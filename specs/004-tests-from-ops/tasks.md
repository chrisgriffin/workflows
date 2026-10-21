# Tasks: The bodies' tests live beside the bodies

- [x] T001 `package.json`: `jest`, `js-yaml`, `npm test`; `package-lock.json`; `.gitignore`.
- [x] T002 `test/workflows.test.js`: the rules every file follows, the gate's shape, the sweep dispatch, this repo's own stubs.
- [x] T003 `test/node-ci.test.js`: inputs, the ci guard, permissions, the scope step, the budget step, the docs check and the structure check against trees built in tmp.
- [x] T004 `test/release-pr.test.js`, `test/create-github-release.test.js`, `test/sync-main-to-develop.test.js`, `test/claude-mention.test.js`.
- [x] T005 No private name in `test/` (the spec's grep prints nothing).
- [x] T006 `build-check.yml` runs the suite; README § Tests.
- [x] T007 PR on top of #6 with `Closes`, reviewer requested; `build / ci` green (the PR that carries this commit).
