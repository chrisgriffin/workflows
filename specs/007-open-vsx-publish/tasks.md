# Tasks: Publish VS Code extensions to Open VSX on release

- [x] T001 `test/create-github-release.test.js`: pin both registries (tokens per tool, notices, independent failures, `--skip-duplicate`, pinned ovsx); red on `develop` and on #17's head.
- [x] T002 `_reusable-create-github-release.yml`: `OVSX_PAT` and the Open VSX publish.
- [x] T003 README: `OVSX_PAT`, the namespace, no card.
- [x] T004 `npm test` and `actionlint` clean.
- [x] T005 token-atlas stub passes `OVSX_PAT`, in its own PR that merges after the release that moves `v1`.
- [ ] T006 (after merge) The next release moves `v1`; with `OVSX_PAT` set, a token-atlas release publishes to Open VSX.
