# Tasks: The release PR's fetches authenticate themselves

- [x] T001 `test/workflows.test.js`: every body's remote git call carries its own header; red on `develop` with the two release-PR fetches.
- [x] T002 `_reusable-release-pr.yml`: authenticate the in-sync fetch and the tag-race fetch per command; the checkout comment says so.
- [x] T003 `test/sync-main-to-develop.test.js`: drop the narrower copy of the check, point at the fleet rule.
- [x] T004 `npm test` and `actionlint` clean.
- [x] T005 Prove it from a private caller before merge: a probe stub at this branch fetches `main` where the same stub at `develop` fails with the username error.
- [ ] T006 (after merge) The next release moves `v1`; a private fleet repo's Release PR run goes green.
