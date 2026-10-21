/**
 * @jest-environment node
 *
 * `_reusable-sync-main-to-develop.yml` — after every push to main, merge main
 * back into develop. The merge step's shell RUNS here against real git repos
 * in tmp (the spawn-real-git convention): asserting on the YAML's text would
 * only prove the words changed, not that a refused push still produces a PR.
 */
const { execFileSync } = require("child_process")
const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require("fs")
const { tmpdir } = require("os")
const { join } = require("path")
const yaml = require("js-yaml")

const WORKFLOW = join(
  __dirname,
  "..",
  ".github",
  "workflows",
  "_reusable-sync-main-to-develop.yml",
)
const text = readFileSync(WORKFLOW, "utf8")
const doc = yaml.load(text)
const steps = doc.jobs.sync.steps

const dirs = []
const tmp = p => {
  const d = mkdtempSync(join(tmpdir(), p))
  dirs.push(d)
  return d
}
afterAll(() => dirs.forEach(d => rmSync(d, { recursive: true, force: true })))

const git = (cwd, ...a) =>
  execFileSync("git", a, { cwd, encoding: "utf8" }).trim()

// TARGET_TOKEN || RELEASE_PR_TOKEN || GITHUB_TOKEN, not bare TARGET_TOKEN:
// one caller has TARGET_TOKEN, every other has RELEASE_PR_TOKEN (ops#436),
// and both are PATs that a ruleset's bypass list can name. What must never
// come back is GITHUB_TOKEN as the ONLY credential on a push (ops#429).
const FALLBACK =
  "${{ secrets.TARGET_TOKEN || secrets.RELEASE_PR_TOKEN || secrets.GITHUB_TOKEN }}"

describe("the token that pushes", () => {
  it("is declared by name: TARGET_TOKEN and RELEASE_PR_TOKEN, both optional", () => {
    expect(Object.keys(doc.on.workflow_call.secrets).sort()).toEqual([
      "RELEASE_PR_TOKEN",
      "TARGET_TOKEN",
    ])
  })

  it("the checkout, the fetch and the merge step all prefer the PAT chain", () => {
    const checkout = steps.find(s =>
      String(s.uses).startsWith("actions/checkout"),
    )
    expect(checkout.with.token).toBe(FALLBACK)
    expect(steps.find(s => s.id === "check").env.TOKEN).toBe(FALLBACK)
    expect(mergeStep().env.GH_TOKEN).toBe(FALLBACK)
  })

  // ops#1685: no credential persisted into .git/config; each fetch and push
  // authenticates per command, as the release PR's push does.
  it("is never persisted — every fetch and push carries it as a header", () => {
    const checkout = steps.find(s =>
      String(s.uses).startsWith("actions/checkout"),
    )
    expect(checkout.with["persist-credentials"]).toBe(false)
    const commands =
      `${steps.find(s => s.id === "check").run}\n${mergeStep().run}`
        .split("\n")
        .filter(l => !l.trim().startsWith("#"))
    for (const l of commands.filter(l => /git\b.*\b(push|fetch)\b/.test(l))) {
      expect(l).toContain('-c "http.extraheader=AUTHORIZATION: basic $AUTH"')
    }
  })
})

describe("the conflict PR", () => {
  it("requests the owner as reviewer in a separate, soft-failing step", () => {
    // Inline on `gh pr create` it used to fail the whole create when the
    // PAT's actor was the reviewer (GitHub rejects a request from a PR's own
    // author), silently leaving the branch pushed with no PR at all.
    expect(mergeStep().run).toMatch(
      /gh pr edit "\$BRANCH" --add-reviewer chrisgriffin 2>\/dev\/null \|\| true/,
    )
  })
})

/** The `run:` body of the step that merges and pushes. */
function mergeStep() {
  const step = steps.find(s => s.name === "Merge main into develop")
  if (!step) throw new Error("step 'Merge main into develop' not found")
  return step
}

/**
 * A bare origin whose `develop` refuses every push — a ruleset with no bypass
 * actor, reproduced. Other refs (the sync/* branch) are accepted, exactly as
 * on a real repo where only `develop` and `main` are covered.
 */
