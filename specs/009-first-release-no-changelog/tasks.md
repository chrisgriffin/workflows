# Tasks: A repo's first release works with no CHANGELOG.md

- [x] T001 The release body writes `# Changelog` to a missing `CHANGELOG.md` before the splice (#26).
- [x] T002 `test/release-pr.test.js` runs that line and the splice on an empty repo, and an existing file is untouched (#26).
- [x] T003 `npm test` green; the Runnable run at the head and pasted in the PR body.
- [ ] T004 (after merge) Once `v1` moves, re-run chrisgriffin/config's Release PR workflow and confirm it opens the release PR.
