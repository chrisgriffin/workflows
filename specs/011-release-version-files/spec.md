# Spec: release-pr keeps version files on the package version

Issue: [#34](https://github.com/chrisgriffin/workflows/issues/34)

## Problem

`npm version` bumps only `package.json`. A caller whose plugin manifest ships at the same version copies it across in `extra_build_command` with a `JSON.stringify` round trip, which undoes Prettier's layout and fails the caller's `format:check` on the release PR, after an `npm ci` the edit never needed.

## Success criteria

- [x] `_reusable-release-pr.yml` takes an optional `version_files` input: space-separated JSON files whose `"version"` value follows `package.json`. After `npm version`, each one's `"version"` value is set to the new version in place, the rest of the file byte for byte, and the file is committed with the release.
- [x] A listed file with no `"version"` field fails the step, naming the file.
- [x] Setting `version_files` alone runs no `npm ci`.
- [x] **Runnable:** `npx jest test/release-pr.test.js -t "version_files"` exits 0. On `develop` it matches no test.

## Needs from Chris

none
