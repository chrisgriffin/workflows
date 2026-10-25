# Spec: Start CHANGELOG.md on a repo's first Release PR

## Overview

`_reusable-release-pr.yml` splices the new changelog entry into `CHANGELOG.md` with awk, which fails when the file does not exist yet, so a new repo's first push to `develop` opens no Release PR. The step starts the file with a `# Changelog` title when it is missing. Fixes #27.

## Functional requirements

- FR-1: Before the splice, a missing `CHANGELOG.md` is created holding `# Changelog`.
- FR-2: An existing `CHANGELOG.md` is spliced exactly as before.

## Success criteria

- [ ] A caller with no `CHANGELOG.md` gets a Release PR whose `CHANGELOG.md` is a `# Changelog` title followed by the new entry.
- [ ] A caller that already has a `CHANGELOG.md` gets the same splice as today.
- [ ] **Runnable:** `npx jest test/release-pr.test.js -t 'no CHANGELOG.md'` runs at least one test and passes. On `develop` none match.

## Needs from Chris

none
