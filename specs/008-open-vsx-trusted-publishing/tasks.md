# Tasks: Publish to Open VSX with trusted publishing

- [x] T001 `test/create-github-release.test.js`: trusted publishing with no token, token precedence, failure reds the job, notices name both switches; red on `develop`.
- [x] T002 `_reusable-create-github-release.yml`: the ID-token branch and notices.
- [x] T003 README: switching a caller to trusted publishing.
- [x] T004 `npm test` and `actionlint` clean.
- [ ] T005 (after merge) The next release moves `v1`; token-atlas, registered and granting `id-token: write`, publishes to Open VSX with no `OVSX_PAT`.
