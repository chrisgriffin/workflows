# Tasks: The release job reads a publish back from the registry

- [x] T001 `test/create-github-release.test.js`: stub `curl`, `unzip` and `sleep`, and add the `reads the publish back` tests; run them red on `develop`'s workflow.
- [x] T002 `_reusable-create-github-release.yml`: `publish_to`, `read_back`, the bounded poll, the `MISSING` and `UNCHECKED` errors, the job's timeout and comment.
- [x] T003 `README.md`: the read-back, its bound and how to re-check, in the workflow's section and § Tests.
- [x] T004 Run the step against a real `.vsix` and both live read APIs, with only `gh` and `npx` stubbed.
- [x] T005 `npm run verify` and actionlint green; the PR closes #33.
