# Spec: a draft PR runs no Evaluator gate and no build / ci

Issue: [#48](https://github.com/chrisgriffin/workflows/issues/48)

## Problem

The fleet keeps agent PRs past its in-flight cap as drafts, so they spend no Actions minutes and fire no grades while they wait. The gate job and this repo's `build / ci` still ran on every draft event.

## Success Criteria

- [ ] The gate job skips a `pull_request` event on a draft PR. Comment events (the loop's own reports and the owner's `/autofix`) are unchanged.
- [ ] This repo's `build / ci` job skips a draft PR and still runs on a push to `develop`.
- [ ] **Runnable:** `npx jest test/workflows.test.js -t "workflows#48"` prints `2 passed`, and on `develop` it runs none.
