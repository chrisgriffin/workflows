/**
 * @jest-environment node
 *
 * `_reusable-node-ci.yml` — every target's CI gate. Its per-repo parts are
 * inputs (`claude_md_budget`, `docs_owed`, `docs_only_paths`), and three of
 * its steps are shell that decides something: the scope step (docs-only or
 * the full gate, ops#976), the CLAUDE.md budget (ops#1045, ops#1286) and the
 * docs/ standard check (ops#1074, ops#1088). Each runs here, as the runner
 * would run it, against trees built in tmp.
 */
const {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require("fs")
const { execFileSync, spawnSync } = require("child_process")
const { tmpdir } = require("os")
const { dirname, join } = require("path")
const yaml = require("js-yaml")

const WORKFLOW = join(
  __dirname,
  "..",
  ".github",
  "workflows",
  "_reusable-node-ci.yml",
)
const doc = yaml.load(readFileSync(WORKFLOW, "utf8"))
const steps = doc.jobs.ci.steps
const stepNamed = name => steps.find(s => s.name === name)

const tmps = []
const tmp = prefix => {
  const d = mkdtempSync(join(tmpdir(), prefix))
  tmps.push(d)
  return d
}
afterAll(() => tmps.forEach(d => rmSync(d, { recursive: true, force: true })))

/** Run a step's own `run:` under `bash -e`, the shell Actions gives a bare run. */
function sh(step, cwd, env) {
  const r = spawnSync("bash", ["-e", "-c", step.run], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  })
  return { code: r.status, out: `${r.stdout}${r.stderr}` }
}

describe("the inputs that replaced the per-repo tables", () => {
  const inputs = doc.on.workflow_call.inputs

  test.each(["claude_md_budget", "docs_owed", "docs_only_paths"])(
    "%s is an optional string input whose empty default skips its check",
    name => {
      expect(inputs[name]).toMatchObject({
        required: false,
        type: "string",
        default: "",
      })
    },
  )

  it("no step keys anything on github.repository: a repo's facts come from its stub", () => {
    for (const s of steps) expect(s.run || "").not.toMatch(/case "\$REPO"/)
  })

  it("NODE_AUTH_TOKEN is the one declared secret, optional", () => {
    expect(Object.keys(doc.on.workflow_call.secrets)).toEqual([
      "NODE_AUTH_TOKEN",
    ])
    expect(doc.on.workflow_call.secrets.NODE_AUTH_TOKEN.required).toBe(false)
  })
})

// ops#1434 — a ready release PR is verified on every event; a draft one is
// skipped whatever skip_draft says, inside the callee (the one sanctioned
// callee-only guard, build.md § Reusable workflows item 6).
describe("the ci job's guard", () => {
  const guard = doc.jobs.ci.if

  it("skips a draft release PR whatever skip_draft says", () => {
    expect(guard).toContain(
      "github.event.pull_request.head.ref != 'release/next'",
    )
    expect(guard).toContain("github.event.pull_request.draft == false")
  })

  it("no longer skips synchronize on a ready release PR", () => {
    expect(guard).not.toContain("github.event.action == 'synchronize'")
  })

  it("keeps the draft skip it already had", () => {
    expect(guard).toContain("inputs.skip_draft != true")
  })
})

// ops#528 — a called workflow's `permissions:` block SETS the effective
// permissions within the caller's ceiling; it narrows, it does not merge. A
// CI body declaring only `contents: read` silently DISCARDS the
// `packages: read` a caller grants for a private package, and `npm ci` 403s.
// The caller end is pinned in each target's own suite.
describe("the ci job keeps the permissions its callers grant (ops#528)", () => {
  it("grants packages: read, or a private install cannot resolve", () => {
    expect(doc.jobs.ci.permissions).toMatchObject({
      contents: "read",
      packages: "read",
    })
  })

  it("its stated permissions stay a narrow allowlist, not write-all", () => {
    // The block exists because this job runs caller-supplied shell.
    const perms = doc.jobs.ci.permissions
    expect(typeof perms).toBe("object")
    for (const scope of Object.values(perms)) expect(scope).toBe("read")
  })
})

