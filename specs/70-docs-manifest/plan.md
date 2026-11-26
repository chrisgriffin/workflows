# Plan: The docs manifest carries the new ADR-index and architecture template hashes

Paste the line. Only the `adr-index` and `architecture` entries change. Merge order: the template change first, then this PR and a `v1` release, because callers read the body at `@v1`; only then does each repo owing `adr-index` or `architecture` re-run CI on its re-sync and merge it. Against the old `v1` manifest a re-sync fails `Check docs/` and cannot go green first, and from the release until a repo's re-sync merges, a repo still carrying the old wording fails the step.

## Surfaces touched

- `.github/workflows/_reusable-node-ci.yml`: every caller at `@v1` picks up the new hashes on release. `permissions:`, inputs and secrets are unchanged, so no stub changes.
- `README.md`: names the manifest, not its hashes; no change.
- migration — consumers: every caller whose stub's `docs_owed` input names `adr-index` or `architecture`: five repos today, all private, none public. Order: the template change, then this PR and the `v1` release, then each consumer's re-sync re-runs CI and merges. This is the one exception the fleet's `build.md` § Fleet surfaces gives the breaking-change row, on its shared-docs template row: no re-sync can be green first, so each consumer fails `Check docs/` from the release until its re-sync merges, and no block is hand-edited to green it.
- cost — none: no new trigger or job.