function makeRepos({ refuseDevelop }) {
  const origin = tmp("sync-origin-")
  git(origin, "init", "-q", "--bare", "-b", "develop")

  const work = tmp("sync-work-")
  git(work, "init", "-q", "-b", "develop")
  git(work, "config", "user.email", "t@t")
  git(work, "config", "user.name", "t")
  writeFileSync(join(work, "package.json"), '{"version":"0.11.0"}\n')
  git(work, "add", "-A")
  git(work, "commit", "-qm", "base")
  git(work, "push", "-q", origin, "develop")

  // main moves ahead, as after a release.
  git(work, "checkout", "-q", "-b", "main")
  writeFileSync(join(work, "package.json"), '{"version":"0.12.0"}\n')
  git(work, "add", "-A")
  git(work, "commit", "-qm", "chore: release v0.12.0")
  git(work, "push", "-q", origin, "main")
  git(work, "checkout", "-q", "develop")

  if (refuseDevelop) {
    const hook = join(origin, "hooks", "pre-receive")
    writeFileSync(
      hook,
      [
        "#!/bin/sh",
        "while read _old _new ref; do",
        '  case "$ref" in',
        "    refs/heads/develop)",
        '      echo "remote: error: GH013: Repository rule violations found for refs/heads/develop." >&2',
        "      exit 1 ;;",
        "  esac",
        "done",
        "exit 0",
      ].join("\n"),
      { mode: 0o755 },
    )
  }

  git(work, "remote", "add", "origin", origin)
  git(work, "fetch", "-q", "origin")
  return { origin, work }
}

/** A `gh` on PATH that records argv instead of calling GitHub. */
function ghShim() {
  const dir = tmp("sync-gh-")
  const log = join(dir, "gh.log")
  writeFileSync(
    join(dir, "gh"),
    ["#!/bin/sh", `printf '%s\\n' "$*" >> "${log}"`, "exit 0"].join("\n"),
    { mode: 0o755 },
  )
  return { dir, log }
}

function runStep({ work, shim }) {
  try {
    const stdout = execFileSync("bash", ["-e", "-c", mergeStep().run], {
      cwd: work,
      encoding: "utf8",
      stdio: "pipe",
      env: {
        ...process.env,
        PATH: `${shim.dir}:${process.env.PATH}`,
        GH_TOKEN: "t",
      },
    })
    return { status: 0, stdout, stderr: "" }
  } catch (err) {
    return {
      status: err.status ?? 1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
    }
  }
}

const ghCalls = log => {
  try {
    return readFileSync(log, "utf8")
  } catch {
    return ""
  }
}

// ops#523 — a push to develop being REFUSED, not just a merge conflicting. A
// ruleset only exempts actors it explicitly names; admin status is not a
// bypass. The clean merge succeeded, the push was rejected, the step died
// under `bash -e`, and `develop` silently stayed a release behind `main`
// until the next release PR proposed a version BELOW the published one.
describe("a refused push to develop opens a PR instead of failing (ops#523)", () => {
  it("pushes directly when the ruleset allows it", () => {
    const { origin, work } = makeRepos({ refuseDevelop: false })
    const shim = ghShim()
    const r = runStep({ work, shim })

    expect(r.status).toBe(0)
    // develop on the origin actually advanced.
    expect(git(origin, "show", "develop:package.json")).toContain("0.12.0")
    // No PR needed.
    expect(ghCalls(shim.log)).not.toContain("pr create")
  })

  it("opens a PR — and does NOT fail the job — when develop refuses the push", () => {
    const { origin, work } = makeRepos({ refuseDevelop: true })
    const shim = ghShim()
    const r = runStep({ work, shim })

    // The whole point: the step must not die under `bash -e`.
    expect(r.status).toBe(0)

    // A sync branch reached the origin, carrying the merge.
    const branches = git(
      origin,
      "for-each-ref",
      "--format=%(refname:strip=2)",
      "refs/heads",
    ).split("\n")
    const sync = branches.find(b => b.startsWith("sync/main-to-develop-"))
    expect(sync).toBeDefined()
    expect(git(origin, "show", `${sync}:package.json`)).toContain("0.12.0")

    // And a PR was opened against develop.
    const calls = ghCalls(shim.log)
    expect(calls).toContain("pr create")
    expect(calls).toContain("--base develop")

    // develop itself is untouched — the refusal held.
    expect(git(origin, "show", "develop:package.json")).toContain("0.11.0")
  })

  it("the PR says the merge is clean, so a reviewer does not hunt for conflict markers", () => {
    const { work } = makeRepos({ refuseDevelop: true })
    const shim = ghShim()
    expect(runStep({ work, shim }).status).toBe(0)

    const calls = ghCalls(shim.log)
    expect(calls).toMatch(/clean/i)
    // The conflict PR's wording must NOT be reused here — it tells the
    // reviewer to resolve markers that do not exist.
    expect(calls).not.toMatch(/conflict markers still in it/i)
  })

  it("warns in the log, so the cause is visible in the run", () => {
    const { work } = makeRepos({ refuseDevelop: true })
    const shim = ghShim()
    const r = runStep({ work, shim })
    expect(r.stdout + r.stderr).toContain("::warning::")
    expect(r.stdout + r.stderr).toMatch(/refused/i)
  })
})
