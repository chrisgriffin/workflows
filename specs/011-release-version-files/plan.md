# Plan: release-pr keeps version files on the package version

## Design

A `version_files` input, passed to the "Build release branch" step as `VERSION_FILES`. Right after `npm version`, a loop sets each file's first `"version": "…"` value with a regex replace in `node -e` (Node is already set up for `npm version`) and fails, naming the file, when there is none. The files are `git add`ed with `package.json`. The `npm ci` step's condition is untouched, so the input alone installs nothing.

## Surfaces touched

- `.github/workflows/_reusable-release-pr.yml`: reaches callers when `v1` moves with this repo's next release. A caller can pass `version_files` only after that; passing it to an older `v1` fails the run on an unknown input.
- Callers that copy a manifest version in `extra_build_command` switch to `version_files` in their own stubs, each after `v1` moves.
- `test/release-pr.test.js`: runs the loop from the workflow text.
- `README.md` § `_reusable-release-pr.yml`: its Inputs line lists `version_files`.
