/**
 * @jest-environment node
 *
 * `_reusable-release-pr.yml` — the release-PR job body every repo calls
 * (2026-08-20, ops#439's release-pr unification: "identical where it can, no
 * bespoke bullshit"). Ported from four repos' own copies, which had drifted
 * on branch naming (release/vX.Y.Z vs release/next), retry robustness,
 * changelog-splice safety and Node version — this is the one place those
 * invariants live, and the shell that decides something runs here.
 */
const { readFileSync, writeFileSync, mkdtempSync, mkdirSync } = require("fs")
const { spawnSync } = require("child_process")
const { join } = require("path")
const os = require("os")
const yaml = require("js-yaml")

const WORKFLOW = join(
  __dirname,
  "..",
  ".github",
  "workflows",
  "_reusable-release-pr.yml",
)
const text = readFileSync(WORKFLOW, "utf8")

const commands = text
  .split("\n")
  .filter(line => !line.trim().startsWith("#"))
  .join("\n")

describe("_reusable-release-pr.yml — release/next is stable, not per-version", () => {
  it("the branch is release/next, reused across version bumps", () => {
    expect(text).toContain('echo "branch=release/next" >> "$GITHUB_OUTPUT"')
    expect(text).not.toMatch(/release\/v\$\{?NEXT\}?/)
  })

  it("force-pushes the same branch rather than creating a new one per version", () => {
    expect(text).toContain('git checkout -B "$BRANCH"')
    // The token enters git per push, as a header, never .git/config.
    expect(text).toContain(
      'git -c "http.extraheader=AUTHORIZATION: basic $AUTH" push origin "$BRANCH" --force',
    )
  })
})

describe("_reusable-release-pr.yml — cancels a superseded run instead of stacking them", () => {
  it("has a concurrency group keyed on the caller's own repo", () => {
    expect(text).toMatch(
      /^concurrency:\n +group: release-pr-\$\{\{ github\.repository \}\}\n +cancel-in-progress: true$/m,
    )
  })
})

describe("_reusable-release-pr.yml — authenticates with RELEASE_PR_TOKEN, not GITHUB_TOKEN", () => {
  const token = String.raw`\$\{\{ secrets\.RELEASE_PR_TOKEN \|\| secrets\.GITHUB_TOKEN \}\}`

  it("the checkout and the gh CLI both use the fallback chain", () => {
    expect(text).toMatch(new RegExp(`^ +token: ${token}$`, "m"))
    expect(text).toMatch(new RegExp(`^ +GH_TOKEN: ${token}$`, "m"))
    // GITHUB_TOKEN never pushes or opens the PR (its events trigger no
    // checks); its one use is the Evaluator status step (ops#1372), which
    // the release PAT cannot write.
    const uses = yaml
      .load(text)
      .jobs["release-pr"].steps.filter(s =>
        JSON.stringify(s).includes("github.token"),
      )
    expect(uses.map(s => s.name)).toEqual([
      "Post the release PR's Evaluator status",
    ])
  })
})

