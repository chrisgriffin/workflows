# Plan: The gate action hands TARGET_TOKEN to the gate so it can resolve a review thread

## Technical context

- The composite action sets the gate step's env; the reusable workflow maps caller secrets to its inputs. `test/workflows.test.js` pins both.
- Every target repo has `RELEASE_PR_TOKEN`; ops has `TARGET_TOKEN` (and `RELEASE_PR_TOKEN`). Neither is required: an empty input is the fallback the gate handles (ops#1919).

## Design

1. `target-token` input, optional, exported as `TARGET_TOKEN` to the gate step.
2. The reusable passes `secrets.TARGET_TOKEN || secrets.RELEASE_PR_TOKEN`; `RELEASE_PR_TOKEN` declared optional.
3. Tests updated for the `with:` map, the env map and the input's `required: false`.

## Surfaces touched

- `.github/actions/pr-loop-gate/action.yml`, `.github/workflows/_reusable-evaluator-gate.yml`: every repo's stub calls them at `@v1`/`@develop`; a stub that passes secrets by name (not `secrets: inherit`) must add `TARGET_TOKEN: ${{ secrets.RELEASE_PR_TOKEN }}` to reach the resolve — under the `TARGET_TOKEN` key, the name every tag declares, so it works at `v1` today and after it moves — which is per-target work filed from ops (config#8, token-atlas#52). Corrected after the Evaluator's round-1 verdict on #40: this line said to add `RELEASE_PR_TOKEN` by its own name, which `v1` does not declare, so such a stub fails at startup.
- `README.md` § evaluator gate secrets, updated here.
- The gate's use of `TARGET_TOKEN` is ops#1919 (its own PR).
