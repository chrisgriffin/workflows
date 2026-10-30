# Spec: The gate action hands TARGET_TOKEN to the gate so it can resolve a review thread

**Issue**: [#39](https://github.com/chrisgriffin/workflows/issues/39)

## Overview

The gate (`chrisgriffin/ops` `pr-loop/gate.mjs`, run by `.github/actions/pr-loop-gate`) replies on each inline finding thread with Autofix's answer and resolves the thread when every finding was fixed (ops#1906, ops#1919). GitHub refuses `resolveReviewThread` to the Actions token (ops#1914), so the resolve needs a user token. `_reusable-evaluator-gate.yml` already receives `TARGET_TOKEN` (ops), a `cgio-agent` PAT with pull-request write; the action never handed it to the gate. A target's `RELEASE_PR_TOKEN` is not always one: in this repo and in token-atlas it holds the owner's token until [#21](https://github.com/chrisgriffin/workflows/issues/21) resets it.

## Requirements

- **FR-1** `pr-loop-gate/action.yml` takes an optional `target-token` input and exports it to the gate step as `TARGET_TOKEN`.
- **FR-2** `_reusable-evaluator-gate.yml` passes `secrets.TARGET_TOKEN` to that input and says what it is for: a `cgio-agent` PAT, never an owner's token. `TARGET_TOKEN` reads the gate script only in ops itself, so a target missing `OPS_GH_TOKEN` still gets the red job naming it.
  - Withdrawn after the Evaluator's round-2 verdict on #40: this requirement also had the reusable fall back to `secrets.RELEASE_PR_TOKEN` and declare it. Its premise, that every target's `RELEASE_PR_TOKEN` is a `cgio-agent` PAT, is false where #21 is open: there it is the owner's token, so each gate reply would post as an OWNER comment the gate's already-answered check does not trust (it would re-post on every run) and that wakes the `@claude` responder. The fallback is dropped, which is also issue #39's own wording.
- **FR-3** A caller passing neither still runs: the gate falls back to the Actions token and the thread stays open.

## Success criteria

- [x] `pr-loop-gate/action.yml` takes an optional `target-token` input and exports it to the gate step as `TARGET_TOKEN`.
- [x] `_reusable-evaluator-gate.yml` passes `secrets.TARGET_TOKEN` to that input, and the secret's description says what it is for.
- [x] **Runnable:** `grep -cF 'TARGET_TOKEN: ${{ inputs.target-token }}' .github/actions/pr-loop-gate/action.yml` prints `1` (prints `0` on `develop`), and `npm test` exits 0.

## Needs from Chris

none
