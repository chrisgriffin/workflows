# Tasks: The release commit is written by the release token's account

- [x] T001 `.github/workflows/_reusable-release-pr.yml`: Configure git sets the author from `gh api user`, falling back to github-actions[bot]
- [x] T002 `test/release-pr.test.js`: run the step with a stubbed `gh` (login and id; a 403; empty output)
- [x] T003 Callers: confirm no stub change (no new input, secret or permission)
- [ ] T004 (after merge) Next chrisgriffin.io release commit authored by cgio-agent; its "Deploy preview" answers HTTP 200