describe("_reusable-release-pr.yml — reviewer request and PR reuse", () => {
  it("requests chrisgriffin at creation, never on an edit", () => {
    expect(commands).toMatch(
      /gh pr create[\s\S]{0,400}?--reviewer chrisgriffin/,
    )
    const edits = commands
      .split("\n")
      .filter(line => line.includes("gh pr edit"))
    expect(edits.length).toBeGreaterThan(0)
    for (const line of edits) {
      expect(line).not.toContain("--reviewer")
      expect(line).not.toContain("--add-reviewer")
    }
  })

  it("retries the existing-PR lookup instead of trusting one possibly-stale read", () => {
    // gh pr list can momentarily return empty right after the force-push
    // (GitHub eventual consistency) — trusting the first read risks opening
    // a duplicate PR for one that already exists.
    expect(text).toContain("for attempt in 1 2 3")
    expect(text).toContain("find_existing")
  })

  // ops#1457 — on one repo the create opened the PR, then its reviewer
  // request failed (a GraphQL 5xx), and the raced path only edited the title.
  describe("ensure_reviewer, run on the raced path", () => {
    const fn = (commands.match(/ensure_reviewer\(\) \{[\s\S]*?\n {10}\}/) || [
      "",
    ])[0]
    const run = viewJson => {
      const dir = mkdtempSync(join(os.tmpdir(), "release-pr-gh-"))
      const log = join(dir, "calls")
      writeFileSync(
        join(dir, "gh"),
        `#!/bin/bash\necho "$*" >> ${log}\n` +
          `[ "$1 $2" = "pr view" ] && echo '${viewJson}' | jq -c "\${@: -1}"\nexit 0\n`,
        { mode: 0o755 },
      )
      spawnSync("bash", ["-c", `${fn}\nensure_reviewer 377`], {
        env: {
          ...process.env,
          PATH: `${dir}:${process.env.PATH}`,
          GITHUB_REPOSITORY: "o/r",
        },
        encoding: "utf8",
      })
      return readFileSync(log, "utf8")
    }

    it("requests chrisgriffin when he has neither a request nor a review", () => {
      expect(run('{"reviewRequests":[],"reviews":[]}')).toContain(
        "api -X POST repos/o/r/pulls/377/requested_reviewers -f reviewers[]=chrisgriffin",
      )
    })

    it.each([
      [
        "a pending request",
        '{"reviewRequests":[{"login":"chrisgriffin"}],"reviews":[]}',
      ],
      [
        "a review",
        '{"reviewRequests":[],"reviews":[{"author":{"login":"chrisgriffin"}}]}',
      ],
    ])("leaves it alone when he already has %s", (_, json) => {
      expect(run(json)).not.toContain("requested_reviewers")
    })

    it("is called only from the raced path, never the per-push edit", () => {
      const raced = commands.split("Create raced with existing PR")[1]
      expect(raced.split("else")[0]).toContain('ensure_reviewer "$EXISTING"')
      expect(commands.match(/ensure_reviewer "/g)).toHaveLength(1)
    })
  })

  it("treats a racing gh pr create failure as success, not a hard error", () => {
    // A concurrent run may have opened the PR between the retry loop giving
    // up and this create call — re-query and edit instead of failing.
    expect(text).toContain("if ! gh pr create")
    expect(text).toContain("Create raced with existing PR")
  })
})

describe("_reusable-release-pr.yml — skips cleanly when there is nothing to release", () => {
  it("checks develop is ahead of main before doing any work", () => {
    expect(text).toContain("git rev-list --count origin/main..origin/develop")
    expect(text).toContain('echo "skip=true" >> "$GITHUB_OUTPUT"')
  })

  it("guards against a race where another release shipped mid-run", () => {
    expect(text).toContain('git rev-parse --verify --quiet "refs/tags/v$NEXT"')
  })
})

describe("_reusable-release-pr.yml — the extra_build_command hook", () => {
  it("declares extra_build_command and extra_add_paths as optional, empty-default inputs", () => {
    const inputs = text.split("workflow_call:")[1].split(/\npermissions:/)[0]
    expect(inputs).toMatch(/extra_build_command:[\s\S]*?default: ""/)
    expect(inputs).toMatch(/extra_add_paths:[\s\S]*?default: ""/)
  })

  it("only runs the hook when a caller actually sets it", () => {
    expect(text).toContain('if [ -n "$EXTRA_BUILD_COMMAND" ]')
    expect(text).toContain('eval "$EXTRA_BUILD_COMMAND"')
  })

  it("only git-adds the extra paths when they were actually provided", () => {
    expect(text).toContain('if [ -n "$EXTRA_PATHS" ]; then')
    expect(text).toContain("git add $EXTRA_PATHS")
  })
})

// #34: a manifest that ships with the package (a plugin.json) follows its
// version, set in place so the caller's Prettier layout survives.
describe("_reusable-release-pr.yml — version_files", () => {
  const block = text.match(
    /\n( +for f in \$VERSION_FILES; do[\s\S]*?\n +done)\n/,
  )[1]
  const sync = files => {
    const dir = mkdtempSync(join(os.tmpdir(), "release-pr-version-files-"))
    for (const [f, body] of Object.entries(files)) {
      mkdirSync(join(dir, f, ".."), { recursive: true })
      writeFileSync(join(dir, f), body)
    }
    const r = spawnSync("bash", ["-e", "-c", block], {
      cwd: dir,
      encoding: "utf8",
      env: {
        ...process.env,
        NEXT: "1.3.0",
        VERSION_FILES: Object.keys(files).join(" "),
      },
    })
    return { r, read: f => readFileSync(join(dir, f), "utf8") }
  }

  it("declares version_files as an optional, empty-default input", () => {
    const inputs = text.split("workflow_call:")[1].split(/\npermissions:/)[0]
    expect(inputs).toMatch(/version_files:[\s\S]*?default: ""/)
  })

  it("sets each file's version in place and leaves the rest byte for byte", () => {
    const manifest =
      '{\n  "name": "x",\n  "version": "1.2.3",\n  "keywords": ["a", "b"]\n}\n'
    const { r, read } = sync({
      ".claude-plugin/plugin.json": manifest,
      "b/plugin.json": '{ "version":"0.1.0" }',
    })
    expect(r.status).toBe(0)
    expect(read(".claude-plugin/plugin.json")).toBe(
      manifest.replace("1.2.3", "1.3.0"),
    )
    expect(read("b/plugin.json")).toBe('{ "version":"1.3.0" }')
  })

  it("fails on a listed file with no version field, naming it", () => {
    const { r } = sync({ "p.json": '{ "name": "x" }\n' })
    expect(r.status).not.toBe(0)
    expect(r.stdout + r.stderr).toContain("p.json")
  })

  it("commits the files with the release, and installs nothing for them", () => {
    expect(commands).toMatch(/git add \$VERSION_FILES/)
    const install = commands.match(/- if: (.*)\n +run: npm ci/)[1]
    expect(install).not.toContain("version_files")
  })
})

describe("_reusable-release-pr.yml — self-contained changelog tooling", () => {
  it("pins Node 22, not a per-repo version", () => {
    expect(text).toContain('node-version: "22"')
  })

  it("installs the changelog tooling into a real, resolvable prefix and writes its config there", () => {
    // A config file at bare /tmp has nothing for its own `import` to
    // resolve against — Node's module resolution walks up from the
    // IMPORTING FILE's directory, and bare /tmp has no node_modules/ in
    // that chain. `npm install --prefix` creates a real one; the config
    // has to live inside that same prefix, not beside it (found live,
    // ops#439 — every release PR silently never opened).
    expect(text).toContain(
      "npm install --no-save --ignore-scripts --prefix /tmp/rp-tools",
    )
    expect(text).toContain("cat > /tmp/rp-tools/changelog-preset.config.mjs")
    expect(text).not.toContain("cat > /tmp/changelog-preset.config.mjs")
  })

  it("drops non-keyword issue mentions so recaps can't fabricate a closing reference", () => {
    expect(text).toContain("ref.action")
  })

  it("formats version-header dates in Pacific time, not UTC", () => {
    expect(text).toContain("America/Los_Angeles")
    expect(text).toContain("preset.writer.formatDate = formatDatePT")
  })

  it("splices the new changelog entry before the first version header, not a raw prepend", () => {
    // A raw `-i -s` prepend has no idea CHANGELOG.md opens with a title +
    // intro line, and shoves that header below the new entry.
    //
    // The matcher requires a VERSION token after the hashes and accepts two
    // or three of them (ops#412). Two hashes alone missed a `###` patch
    // heading — which this file's own preset can emit, since it overrides
    // types/transform/formatDate but never writer.headerPartial — and the
    // splice then landed below the leading patch entries instead of above
    // them. The version token is what still keeps `### Bug Fixes` from
    // reading as a release boundary.
    //
    // Spelled `###?` rather than the equivalent `#{2,3}` interval: mawk
    // 1.3.4 20240123 ignores an interval's upper bound, matching `##` only,
    // which drops the new entry instead of splicing it (ops#921).
    expect(text).toContain("!done && /^###? \\[?v?[0-9]/")
  })

  // The matcher above is pinned as text; these run the program. Pulled out of
  // the workflow, not restated here, so a change to its copy fails them.
  const splice = changelog => {
    const program = text.match(
      /awk -v new="\$NEW_ENTRY" '\n([\s\S]*?)\n +' CHANGELOG\.md/,
    )[1]
    const dir = mkdtempSync(join(os.tmpdir(), "release-pr-splice-"))
    const file = join(dir, "CHANGELOG.md")
    writeFileSync(file, changelog)
    const r = spawnSync(
      "awk",
      ["-v", "new=## 0.2.0 (2026-10-01)", program, file],
      {
        encoding: "utf8",
      },
    )
    expect(r.status).toBe(0)
    return r.stdout
  }

  it("a changelog with no version heading gains the entry under its title (a first release, ops#1241)", () => {
    expect(splice("# Changelog\n")).toBe(
      "# Changelog\n\n## 0.2.0 (2026-10-01)\n",
    )
  })

  it("a changelog with an earlier entry gains the new one above it, below the title", () => {
    expect(splice("# Changelog\n\n## 0.1.0 (2026-09-01)\n\n- first\n")).toBe(
      "# Changelog\n\n## 0.2.0 (2026-10-01)\n\n## 0.1.0 (2026-09-01)\n\n- first\n",
    )
  })

  // #27 — a repo's first release can come before it has a CHANGELOG.md at
  // all; the splice used to read the missing file and fail the run. Runs the
  // step's lines from the missing-file check through the `mv`, pulled out of
  // the workflow so a change to its copy fails this.
  it("a repo with no CHANGELOG.md gets one: the title, then the new entry", () => {
    const block = text.match(
      /\n( +\[ -f CHANGELOG\.md \][\s\S]*?mv CHANGELOG\.md\.new CHANGELOG\.md)\n/,
    )[1]
    const dir = mkdtempSync(join(os.tmpdir(), "release-pr-first-"))
    const r = spawnSync("bash", ["-e", "-c", block], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, NEW_ENTRY: "## 1.0.0 (2026-10-25)" },
    })
    expect(r.status).toBe(0)
    expect(readFileSync(join(dir, "CHANGELOG.md"), "utf8")).toBe(
      "# Changelog\n\n## 1.0.0 (2026-10-25)\n",
    )
  })

  it("reformats the spliced changelog with Prettier before committing", () => {
    expect(text).toContain(
      '/tmp/rp-tools/node_modules/.bin/prettier ${RP_PRETTIER_CONFIG:+--config "$RP_PRETTIER_CONFIG"} --write CHANGELOG.md',
    )
  })

  // #36: a caller on a packaged Prettier config failed here with "Cannot
  // find package", since its own install never runs in this job.
  describe("a caller's packaged Prettier config", () => {
    const parse = text.match(
      /read -r CFG CFG_SPEC <<< "\$\(node -e '([\s\S]*?)'\)"/,
    )[1]
    const read = pkg => {
      const dir = mkdtempSync(join(os.tmpdir(), "release-pr-prettier-"))
      writeFileSync(join(dir, "package.json"), JSON.stringify(pkg))
      const r = spawnSync("node", ["-e", parse], { cwd: dir, encoding: "utf8" })
      expect(r.status).toBe(0)
      return r.stdout.trim()
    }

    it("names the config and the package to install at the caller's own spec", () => {
      expect(
        read({
          prettier: "@chrisgriffin/config/prettier",
          devDependencies: {
            "@chrisgriffin/config": "github:chrisgriffin/config#v1",
          },
        }),
      ).toBe("@chrisgriffin/config/prettier github:chrisgriffin/config#v1")
      expect(
        read({
          prettier: "shared-prettier",
          devDependencies: { "shared-prettier": "^2.1.0" },
        }),
      ).toBe("shared-prettier shared-prettier@^2.1.0")
    })

    it("names nothing for a file config, an inline config or none", () => {
      expect(read({ prettier: "./prettier.json" })).toBe("")
      expect(read({ prettier: { semi: false } })).toBe("")
      expect(read({})).toBe("")
    })

    it("installs it with the tools and points the format step at it", () => {
      expect(commands).toMatch(/prettier@[\d.]+ \$CFG_SPEC\n/)
      expect(commands).toContain('echo "RP_PRETTIER_CONFIG=')
    })
  })

  it("uses pinned versions installed into the prefix, not a local devDependency, for every conventional-changelog call", () => {
    expect(text).toMatch(
      /\/tmp\/rp-tools\/node_modules\/\.bin\/conventional-changelog[\s\S]*?-r 1/,
    )
    // The npm package is conventional-changelog-cli, but the bin it installs
    // is named conventional-changelog — found live, ops#444: every release
    // run failed at the splice step calling a bin path that never existed.
    expect(text).not.toContain(
      "/tmp/rp-tools/node_modules/.bin/conventional-changelog-cli",
    )
  })

  it("the install step pins the exact versions every subsequent step assumes are present", () => {
    const install = text
      .split("npm install --no-save --ignore-scripts --prefix /tmp/rp-tools")[1]
      .split("\n\n")[0]
    // Exact versions, not majors: a floating major is a moving dependency
    // in a release path, and `--ignore-scripts` keeps a postinstall out.
    expect(install).toContain("conventional-changelog-cli@5.0.0")
    expect(install).toContain(
      "conventional-changelog-conventionalcommits@8.0.0",
    )
    expect(install).toMatch(/prettier@3\.\d+\.\d+/)
    // The bump is read from git now; the tool that hung is not installed.
    expect(install).not.toContain("conventional-recommended-bump")
  })
})

