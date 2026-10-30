# Tasks: The gate action hands TARGET_TOKEN to the gate so it can resolve a review thread

- [x] T001 `action.yml`: `target-token` input → `TARGET_TOKEN` env.
- [x] T002 `_reusable-evaluator-gate.yml`: pass it, declare `RELEASE_PR_TOKEN`, document.
- [x] T003 `test/workflows.test.js` pins both; `README.md` names the secret.
- [x] T004 `npm run verify` green; PR closes #39.
