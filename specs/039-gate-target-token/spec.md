# Spec: The gate action hands TARGET_TOKEN to the gate so it can resolve a review thread

**Issue**: [#39](https://github.com/chrisgriffin/workflows/issues/39)

## Overview

The gate (`chrisgriffin/ops` `pr-loop/gate.mjs`, run by `.github/actions/pr-loop-gate`) replies on each inline finding thread with Autofix's answer and resolves the thread when every finding was fixed (ops#1906, ops#1919). GitHub refuses `resolveReviewThread` to the Actions token (ops#1914), so the resolve needs a user token. `_reusable-evaluator-gate.yml` already receives `TARGET_TOKEN` (ops) and every target carries `RELEASE_PR_TOKEN`, both `cgio-agent` PATs with pull-request write; the action never handed either to the gate.

## Requirements

- **FR-1** `pr-loop-gate/action.yml` takes an optional `target-token` input and exports it to the gate step as `TARGET_TOKEN`.
- **FR-2** `_reusable-evaluator-gate.yml` passes `secrets.TARGET_TOKEN || secrets.RELEASE_PR_TOKEN` to that input, declares `RELEASE_PR_TOKEN` as an optional secret, and says what both are for.
- **FR-3** A caller passing neither still runs: the gate falls back to the Actions token and the thread stays open.

## Success criteria

- [x] `pr-loop-gate/action.yml` takes an optional `target-token` input and exports it to the gate step as `TARGET_TOKEN`.
- [x] `_reusable-evaluator-gate.yml` passes `secrets.TARGET_TOKEN` to that input, and the secret's description says what it is for.
- [x] **Runnable:** `grep -c 'TARGET_TOKEN: \${{ inputs.target-token }}' .github/actions/pr-loop-gate/action.yml` prints `1` (prints `0` on `develop`), and `npm test` exits 0.

## Needs from Chris

none
