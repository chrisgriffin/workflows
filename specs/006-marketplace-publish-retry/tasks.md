# Tasks: Let a re-run retry a failed Marketplace publish

- [x] T001 `test/create-github-release.test.js`: pin the `marketplace` job (after the release, not gated on its skip, version from its output, download by version, `--skip-duplicate`, the no-PAT notice, red on failure); red on `develop`.
- [x] T002 `_reusable-create-github-release.yml`: move the publish into the `marketplace` job.
- [x] T003 README: the job, the retry, the PAT's retirement and the manual upload after it.
- [x] T004 `npm test` and `actionlint` clean.
- [ ] T005 (after merge) The next release moves `v1`; a token-atlas release run's `marketplace` job reports the no-PAT notice (or publishes, once a PAT exists).
