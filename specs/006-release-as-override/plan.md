# Plan: A repository variable forces the next release version

## Technical context

- `Calculate next version` in `_reusable-release-pr.yml` computes `NEXT` from git and writes it to the step's `next` output; `Build release branch` (`npm version "$NEXT"`, then `conventional-changelog -r 1`, which reads the bumped `package.json`) and `Create or update release PR` (`TITLE`) read that output. The tag race guard is in the same step, after `NEXT`. Nothing else derives a version.
- GitHub docs, [variables reference](https://docs.github.com/en/actions/reference/workflows-and-actions/variables), "Configuration variable precedence": "For reusable workflows, the variables from the caller workflow's repository are used."
- The same docs say creating a repository variable needs write access on an organization repo, collaborator on a personal one; it is a settings change, never something a commit can do.
- `test/release-pr.test.js` already runs the shipped step script (`runStep`) against a throwaway git repo.

## Design

1. Step `env:` gains `RELEASE_AS: ${{ vars.RELEASE_AS }}` (empty when unset).
2. After the commit bump is computed and logged, if `RELEASE_AS` is non-empty: validate against `^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$` or fail; compare numerically by component with a small `ver_gt` function; stale (not above current) logs and is ignored; above the computed next replaces it; otherwise logs and keeps it.
3. The override sits before the race guard, so a 1.0.0 that shipped while develop still reads 0.x is skipped by the existing tag check.

## Surfaces touched

- a `_reusable-*.yml` body (`_reusable-release-pr.yml`): no input, secret or `permissions:` change, so no calling stub changes; token-atlas's `RELEASE_AS=1.0.0` is already set. Callers pick it up when `v1` moves with this repo's next release.
- a published surface: the README section for this body gains the variable.
- a workflow job name that is a required check: none renamed.
