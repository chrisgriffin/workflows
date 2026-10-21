# Spec: The bodies' tests live beside the bodies

## Overview

The seven reusable workflow bodies and both composite actions moved here from the operator (ops#1683), but the tests that pin what their shell does stayed behind in the operator, reading its own copies of the files. Once the operator deletes those copies (phase B's last PR), a change to a body here would be checked by nothing: the operator's suite cannot read a file in another repo, and this repo's CI is actionlint alone. This moves every test that reads a body or an action into this repo, where the PR that changes a body runs it.

## User scenarios

- A PR here edits `_reusable-release-pr.yml`'s version-bump shell: `build / ci` runs that step against a throwaway git repo and fails if the bump is wrong, before anyone merges it.
- A PR here adds a GitHub-owned action by tag, or a job with no timeout, or a body that declares no secrets: `build / ci` names the line.
- The operator deletes its `_reusable-*.yml` copies and the tests that read them: nothing is lost, because each test is here.

## Functional requirements

- FR-1: `package.json` gains `jest` and `js-yaml` as dev dependencies, `npm test` runs Jest, and `package-lock.json` is committed; `node_modules/` is ignored.
- FR-2: `test/` holds one suite per body (`node-ci`, `release-pr`, `create-github-release`, `sync-main-to-develop`, `claude-mention`) and `test/workflows.test.js` for the rules every file follows: `workflow_call` only, secrets declared by name, no `chrisgriffin/ops/.github` reference, a timeout on every `runs-on` job, a full commit SHA with version comment on every GitHub-owned action, this repo's own stubs at `develop`.
- FR-3: Every test that ran a step's shell in the operator runs it here the same way (`bash -e`, the step's own `env:` names) against fixtures; the per-repo table tests become input tests (`claude_md_budget`, `docs_owed`, `docs_only_paths`, `marketplace_packages`).
- FR-4: The docs/ check's cases build their trees in tmp from the inline `MANIFEST`'s shape (title, block order), never from the operator's template text: that text links the operator's private surfaces and stays there, so the one green path that needs it (a tree laid from the real templates) is proven in the operator's suite against the checker's copy there.
- FR-5: No test names a private repo, a local path, a vault or a password manager; a repo is "one target" or `o/r`.
- FR-6: `build-check.yml` runs `npm ci` and `npm test` after actionlint, with `actions/setup-node` pinned to a full SHA; the README has a `## Tests` section and names what the operator's suite still holds.

## Success criteria

- [ ] **Runnable:** `npm ci && npm test 2>&1 | grep -E '^Tests:'` prints `Tests:       243 passed, 243 total` on the PR head; on `develop` there is no `test` script.
- [ ] `grep -rniE 'chrisgriffin\.io|design-drift|token-atlas|ds-kit|resume-kit|workstation|1password|op://|keychain|czg-vault|obsidian|/Users/' test package.json` prints nothing.
- [ ] The PR's `build / ci` check runs the suite and succeeds.

## Needs from Chris

none