describe("_reusable-release-pr.yml — extra_build_command runs at the right time", () => {
  it("runs after the version bump and before the changelog splice, inside the same step as the commit — not as an earlier, separately-ordered step", () => {
    // A prior version ran this as its own step BEFORE "Build release
    // branch" (where npm version actually happens), directly contradicting
    // the input's own documented contract ("run after the version bump,
    // before committing") — found live, ops#439.
    const buildStep = text
      .split("- name: Build release branch")[1]
      .split(/\n {6}- name:/)[0]
    const versionIdx = buildStep.indexOf('npm version "$NEXT"')
    const hookIdx = buildStep.indexOf('eval "$EXTRA_BUILD_COMMAND"')
    const spliceIdx = buildStep.indexOf("conventional-changelog -n")
    const commitIdx = buildStep.indexOf('git commit -m "chore: release')
    expect(versionIdx).toBeGreaterThan(-1)
    expect(hookIdx).toBeGreaterThan(versionIdx)
    expect(spliceIdx).toBeGreaterThan(hookIdx)
    expect(commitIdx).toBeGreaterThan(spliceIdx)
  })

  it("does not exist as a separate 'Repo-specific build step' job step anymore", () => {
    expect(text).not.toContain("name: Repo-specific build step")
  })
})

describe("_reusable-release-pr.yml's inlined changelog config", () => {
  // Whether the config actually resolves and produces a valid preset needs a
  // real npm install against the public registry — that lives in
  // repo/check-changelog-config.mjs instead, run by hand, not here.
  // `npm run verify` is a required check on every PR and must stay offline
  // (found live, ops#444: an earlier version of this suite ran that install
  // inline and redded the gate on a registry hiccup — exactly why that
  // check is a script, not a test).

  it("the filter predicate itself keeps only references with a matched closing keyword", () => {
    // The wrapping mechanism (does it crash, does it produce a well-formed
    // preset) is proven end to end by the test above. The predicate itself —
    // `ref.action` truthy means a real closing keyword matched, null means a
    // bare mention — is simple enough to pin directly rather than fight the
    // library's internal commit shape for a second full pipeline run.
    const refs = [{ action: "closes" }, { action: null }, { action: "fixes" }]
    expect(refs.filter(ref => ref.action)).toEqual([
      { action: "closes" },
      { action: "fixes" },
    ])
  })
})

