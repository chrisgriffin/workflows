# Spec: Name the secrets in this repo's own Evaluator and Claude Mention stubs

Issue: [workflows#51](https://github.com/chrisgriffin/workflows/issues/51)

## Problem

`evaluator-gate.yml` and `claude-mention.yml` call their bodies with `secrets: inherit`, which hands every secret this public repo holds to the called workflow. They kept it only while the bodies on `develop` declared nothing: a `pull_request` or review event runs the stub from the PR head against the body on `develop`, and a name the body does not declare fails the run at startup. Every body on `develop` now declares its secrets (specs/003-versioned-releases), so both stubs can name theirs.

## Success Criteria

- [x] `evaluator-gate.yml` passes `EVALUATOR_FIRE_TOKEN`, `AUTOFIX_FIRE_TOKEN` and `OPS_GH_TOKEN` by name, and `claude-mention.yml` passes `OPS_GH_TOKEN` by name; neither carries `secrets: inherit`, and the comments that explained the wait are gone.
- [x] A test fails when any stub in `.github/workflows/` carries `secrets: inherit`.
- [x] **Runnable:** `grep -rlE '^\s+secrets: inherit' .github/workflows` prints nothing (it prints `claude-mention.yml` and `evaluator-gate.yml` on `develop`).

## Out of scope

- `TARGET_TOKEN` on this repo's gate: the README keeps it off here until this repo holds a `cgio-agent` token for it ([#21](https://github.com/chrisgriffin/workflows/issues/21)).
- Every other caller's stub: each repo moves its own; the bodies at `v1` already declare every name.
