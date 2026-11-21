# Spec: The gate queues every waiting run, so none is cancelled

## Overview

`_reusable-evaluator-gate.yml` serializes a PR's gate runs in one concurrency
group (workflows#42). GitHub's default holds one waiting run per group, so a
third event cancels the waiting one. On ops#2470 a loop comment edit cancelled
the `pull_request` run waiting on the new head, and its `evaluator / gate`
check stayed cancelled there for 10 hours, the PR red though the Evaluator had
passed. `queue: max` holds up to 100 waiting runs, first in first out.

## Functional requirements

- **FR-1** The gate job's concurrency group sets `queue: max` with
  `cancel-in-progress: false`.
- **FR-2** The workflow comment and README no longer describe a run lost to a
  third event.

## Success criteria

- [ ] **Runnable:** `npx jest test/workflows.test.js` passes with the concurrency test expecting `queue: max`, and fails on `develop`.
- [ ] `npm run verify` passes.
- [ ] after-merge: once `v1` moves, a PR whose push and loop comment edit land within seconds keeps a green `evaluator / gate` check on its head.
