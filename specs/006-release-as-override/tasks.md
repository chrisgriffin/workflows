# Tasks: A repository variable forces the next release version

- [x] T001 `test/release-pr.test.js`: run the shipped step with `RELEASE_AS` unset, 1.0.0 from 0.30.2, stale 0.1.0, below the commit bump, and malformed; assert the step reads it from `vars` through `env:`. Red on `develop`.
- [x] T002 `_reusable-release-pr.yml`: read `RELEASE_AS` in `Calculate next version`, validate, override, ignore stale; header comment names it.
- [x] T003 README: document `RELEASE_AS` in the `_reusable-release-pr.yml` section.
- [x] T004 `npm test` and `actionlint` clean.
- [ ] T005 (after merge) This repo's release moves `v1`; token-atlas's next Release PR opens as `chore: release v1.0.0`.
