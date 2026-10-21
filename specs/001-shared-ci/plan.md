# Plan: Host the fleet's reusable workflows and composite actions here

Written after the fact for [PR #2](https://github.com/chrisgriffin/workflows/pull/2).

## Technical context

- An empty public repo; `develop` is the default and only branch, protected by a ruleset (PR + one review, last-push approval).
- The bodies came from the operator's private copies as history-free files. `pr-loop-gate` runs a script whose import closure is operator-internal.
- Proof: a disposable public repo, `cgio-agent/workflows-canary`, with a `build-check.yml` on the new path and a `control.yml` on the old one.

## Design

1. **Copy, then repoint and harden.** Internal `uses:` lines point at `chrisgriffin/workflows/...@develop`. `pr-loop-gate` gains an `ops-token` input and checks the operator out into `.pr-loop-gate` (`persist-credentials: false`), then runs the gate script from there: a public caller cannot `uses:` a private action, but a job holding a token can clone one, so the script keeps one home. The evaluator gate passes `secrets.OPS_GH_TOKEN || secrets.TARGET_TOKEN` and skips a fork PR. The mention responder requires OWNER/MEMBER/COLLABORATOR in both the `if:` and the script. Per-repo tables become empty-default inputs.
2. **Hardening for public callers.** `persist-credentials: false` wherever a caller's command runs afterwards; the release push authenticates with a per-command `http.extraheader` so the token never reaches `.git/config`; exact pins with `--ignore-scripts`; comments say nothing about whose account a token belongs to.
3. **README**: one section per workflow; the caller-side rules live in the operator's build rules and are pointed at, not restated.
4. **Gate** before each push: `actionlint`, the private-reference grep, the canary run.

## Surfaces touched

- Every calling stub of a `_reusable-*.yml` body: none repointed by that PR; the operator's own stubs are chrisgriffin/ops#1683, the targets' are phase B (chrisgriffin/ops#1685).
- Required check names: none in this repo yet; see `specs/002-fleet-onboarding/`.
- A decision worth remembering: recorded on the operator's side, linked from chrisgriffin/ops#1683.
