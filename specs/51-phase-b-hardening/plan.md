# Plan: Name the secrets in this repo's own Evaluator and Claude Mention stubs

Pass each stub exactly the secrets the body reads that this repo holds (`gh secret list`: `AUTOFIX_FIRE_TOKEN`, `EVALUATOR_FIRE_TOKEN`, `OPS_GH_TOKEN`, `RELEASE_PR_TOKEN`), which is what `inherit` reached before, so behavior does not change. A test in `test/workflows.test.js` walks every stub's `uses:` job: no `inherit`, and each named secret is one the called body declares, so a name the body does not know fails here before it fails a run at startup.

## Surfaces touched

- `.github/workflows/evaluator-gate.yml`, `.github/workflows/claude-mention.yml`: this repo's own stubs only; `permissions:`, triggers and job names unchanged, so no required check moves.
- `test/workflows.test.js`: the new stub rule.
- No body changes, so no caller is affected and nothing waits on a release.
- `README.md`: already says a stub passes each secret by name; no change.
