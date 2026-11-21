# Plan: workflows#66

1. Add `queue: max` to the gate job's `concurrency` block in
   `.github/workflows/_reusable-evaluator-gate.yml`; rewrite the comment above it.
2. Expect `queue: "max"` in `test/workflows.test.js`'s concurrency test.
3. Rewrite the README's gate paragraph.
4. The live check is this repo's own stub, which calls the body at `develop`:
   the first PR here after merge runs `queue: max` before `v1` moves the fleet.

## Surfaces touched

- Every fleet repo's gate stub calls this body (`@develop` here, `@v1` elsewhere), so the change reaches the fleet when `v1` moves.
- cost — none.
