# Spec: A repo's first release works with no CHANGELOG.md

## Overview

`_reusable-release-pr.yml` splices the new release entry into `CHANGELOG.md` with `awk`. When the repo has no `CHANGELOG.md` yet, `awk` exits 2 and the job stops before it opens the release PR. [chrisgriffin/config](https://github.com/chrisgriffin/config)'s first release hit this on 2026-10-25 ([run 40160576462](https://github.com/chrisgriffin/config/actions/runs/40160576462)). The splice already handles a changelog with only a title (a first release, ops#1241); a missing file now becomes that case. Fixes #26.

## User scenarios

- A new repo with no `CHANGELOG.md` runs its first release: it gets a `CHANGELOG.md` titled `# Changelog` with the first entry under it, and the release PR opens.
- A repo with a `CHANGELOG.md` releases exactly as before.

## Functional requirements

- FR-1: Before the splice, the step writes `# Changelog` to `CHANGELOG.md` when the file does not exist.
- FR-2: An existing `CHANGELOG.md` is not touched by that line.

## Success criteria

- [ ] A repo with no `CHANGELOG.md` gets one, titled `# Changelog`, with its first entry under the title, and the release PR opens.
- [ ] A repo that already has a `CHANGELOG.md` is spliced exactly as before.
- [ ] **Runnable:** `npx jest test/release-pr.test.js -t 'no CHANGELOG'` runs at least one test and passes. On `develop` none match.

## Needs from Chris

none
