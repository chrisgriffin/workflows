# Spec: Let a re-run retry a failed Marketplace publish

## Overview

`_reusable-create-github-release.yml` publishes a caller's `.vsix` to the VS Code Marketplace as a step after `gh release create`, behind the version step's "already released" skip. When the publish fails, the Release is already made, so re-running the run sees it, skips every later step, and goes green without retrying. The publish moves to its own job that re-runs reach regardless, and a version already on the Marketplace counts as published. Publishing stays on the caller's `VSCE_PAT`, a global Azure DevOps PAT that Microsoft retires on 2026-12-01. Fixes #16.

## User scenarios

- A release's Marketplace publish fails (an expired PAT, an outage): the run is red. Once fixed, re-running the run publishes the `.vsix` attached to the existing Release, without recreating it.
- The publish reached the Marketplace but the run failed after: the retry finds the version already there and is green.
- A caller with no `VSCE_PAT`: the job skips green with a notice, as before.
- After 2026-12-01: the caller removes the secret and uploads the Release's `.vsix` by hand on the Marketplace manage page (README).

## Functional requirements

- FR-1: The publish is a `marketplace` job, `needs: release`, run only when `marketplace_packages` is set, and not gated on the release job's skip.
- FR-2: It reads the version from the release job's output, downloads that Release's assets, and runs `vsce publish --skip-duplicate --packagePath $PACKAGES` there.
- FR-3: No `VSCE_PAT`: a notice and exit 0, decided inside the step. Any other failure fails the job.
- FR-4: README documents the job, the retry, the PAT's retirement and the manual upload after it.

## Success criteria

- [ ] Re-running a release run whose Marketplace publish failed retries the publish when the Release already exists, without recreating the Release.
- [ ] A version already on the Marketplace counts as published, so a retry of it is green.
- [ ] Publishing uses the caller's `VSCE_PAT`; with none it skips green with a notice, and any other publish failure fails the run.
- [ ] The README says publishing uses a global Azure DevOps PAT that Microsoft retires on 2026-12-01, after which the caller uploads the Release's `.vsix` by hand on the Marketplace manage page.
- [ ] **Runnable:** `npx jest test/create-github-release.test.js -t 'marketplace job'` passes on the PR head; on `develop` it fails.

## Needs from Chris

none
