# Plan: The docs manifest carries the new releasing template hash

Paste the line. Merge order: the ops PR first, then this one and a v1 release, because callers read the body at `@v1`. Every repo owing `releasing` then needs its re-sync merged, since a repo with the old sentence fails the step from that release on.

## Surfaces touched

- `.github/workflows/_reusable-node-ci.yml`: every caller at `@v1` picks up the new hash on release. `permissions:` and inputs are unchanged, so no stub changes.
- `README.md`: names the manifest, not its hashes; no change.
