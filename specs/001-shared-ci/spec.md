# Spec: Host the fleet's reusable workflows and composite actions here

Written after the fact: this records what [PR #2](https://github.com/chrisgriffin/workflows/pull/2) shipped, so the repo carries the spec the fleet's build rules ask for. The operator's side (its own stubs repointed here, and the record of the decision) is chrisgriffin/ops#1683.

## Overview

Every repo the operator runs plugs into the fleet through thin workflow stubs that `uses:` a reusable workflow. GitHub refuses that call from a public repo when the workflow lives in a private one, before it schedules a job, so a public target's CI gate, review gate, mention responder, release PR, GitHub release and merge-back all go dead at once. This repo is the public home for those bodies, hardened for public callers.

## User scenarios

- A public repo's `build-check.yml` calls `chrisgriffin/workflows/.github/workflows/_reusable-node-ci.yml@develop` with its `run` input and the gate runs green; the same call against the private copy fails to start.
- A stranger comments `@claude` on a public target's issue: nothing happens. The owner, a member or a collaborator still gets the placeholder and the reply.
- A fork opens a pull request against a public target: the Evaluator gate job is skipped, not red, and the `Evaluator` commit status is never posted, so the PR waits for a maintainer.
- A target passes its own CLAUDE.md budget, the docs it owes and its docs-only paths as inputs; the public workflow carries no per-repo table.

## Functional requirements

- FR-1: `.github/workflows/_reusable-{claude-mention,create-github-release,evaluator-gate,merge-sweep,node-ci,release-pr,sync-main-to-develop}.yml` and `.github/actions/{pr-loop-gate,dispatch-sweep}/action.yml` exist on `develop`.
- FR-2: No file `uses:` anything under the private operator repo, carries a repo-specific `case` on `github.repository`, names a secret-store, a local path or a private note, or triggers on `pull_request_target`.
- FR-3: `_reusable-node-ci.yml` takes `claude_md_budget`, `docs_owed` and `docs_only_paths`, each empty by default and skipping its check; `_reusable-create-github-release.yml` takes `marketplace_packages`, empty by default.
- FR-4: `_reusable-claude-mention.yml` replies only when the event's `author_association` is OWNER, MEMBER or COLLABORATOR, in both the job `if:` and the detect step.
- FR-5: `_reusable-evaluator-gate.yml` skips a PR whose head repo is not the caller; `pr-loop-gate` checks the operator out with an `ops-token` input and runs the gate script from there, so the script keeps its one home.
- FR-6: Every checkout that is followed by a step running caller-supplied commands sets `persist-credentials: false`; the release push authenticates per command; tooling installs exact versions with `--ignore-scripts`.
- FR-7: The README has one section per workflow: purpose, inputs, the secrets it expects by name, and the `uses:` line a caller writes. `.github/CODEOWNERS` is `* @chrisgriffin`.

## Success criteria

- [x] `develop` holds the seven reusable workflows and both actions, and `grep -rniE '1password|op://|keychain|czg-vault|obsidian|/Users/|pull_request_target|chrisgriffin/ops/\.github' .github` prints nothing.
- [x] **Runnable:** from a public repo, a workflow `uses: chrisgriffin/workflows/.github/workflows/_reusable-node-ci.yml@develop` with `run: npm test` concludes `success` ([cgio-agent/workflows-canary run 39543925320](https://github.com/cgio-agent/workflows-canary/actions/runs/39543925320), at `develop` after the merge); the control call against the private copy concludes `failure` with zero jobs ([run 39539110586](https://github.com/cgio-agent/workflows-canary/actions/runs/39539110586)).
- [x] The README has one section per workflow.

## Needs from Chris

Done: the PR merged on 2026-10-20 as `18c3d26`.
