/**
 * @jest-environment node
 *
 * Every `_reusable-*.yml` here is a `workflow_call` body some repo's thin
 * stub calls (chrisgriffin/ops#439; moved here in ops#1683 so a public repo
 * can call it). Pinned here: each body's interface, the shape of the PR loop
 * gate and the sweep dispatch, this repo's own stubs, and the rules every
 * file in `.github/` follows (a timeout on every job, a full commit SHA on
 * every GitHub-owned action). What a body's shell does is pinned beside it in
 * the other suites.
 */
const { readFileSync, readdirSync } = require("fs")
const { join } = require("path")
const yaml = require("js-yaml")

const ROOT = join(__dirname, "..")
const WORKFLOWS = join(ROOT, ".github", "workflows")
const ACTIONS = join(ROOT, ".github", "actions")
const read = name => readFileSync(join(WORKFLOWS, name), "utf8")
const load = name => yaml.load(read(name))
const action = name =>
  yaml.load(readFileSync(join(ACTIONS, name, "action.yml"), "utf8"))

const BODIES = [
  "_reusable-claude-mention.yml",
  "_reusable-create-github-release.yml",
  "_reusable-evaluator-gate.yml",
  "_reusable-merge-sweep.yml",
  "_reusable-node-ci.yml",
  "_reusable-release-pr.yml",
  "_reusable-sync-main-to-develop.yml",
]
const FILES = readdirSync(WORKFLOWS)
  .filter(f => f.endsWith(".yml"))
  .sort()

describe("every _reusable-*.yml is a workflow_call body", () => {
  it("the list is the directory, so a new body is covered the day it lands", () => {
    expect(FILES.filter(f => f.startsWith("_reusable-"))).toEqual(BODIES)
  })

  test.each(BODIES)("%s triggers on workflow_call only", name => {
    expect(Object.keys(load(name).on)).toEqual(["workflow_call"])
  })

  // The caller passes what the body needs by name (ops#1685): a body that
  // declares nothing leaves `secrets: inherit` as the only way to call it,
  // which hands every secret of a public repo to a workflow in another one.
  test.each(BODIES)("%s declares its secrets by name", name => {
    const secrets = load(name).on.workflow_call.secrets
    expect(Object.keys(secrets || {}).length).toBeGreaterThan(0)
    for (const [key, spec] of Object.entries(secrets)) {
      expect(key).toMatch(/^[A-Z_]+$/)
      expect(typeof spec.description).toBe("string")
    }
  })

  // A public caller cannot `uses:` a private repo's workflow or action
  // (ops#440): the gate script is cloned with a token instead.
  test.each(FILES)("%s names nothing under chrisgriffin/ops/.github", name => {
    expect(read(name)).not.toContain("chrisgriffin/ops/.github")
  })

  it("_reusable-claude-mention.yml declares a required `target` input", () => {
    const inputs = load("_reusable-claude-mention.yml").on.workflow_call.inputs
    expect(inputs.target).toMatchObject({ required: true, type: "string" })
  })
})

