# Spec: The docs manifest carries the new ADR-index and architecture template hashes

Issue: #70

## Problem

The `Check docs/` step in `_reusable-node-ci.yml` holds each repo's shared docs to hashes carried inline. The `adr-index` template's `fleet:intro` and `fleet:fleet-decisions` blocks and the `architecture` template's `fleet:intro` block changed, so the inline manifest needs their new hashes and skeletons.

## Success criteria

1. The `MANIFEST` line in `_reusable-node-ci.yml` equals the output of `node repo/sync-docs.mjs --manifest` from the branch that changes the templates, and nothing else in the file changes.
2. **Runnable:** `grep -c "8b16d790f3b19b83" .github/workflows/_reusable-node-ci.yml` prints `0` (it prints `1` on `develop`).
3. `npm test` exits 0.
