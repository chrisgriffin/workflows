# Tasks: The release commit is written by the release token's account

- [x] T001 `.github/workflows/_reusable-release-pr.yml`: Configure git sets the author from `gh api user`, falling back to github-actions[bot]
- [x] T002 `test/release-pr.test.js`: run the step with a stubbed `gh` (login and id; a 403; empty output)
- [x] T003 Callers: confirm no stub change (no new input, secret or permission)
- [x] T005 `.github/workflows/_reusable-release-pr.yml`: a `::warning::` when `RELEASE_PR_TOKEN` is set and `gh api user` fails; a test beside the three
- [x] T006 `README.md` and the workflow's secret docs: the token's account authors the release commit; an App installation token leaves the bot
- [ ] T004 (after merge) Next private caller's release commit authored by cgio-agent; its "Deploy preview" answers HTTP 200
