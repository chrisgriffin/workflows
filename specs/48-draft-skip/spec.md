# Spec: a draft PR runs no Evaluator gate and no build / ci

Issue: [#48](https://github.com/chrisgriffin/workflows/issues/48)

## Problem

The fleet keeps agent PRs past its in-flight cap as drafts, so they spend no Actions minutes and fire no grades while they wait. The gate job and this repo's `build / ci` still ran on every draft event.

## Success Criteria

- [ ] The gate job skips a `pull_request` event on a draft PR, except `converted_to_draft` itself. Comment events (the loop's own reports and the owner's `/autofix`) are unchanged.
- [ ] This repo's `build / ci` job skips a draft PR and still runs on a push to `develop`.
- [ ] **Runnable:** `npx jest test/workflows.test.js -t "workflows#48"` prints `2 passed`, and on `develop` it runs none.

## Corrections

- **`converted_to_draft` still runs the gate** (Evaluator, PR #49 round 0). Skipping every draft event also skipped the transition itself, the only event that runs the gate's draft branch (ops `pr-loop/state.mjs`): it supersedes a `working` Evaluator block and sets the `Evaluator` status to pending. Without it a block left `working` by a mid-grade conversion waits for the stale sweep, and a parked PR that had passed keeps a green status. The first criterion's premise, that no draft event needs the gate, does not hold for that one event, so it is excepted.
