# Plan: The docs manifest carries the new releasing template hash

Paste the line. Merge order: this PR and a v1 release first, because callers read the body at `@v1`. Only then does each repo owing `releasing` merge its re-sync of `docs/releasing.md`, the PR that changes the template included: that PR re-syncs its own repo's copy too, so against the old v1 manifest its required `build / ci` fails `Check docs/` and cannot go green first. From the release until a repo's re-sync merges, a repo still carrying the old sentence fails the step. The public re-sync that waits on this release is [design-drift#719](https://github.com/chrisgriffin/design-drift/pull/719); the private repos' re-syncs follow the same order.

## Surfaces touched

- `.github/workflows/_reusable-node-ci.yml`: every caller at `@v1` picks up the new hash on release. `permissions:` and inputs are unchanged, so no stub changes.
- `README.md`: names the manifest, not its hashes; no change.
