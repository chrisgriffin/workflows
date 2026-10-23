# Spec: A repository variable forces the next release version

## Overview

The Release PR body computes the next version from conventional commits and, below 1.0.0, demotes a breaking change to a minor on purpose (ops#1457): 1.0.0 is the owner's call, never a commit footer's. That leaves no way to make the call. This adds one: the caller repo's Actions variable `RELEASE_AS`, set in the repo's settings rather than by a commit, forces the next version when it is above what the commits would give. Chris requested this on 2026-10-21, for token-atlas's next release to be 1.0.0.

## User scenarios

- A repo at 0.30.2 sets `RELEASE_AS=1.0.0`; the next push to `develop` opens or refreshes `release/next` as `chore: release v1.0.0`, with `package.json` and the changelog header at 1.0.0.
- After 1.0.0 ships and merges back, the variable still reads 1.0.0; it is not above the current version, so the run logs that it is stale and releases by commits as before.
- Someone sets `RELEASE_AS=v1.0` by mistake; the step fails with an error naming the value and the fix, before anything is pushed.
- No variable set: every run behaves exactly as today, pre-1.0 demotion included.

## Functional requirements

- FR-1: `Calculate next version` reads `vars.RELEASE_AS` through its step `env:`, never interpolated into the script. In a reusable workflow `vars` resolves to the caller repository's variables (GitHub docs, "Configuration variable precedence").
- FR-2: Set and a plain `X.Y.Z` (no `v`, no pre-release, no leading zeros) above the computed next version: it becomes the next version. Not above the current version: ignored with a log line. Above current but not above the computed next: the computed one stands, with a log line.
- FR-3: Set but not a plain `X.Y.Z`: the step fails with an `::error::` naming the value.
- FR-4: Every later step (tag race guard, `npm version`, changelog header, PR title) reads the overridden version from the step's `next` output; nothing recomputes it.
- FR-5: The README section for this body documents the variable.

## Success criteria

- [ ] **Runnable:** `npx jest test/release-pr.test.js -t 'RELEASE_AS'` passes on the PR head; on `develop` it fails (the override and the malformed-value cases).
- [ ] A test or check exists that would have failed before this change landed.
- [ ] The README's `_reusable-release-pr.yml` section says how to set `RELEASE_AS` and that a stale value is ignored.
- [ ] (after merge) Once this repo's release moves `v1`, token-atlas's next Release PR run titles its PR `chore: release v1.0.0`.

## Needs from Chris

1. Merge this repo's `release/next` PR after this one, so the `v1` tag every caller uses moves onto the change. After merge.