// ---------------------------------------------------------------------------
// ops#976 — the scope step: docs-only when every changed file matches one of
// the caller's `docs_only_paths` globs, decided against a real merge commit
// (the shape actions/checkout hands a pull_request run, first parent the
// base). Anything it cannot prove docs-only runs the gate.
// ---------------------------------------------------------------------------
describe("the scope step (ops#976)", () => {
  const scope = steps.find(s => s.id === "scope")

  function git(cwd, ...args) {
    const r = spawnSync("git", args, { cwd, encoding: "utf8" })
    if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`)
    return r.stdout
  }
  function write(cwd, file) {
    mkdirSync(dirname(join(cwd, file)), { recursive: true })
    writeFileSync(join(cwd, file), `${file} ${Math.random()}\n`)
  }
  // A repo whose HEAD is a merge of a PR branch touching `files` into main,
  // or, with `merge: false`, a single commit (no HEAD^1: the diff must fail).
  function repo(files, { merge = true } = {}) {
    const cwd = tmp("node-ci-scope-")
    git(cwd, "init", "-q", "-b", "main")
    git(cwd, "config", "user.email", "t@example.com")
    git(cwd, "config", "user.name", "t")
    write(cwd, "README.md")
    write(cwd, "src/app.js")
    write(cwd, "docs/old.md")
    git(cwd, "add", "-A")
    git(cwd, "commit", "-qm", "base")
    if (!merge) return cwd
    git(cwd, "switch", "-qc", "pr")
    for (const f of files) {
      if (f.startsWith("-")) git(cwd, "rm", "-q", f.slice(1))
      else write(cwd, f)
    }
    git(cwd, "add", "-A")
    git(cwd, "commit", "-qm", "pr")
    git(cwd, "switch", "-q", "main")
    write(cwd, "src/other.js") // the base moved on: a true merge, not a fast-forward
    git(cwd, "add", "-A")
    git(cwd, "commit", "-qm", "base moves")
    git(cwd, "merge", "-q", "--no-ff", "--no-edit", "pr")
    return cwd
  }
  const SITE = "docs/** README.md .claude/** .github/CODEOWNERS"
  function decide(cwd, { event = "pull_request", paths = SITE } = {}) {
    const out = join(cwd, ".gh-output")
    writeFileSync(out, "")
    const r = sh(scope, cwd, {
      EVENT: event,
      DOCS_ONLY_PATHS: paths,
      GITHUB_OUTPUT: out,
    })
    expect(r.code).toBe(0)
    return readFileSync(out, "utf8").trim()
  }

  test("every changed file matches → docs_only=true", () => {
    expect(
      decide(repo(["docs/new.md", "docs/deep/nested/x.png", "README.md"])),
    ).toBe("docs_only=true")
  })

  test("a deleted doc still counts as a doc", () => {
    expect(decide(repo(["-docs/old.md"]))).toBe("docs_only=true")
  })

  test("agent config and CODEOWNERS count only where the caller lists them", () => {
    const files = [".claude/settings.json", ".github/CODEOWNERS"]
    expect(decide(repo(files))).toBe("docs_only=true")
    // A repo whose tests read its CODEOWNERS leaves it off the list.
    expect(decide(repo(files), { paths: "docs/** .claude/**" })).toBe(
      "docs_only=false",
    )
  })

  test("one file outside the list → the full gate", () => {
    expect(decide(repo(["docs/new.md", "src/app.js"]))).toBe("docs_only=false")
  })

  test("each caller gets only its own list — README.md counts only when listed", () => {
    expect(decide(repo(["README.md"]), { paths: "docs/**" })).toBe(
      "docs_only=false",
    )
    expect(decide(repo(["docs/a.md"]), { paths: "docs/**" })).toBe(
      "docs_only=true",
    )
  })

  test("a push always runs the full gate", () => {
    expect(decide(repo(["docs/new.md"]), { event: "push" })).toBe(
      "docs_only=false",
    )
  })

  test("a caller passing no paths → the full gate", () => {
    expect(decide(repo(["docs/new.md"]), { paths: "" })).toBe("docs_only=false")
  })

  test("a diff that cannot be computed → the full gate", () => {
    expect(decide(repo([], { merge: false }))).toBe("docs_only=false")
  })

  describe("the wiring around it", () => {
    test("checkout fetches the merge commit's parents so HEAD^1 exists, and persists no credential", () => {
      const checkout = steps.find(s =>
        String(s.uses).startsWith("actions/checkout"),
      )
      expect(checkout.with["fetch-depth"]).toBe(2)
      expect(checkout.with["persist-credentials"]).toBe(false)
    })

    test("the step reads the event and the globs from env, not inline", () => {
      expect(scope.env.EVENT).toBe("${{ github.event_name }}")
      expect(scope.env.DOCS_ONLY_PATHS).toBe("${{ inputs.docs_only_paths }}")
      expect(scope.run).not.toContain("${{")
    })

    test("the repo's gate is skipped only on docs_only=true", () => {
      const gate = steps.find(s => s.run === "${{ inputs.run }}")
      expect(gate.if).toBe("steps.scope.outputs.docs_only != 'true'")
    })
  })
})

// ---------------------------------------------------------------------------
// ops#1045 — the CLAUDE.md byte budget, a ratchet; ops#1286 — a CLAUDE.md
// that restates a rule whose one home is the fleet's shared docs fails too.
// ---------------------------------------------------------------------------
describe("the Budget CLAUDE.md step", () => {
  const step = stepNamed("Budget CLAUDE.md")

  function run(budget, claudeMd) {
    const dir = tmp("claude-md-budget-")
    if (claudeMd !== null) writeFileSync(join(dir, "CLAUDE.md"), claudeMd)
    return sh(step, dir, { BUDGET: budget })
  }

  it("reads the budget from the input, and runs before install whatever the scope decided", () => {
    expect(step.env.BUDGET).toBe("${{ inputs.claude_md_budget }}")
    expect(step.if).toBeUndefined()
    expect(steps.indexOf(step)).toBeLessThan(
      steps.indexOf(stepNamed("Install dependencies")),
    )
  })

  it("passes a file inside its budget", () => {
    const r = run("2000", "# short\n")
    expect(r.code).toBe(0)
    expect(r.out).toMatch(/\/2000 bytes/)
  })

  it("fails a file over its budget, naming the size and the overage", () => {
    const r = run("2000", "x".repeat(2400) + "\n")
    expect(r.code).toBe(1)
    expect(r.out).toContain("::error")
    expect(r.out).toMatch(/2401 bytes, 401 over its 2000-byte budget/)
  })

  it("fails a line over the cap, naming the line number", () => {
    const r = run("2000", `ok\n${"x".repeat(401)}\n`)
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/lines over 400 chars: 2/)
  })

  // Prettier pads table rows; a wide row is a table, not a buried rule.
  it("ignores a wide markdown table row", () => {
    expect(run("2000", `| ${"x".repeat(401)} |\n`).code).toBe(0)
  })

  it("fails a restated fleet rule, naming the rule and its home (ops#1286)", () => {
    const r = run("2000", "# Rules\n\nCommits are Conventional Commits.\n")
    expect(r.code).toBe(1)
    expect(r.out).toMatch(
      /::error file=CLAUDE\.md::restates "commits are Conventional Commits", whose one home is chrisgriffin\/ops shared\/agents\/conventions\.md/,
    )
  })

  it("skips, green and saying so, when the caller passes no budget", () => {
    const r = run("", "x".repeat(50000))
    expect(r.code).toBe(0)
    expect(r.out).toContain("No claude_md_budget passed")
  })

  it("fails a budget that is not a number", () => {
    const r = run("lots", "# short\n")
    expect(r.code).toBe(1)
    expect(r.out).toMatch(
      /claude_md_budget must be a number of bytes, got 'lots'/,
    )
  })

  it("skips a checkout with no CLAUDE.md", () => {
    expect(run("2000", null).code).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// ops#1074 — the docs/ standard. The templates live in the operator's
// shared docs; this step carries their manifest inline (a called workflow
// cannot read another repo) and holds each doc the caller owes to it. The
// templates' words stay in the operator, so every tree here is built from
// the manifest's shape alone (title, block order), never their text.
// ---------------------------------------------------------------------------
describe("the Check docs/ step", () => {
  const step = stepNamed("Check docs/")
  const MANIFEST = JSON.parse(step.run.match(/^\s*const MANIFEST = (.*)$/m)[1])
  const WIRE = MANIFEST["pr-form"].wire

  const write = (dir, rel, text) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), text)
  }
  /** A checkout holding `files` ({ path: text }). */
  function tree(files = {}) {
    const dir = tmp("docs-standard-")
    for (const [rel, text] of Object.entries(files)) write(dir, rel, text)
    return dir
  }
  function check(dir, owed = "", extra = {}) {
    return sh(step, dir, { EVENT: "", OWED: owed, ...extra })
  }
  /** docs/<name>.md in the template's shape: its title, then its blocks. */
  function templated(name, fleetBody = "the template's words") {
    const t = MANIFEST[name]
    const blocks = t.blocks.map(
      ([kind, id]) =>
        `<!-- ${kind}:${id} -->\n${kind === "fleet" ? fleetBody : "Filled in."}\n<!-- /${kind}:${id} -->`,
    )
    return `${t.title}\n\n${blocks.join("\n\n")}\n`
  }
  const wired = JSON.stringify({
    hooks: {
      PreToolUse: [
        { matcher: "Bash", hooks: [{ type: "command", command: WIRE }] },
      ],
    },
  })
  const ADR = `---
status: proposed
date: 2026-09-22
---

# ADR-001: Do it

## Context

Why.

## Decision

What.

## Consequences

So.
`

  it("reads what the caller owes from the input", () => {
    expect(step.env.OWED).toBe("${{ inputs.docs_owed }}")
    expect(step.env.EVENT).toBe("${{ github.event_name }}")
  })

  it("the manifest names the five templates a caller may owe, each with its path, title and blocks", () => {
    expect(Object.keys(MANIFEST).sort()).toEqual([
      "adr-index",
      "architecture",
      "pr-form",
      "releasing",
      "testing",
    ])
    for (const name of ["adr-index", "architecture", "releasing", "testing"]) {
      const t = MANIFEST[name]
      expect(t.path).toMatch(/^docs\/.*\.md$/)
      expect(t.title).toMatch(/^# /)
      expect(t.skeleton).toMatch(/^[0-9a-f]{64}$/)
      for (const b of t.blocks) {
        expect(["fleet", "slot"]).toContain(b[0])
        if (b[0] === "fleet") expect(b[2]).toMatch(/^[0-9a-f]{64}$/)
      }
    }
    expect(WIRE).toMatch(
      /gh api "repos\/chrisgriffin\/ops\/contents\/plugins\/harness\/hooks\/pr-form\.mjs\?ref=develop"/,
    )
  })

  it("rejects a docs_owed entry that is not a fleet template", () => {
    const r = check(tree(), "architecture roadmap")
    expect(r.code).toBe(1)
    expect(r.out).toMatch(
      /docs_owed names 'roadmap', which is not a fleet doc template/,
    )
  })

  it("passes a caller that owes nothing and has no docs/", () => {
    const r = check(tree())
    expect(r.out).not.toContain("::error")
    expect(r.code).toBe(0)
    expect(r.out).toContain("owes: nothing templated")
  })

  // The template's own words are the operator's (its shared docs); this
  // repo holds only their hashes. The operator's suite lays real templates
  // and proves a conforming tree passes; what is pinned here is each way a
  // doc can differ from its template and what the step says about it.
  const cases = [
    [
      "a missing owed doc",
      {},
      "testing",
      "docs/testing.md",
      /missing — this repo owes docs\/testing\.md/,
    ],
    [
      "a doc whose first line is not the template title",
      { "docs/testing.md": "# Tests\n\nWords.\n" },
      "testing",
      "docs/testing.md",
      /the first line must be the template title `# Testing`/,
    ],
    [
      "a doc with the template's blocks missing",
      { "docs/testing.md": "# Testing\n\nWords.\n" },
      "testing",
      "docs/testing.md",
      /blocks are \[\], the template's are \[slot:summary fleet:gate/,
    ],
    [
      "a fixed block whose words differ from the template",
      { "docs/testing.md": templated("testing", "Someone's own words.") },
      "testing",
      "docs/testing.md",
      /fixed block fleet:gate differs from the fleet template/,
    ],
    [
      "a slot still holding its prompt",
      {
        "docs/testing.md": templated("testing").replace(
          "<!-- slot:adding -->\nFilled in.",
          "<!-- slot:adding -->\nTODO(slot): say how a test is added",
        ),
      },
      "testing",
      "docs/testing.md",
      /slot:adding is not filled/,
    ],
    [
      "an unsorted block the docs sync could not place",
      {
        "docs/testing.md":
          templated("testing") +
          "\n<!-- unsorted -->\n\nAn old paragraph.\n\n<!-- /unsorted -->\n",
      },
      "testing",
      "docs/testing.md",
      /an unsorted block/,
    ],
    [
      "the hook not wired in settings",
      { ".claude/settings.json": JSON.stringify({ hooks: {} }) },
      "pr-form",
      ".claude/settings.json",
      /does not run ops's plugins\/harness\/hooks\/pr-form\.mjs from develop/,
    ],
    [
      "a vendored hook copy still present",
      {
        ".claude/settings.json": wired,
        ".claude/hooks/pr-form.mjs": "// the old copy\n",
      },
      "pr-form",
      ".claude/hooks/pr-form.mjs",
      /vendored copy/,
    ],
    [
      "a dated file under docs/",
      { "docs/report-2026-01-01.md": "# Report\n" },
      "",
      "docs/report-2026-01-01.md",
      /dated file/,
    ],
    [
      "an upper-case filename",
      { "docs/NOTES.md": "# Notes\n\nWhat it is for.\n" },
      "",
      "docs/NOTES.md",
      /lower-case/,
    ],
    [
      "a provenance line",
      {
        "docs/design.md":
          "# Design\n\nWhat it is for.\n\nMoved here in #546.\n",
      },
      "",
      "docs/design.md",
      /provenance/,
    ],
    [
      "a second title",
      { "docs/design.md": "# Design\n\nOne.\n\n# Again\n" },
      "",
      "docs/design.md",
      /exactly one/,
    ],
    [
      "a doc with no title",
      { "docs/design.md": "Just words.\n" },
      "",
      "docs/design.md",
      /opens with its one `# ` title/,
    ],
    [
      "an ADR named off the pattern",
      { "docs/adr/first-decision.md": ADR },
      "",
      "docs/adr/first-decision.md",
      /ADR-NNN-<kebab-slug>\.md/,
    ],
    [
      "an ADR with no frontmatter",
      { "docs/adr/ADR-001-do-it.md": ADR.replace(/^---[\s\S]*?---\n\n/, "") },
      "",
      "docs/adr/ADR-001-do-it.md",
      /frontmatter/,
    ],
    [
      "an ADR whose title number is not its filename's",
      { "docs/adr/ADR-001-do-it.md": ADR.replace("# ADR-001:", "# ADR-002:") },
      "",
      "docs/adr/ADR-001-do-it.md",
      /ADR-001: <title>/,
    ],
    [
      "an ADR without ## Consequences",
      {
        "docs/adr/ADR-001-do-it.md": ADR.replace(
          "## Consequences",
          "## Afterwards",
        ),
      },
      "",
      "docs/adr/ADR-001-do-it.md",
      /## Consequences/,
    ],
    [
      "a superseded ADR naming no successor",
      {
        "docs/adr/ADR-001-do-it.md": ADR.replace(
          "status: proposed",
          "status: superseded",
        ),
      },
      "",
      "docs/adr/ADR-001-do-it.md",
      /superseded-by/,
    ],
  ]

  it.each(cases)(
    "fails on %s, naming the file",
    (_, files, owed, file, why) => {
      const r = check(tree(files), owed)
      expect(r.code).toBe(1)
      const lines = r.out.split("\n").filter(l => l.includes(`file=${file}::`))
      expect(lines.length).toBeGreaterThan(0)
      expect(lines.some(l => why.test(l))).toBe(true)
    },
  )

  it("passes a filled templated doc, a wired hook and a well-formed ADR", () => {
    const r = check(
      tree({
        "docs/testing.md": templated("testing"),
        ".claude/settings.json": wired,
        "docs/adr/ADR-001-do-it.md": ADR,
        "docs/design.md": "# Design\n\nIt is.\n\n```sh\n# a comment\n```\n",
      }),
      "pr-form",
    )
    // `testing` is not owed here, so its fleet block's words are not held
    // to the template's hash; everything else above is checked and passes.
    expect(r.out).not.toContain("::error")
    expect(r.code).toBe(0)
  })

  it("reports every failure in one run, not the first", () => {
    const r = check(
      tree({ "docs/a-2026-01-01.md": "# A\n", "docs/B.md": "# B\n" }),
    )
    expect(r.out.match(/::error/g)).toHaveLength(2)
  })

  // ops#1088: docs/architecture.md is living documentation. A PR that adds,
  // removes or renames a directory changes what that doc describes, so it
  // changes the doc too. Pull requests only; a caller that owes it. The
  // doc itself is held to its template, whose words the operator has, so
  // the green path is proven there; what is pinned here is the structure
  // finding and when it fires.
  describe("the structure check (ops#1088)", () => {
    const STRUCTURE =
      /file=docs\/architecture\.md::this PR changes the directory structure/
    const git = (dir, ...args) =>
      execFileSync(
        "git",
        ["-c", "user.name=t", "-c", "user.email=t@t", ...args],
        { cwd: dir, encoding: "utf8" },
      )
    /** One base commit holding src/ and docs/architecture.md; `change` makes the PR commit. */
    function pr(
      change,
      { owed = "architecture", event = "pull_request" } = {},
    ) {
      const dir = tree({
        "src/index.js": "export {}\n",
        "docs/architecture.md": templated("architecture"),
      })
      git(dir, "init", "-q")
      git(dir, "add", "-A")
      git(dir, "commit", "-qm", "base")
      change(dir)
      git(dir, "add", "-A")
      git(dir, "commit", "-qm", "pr")
      return check(dir, owed, { EVENT: event })
    }
    const touchDoc = dir => {
      const p = join(dir, "docs/architecture.md")
      writeFileSync(
        p,
        readFileSync(p, "utf8").replace("Filled in.", "Filled in, updated."),
      )
    }

    it("names an added directory when docs/architecture.md is untouched", () => {
      const r = pr(dir => write(dir, "src/new-part/a.js", "export {}\n"))
      expect(r.out).toMatch(STRUCTURE)
      expect(r.out).toMatch(/added: src\/new-part/)
    })

    it("names a removed directory", () => {
      const r = pr(dir => rmSync(join(dir, "src"), { recursive: true }))
      expect(r.out).toMatch(/removed: src/)
    })

    it("stays quiet when docs/architecture.md changes too", () => {
      const r = pr(dir => {
        write(dir, "src/new-part/a.js", "export {}\n")
        touchDoc(dir)
      })
      expect(r.out).not.toMatch(STRUCTURE)
    })

    it("ignores test, fixture, docs, specs, public and dot directories", () => {
      const r = pr(dir => {
        write(dir, "__tests__/fixtures/x/a.json", "{}\n")
        write(dir, "test/unit/a.test.js", "\n")
        write(dir, "specs/001-x/spec.md", "# Spec\n")
        write(dir, "docs/guides/how.md", "# How\n\nIt is.\n")
        write(dir, "public/images/x/hero.png", "png\n")
        write(dir, ".vscode/settings.json", "{}\n")
      })
      expect(r.out).not.toMatch(STRUCTURE)
    })

    it("stays quiet for a PR that only edits files", () => {
      const r = pr(dir => write(dir, "src/index.js", "export const a = 1\n"))
      expect(r.out).not.toMatch(STRUCTURE)
    })

    it("does not run for a caller that does not owe architecture, or outside a pull_request", () => {
      const add = dir => write(dir, "src/new-part/a.js", "export {}\n")
      expect(pr(add, { owed: "testing" }).out).not.toMatch(STRUCTURE)
      expect(pr(add, { event: "push" }).out).not.toMatch(STRUCTURE)
    })
  })
})
