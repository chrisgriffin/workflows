# Tasks: This repo runs on the fleet's own stubs

- [x] T001 `.github/workflows/evaluator-gate.yml` calling `_reusable-evaluator-gate.yml@develop`, `secrets: inherit`.
- [x] T002 `.github/workflows/claude-mention.yml` calling `_reusable-claude-mention.yml@develop`, `target: workflows`, `secrets: inherit`.
- [x] T003 `.github/workflows/build-check.yml`: job `verify`, pinned `actionlint` tarball verified by sha256, `-shellcheck=shellcheck` over every workflow.
- [x] T004 Quote the `$GITHUB_OUTPUT` redirects and `BUMP=` assignments in `_reusable-release-pr.yml`; `actionlint -shellcheck=shellcheck` exits 0.
- [x] T005 `specs/001-shared-ci/` after the fact; this folder.
- [x] T006 README section on this repo's own workflows.
- [ ] T007 PR with `Closes`, `chrisgriffin` requested as reviewer; `build / verify` green.
- [ ] T008 (after merge, Chris) secrets and ruleset per the spec's `## Needs from Chris`.
