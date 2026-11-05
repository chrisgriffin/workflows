# Plan: a draft PR runs no Evaluator gate and no build / ci

Add `(github.event.pull_request.draft == false || github.event.action == 'converted_to_draft')` to the `pull_request` arm of the gate job's `if:`, so the draft transition still runs the gate's draft branch, and a job-level `if:` to `build / ci` that keeps `push` runs. Every caller's stub already subscribes to `ready_for_review`, so marking a draft ready starts both.

## Surfaces touched

- `_reusable-evaluator-gate.yml`: every calling stub (all 9, checked by content); stubs call `@v1`, so it reaches them at the next release.
- `.github/workflows/build-check.yml` and `test/workflows.test.js`.
