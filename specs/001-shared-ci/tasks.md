# Tasks: Host the fleet's reusable workflows and composite actions here

All shipped in [PR #2](https://github.com/chrisgriffin/workflows/pull/2), merged as `18c3d26`.

- [x] T001 Bootstrap: README stub and MIT license, one commit on `develop`.
- [x] T002 Copy the seven `_reusable-*.yml` and the `pr-loop-gate` and `dispatch-sweep` actions; repoint internal `uses:` to `chrisgriffin/workflows/...@develop`.
- [x] T003 `pr-loop-gate`: `ops-token` input, operator checkout into `.pr-loop-gate`, run the script from there; `_reusable-evaluator-gate.yml` passes the token and skips a fork PR.
- [x] T004 `_reusable-node-ci.yml`: `claude_md_budget`, `docs_owed`, `docs_only_paths` inputs replace the per-repo tables; `_reusable-create-github-release.yml`: `marketplace_packages` replaces the Marketplace `case`.
- [x] T005 `_reusable-claude-mention.yml`: OWNER/MEMBER/COLLABORATOR required in the job `if:` and the detect step.
- [x] T006 Scrub every private reference; no `pull_request_target`.
- [x] T007 README, one section per workflow; `.github/CODEOWNERS`.
- [x] T008 Hardening pass: `persist-credentials: false`, per-command push auth, exact pins with `--ignore-scripts`, token-identity comments cut.
- [x] T009 `actionlint` and the grep clean; canary green on the branch, then on `develop` after the merge.
