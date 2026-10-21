# Spec: This repo runs on the fleet's own stubs

## Overview

This repo ships the fleet's shared workflows but, until now, ran none of them on itself: no CI, no Evaluator, no `@claude` responder. A repo in the fleet carries the same thin stubs as every other target, so this adds them, calling this repo's own bodies at `develop`, plus a CI job that lints every workflow. The operator's half, which registers this repo as a target so the stubs have something to dispatch to, is a separate PR there and is linked from this one.

## User scenarios

- A PR opens here: the `build` workflow's `verify` job runs `actionlint` with shellcheck over every workflow and goes green; a syntax error or an unquoted variable in a `run:` block turns it red.
- A PR opens here: the Evaluator gate fires through `_reusable-evaluator-gate.yml@develop` and writes the `Evaluator` commit status, once the repo holds the secrets it needs.
- The owner comments `@claude` on an issue here: the mention responder posts its placeholder and dispatches to the operator with `target: workflows`.
- A stranger comments `@claude` here: nothing happens.

## Functional requirements

- FR-1: `.github/workflows/evaluator-gate.yml` calls `chrisgriffin/workflows/.github/workflows/_reusable-evaluator-gate.yml@develop` with `secrets: inherit`, on the fleet's standard events.
- FR-2: `.github/workflows/claude-mention.yml` calls `chrisgriffin/workflows/.github/workflows/_reusable-claude-mention.yml@develop` with `target: workflows` and `secrets: inherit`.
- FR-3: `.github/workflows/build-check.yml` has one job, `verify`, on push to `develop` and on pull requests, that downloads an exact `actionlint` release tarball, checks its sha256 against the release's published checksum before running it, and lints `.github/workflows/*.yml` with shellcheck. Nothing executes from a moving ref.
- FR-4: `actionlint -shellcheck=shellcheck` is clean over every workflow here, so the new job is green on its first run.
- FR-5: `specs/001-shared-ci/` records what PR #2 shipped; `specs/002-fleet-onboarding/` is this.
- FR-6: Nothing added needs a secret the repo does not yet hold in order to go green: the `verify` job runs on `GITHUB_TOKEN` alone.

## Success criteria

- [ ] **Runnable:** `actionlint -no-color -shellcheck=shellcheck .github/workflows/*.yml; echo "exit $?"` prints `exit 0` on the PR head.
- [ ] `git ls-files .github/workflows | grep -vc '^.github/workflows/_reusable-'` prints `3` on the PR head: the three stubs, nothing else outside the shared bodies.
- [ ] The `build / verify` check-run on the PR concludes `success`.
- [ ] after-merge: the first PR opened after the secrets below exist gets an `Evaluator` commit status from the gate.

## Needs from Chris

1. Repo secrets, as admin: `EVALUATOR_FIRE_TOKEN`, `AUTOFIX_FIRE_TOKEN`, `OPS_GH_TOKEN`, the same values the other targets hold. Until they exist the Evaluator stub's job runs and fails at the operator checkout; the `verify` job does not depend on them.
2. On the `develop` ruleset, require the `verify` check (the `build` workflow's job) and the `Evaluator` commit status, as every other target's ruleset does.