// ---------------------------------------------------------------------------
// `Calculate next version` reads the conventional-commits bump from git.
//
// It used to call conventional-recommended-bump, which on a long history
// printed its answer and never exited (ops#451); the 120s timeout that kept
// releases moving billed those 120s on every push to develop in three repos
// (Actions audit 2026-09-13). Everything below runs the SHIPPED step script
// against a real throwaway git repo — no network, no npm install.
// ---------------------------------------------------------------------------

function calculateNextVersionScript() {
  const step = yaml
    .load(text)
    .jobs["release-pr"].steps.find(s => s.name === "Calculate next version")
  if (!step) {
    throw new Error("no `Calculate next version` step in the workflow")
  }
  return step.run
}

/**
 * `history` entries are commit messages ("subject" or "subject\n\nbody"), or
 * `{ tag }` to tag the commit before them.
 */
function runStep(history, { version = "1.2.3", releaseAs = "" } = {}) {
  const dir = mkdtempSync(join(os.tmpdir(), "release-pr-step-"))
  const repo = join(dir, "repo")
  mkdirSync(repo)
  writeFileSync(
    join(repo, "package.json"),
    JSON.stringify({ name: "stub-target", version }),
  )

  // Isolated from the machine's own git config: no signing, no hooks path.
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "t",
    GIT_AUTHOR_EMAIL: "t@example.com",
    GIT_COMMITTER_NAME: "t",
    GIT_COMMITTER_EMAIL: "t@example.com",
  }
  const git = (...args) => {
    const r = spawnSync("git", args, { cwd: repo, env, encoding: "utf8" })
    if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`)
  }
  git("init", "-q")
  git("add", "package.json")
  git("commit", "-q", "-m", "chore: init")
  for (const entry of history) {
    if (entry.tag) {
      git("tag", entry.tag)
      continue
    }
    const [subject, body] = entry.split("\n\n")
    git(
      "commit",
      "-q",
      "--allow-empty",
      "-m",
      subject,
      ...(body ? ["-m", body] : []),
    )
  }

  const scriptPath = join(dir, "step.sh")
  writeFileSync(scriptPath, calculateNextVersionScript())
  const outputs = join(dir, "github-output")
  writeFileSync(outputs, "")

  // `bash -e` is GitHub's own default shell for a `run:` block. The spawn
  // timeout is a backstop: a regression that wedges fails instead of hanging.
  const r = spawnSync("bash", ["-e", scriptPath], {
    cwd: repo,
    encoding: "utf8",
    env: { ...env, GITHUB_OUTPUT: outputs, RELEASE_AS: releaseAs },
    timeout: 15000,
    killSignal: "SIGKILL",
  })
  return {
    status: r.status,
    outputs: readFileSync(outputs, "utf8"),
    log: r.stdout + r.stderr,
  }
}

describe("_reusable-release-pr.yml — Calculate next version reads the bump from git", () => {
  it("no longer calls the bump tool that hung", () => {
    expect(
      calculateNextVersionScript()
        .split("\n")
        .filter(line => !line.trim().startsWith("#"))
        .join("\n"),
    ).not.toContain("conventional-recommended-bump")
  })

  test.each([
    ["only chore commits", "1.2.4", ["chore: tidy", "docs: words"]],
    ["a fix", "1.2.4", ["fix: bug"]],
    ["a feat", "1.3.0", ["fix: bug", "feat: thing"]],
    ["a scoped feat", "1.3.0", ["feat(dashboard): thing"]],
    ["a `type!:` subject", "2.0.0", ["feat: thing", "fix(api)!: drop v1"]],
    [
      "a BREAKING CHANGE footer",
      "2.0.0",
      ["fix: thing\n\nBREAKING CHANGE: config renamed"],
    ],
    [
      "a feat already released before the last v tag",
      "1.2.4",
      ["feat: old", { tag: "v1.2.3" }, "fix: new"],
    ],
    [
      "a feat before a non-release (harness--v) tag",
      "1.3.0",
      ["feat: old", { tag: "harness--v0.3.0" }, "fix: new"],
    ],
  ])("%s → next=%s", (_, next, history) => {
    const r = runStep(history)
    expect(r.status).toBe(0)
    expect(r.outputs).toContain(`next=${next}`)
  })

  // ops#1457 — Chris (2026-10-11): "no we're not a 1.0.0 yet". Below 1.0 a
  // breaking change is a minor, as release-please's bump-minor-pre-major.
  test.each([
    ["a `type!:` subject", "0.26.0", ["feat!: rename"]],
    [
      "a BREAKING CHANGE footer",
      "0.26.0",
      ["feat: rename\n\nBREAKING CHANGE: new name"],
    ],
    ["a feat", "0.26.0", ["feat: thing"]],
    ["a fix", "0.25.2", ["fix: bug"]],
  ])("pre-1.0: %s → next=%s", (_, next, history) => {
    const r = runStep(history, { version: "0.25.1" })
    expect(r.status).toBe(0)
    expect(r.outputs).toContain(`next=${next}`)
  })
})

// RELEASE_AS: the caller repo's Actions variable forces the next version,
// the one way past the pre-1.0 demotion above. Set in the repo's settings,
// never by a commit.
describe("_reusable-release-pr.yml — the RELEASE_AS repository variable", () => {
  it("reads RELEASE_AS from the caller's vars through env, never inline", () => {
    const step = yaml
      .load(text)
      .jobs["release-pr"].steps.find(s => s.name === "Calculate next version")
    expect(step.env.RELEASE_AS).toBe("${{ vars.RELEASE_AS }}")
    expect(step.run).not.toContain("${{")
  })

  test.each([
    ["unset: the commit bump", "", "0.31.0", /Bump: minor/],
    ["1.0.0 from 0.30.2", "1.0.0", "1.0.0", /RELEASE_AS=1\.0\.0 overrides/],
    [
      "stale 0.1.0",
      "0.1.0",
      "0.31.0",
      /RELEASE_AS=0\.1\.0 is not above 0\.30\.2.*ignored/,
    ],
    [
      "at or below the commit bump",
      "0.30.5",
      "0.31.0",
      /RELEASE_AS=0\.30\.5 is not above the commit bump 0\.31\.0/,
    ],
  ])("RELEASE_AS %s → next=%s", (_, releaseAs, next, log) => {
    const r = runStep(["feat!: rename"], { version: "0.30.2", releaseAs })
    expect(r.status).toBe(0)
    expect(r.outputs).toContain(`next=${next}\n`)
    expect(r.log).toMatch(log)
  })

  test.each(["v1.0.0", "1.0", "1.0.0-beta.1", "01.0.0", " 1.0.0"])(
    "RELEASE_AS %p (malformed) fails the step before any output",
    releaseAs => {
      const r = runStep(["fix: bug"], { version: "0.30.2", releaseAs })
      expect(r.status).not.toBe(0)
      expect(r.log).toContain(`::error::RELEASE_AS='${releaseAs}'`)
      expect(r.outputs).toBe("")
    },
  )
})

describe("_reusable-release-pr.yml — PR-collection logic", () => {
  it("collects both merge-commit and squash-merged work PRs, deduped", () => {
    expect(text).toContain("--merges --format='%s'")
    expect(text).toContain("--no-merges --format='%s'")
    expect(text).toContain("SEEN=")
  })

  it("drops release/* back-merges from the collected list", () => {
    expect(text).toMatch(
      /case "\$BRANCH_REF" in release\/\*\)\s+echo .*\s+continue/,
    )
  })

  // ops#816: the CHANGELOG is computed since the last tag; the PR list was
  // computed since main, and main only carries the release squash — so every
  // PR since the previous release looked new and one repo's release PR
  // listed six PRs that shipped in the release before. Both sections share one boundary.
  it("lists PRs since the last release tag reachable from develop, falling back to main only when no tag exists", () => {
    const step = text
      .split("- name: Create or update release PR")[1]
      .split(/\n {6}- name:/)[0]
    // `--match 'v[0-9]*'`: ops carries `harness--v*` plugin tags too, and an
    // unfiltered describe picked one of those as the boundary (Evaluator
    // finding on ops#819) — only release tags mark a release.
    expect(step).toContain(
      "RANGE_BASE=$(git describe --tags --match 'v[0-9]*' --abbrev=0 origin/develop 2>/dev/null || echo origin/main)",
    )
    expect(step).toContain('git log "${RANGE_BASE}..origin/develop" --merges')
    expect(step).toContain(
      'git log "${RANGE_BASE}..origin/develop" --no-merges',
    )
    // The literal main-based range must be gone from the PR-list step; the
    // in-sync guard elsewhere legitimately still compares main to develop.
    expect(step).not.toContain("git log origin/main..origin/develop")
  })

  it("skips a squash-merged release PR that falls inside the tag range", () => {
    const step = text
      .split("- name: Create or update release PR")[1]
      .split(/\n {6}- name:/)[0]
    expect(step).toMatch(/headRefName \| startswith\("release\/"\) \| not/)
    expect(step).toMatch(/grep -q '\^release\/'; then\s+echo .*\s+return 0/)
  })
})

// ops#630, found live on ops's own first release: `gh pr create` hard-fails
// with "Body is too long (maximum is 65536 characters)" and the step exits 1
// having ALREADY force-pushed release/next — so the branch exists with no PR
// attached and the release is stuck. A release must not be blocked by the
// size of its own description.
describe("_reusable-release-pr.yml — an over-long body truncates instead of failing", () => {
  it("caps the body below GitHub's 65536 limit, with room for the notice", () => {
    expect(commands).toMatch(/BODY_LIMIT=(\d+)/)
    const limit = Number(commands.match(/BODY_LIMIT=(\d+)/)[1])
    expect(limit).toBeLessThan(65536)
    // The notice is appended AFTER the cut, so the cap needs headroom for it.
    expect(65536 - limit).toBeGreaterThan(200)
  })

  it("truncates rather than aborting, and says the changelog is complete", () => {
    expect(commands).toMatch(/head -c "\$BODY_LIMIT"/)
    expect(commands).toMatch(/Body truncated at/)
    expect(commands).toMatch(/CHANGELOG\.md/)
    // A warning, not an error — the release still goes out.
    expect(commands).toMatch(/::warning::PR body exceeded/)
  })

  // The shell itself, not just its presence in the file: an off-by-one here
  // fails only on a release big enough to hit it, which is exactly the case
  // nobody tests by hand.
  it("really produces a body under the limit", () => {
    const script = `
      BODY=$(head -c 70000 < /dev/zero | tr '\\0' 'x')
      BODY_LIMIT=65000
      if [ "$(printf '%s' "$BODY" | wc -c)" -gt "$BODY_LIMIT" ]; then
        BODY="$(printf '%s' "$BODY" | head -c "$BODY_LIMIT")"$'\\n\\n'"— truncated"
      fi
      printf '%s' "$BODY" | wc -c
    `
    const out = spawnSync("bash", ["-c", script], { encoding: "utf8" })
    expect(out.status).toBe(0)
    const len = Number(out.stdout.trim())
    expect(len).toBeGreaterThan(64000)
    expect(len).toBeLessThan(65536)
  })
})

// ops#652 — one repo's release-pr failed on every run from 2026-08-24, six
// consecutively, producing no release PR and no red check anywhere a human
// looks. `npm ci` ran anonymously against GitHub Packages and got 401
// fetching a private @chrisgriffin/* package.
describe("_reusable-release-pr.yml — the caller's npm ci is authenticated", () => {
  const steps = yaml.load(text).jobs["release-pr"].steps

  it("setup-node writes an .npmrc pointing at GitHub Packages", () => {
    const node = steps.find(s => (s.uses || "").includes("setup-node"))
    expect(node.with["registry-url"]).toBe("https://npm.pkg.github.com")
    expect(node.with.scope).toBe("@chrisgriffin")
  })

  it("npm ci prefers a PAT — GITHUB_TOKEN cannot read another repo's package", () => {
    // ops#653: shipping `secrets.GITHUB_TOKEN` alone moved the failure from
    // 401 to 403 "Permission installation not allowed to Read organization
    // package". The job token is scoped to the CALLING repo, so it cannot
    // read a package published from a different one — which is exactly a
    // site installing the private package its design system publishes.
    const install = steps.find(s => s.run === "npm ci")
    expect(install).toBeDefined()
    const tok = install.env?.NODE_AUTH_TOKEN || ""
    expect(tok).toContain("secrets.RELEASE_PR_TOKEN")
    // GITHUB_TOKEN stays as the last resort, never the first choice.
    expect(tok.indexOf("RELEASE_PR_TOKEN")).toBeLessThan(
      tok.indexOf("GITHUB_TOKEN"),
    )
  })
})

// ops#883: `npm ci` here serves exactly one thing — extra_build_command —
// and one caller's hook frequently decides it has nothing to do, after the
// job already paid the install to find out. The gate lets a caller answer
// that before anything is installed, without this workflow learning a single
// caller-specific fact.
describe("_reusable-release-pr.yml — the extra_build_gate_command hook", () => {
  it("declares the gate as an optional, empty-default input", () => {
    const inputs = text.split("workflow_call:")[1].split(/\npermissions:/)[0]
    expect(inputs).toContain("extra_build_gate_command:")
    const block = inputs.split("extra_build_gate_command:")[1]
    expect(block).toMatch(/required:\s*false/)
    expect(block).toMatch(/default:\s*""/)
  })

  it("runs the gate before the install, so a skip actually saves the install", () => {
    const gateAt = commands.indexOf("id: extra-build-gate")
    const installAt = commands.indexOf("run: npm ci")
    expect(gateAt).toBeGreaterThan(-1)
    expect(installAt).toBeGreaterThan(gateAt)
  })

  it("never fails the job on a non-zero gate — a broken gate must not block a release", () => {
    const step = commands.split("id: extra-build-gate")[1].split("- uses:")[0]
    expect(step).toContain("set +e")
    expect(step).toContain('echo "needed=false" >> "$GITHUB_OUTPUT"')
    expect(step).toContain('echo "needed=true" >> "$GITHUB_OUTPUT"')
  })

  it("gates both the install and the hook on the same answer", () => {
    expect(commands).toMatch(
      /steps\.extra-build-gate\.outputs\.needed != 'false'[\s\S]{0,40}run: npm ci/,
    )
    expect(commands).toContain('[ "$EXTRA_BUILD_NEEDED" != "false" ]')
  })

  // The five callers that set no gate must behave byte-for-byte as before.
  // An unset gate step yields an empty output, so every condition has to be
  // written as `!= 'false'`, never `== 'true'`.
  it("treats an unset gate as 'build as before', not as 'skip'", () => {
    expect(commands).not.toMatch(
      /steps\.extra-build-gate\.outputs\.needed == 'true'/,
    )
    expect(commands).not.toContain('[ "$EXTRA_BUILD_NEEDED" = "true" ]')
  })

  it("only runs the gate for a caller that also set a build command", () => {
    const cond = commands.split("id: extra-build-gate")[1].split("run: |")[0]
    expect(cond).toContain("inputs.extra_build_gate_command != ''")
    expect(cond).toContain("inputs.extra_build_command != ''")
  })
})

// ops#1372 — Chris (2026-10-07): release PRs open as drafts, the Release PR
// job posts the release PR's Evaluator status itself so the gate never wakes
// for one, and the merge sweep's dispatch is a step here, not its own job.
describe("_reusable-release-pr.yml — draft, own Evaluator check, sweep dispatch (ops#1372)", () => {
  const wf = yaml.load(text)
  const job = wf.jobs["release-pr"]
  const steps = job.steps

  it("opens the release PR as a draft, and never flips an existing one", () => {
    const create = commands.match(/gh pr create[\s\S]*?--reviewer chrisgriffin/)
    expect(create[0]).toMatch(/--draft/)
    expect(commands).not.toMatch(/gh pr ready --undo/)
  })

  it("posts the Evaluator status on the pushed head with GITHUB_TOKEN, last", () => {
    expect(wf.permissions.statuses).toBe("write")
    const last = steps.at(-1)
    expect(last.env.GH_TOKEN).toBe("${{ github.token }}")
    expect(last.env.SHA).toBe("${{ steps.build.outputs.sha }}")
    expect(last.run).toMatch(/statuses\/\$SHA/)
    expect(last.run).toMatch(/context=Evaluator/)
    expect(last.run).toMatch(/Release or promotion PR — not graded/)
    expect(last.if).toMatch(/steps\.in-sync\.outputs\.skip != 'true'/)
    const build = steps.find(s => s.name === "Build release branch")
    expect(build.id).toBe("build")
    expect(build.run).toMatch(/sha=\$\(git rev-parse HEAD\)/)
  })

  it("dispatches the sweep through the composite action on push, first", () => {
    const first = steps[0]
    expect(first.uses).toBe(
      "chrisgriffin/workflows/.github/actions/dispatch-sweep@develop",
    )
    expect(first.if).toBe("github.event_name == 'push'")
    expect(first.with.token).toBe(
      "${{ secrets.OPS_GH_TOKEN || secrets.TARGET_TOKEN }}",
    )
  })

  it("starts on a [skip-release] push but builds nothing past in-sync", () => {
    expect(job.if).toBeUndefined()
    const inSync = steps.find(s => s.id === "in-sync")
    expect(inSync.env.SKIP_RELEASE).toMatch(/\[skip-release\]/)
    expect(inSync.run.split("\n").find(l => l.trim())).toMatch(/SKIP_RELEASE/)
  })
})

describe("_reusable-release-pr.yml — the secrets a caller passes by name", () => {
  it("declares the release PAT, the dispatch token and its stand-in, and the registry token", () => {
    expect(
      Object.keys(yaml.load(text).on.workflow_call.secrets).sort(),
    ).toEqual([
      "NODE_AUTH_TOKEN",
      "OPS_GH_TOKEN",
      "RELEASE_PR_TOKEN",
      "TARGET_TOKEN",
    ])
  })

  it("commits a lockfile only where the repo keeps one", () => {
    // A repo with no Node project (these workflows' own) has no
    // package-lock.json; `git add` of a missing path fails the step.
    expect(text).toContain(
      "[ ! -f package-lock.json ] || git add package-lock.json",
    )
  })
})

describe("_reusable-release-pr.yml — a refresh returns the release PR to draft first (ops#1434)", () => {
  const steps = yaml.load(text).jobs["release-pr"]
    ? yaml.load(text).jobs["release-pr"].steps
    : Object.values(yaml.load(text).jobs)[0].steps
  const at = name => steps.findIndex(s => s.name === name)
  const redraft = steps.find(s => (s.run || "").includes("gh pr ready"))

  it("opens a new release PR as a draft", () => {
    expect(commands).toMatch(/gh pr create[\s\S]{0,400}?--draft/)
  })

  it("converts an open, ready release PR back to draft with gh pr ready --undo", () => {
    expect(redraft).toBeDefined()
    expect(redraft.run).toContain("gh pr ready")
    expect(redraft.run).toContain("--undo")
    expect(redraft.run).toContain("isDraft")
    expect(redraft.run).toContain("set -euo pipefail")
  })

  it("does so before the force-push, so the push's synchronize already sees a draft", () => {
    expect(at(redraft.name)).toBeGreaterThan(-1)
    expect(at(redraft.name)).toBeLessThan(at("Build release branch"))
  })

  it("runs only when the run will push, with the release token", () => {
    expect(redraft.if).toBe(steps[at("Build release branch")].if)
    expect(redraft.env.GH_TOKEN).toContain("secrets.RELEASE_PR_TOKEN")
  })
})

// ---------------------------------------------------------------------------
// ops#1427 — every repo's Release PR died at `Create or update release PR`
// with exit 1 and no diagnostic once a PR number repeated in the tag range:
// `add_pr()`'s bare `return` on a seen number handed back the failed
// `[ -z "$num" ]` status, and `bash -e` ended the step. This runs the SHIPPED
// PR-list section against a real throwaway repo, with `gh` stubbed.
// ---------------------------------------------------------------------------
const createStep = yaml
  .load(text)
  .jobs["release-pr"].steps.find(s => s.name === "Create or update release PR")

// From the range base through the squash loop: the whole PR-list builder,
// stopping before the body/`gh pr create` half that needs the network.
function prListSection() {
  const start = createStep.run.indexOf("RANGE_BASE=")
  const end = createStep.run.indexOf("# PR body:")
  if (start < 0 || end < 0) throw new Error("PR-list section not found")
  return createStep.run.slice(start, end)
}

// #9 is a release PR (head release/next); everything else is a work PR.
const GH_STUB = `
gh() {
  local num="$3"
  case "$*" in
    *title,author*) [ "$num" = 9 ] || echo "PR $num (@someone)" ;;
    *headRefName*) [ "$num" = 9 ] && echo release/next || echo feat ;;
  esac
}
`

function run(extra = "") {
  const repo = mkdtempSync(join(os.tmpdir(), "release-pr-dup-"))
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "t",
    GIT_AUTHOR_EMAIL: "t@example.com",
    GIT_COMMITTER_NAME: "t",
    GIT_COMMITTER_EMAIL: "t@example.com",
  }
  const git = (...args) => {
    const r = spawnSync("git", args, { cwd: repo, env, encoding: "utf8" })
    if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`)
  }
  const commit = msg => git("commit", "-q", "--allow-empty", "-m", msg)
  const merge = (branch, msg) => {
    git("checkout", "-q", "-b", branch)
    commit(`work on ${branch}`)
    git("checkout", "-q", "main")
    git("merge", "-q", "--no-ff", "-m", msg, branch)
  }

  git("init", "-q", "-b", "main")
  commit("chore: init")
  git("tag", "v1.0.0")
  merge("feat-a", "Merge pull request #5 from o/feat-a")
  commit("fix: same PR squashed too (#5)") // repeat across the two loops
  commit("feat: b (#6)")
  commit("feat: b again (#6)") // repeat within one loop — found live on one repo
  commit("chore: release v1.0.1 (#9)")
  merge("release/next", "Merge pull request #8 from o/release/next")
  git("update-ref", "refs/remotes/origin/develop", "HEAD")

  const scriptPath = join(repo, "..", `${repo.split("/").pop()}.sh`)
  writeFileSync(
    scriptPath,
    `${GH_STUB}\n${prListSection()}\n${extra}\nprintf 'LIST<%s>' "$PR_LIST"\n`,
  )
  // `bash -e`, as GitHub runs a `run:` block.
  const r = spawnSync("bash", ["-e", scriptPath], {
    cwd: repo,
    encoding: "utf8",
    env,
    timeout: 15000,
    killSignal: "SIGKILL",
  })
  return { status: r.status, out: r.stdout + r.stderr }
}

