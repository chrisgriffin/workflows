/**
 * @jest-environment node
 *
 * `_reusable-create-github-release.yml` — fires when a merged `release/*` or
 * `hotfix/*` PR lands on main: reads the version, cuts that section out of
 * CHANGELOG.md, creates the Release and tag, then the optional publishes.
 * The shell that decides something (the awk that cuts the notes, the
 * Marketplace step's two no-ops) runs here.
 */
const { readFileSync, mkdtempSync, writeFileSync, chmodSync } = require("fs")
const { execSync, spawnSync } = require("child_process")
const { join } = require("path")
const os = require("os")
const yaml = require("js-yaml")

const WORKFLOW = join(
  __dirname,
  "..",
  ".github",
  "workflows",
  "_reusable-create-github-release.yml",
)
const text = readFileSync(WORKFLOW, "utf8")
const doc = yaml.load(text)
const steps = doc.jobs.release.steps
const named = name => steps.find(s => s.name === name)

// ops#646 — which branches cut a release is decided HERE, for every caller
// at once. Every stub is a `uses:` call, and a called workflow evaluates its
// own job `if:` against the caller's event; teaching the stubs about
// `hotfix/` while this stayed on `release/` left every one of them inert,
// with a green check to match (ops#637).
describe("the release gate", () => {
  const gate = doc.jobs.release.if

  it("fires on a merged release/ or hotfix/ head, and nothing else", () => {
    expect(gate).toContain("github.event.pull_request.merged == true")
    expect(gate).toMatch(
      /startsWith\(github\.event\.pull_request\.head\.ref, 'release\/'\)/,
    )
    expect(gate).toMatch(
      /startsWith\(github\.event\.pull_request\.head\.ref, 'hotfix\/'\)/,
    )
  })

  it("skips rather than fails when the tag already exists (ops#637)", () => {
    // A hotfix does not go through release-pr.yml, so nothing bumped
    // package.json. Failing would put a red run on a deploy that worked.
    expect(text).toMatch(/gh release view "v\$VERSION"/)
    expect(text).toMatch(/skip=true/)
    const gated = steps.filter(s => (s.if || "").includes("skip != 'true'"))
    // Every step that would act on the tag.
    expect(gated.map(s => s.name)).toEqual([
      "Extract changelog notes",
      "Create GitHub Release",
      "Move the floating major tag",
      "Publish package",
      "Publish to the VS Code Marketplace",
    ])
  })
})

describe("the Release and its tags", () => {
  it("tags the merge commit on main, not the default branch's head", () => {
    const create = named("Create GitHub Release")
    expect(create.env.TARGET).toBe(
      "${{ github.event.pull_request.merge_commit_sha }}",
    )
    expect(create.run).toMatch(
      /gh release create "v\$VERSION" \\\n\s+--target "\$TARGET"/,
    )
  })

  it("moves the floating major tag only when the caller opts in, by force, onto the same commit", () => {
    const move = named("Move the floating major tag")
    expect(doc.on.workflow_call.inputs.floating_major_tag).toMatchObject({
      type: "boolean",
      default: false,
    })
    expect(move.if).toBe(
      "steps.version.outputs.skip != 'true' && inputs.floating_major_tag",
    )
    expect(move.env.TARGET).toBe(
      "${{ github.event.pull_request.merge_commit_sha }}",
    )
    expect(move.run).toContain('MAJOR="v${VERSION%%.*}"')
    expect(move.run).toMatch(
      /git\/refs\/tags\/\$MAJOR" \\\n\s+-f sha="\$TARGET" -F force=true/,
    )
    expect(move.run).toMatch(/-f ref="refs\/tags\/\$MAJOR" -f sha="\$TARGET"/)
  })

  it("the checkout persists no credential: every write goes through gh", () => {
    const checkout = steps.find(s =>
      String(s.uses).startsWith("actions/checkout"),
    )
    expect(checkout.with["persist-credentials"]).toBe(false)
    expect(text).not.toMatch(/\bgit push\b/)
  })
})

