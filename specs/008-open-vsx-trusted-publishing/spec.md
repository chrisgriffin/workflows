# Spec: Publish to Open VSX with trusted publishing

## Overview

The `marketplace` job publishes to Open VSX only with a caller's `OVSX_PAT`, a long-lived token stored as a secret. Open VSX's trusted publishing trades the run's GitHub OIDC ID token for a five-minute publishing token instead, so a caller that registers its release stub on open-vsx.org and grants `id-token: write` can stop storing one. Fixes #22.

## User scenarios

- A caller grants `id-token: write`, passes no `OVSX_PAT`, and has registered its stub as a trusted publisher: its release publishes to Open VSX with no secret.
- A caller publishing an extension's first version, which Open VSX requires to use a token: it passes `OVSX_PAT`, and the token is used.
- A caller with neither: Open VSX is skipped with a notice naming both ways to turn it on.

## Functional requirements

- FR-1: With no `OVSX_PAT` and an ID-token source in the runner (`ACTIONS_ID_TOKEN_REQUEST_URL`), the step runs the pinned `ovsx publish --trusted-publishing --skip-duplicate --packagePath $PACKAGES`, with `VSCE_PAT` unset; a failure is recorded in `FAILED` like a token publish.
- FR-2: With `OVSX_PAT` set, the token publish runs unchanged, without `--trusted-publishing`.
- FR-3: With neither, the Open VSX notice names `OVSX_PAT` and `id-token: write`; with no Marketplace token either, the one early notice does the same and nothing is downloaded.
- FR-4: No `permissions:` key is added to the called workflow: the caller's grant is the only switch.
- FR-5: The README documents the switch.

## Success criteria

- [ ] A caller that grants `id-token: write` and passes no `OVSX_PAT` publishes the Release's `.vsix` to Open VSX with trusted publishing. A failure reds the job, the same as a failed token publish.
- [ ] A caller that passes `OVSX_PAT` still publishes with the token, so a first publish (which Open VSX requires to use a token) still works.
- [ ] A caller with neither a token nor the grant still skips Open VSX with a notice, and the notice names both ways to turn publishing on.
- [ ] The README says how to switch a caller to trusted publishing: the registration on open-vsx.org, the stub's `id-token: write`, and that the first version needs a token.
- [ ] **Runnable:** `npx jest test/create-github-release.test.js -t 'trusted publishing'` runs at least one test and passes. On `develop` none match.

## Needs from Chris

none
