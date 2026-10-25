# Plan: A repo's first release works with no CHANGELOG.md

## Technical context

- The splice in `_reusable-release-pr.yml` reads `CHANGELOG.md` with `awk` and writes `CHANGELOG.md.new`; its `END` branch already places an entry under a title-only file.
- `test/release-pr.test.js` pulls the `awk` program out of the workflow and runs it.

## Design

1. One line before the splice: `[ -f CHANGELOG.md ] || printf '# Changelog\n' > CHANGELOG.md`.
2. A test that pulls that line out of the workflow, checks it runs before the splice, runs it in an empty directory, splices into the result, and confirms an existing file is left alone.

## Surfaces touched

- `.github/workflows/_reusable-release-pr.yml`: every caller's release PR uses it at `v1`; the fix reaches callers when this repo's next release moves `v1`.
- No input, output or permission change.
