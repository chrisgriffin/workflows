/**
 * @jest-environment node
 *
 * `_reusable-create-github-release.yml` — fires when a merged `release/*` or
 * `hotfix/*` PR lands on main: reads the version, cuts that section out of
 * CHANGELOG.md, creates the Release and tag, then the optional publishes.
 * The shell that decides something (the awk that cuts the notes, the
 * Marketplace job's no-token skips, publishes and read-back) runs here.
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
    ])
  })
})

// #55 — the publish step's token. GITHUB_TOKEN is what GitHub Packages
// accepts and the public npm registry does not, so a caller publishing there
// passes NPM_TOKEN by name and it wins; a caller passing none (resume-kit and
// design-drift, on GitHub Packages) is unchanged. Same `||` fallback as
// _reusable-release-pr.yml's RELEASE_PR_TOKEN || GITHUB_TOKEN.
describe("the npm publish step", () => {
  const publishPkg = named("Publish package")

  it("authenticates with the caller's NPM_TOKEN, falling back to GITHUB_TOKEN", () => {
    expect(publishPkg.env.NODE_AUTH_TOKEN).toBe(
      "${{ secrets.NPM_TOKEN || secrets.GITHUB_TOKEN }}",
    )
  })

  it("runs only when the caller named a registry, never on a secret", () => {
    expect(publishPkg.if).toMatch(/inputs\.npm_registry_url != ''/)
    expect(String(publishPkg.if)).not.toMatch(/secrets\./)
  })

  // setup-node's `registry-url` writes the only `.npmrc` auth line, for
  // `npm_registry_url`, so the build step installs from the publish registry
  // too: on npmjs, GITHUB_TOKEN there is an E401 and a token sent off GitHub.
  it("gives the build step the same token: its installs hit the publish registry", () => {
    const setup = steps.find(s =>
      String(s.uses).startsWith("actions/setup-node"),
    )
    expect(setup.with["registry-url"]).toBe("${{ inputs.npm_registry_url }}")
    expect(named("Build release artifacts").env.NODE_AUTH_TOKEN).toBe(
      "${{ secrets.NPM_TOKEN || secrets.GITHUB_TOKEN }}",
    )
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
// The `marketplace` job (ops#1358, #16): publishes to the VS Code Marketplace
// (`VSCE_PAT`) and Open VSX (`OVSX_PAT`). Which caller publishes is its
// `marketplace_packages` input, and the job must tell apart "publishes
// nothing" (the job never starts) and "no token yet" (a notice per
// registry), or the day a token lands nobody can tell whether publishing
// started. It is its own job, reading the .vsix off the Release by version,
// so re-running a failed publish retries it even though the Release exists.
// #33: what it published it then reads back from the registry.
// ---------------------------------------------------------------------------
describe("the marketplace job", () => {
  // `|| { steps: [] }` so each test, not the whole file, fails without it.
  const job = doc.jobs.marketplace || { steps: [] }
  const publish = job.steps.find(
    s => s.name === "Publish to the VS Code Marketplace and Open VSX",
  )

  // What each registry's read API answers: the registry's own shape for a
  // version it serves and for one it does not, read off both live.
  const OVSX_FOUND = { code: 200, body: JSON.stringify({ version: "0.1.0" }) }
  const OVSX_ABSENT = {
    code: 404,
    body: JSON.stringify({ error: "Extension not found: pub.ext 0.1.0" }),
  }
  const gallery = extensions => ({
    code: 200,
    body: JSON.stringify({ results: [{ extensions }] }),
  })
  const VSCE_FOUND = gallery([{ versions: [{ version: "0.1.0" }] }])
  const VSCE_ABSENT = gallery([])
  const VSCE_OLDER = gallery([{ versions: [{ version: "0.0.9" }] }])
  const DOWN = { down: true }
  const BUSY = { code: 503, body: "<html>Service Unavailable</html>" }

  // The step's script run the way the runner would (`bash -e`, its env),
  // with `gh`, `npx`, `unzip`, `curl` and `sleep` stubbed: `gh release
  // download` drops the Release's .vsix into --dir; npx logs each tool's
  // arguments and the tokens it saw, and exits with that tool's code; unzip
  // prints the .vsix's manifest; curl answers from `ovsxReads` or `vsceReads`
  // in turn, the last answer repeating; sleep only logs, so a test of the
  // polling bound takes no time. `tries` shortens the bound for a test about
  // something else: a read costs two processes, and one test pins the real one.
  function runStep({
    vsce = "",
    ovsx = "",
    oidc = false,
    vsceExit = 0,
    ovsxExit = 0,
    ovsxReads = [OVSX_FOUND],
    vsceReads = [VSCE_FOUND],
    unzipExit = 0,
    vsixes = ["ext-0.1.0.vsix"],
    tries,
  }) {
    const bin = mkdtempSync(join(os.tmpdir(), "marketplace-bin-"))
    const log = join(bin, "calls.log")
    writeFileSync(log, "")
    writeFileSync(
      join(bin, "gh"),
      `#!/bin/sh\necho "gh $*" >> "${log}"\nwhile [ $# -gt 0 ]; do [ "$1" = --dir ] && for f in ${vsixes.join(" ")}; do : > "$2/$f"; done; shift; done\n`,
    )
    writeFileSync(
      join(bin, "npx"),
      `#!/bin/sh\necho "npx $* vsce_pat=$VSCE_PAT ovsx_pat=$OVSX_PAT" >> "${log}"\n` +
        `case "$2" in @vscode/vsce@*) exit ${vsceExit};; ovsx@*) exit ${ovsxExit};; esac\n`,
    )
    writeFileSync(
      join(bin, "unzip"),
      `#!/bin/sh\necho "unzip $*" >> "${log}"\n` +
        (unzipExit
          ? `exit ${unzipExit}\n`
          : `case "$*" in *other-*) n=other;; *) n=ext;; esac\n` +
            `echo '{"publisher":"pub","name":"'$n'","version":"0.1.0"}'\n`),
    )
    writeFileSync(
      join(bin, "sleep"),
      `#!/bin/sh\necho "sleep $*" >> "${log}"\n`,
    )
    const reads = join(bin, "reads.json")
    writeFileSync(reads, JSON.stringify({ ovsxReads, vsceReads }))
    writeFileSync(
      join(bin, "curl"),
      `#!/usr/bin/env node
const fs = require("fs")
const args = process.argv.slice(2)
fs.appendFileSync(${JSON.stringify(log)}, "curl " + args.join(" ") + "\\n")
const plan = JSON.parse(fs.readFileSync(${JSON.stringify(reads)}, "utf8"))
const key = args.some(a => a.includes("open-vsx.org")) ? "ovsxReads" : "vsceReads"
const read = plan[key].length > 1 ? plan[key].shift() : plan[key][0]
fs.writeFileSync(${JSON.stringify(reads)}, JSON.stringify(plan))
if (read.down) {
  process.stdout.write("000")
  process.exit(7)
}
fs.writeFileSync(args[args.indexOf("-o") + 1], read.body)
process.stdout.write(String(read.code))
`,
    )
    for (const tool of ["gh", "npx", "unzip", "sleep", "curl"])
      chmodSync(join(bin, tool), 0o755)
    const script = tries
      ? publish.run.replace(/READ_BACK_TRIES=\d+/, `READ_BACK_TRIES=${tries}`)
      : publish.run
    const res = spawnSync("bash", ["-e", "-c", script], {
      encoding: "utf8",
      env: {
        PATH: `${bin}:${process.env.PATH}`,
        REPO: "o/r",
        VERSION: "0.1.0",
        PACKAGES: "./*.vsix",
        VSCE_PAT: vsce,
        OVSX_PAT: ovsx,
        // Set by the runner only when the job's token has `id-token: write`.
        ...(oidc && {
          ACTIONS_ID_TOKEN_REQUEST_URL: "https://token.example/oidc",
          ACTIONS_ID_TOKEN_REQUEST_TOKEN: "req",
        }),
      },
    })
    return {
      status: res.status,
      out: res.stdout + res.stderr,
      calls: readFileSync(log, "utf8"),
    }
  }

  const VSCE =
    /^npx --yes @vscode\/vsce@\d+\.\d+\.\d+ publish --skip-duplicate --packagePath \.\/ext-0\.1\.0\.vsix /m
  const OVSX =
    /^npx --yes ovsx@\d+\.\d+\.\d+ publish --skip-duplicate --packagePath \.\/ext-0\.1\.0\.vsix /m

  it("runs after the release job, only for a caller passing marketplace_packages", () => {
    expect(job.needs).toBe("release")
    expect(job.if).toBe("inputs.marketplace_packages != ''")
    expect(typeof job["timeout-minutes"]).toBe("number")
    expect(doc.on.workflow_call.inputs.marketplace_packages).toMatchObject({
      required: false,
      type: "string",
      default: "",
    })
  })

  // #16 — the publish used to be a step after `gh release create`, behind
  // the version step's skip. A failed publish left the Release behind, so a
  // re-run saw it, skipped, and never retried.
  it("is not gated on the release job's skip, so a re-run retries the publish", () => {
    expect(job.if).not.toMatch(/skip/)
    for (const s of job.steps) expect(String(s.if ?? "")).not.toMatch(/skip/)
    expect(steps.map(s => s.name)).not.toContain(
      "Publish to the VS Code Marketplace",
    )
    expect(doc.jobs.release.outputs.version).toBe(
      "${{ steps.version.outputs.version }}",
    )
    expect(publish.env.VERSION).toBe("${{ needs.release.outputs.version }}")
  })

  it("reads the caller's input and the three named secrets, with no table keyed on the repo", () => {
    expect(publish.env.PACKAGES).toBe("${{ inputs.marketplace_packages }}")
    expect(publish.env.VSCE_PAT).toBe("${{ secrets.VSCE_PAT }}")
    expect(publish.env.OVSX_PAT).toBe("${{ secrets.OVSX_PAT }}")
    expect(publish.run).not.toMatch(/case "\$REPO"/)
    expect(Object.keys(doc.on.workflow_call.secrets)).toEqual([
      "VSCE_PAT",
      "OVSX_PAT",
      "NPM_TOKEN",
    ])
    for (const s of Object.values(doc.on.workflow_call.secrets))
      expect(s.required).toBe(false)
  })

  it("gates inside the step, never with an if: on a secret", () => {
    // A secret in an `if:` skips the step with no log line — the silent
    // case the notices exist to prevent.
    for (const s of [job, ...job.steps]) {
      expect(String(s.if ?? "")).not.toMatch(/secrets\./)
      expect(String(s.if ?? "")).not.toMatch(/_PAT/)
    }
  })

  it("skips green with a notice when there is no token, without reaching gh or npx", () => {
    const r = runStep({})
    expect(r.status).toBe(0)
    expect(r.out).toMatch(
      /::notice::.*no VSCE_PAT or OVSX_PAT secret, and no id-token: write, on o\/r/,
    )
    expect(r.calls).toBe("")
  })

  it("publishes the Release's own .vsix to both registries, pinned, each tool seeing only its own token", () => {
    const r = runStep({ vsce: "v-pat", ovsx: "o-pat" })
    expect(r.status).toBe(0)
    expect(r.calls).toMatch(/^gh release download v0\.1\.0 --repo o\/r --dir /m)
    expect(r.calls).toMatch(VSCE)
    expect(r.calls).toMatch(OVSX)
    expect(r.calls).toMatch(/@vscode\/vsce.* vsce_pat=v-pat ovsx_pat=$/m)
    expect(r.calls).toMatch(/ovsx@.* vsce_pat= ovsx_pat=o-pat$/m)
    expect(publish.run).not.toMatch(/--pat|-p /)
  })

  test.each([
    [
      "VSCE_PAT",
      { ovsx: "o-pat" },
      OVSX,
      VSCE,
      /VS Code Marketplace publish skipped: no VSCE_PAT/,
    ],
    [
      "OVSX_PAT",
      { vsce: "v-pat" },
      VSCE,
      OVSX,
      /Open VSX publish skipped: no OVSX_PAT secret, and no id-token: write, on o\/r/,
    ],
  ])(
    "with no %s, skips that registry with a notice and still publishes the other",
    (_, tokens, published, skipped, notice) => {
      const r = runStep(tokens)
      expect(r.status).toBe(0)
      expect(r.out).toMatch(notice)
      expect(r.calls).toMatch(published)
      expect(r.calls).not.toMatch(skipped)
    },
  )

  // `--skip-duplicate` is each tool's own "already published" check: a retry
  // of a version that did reach a registry is green. Any other failure still
  // reds the job, because a swallowed one looks exactly like the no-op.
  test.each([
    [
      "the Marketplace",
      { vsceExit: 1 },
      /Publish failed: VS-Code-Marketplace$/m,
    ],
    ["Open VSX", { ovsxExit: 1 }, /Publish failed: Open-VSX$/m],
  ])(
    "a failed publish to %s reds the job without skipping the other registry",
    (_, exits, error) => {
      const r = runStep({ vsce: "v-pat", ovsx: "o-pat", ...exits })
      expect(r.status).not.toBe(0)
      expect(r.out).toMatch(error)
      expect(r.calls).toMatch(VSCE)
      expect(r.calls).toMatch(OVSX)
    },
  )

  // #22 — Open VSX trusted publishing: with no OVSX_PAT, a caller granting
  // `id-token: write` publishes with the run's OIDC ID token, so it stores
  // no secret. A token still wins: an extension's first version needs one.
  const TRUSTED =
    /^npx --yes ovsx@\d+\.\d+\.\d+ publish --trusted-publishing --skip-duplicate --packagePath \.\/ext-0\.1\.0\.vsix /m

  describe("trusted publishing", () => {
    it("publishes to Open VSX with the ID token when there is no OVSX_PAT", () => {
      const r = runStep({ vsce: "v-pat", oidc: true })
      expect(r.status).toBe(0)
      expect(r.calls).toMatch(TRUSTED)
      expect(r.calls).toMatch(/ovsx@.* vsce_pat= ovsx_pat=$/m)
      expect(r.out).not.toMatch(/Open VSX publish skipped/)
    })

    it("needs no token at all: the ID token alone gets past the early skip", () => {
      const r = runStep({ oidc: true })
      expect(r.status).toBe(0)
      expect(r.calls).toMatch(/^gh release download v0\.1\.0 /m)
      expect(r.calls).toMatch(TRUSTED)
      expect(r.out).toMatch(/VS Code Marketplace publish skipped: no VSCE_PAT/)
    })

    it("uses OVSX_PAT when both are there, so a first publish still works", () => {
      const r = runStep({ ovsx: "o-pat", oidc: true })
      expect(r.status).toBe(0)
      expect(r.calls).toMatch(OVSX)
      expect(r.calls).not.toMatch(/--trusted-publishing/)
    })

    it("reds the job when the trusted publish fails, without skipping the Marketplace", () => {
      const r = runStep({ vsce: "v-pat", oidc: true, ovsxExit: 1 })
      expect(r.status).not.toBe(0)
      expect(r.out).toMatch(/Publish failed: Open-VSX$/m)
      expect(r.calls).toMatch(VSCE)
    })

    it("adds no permissions: key, so the caller's grant is the only switch", () => {
      expect(doc.permissions).toBeUndefined()
      for (const j of Object.values(doc.jobs))
        expect(j.permissions).toBeUndefined()
    })
  })

  it("reds the job when both publishes fail, and never swallows a failure", () => {
    const r = runStep({ vsce: "v", ovsx: "o", vsceExit: 1, ovsxExit: 1 })
    expect(r.status).not.toBe(0)
    expect(r.out).toMatch(/Publish failed: VS-Code-Marketplace Open-VSX$/m)
    expect(job["continue-on-error"]).toBeUndefined()
    expect(publish["continue-on-error"]).toBeUndefined()
    expect(publish.run).not.toMatch(/\|\|\s*true/)
  })

  // #33 — a publish command exiting 0 says the registry accepted the upload,
  // not that it serves the version, so a publish that stored nothing looked
  // exactly like one that worked. The job asks the registry afterwards.
  describe("reads the publish back", () => {
    const BOTH = { vsce: "v-pat", ovsx: "o-pat" }
    const count = (calls, re) => (calls.match(re) || []).length
    const OVSX_READ = /^curl .*open-vsx\.org/gm
    const VSCE_READ = /^curl .*marketplace\.visualstudio\.com/gm
    const SLEEP = /^sleep 30$/gm

    it("names the registry, the namespace and the version it verified", () => {
      const r = runStep(BOTH)
      expect(r.status).toBe(0)
      expect(r.out).toMatch(/^Verified: VS-Code-Marketplace pub\/ext 0\.1\.0$/m)
      expect(r.out).toMatch(/^Verified: Open-VSX pub\/ext 0\.1\.0$/m)
      expect(r.calls).toMatch(
        /https:\/\/open-vsx\.org\/api\/pub\/ext\/0\.1\.0$/m,
      )
      expect(r.calls).toMatch(/"value":"pub\.ext"/)
      // IncludeVersions | ExcludeNonValidated: a version still in validation,
      // or that failed it, is not one the Marketplace serves.
      expect(r.calls).toMatch(/"flags":33/)
      expect(count(r.calls, SLEEP)).toBe(0)
    })

    it("reads the extension's identity out of the .vsix the job published", () => {
      const r = runStep(BOTH)
      expect(r.calls).toMatch(
        /^unzip .*ext-0\.1\.0\.vsix extension\/package\.json$/m,
      )
    })

    it("reads a trusted publish back too", () => {
      const r = runStep({ oidc: true, ovsxReads: [OVSX_ABSENT], tries: 1 })
      expect(r.status).not.toBe(0)
      expect(r.out).toMatch(/::error::MISSING: Open-VSX pub\/ext 0\.1\.0/)
    })

    test.each([
      [
        "Open VSX",
        { ovsxReads: [OVSX_ABSENT, OVSX_ABSENT, OVSX_FOUND] },
        OVSX_READ,
      ],
      [
        "the Marketplace",
        { vsceReads: [VSCE_ABSENT, VSCE_OLDER, VSCE_FOUND] },
        VSCE_READ,
      ],
      [
        "an outage on Open VSX",
        { ovsxReads: [DOWN, BUSY, OVSX_FOUND] },
        OVSX_READ,
      ],
    ])(
      "polls through a delay on %s: not there yet is not missing",
      (_, reads, read) => {
        const r = runStep({ ...BOTH, ...reads })
        expect(r.status).toBe(0)
        expect(count(r.calls, read)).toBe(3)
        expect(count(r.calls, SLEEP)).toBe(2)
        expect(r.out).not.toMatch(/::error::/)
      },
    )

    test.each([
      ["Open-VSX", { ovsxReads: [OVSX_ABSENT] }, OVSX_READ],
      ["VS-Code-Marketplace", { vsceReads: [VSCE_ABSENT] }, VSCE_READ],
      ["VS-Code-Marketplace", { vsceReads: [VSCE_OLDER] }, VSCE_READ],
    ])(
      "reds the job as MISSING when %s answers without the version, once the bound is spent",
      (registry, reads, read) => {
        const r = runStep({ ...BOTH, ...reads, tries: 2 })
        expect(r.status).not.toBe(0)
        expect(r.out).toMatch(
          new RegExp(`^::error::MISSING: ${registry} pub/ext 0\\.1\\.0: `, "m"),
        )
        expect(r.out).not.toMatch(/UNCHECKED/)
        expect(count(r.calls, read)).toBe(2)
      },
    )

    test.each([
      ["Open-VSX", "does not connect", { ovsxReads: [DOWN] }, OVSX_READ],
      ["Open-VSX", "answers 503", { ovsxReads: [BUSY] }, OVSX_READ],
      [
        "VS-Code-Marketplace",
        "does not connect",
        { vsceReads: [DOWN] },
        VSCE_READ,
      ],
      ["VS-Code-Marketplace", "answers 503", { vsceReads: [BUSY] }, VSCE_READ],
      [
        "Open-VSX",
        "answers 200 with something unreadable",
        { ovsxReads: [{ code: 200, body: "<html>" }] },
        OVSX_READ,
      ],
      [
        "VS-Code-Marketplace",
        "answers 200 with no results",
        { vsceReads: [{ code: 200, body: "{}" }] },
        VSCE_READ,
      ],
      [
        "Open-VSX",
        "answers a 404 that is not the registry's own",
        { ovsxReads: [{ code: 404, body: "<html>" }] },
        OVSX_READ,
      ],
    ])(
      "reds the job as UNCHECKED, never MISSING or verified, when %s %s",
      (registry, _, reads, read) => {
        const r = runStep({ ...BOTH, ...reads, tries: 2 })
        expect(r.status).not.toBe(0)
        expect(r.out).toMatch(
          new RegExp(
            `^::error::UNCHECKED: ${registry} pub/ext 0\\.1\\.0: `,
            "m",
          ),
        )
        expect(r.out).not.toMatch(/MISSING/)
        expect(r.out).not.toMatch(new RegExp(`Verified: ${registry}`))
        expect(count(r.calls, read)).toBe(2)
      },
    )

    it("spends the named bound before calling anything: 20 tries, 30 seconds apart", () => {
      const r = runStep({
        ...BOTH,
        ovsxReads: [OVSX_ABSENT],
        vsceReads: [DOWN],
      })
      expect(r.status).not.toBe(0)
      expect(count(r.calls, OVSX_READ)).toBe(20)
      expect(count(r.calls, VSCE_READ)).toBe(20)
      expect(count(r.calls, SLEEP)).toBe(19)
      expect(r.out).toMatch(
        /::error::MISSING: Open-VSX.*after 20 tries, 30s apart/,
      )
      expect(r.out).toMatch(
        /::error::UNCHECKED: VS-Code-Marketplace.*after 20 tries, 30s apart/,
      )
    })

    it("calls it by the last answer: absent, then unreachable, is unchecked", () => {
      const r = runStep({ ...BOTH, ovsxReads: [OVSX_ABSENT, DOWN], tries: 2 })
      expect(r.status).not.toBe(0)
      expect(r.out).toMatch(/::error::UNCHECKED: Open-VSX/)
      expect(r.out).not.toMatch(/MISSING/)
    })

    it("reports each registry on its own, and stops asking the one that answered", () => {
      const r = runStep({
        ...BOTH,
        ovsxReads: [DOWN],
        vsceReads: [VSCE_ABSENT],
        tries: 1,
      })
      expect(r.out).toMatch(/::error::UNCHECKED: Open-VSX/)
      expect(r.out).toMatch(/::error::MISSING: VS-Code-Marketplace/)

      const one = runStep({ ...BOTH, ovsxReads: [OVSX_ABSENT], tries: 2 })
      expect(one.out).toMatch(/^Verified: VS-Code-Marketplace/m)
      expect(one.out).toMatch(/::error::MISSING: Open-VSX/)
      expect(count(one.calls, VSCE_READ)).toBe(1)
    })

    test.each([
      ["the Marketplace", { ovsx: "o-pat" }, VSCE_READ, OVSX_READ],
      ["Open VSX", { vsce: "v-pat" }, OVSX_READ, VSCE_READ],
    ])(
      "never reads back a skipped %s, however its read API would answer",
      (_, tokens, skipped, published) => {
        const r = runStep({
          ...tokens,
          ...(skipped === VSCE_READ
            ? { vsceReads: [VSCE_ABSENT] }
            : { ovsxReads: [OVSX_ABSENT] }),
        })
        expect(r.status).toBe(0)
        expect(count(r.calls, skipped)).toBe(0)
        expect(count(r.calls, published)).toBe(1)
        expect(r.out).not.toMatch(/::error::/)
      },
    )

    it("touches no registry and no .vsix for a repo publishing to neither", () => {
      const r = runStep({ ovsxReads: [DOWN], vsceReads: [DOWN] })
      expect(r.status).toBe(0)
      expect(r.calls).toBe("")
      expect(r.out).not.toMatch(/::error::|Verified|MISSING|UNCHECKED/)
      // And a repo passing no marketplace_packages never starts the job.
      expect(job.if).toBe("inputs.marketplace_packages != ''")
    })

    it("does not read back a publish that failed: it is already red for that", () => {
      const r = runStep({ ...BOTH, vsceExit: 1, vsceReads: [VSCE_ABSENT] })
      expect(r.status).not.toBe(0)
      expect(r.out).toMatch(/Publish failed: VS-Code-Marketplace$/m)
      expect(count(r.calls, VSCE_READ)).toBe(0)
      expect(r.out).toMatch(/^Verified: Open-VSX/m)

      const both = runStep({ ...BOTH, vsceExit: 1, ovsxExit: 1 })
      expect(both.out).toMatch(/Publish failed: VS-Code-Marketplace Open-VSX$/m)
      expect(both.calls).not.toMatch(/^(curl|unzip) /m)
    })

    // `unzip | node` hides unzip's status, so an unreadable .vsix must not
    // leave an empty list of things to check and a green job.
    it("reds the job when it cannot tell what it published", () => {
      const r = runStep({ ...BOTH, unzipExit: 9 })
      expect(r.status).not.toBe(0)
      expect(r.out).not.toMatch(/Verified/)
      expect(r.calls).not.toMatch(/^curl /m)
    })

    it("sends neither token to a read API", () => {
      const r = runStep(BOTH)
      for (const line of r.calls
        .split("\n")
        .filter(l => l.startsWith("curl "))) {
        expect(line).not.toMatch(/v-pat|o-pat/)
      }
      expect(publish.run).not.toMatch(/curl[^\n]*(VSCE_PAT|OVSX_PAT)/)
    })

    // A glob can match one extension's platform-specific packages, which all
    // carry one publisher/name/version: the bound and the timeout are sized
    // for one read of it per registry per try, and one error each.
    describe("packages of one extension identity", () => {
      const PLATFORMS = ["ext-linux-x64-0.1.0.vsix", "ext-win32-x64-0.1.0.vsix"]

      it("reads both packages' manifests, and the identity once per registry", () => {
        const r = runStep({ ...BOTH, vsixes: PLATFORMS })
        expect(r.status).toBe(0)
        expect(count(r.calls, /^unzip /gm)).toBe(2)
        expect(count(r.calls, OVSX_READ)).toBe(1)
        expect(count(r.calls, VSCE_READ)).toBe(1)
        expect(count(r.out, /^Verified: Open-VSX pub\/ext 0\.1\.0$/gm)).toBe(1)
        expect(
          count(r.out, /^Verified: VS-Code-Marketplace pub\/ext 0\.1\.0$/gm),
        ).toBe(1)
      })

      test.each([
        ["MISSING", "Open-VSX", { ovsxReads: [OVSX_ABSENT] }, OVSX_READ],
        [
          "MISSING",
          "VS-Code-Marketplace",
          { vsceReads: [VSCE_ABSENT] },
          VSCE_READ,
        ],
        ["UNCHECKED", "Open-VSX", { ovsxReads: [DOWN] }, OVSX_READ],
        ["UNCHECKED", "VS-Code-Marketplace", { vsceReads: [BUSY] }, VSCE_READ],
      ])(
        "reads it once a try and reports %s on %s once",
        (word, registry, reads, read) => {
          const r = runStep({ ...BOTH, ...reads, vsixes: PLATFORMS, tries: 2 })
          expect(r.status).not.toBe(0)
          expect(count(r.calls, read)).toBe(2)
          expect(
            count(r.out, new RegExp(`^::error::${word}: ${registry} `, "gm")),
          ).toBe(1)
          expect(
            count(r.out, new RegExp(`^Try 2 of 2: ${registry} `, "gm")),
          ).toBe(1)
        },
      )

      it("still reads each of two different extensions", () => {
        const r = runStep({
          ...BOTH,
          vsixes: [...PLATFORMS, "other-0.1.0.vsix"],
        })
        expect(r.status).toBe(0)
        expect(count(r.calls, /^unzip /gm)).toBe(3)
        expect(count(r.calls, OVSX_READ)).toBe(2)
        expect(count(r.calls, VSCE_READ)).toBe(2)
        expect(r.out).toMatch(/^Verified: Open-VSX pub\/ext 0\.1\.0$/m)
        expect(r.out).toMatch(/^Verified: Open-VSX pub\/other 0\.1\.0$/m)
      })
    })

    // A job the timeout kills mid-poll reports neither MISSING nor UNCHECKED.
    it("fits the whole bound inside the job's timeout, publishes included", () => {
      const tries = Number(publish.run.match(/READ_BACK_TRIES=(\d+)/)[1])
      const wait = Number(publish.run.match(/READ_BACK_WAIT=(\d+)/)[1])
      const maxTime = Number(publish.run.match(/--max-time (\d+)/)[1])
      const worst = (tries - 1) * wait + tries * 2 * maxTime
      expect(job["timeout-minutes"] * 60).toBeGreaterThan(worst + 5 * 60)
    })
  })
})