// ---------------------------------------------------------------------------
// "Extract changelog notes". An Evaluator finding on one target caught the
// awk duplicating the `## vX.Y.Z` heading into the release body: `p=1` fell
// through to the print action on the same line. The release already carries
// `--title "v$VERSION"`, so every release note repeated its own heading.
// ---------------------------------------------------------------------------
describe("Extract changelog notes", () => {
  const AWK_MATCH = text.match(/NOTES=\$\((awk '[^']+' CHANGELOG\.md)\)/)

  const CHANGELOG = `## v1.4.0

### Features
- add the issue-reference gate

### Other
- Merge pull request #24

## v1.3.0

### Other
- earlier release
`

  function extractNotes(changelog = CHANGELOG) {
    const dir = mkdtempSync(join(os.tmpdir(), "changelog-"))
    writeFileSync(join(dir, "CHANGELOG.md"), changelog)
    return execSync(AWK_MATCH[1], { cwd: dir, encoding: "utf8" })
  }

  // ops#412: the fixture above is a hand-written bare `## v1.4.0`. Every
  // caller on the shared release flow generates the BRACKETED form through
  // _reusable-release-pr.yml, and the preset owns the heading LEVEL — that
  // file overrides only types/transform/formatDate, never
  // writer.headerPartial — so a `###` patch heading is the preset's to
  // introduce at any time. A matcher keyed on `## ` alone silently falls
  // through to the PREVIOUS version's section when that happens.
  const bracketed = (h1, h2) => `${h1}

### Bug Fixes
- the current fix

${h2}

### Bug Fixes
- an older fix
`

  it("has an awk extraction command to test", () => {
    expect(AWK_MATCH).not.toBeNull()
  })

  it("extracts the bracketed minor/major heading the shared release flow generates", () => {
    const notes = extractNotes(
      bracketed(
        "## [2.2.0](https://github.com/o/r/compare/v2.1.0...v2.2.0) (2026-08-12)",
        "## [2.1.0](https://github.com/o/r/compare/v2.0.0...v2.1.0) (2026-07-01)",
      ),
    )
    expect(notes).toContain("the current fix")
    expect(notes).not.toContain("an older fix")
  })

  it("extracts a ### patch heading — the preset owns the level, so this must not assume ##", () => {
    const notes = extractNotes(
      bracketed(
        "### [2.2.1](https://github.com/o/r/compare/v2.2.0...v2.2.1) (2026-08-12)",
        "### [2.2.0](https://github.com/o/r/compare/v2.1.0...v2.2.0) (2026-07-01)",
      ),
    )
    expect(notes).toContain("the current fix")
    expect(notes).not.toContain("an older fix")
  })

  it("never treats a ### section heading as a release boundary", () => {
    const notes = extractNotes(
      `## [1.0.0](https://github.com/o/r/compare/v0.9.0...v1.0.0) (2026-08-12)

### Bug Fixes
- first section

### Features
- second section

## [0.9.0](https://github.com/o/r/compare/v0.8.0...v0.9.0) (2026-07-01)

### Bug Fixes
- older
`,
    )
    expect(notes).toContain("first section")
    expect(notes).toContain("second section")
    expect(notes).not.toContain("older")
  })

  it("excludes the version heading itself from the notes body", () => {
    expect(extractNotes()).not.toMatch(/^## v1\.4\.0/m)
  })

  it("still includes the section's body content", () => {
    expect(extractNotes()).toContain("add the issue-reference gate")
  })

  it("stops before the next version's section", () => {
    expect(extractNotes()).not.toContain("earlier release")
  })
})

// ---------------------------------------------------------------------------
// "Publish to the VS Code Marketplace" (ops#1358). Which caller publishes is
// its `marketplace_packages` input, and the step must tell apart its two
// no-ops — a caller that publishes nothing, and one whose `VSCE_PAT` does
// not exist yet — or the day the PAT lands nobody can tell whether
// publishing started. Past both gates the publish is unguarded.
// ---------------------------------------------------------------------------
describe("Publish to the VS Code Marketplace", () => {
  const STEP_NAME = "Publish to the VS Code Marketplace"
  const step = named(STEP_NAME)

  // Run the step's script the way the runner would: `bash -e`, the step's
  // env with the expressions replaced, inside a workspace holding a .vsix.
  function runStep({ packages, pat, npxExit = 0 }) {
    const dir = mkdtempSync(join(os.tmpdir(), "marketplace-"))
    const bin = mkdtempSync(join(os.tmpdir(), "marketplace-bin-"))
    writeFileSync(join(dir, "ext-0.1.0.vsix"), "")
    writeFileSync(join(dir, "script.sh"), step.run)
    const log = join(bin, "npx.log")
    writeFileSync(
      join(bin, "npx"),
      `#!/bin/sh\necho "$@" >> "${log}"\necho "pat=$VSCE_PAT" >> "${log}"\nexit ${npxExit}\n`,
    )
    chmodSync(join(bin, "npx"), 0o755)
    const res = spawnSync("bash", ["-e", "script.sh"], {
      cwd: dir,
      encoding: "utf8",
      env: {
        PATH: `${bin}:${process.env.PATH}`,
        REPO: "o/r",
        PACKAGES: packages,
        VSCE_PAT: pat,
      },
    })
    let npx = ""
    try {
      npx = readFileSync(log, "utf8")
    } catch {
      // npx never ran
    }
    return { status: res.status, out: res.stdout + res.stderr, npx }
  }

  it("is the last step of the release job", () => {
    expect(step).toBeDefined()
    expect(steps[steps.length - 1].name).toBe(STEP_NAME)
  })

  it("reads the caller's input and named secret, with no table keyed on the repo", () => {
    expect(step.env.PACKAGES).toBe("${{ inputs.marketplace_packages }}")
    expect(step.env.VSCE_PAT).toBe("${{ secrets.VSCE_PAT }}")
    expect(step.run).not.toMatch(/case "\$REPO"/)
    expect(doc.on.workflow_call.inputs.marketplace_packages).toMatchObject({
      required: false,
      type: "string",
      default: "",
    })
    expect(Object.keys(doc.on.workflow_call.secrets)).toEqual(["VSCE_PAT"])
  })

  it("gates inside the step, never with a step-level if: on the secret", () => {
    // A secret in an `if:` skips the step with no log line — the silent
    // case the two skip messages exist to prevent.
    expect(String(step.if ?? "")).not.toMatch(/secrets\./)
    expect(String(step.if ?? "")).not.toMatch(/VSCE_PAT/)
  })

  it("skips a caller passing no packages, green, without reaching vsce", () => {
    const r = runStep({ packages: "", pat: "x" })
    expect(r.status).toBe(0)
    expect(r.out).toMatch(/passes no marketplace_packages/)
    expect(r.out).not.toMatch(/VSCE_PAT/)
    expect(r.npx).toBe("")
  })

  it("skips a caller with packages but no PAT, green, with a different line", () => {
    const r = runStep({ packages: "./*.vsix", pat: "" })
    expect(r.status).toBe(0)
    expect(r.out).toMatch(/no VSCE_PAT secret/)
    expect(r.out).not.toMatch(/passes no marketplace_packages/)
    expect(r.npx).toBe("")
  })

  it("publishes the built .vsix with a pinned vsce, the PAT only in the env", () => {
    const r = runStep({ packages: "./*.vsix", pat: "secret-pat" })
    expect(r.status).toBe(0)
    expect(r.npx).toMatch(
      /^--yes @vscode\/vsce@\d+\.\d+\.\d+ publish --packagePath \.\/ext-0\.1\.0\.vsix$/m,
    )
    expect(r.npx).toContain("pat=secret-pat")
    expect(step.run).not.toMatch(/--pat|-p /)
  })

  it("reds the job when the publish itself fails", () => {
    const r = runStep({ packages: "./*.vsix", pat: "secret-pat", npxExit: 1 })
    expect(r.status).not.toBe(0)
    expect(step["continue-on-error"]).toBeUndefined()
    expect(step.run).not.toMatch(/\|\|\s*true/)
  })
})