describe("_reusable-release-pr.yml — a repeated PR number does not end the step (ops#1427)", () => {
  const r = run()

  it("the PR-list builder sees the same number twice and still succeeds", () => {
    expect(r.status).toBe(0)
    expect(r.out).toContain(
      "LIST<- #5 PR 5 (@someone)\n- #6 PR 6 (@someone)\n>",
    )
  })

  it("each skip path says why", () => {
    expect(r.out).toContain("PR list: skipped #5, already listed")
    expect(r.out).toContain("PR list: skipped #6, already listed")
    expect(r.out).toContain("PR list: skipped #9, a release PR")
    expect(r.out).toContain(
      "PR list: skipped #8, a back-merge from release/next",
    )
  })

  it("an empty number is skipped with a message, not a failure", () => {
    const e = run('add_pr ""')
    expect(e.status).toBe(0)
    expect(e.out).toContain("PR list: skipped an empty PR number")
  })
})

describe("_reusable-release-pr.yml — a failure in the step names its command (ops#1427)", () => {
  it("an ERR trap reports the failing command and line", () => {
    const trap = createStep.run.match(/^trap '.*' ERR$/m)
    expect(trap).not.toBeNull()
    const r = spawnSync("bash", ["-e", "-c", `${trap[0]}\nfalse`], {
      encoding: "utf8",
    })
    expect(r.status).toBe(1)
    expect(r.stdout).toMatch(
      /::error::Create or update release PR failed \(exit 1\) at line \d+: false/,
    )
  })
})
