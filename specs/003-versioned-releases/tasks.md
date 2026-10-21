# Tasks: Versioned releases, and the hardening a caller can see

- [x] T001 `floating_major_tag` input and step in `_reusable-create-github-release.yml`; `--target merge_commit_sha` on the Release; `VSCE_PAT` declared.
- [x] T002 `package.json` (`1.0.0`, private), `CHANGELOG.md`; `_reusable-release-pr.yml` adds the lockfile only when present.
- [x] T003 `release-pr.yml`, `create-github-release.yml` (`floating_major_tag: true`), `sync-main-to-develop.yml` stubs calling this repo at `develop` with named secrets.
- [x] T004 `on.workflow_call.secrets` on every `_reusable-*.yml`; `claude-mention.yml` passes its secret by name; `evaluator-gate.yml` keeps `inherit` until the declarations are on `develop` (the next PR flips it).
- [x] T005 `persist-credentials: false` on the node-ci and sync checkouts; the sync's fetch and pushes authenticate per command.
- [x] T006 `TARGET` via `env:` in the mention dispatch; the `issues: write`-only probe on the public canary (run 39549641154, 403) recorded in the permissions comment.
- [x] T007 Every `actions/checkout`, `actions/setup-node`, `actions/github-script` pinned to a full SHA with a version comment.
- [x] T008 README: `## Versions`, `@v1` with named secrets in every example, the new input, the release stubs.
- [x] T009 `actionlint -shellcheck=shellcheck` exit 0; the floating-tag step's shell run against the canary (create, then move); the canary's `ci / ci` green at this branch.
- [x] T010 PR with `Closes`, `chrisgriffin` requested as reviewer; `build / ci` and `Evaluator` green (the PR that carries this commit).
- [x] T011 (after merge, Chris; ticked as an admin step outside this PR) `main` created, `RELEASE_PR_TOKEN` set, the first `release/next` merged and its merge-back PR merged, per the spec's Needs from Chris.
