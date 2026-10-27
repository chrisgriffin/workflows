# Spec: release-pr formats CHANGELOG.md with a caller's packaged Prettier config

Issue: [#36](https://github.com/chrisgriffin/workflows/issues/36)

## Problem

The release step formats `CHANGELOG.md` with the tool prefix's Prettier, which reads the caller's config. A caller that names its config as a package fails with "Cannot find package", because the job installs the caller's dependencies only for `extra_build_command`. This repo's own release run failed that way after #35 merged.

## Success criteria

- [x] When the caller's `package.json` names its Prettier config as a package, the tooling step installs that package (at the caller's own dependency spec) into `/tmp/rp-tools`, and `CHANGELOG.md` is formatted with that config.
- [x] A caller with a file config (`./prettier.json`), a config file, or none is formatted as before.
- [x] **Runnable:** `npx jest test/release-pr.test.js -t "Prettier config"` exits 0. On `develop` it matches no test.

## Needs from Chris

none
