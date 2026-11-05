# Spec: The docs manifest carries the new releasing template hash

Issue: [workflows#43](https://github.com/chrisgriffin/workflows/issues/43)

## Overview

The `Check docs/` step in `_reusable-node-ci.yml` holds each repo's fleet docs to hashes it carries inline. The `releasing` template's `flow` block changed in chrisgriffin/ops#1815, so the manifest needs the new hash.

## Functional requirements

- **FR-1** The `MANIFEST` line is replaced whole by the output of `repo/sync-docs.mjs --manifest` from the ops branch. Nothing else in the file changes.

## Success criteria

- [x] The `MANIFEST` line in `_reusable-node-ci.yml` equals the output of `node repo/sync-docs.mjs --manifest` from the ops branch that changes the template, and nothing else in the file changes.
- [x] **Runnable:** `grep -c "94e03a28" .github/workflows/_reusable-node-ci.yml` prints `0` (it prints `1` on `develop`).
- [x] `npm test` exits 0.