// ops#1164 — one gate job is the loop's only dispatcher: no draft toggle, no
// label, no Slack post. It runs the gate script through the pr-loop-gate
// action, which clones chrisgriffin/ops for it (ADR-017 there).
describe("_reusable-evaluator-gate.yml — one job running the gate action", () => {
  const gate = load("_reusable-evaluator-gate.yml")

  it("one job, one step: the pr-loop-gate action at develop, with both fire tokens, the token that reads the script, and the user token that resolves a thread", () => {
    expect(Object.keys(gate.jobs)).toEqual(["gate"])
    expect(gate.jobs.gate.steps).toHaveLength(1)
    const [step] = gate.jobs.gate.steps
    expect(step.uses).toBe(
      "chrisgriffin/workflows/.github/actions/pr-loop-gate@develop",
    )
    expect(step.with).toEqual({
      "github-token": "${{ github.token }}",
      "evaluator-fire-token": "${{ secrets.EVALUATOR_FIRE_TOKEN }}",
      "autofix-fire-token": "${{ secrets.AUTOFIX_FIRE_TOKEN }}",
      // Only ops reads the script with TARGET_TOKEN: a target missing
      // OPS_GH_TOKEN gets the red job that names it.
      "ops-token":
        "${{ secrets.OPS_GH_TOKEN || (github.repository == 'chrisgriffin/ops' && secrets.TARGET_TOKEN || '') }}",
      // ops#1919: only a user token may resolve a review thread.
      "target-token": "${{ secrets.TARGET_TOKEN }}",
    })
  })

  it("a pull request runs it only from a branch of the same repo, never a release head", () => {
    // A fork PR runs with no secrets and a read-only token: skipped, the
    // check-run completes and the `Evaluator` status is simply never posted.
    // A release head never wakes the gate (ops#1372): the Release PR job
    // posts that status itself.
    expect(gate.jobs.gate.if).toMatch(
      /github\.event_name == 'pull_request' &&\s*github\.event\.pull_request\.head\.repo\.full_name == github\.repository &&\s*!startsWith\(github\.event\.pull_request\.head\.ref, 'release\/'\)/,
    )
  })

  it("a comment runs it only for a loop comment from a routine, or an owner's /autofix", () => {
    const cond = gate.jobs.gate.if
    expect(cond).toContain(
      "contains(github.event.comment.body, '<!-- pr-loop ')",
    )
    expect(cond).toContain("github.event.sender.login == 'claude[bot]'")
    expect(cond).toContain("github.event.comment.author_association == 'OWNER'")
    expect(cond).toContain(
      "!startsWith(github.event.comment.body, '/autofix:')",
    )
  })

  it("no draft toggle, no label, no Slack; the user token reaches only the gate's target-token input", () => {
    const text = read("_reusable-evaluator-gate.yml")
    expect(text).not.toMatch(
      /convertPullRequestToDraft|markPullRequestReadyForReview/,
    )
    // The owner's RELEASE_PR_TOKEN never reaches the gate (workflows#21).
    expect(text).not.toMatch(/SLACK_|RELEASE_PR_TOKEN|labels\/autofix/)
    // ops#1919: the gate replies on inline finding threads and resolves them
    // with a user token, since the Actions token may not resolve a thread
    // (ops#1914). Those writes are review-comment and GraphQL events, which
    // start no gate run, so the loop still cannot trigger itself. The
    // token goes nowhere else: no step of its own, no other env.
    expect(text).toMatch(/target-token: \$\{\{ secrets\.TARGET_TOKEN \}\}/)
    // ops's TARGET_TOKEN stands in for both: once in ops-token, once in
    // target-token, and nowhere else.
    const targetUses = text.match(/secrets\.TARGET_TOKEN\b/g) || []
    expect(targetUses).toHaveLength(2)
    expect(text).toContain(
      "ops-token: ${{ secrets.OPS_GH_TOKEN || (github.repository == 'chrisgriffin/ops' && secrets.TARGET_TOKEN || '') }}",
    )
    expect(FILES).not.toContain("_reusable-evaluator-autofix.yml")
  })

  it("grants exactly what the gate writes, and every caller's ceiling must cover it", () => {
    expect(gate.permissions).toEqual({
      contents: "read",
      issues: "write",
      "pull-requests": "write",
      statuses: "write",
    })
  })
})

describe("the pr-loop-gate action — the gate script keeps its one home in chrisgriffin/ops", () => {
  const a = action("pr-loop-gate")
  const steps = a.runs.steps

  it("is composite, and requires the token that reads the script", () => {
    expect(a.runs.using).toBe("composite")
    expect(a.inputs["ops-token"].required).toBe(true)
    const guard = steps.find(s => (s.run || "").includes("OPS_TOKEN"))
    expect(guard.env.OPS_TOKEN).toBe("${{ inputs.ops-token }}")
    expect(guard.run).toContain("exit 1")
  })

  it("clones chrisgriffin/ops at develop with that token, nothing persisted, and never the caller's tree", () => {
    const checkouts = steps.filter(s =>
      (s.uses || "").startsWith("actions/checkout@"),
    )
    expect(checkouts).toHaveLength(1)
    expect(checkouts[0].with).toMatchObject({
      repository: "chrisgriffin/ops",
      ref: "develop",
      token: "${{ inputs.ops-token }}",
      path: ".pr-loop-gate",
      "persist-credentials": false,
    })
  })

  it("runs the script from that checkout with the caller's token, both fire tokens and the optional user token in its environment", () => {
    const run = steps.find(s => (s.run || "").includes("gate.mjs"))
    expect(run.run.trim()).toBe("node .pr-loop-gate/pr-loop/gate.mjs")
    expect(run.env).toEqual({
      GITHUB_TOKEN: "${{ inputs.github-token }}",
      EVALUATOR_FIRE_TOKEN: "${{ inputs.evaluator-fire-token }}",
      AUTOFIX_FIRE_TOKEN: "${{ inputs.autofix-fire-token }}",
      TARGET_TOKEN: "${{ inputs.target-token }}",
    })
    expect(a.inputs["target-token"].required).toBe(false)
  })
})

// ops#1268 — a merge into a repo's base dispatches ops's conflict sweep at
// once; the 20-minute cron is the backstop. The call lives once, in the
// composite action (ops#1372): the Release PR body runs it on a push, and the
// merge-sweep body runs it for a repo with no Release PR.
describe("the sweep dispatch", () => {
  it("the dispatch-sweep composite runs stale-grade-sweep.yml on chrisgriffin/ops with its token", () => {
    const a = action("dispatch-sweep")
    expect(a.runs.using).toBe("composite")
    const step = a.runs.steps.find(s => s.run?.includes("gh workflow run"))
    expect(step.run).toMatch(
      /gh workflow run stale-grade-sweep\.yml[\s\\]+--repo chrisgriffin\/ops[\s\\]+--ref develop/,
    )
    expect(step.env.GH_TOKEN).toBe("${{ inputs.token }}")
  })

  it("_reusable-merge-sweep.yml is one job that uses the composite with the dispatch token", () => {
    const wf = load("_reusable-merge-sweep.yml")
    const jobs = Object.values(wf.jobs)
    expect(jobs).toHaveLength(1)
    const step = jobs[0].steps.find(s => s.uses?.includes("dispatch-sweep"))
    expect(step.uses).toBe(
      "chrisgriffin/workflows/.github/actions/dispatch-sweep@develop",
    )
    expect(step.with.token).toBe(
      "${{ secrets.OPS_GH_TOKEN || secrets.TARGET_TOKEN }}",
    )
  })
})

