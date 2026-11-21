# Plan: workflows#66

1. Add `queue: max` to the gate job's `concurrency` block in
   `.github/workflows/_reusable-evaluator-gate.yml`; rewrite the comment above it.
2. Expect `queue: "max"` in `test/workflows.test.js`'s concurrency test.
3. Rewrite the README's gate paragraph.
4. Check the syntax is valid at job level inside a called workflow: a commit
   points this repo's own stub at the branch, the PR's gate run must start and
   pass, then the commit is reverted before review.
