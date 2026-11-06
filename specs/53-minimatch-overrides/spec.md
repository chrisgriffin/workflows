# Spec: Dependabot's minimatch security update fails on develop

Issue: chrisgriffin/workflows#53

## Overview

Dependabot's security update for `minimatch` (advisory
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249),
patched in `11.0.1`, affected `>=7.0.0 <11.0.1`) failed on `develop` on
2026-11-05 and 2026-11-06.

**Cause.** No package in the tree allows a patched `minimatch` for an
affected copy: every parent of an affected copy pins a major the advisory
covers (`^9`/`^10`) — `@typescript-eslint/typescript-estree` and `glob@13`
want `^10.2.2`, `test-exclude@7` wants `^10.2.2`, and its nested `glob@10`
wants `^9.0.4`. ESLint's parents (`eslint`, `@eslint/config-array`,
`@eslint/eslintrc`) pin `minimatch` `^3.1.5`, which sits outside the
advisory. A security update only moves a transitive
dependency within its parents' ranges, so there is nothing it can resolve
to, and the job fails. `glob` `9.0.0`–`14.0.1` carries its own advisory
(GHSA-3g3m-2fjr-6pw4) and pulls the vulnerable `minimatch` with it.

## User scenarios

- A maintainer runs `npm ls minimatch` on `develop` and sees no version
  inside the advisory.
- Dependabot's next `npm_and_yarn` run on `develop` has nothing it cannot
  resolve, and finishes green.

## Functional requirements

- FR-1: `package.json` carries `overrides` that lift `minimatch` 7.x–11.x to
  `^11.0.1` and `glob` 9.x–14.x to `^14.0.2`, keyed on bounded ranges so a
  future major is never forced down and `minimatch@3` (ESLint's) is left alone.
- FR-2: `package-lock.json` is regenerated from those overrides.
- FR-3: `npm run verify` stays green.

## Success criteria

- [ ] The cause of the failing `minimatch` update job is named on this issue.
- [ ] `npm ls minimatch` in `chrisgriffin/workflows` on `develop` shows only versions outside the security advisory that triggered the update.
- [ ] after-merge: Dependabot's next `npm_and_yarn` update run for `chrisgriffin/workflows` on `develop` finishes without failure.
- [ ] after-merge: **Runnable:** `gh api -H "Accept: application/vnd.github.raw" "repos/chrisgriffin/ops/contents/incidents/latest.json?ref=incident-ledger" --jq '.incidents[] | select(.id=="1e0a78f80292") | .resolved_at'` prints a timestamp, not `null` (it prints `null` today, while the record is open).