describe("this repo's own stubs call the bodies here at develop (README § Versions)", () => {
  test.each([
    ["evaluator-gate.yml", "_reusable-evaluator-gate.yml"],
    ["claude-mention.yml", "_reusable-claude-mention.yml"],
    ["release-pr.yml", "_reusable-release-pr.yml"],
    ["create-github-release.yml", "_reusable-create-github-release.yml"],
    ["sync-main-to-develop.yml", "_reusable-sync-main-to-develop.yml"],
  ])(
    "%s uses chrisgriffin/workflows/.github/workflows/%s@develop",
    (stub, body) => {
      const jobs = Object.values(load(stub).jobs)
      expect(jobs).toHaveLength(1)
      expect(jobs[0].uses).toBe(
        `chrisgriffin/workflows/.github/workflows/${body}@develop`,
      )
    },
  )

  it("create-github-release.yml moves the floating major tag, the thing a caller's @v1 resolves", () => {
    expect(load("create-github-release.yml").jobs.release.with).toMatchObject({
      floating_major_tag: true,
    })
  })

  // A plain job's check-run is the job name alone, never `<workflow> / <job>`;
  // only a `uses:` call reports as `<caller> / <callee>`. The ruleset requires
  // `build / ci`, so the job carries that as its `name:`; without it every PR
  // into develop stayed BLOCKED after CI and the Evaluator passed.
  it("build-check.yml's plain job is named `build / ci`, the check the ruleset requires", () => {
    const wf = load("build-check.yml")
    expect(Object.keys(wf.jobs)).toEqual(["ci"])
    expect(wf.jobs.ci.name).toBe("build / ci")
    expect(wf.jobs.ci["runs-on"]).toBeDefined()
  })
})

// Every body's checkout persists no credential (ops#1685), so git holds no
// token: a fetch or push that does not carry its own header asks for a
// username, and on a private caller dies with exit 128 (ops#1702). A public
// caller's anonymous fetch succeeds, which is how the release PR's fetch
// passed this repo's own run and failed every private target's.
describe("every git call that reaches the remote carries its own credential", () => {
  const calls = BODIES.flatMap(file =>
    Object.values(load(file).jobs)
      .flatMap(job => job.steps || [])
      .flatMap(s => (s.run || "").split("\n"))
      .filter(l => !l.trim().startsWith("#"))
      .filter(l => /\bgit\b.*\b(fetch|push|pull|ls-remote|clone)\b/.test(l))
      .map(l => [`${file}: ${l.trim()}`, l]),
  )

  it("finds the git calls", () => {
    expect(calls.length).toBeGreaterThan(3)
  })

  test.each(calls)("%s", (_, line) => {
    expect(line).toContain('-c "http.extraheader=AUTHORIZATION: basic $AUTH"')
  })
})

// A job with no `timeout-minutes` inherits GitHub's six-hour default; one
// hung release step billed 1,824 minutes in a 48-hour window before ops#450.
// `uses:` jobs are exempt because GitHub rejects the key on them.
describe("every runs-on job declares timeout-minutes (ops#450)", () => {
  const jobs = FILES.flatMap(file =>
    Object.entries(load(file).jobs || {})
      .filter(([, job]) => job["runs-on"])
      .map(([name, job]) => [`${file} › ${name}`, job]),
  )

  it("finds the runs-on jobs", () => {
    expect(jobs.length).toBeGreaterThan(5)
  })

  test.each(jobs)("%s", (_, job) => {
    expect(typeof job["timeout-minutes"]).toBe("number")
  })
})

// ops#1685 — every GitHub-owned action is pinned to a full commit SHA, with
// the version it is in a trailing comment so a bump reads as one.
describe("every GitHub-owned action is pinned to a full commit SHA", () => {
  const lines = [
    ...FILES.map(f => [`.github/workflows/${f}`, read(f)]),
    ...readdirSync(ACTIONS).map(a => [
      `.github/actions/${a}/action.yml`,
      readFileSync(join(ACTIONS, a, "action.yml"), "utf8"),
    ]),
  ].flatMap(([file, text]) =>
    text
      .split("\n")
      .filter(l => /^\s*-?\s*uses:\s*(actions|github)\//.test(l))
      .map(l => [`${file}: ${l.trim()}`, l.trim()]),
  )

  it("finds the uses lines", () => {
    expect(lines.length).toBeGreaterThan(5)
  })

  test.each(lines)("%s", (_, line) => {
    expect(line).toMatch(/@[0-9a-f]{40} # v\d+\.\d+\.\d+$/)
  })
})
