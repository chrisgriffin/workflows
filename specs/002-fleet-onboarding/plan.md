# Plan: This repo runs on the fleet's own stubs

## Technical context

- The stubs mirror the operator's own: `evaluator-gate.yml` (pull_request + issue_comment, four write permissions, `secrets: inherit`) and the mention stub (issue_comment, review comment, review, issues; `target: <overlay name>`).
- No Node project here, so `_reusable-node-ci.yml` does not fit; CI is one plain job. `actionlint` ships as a release tarball with a published `checksums.txt`; pinning the version and the sha256 side by side is enough to keep a moving ref out of the job.
- `actionlint -shellcheck=shellcheck` reported ten pre-existing notes in `_reusable-release-pr.yml` (nine unquoted `$GITHUB_OUTPUT` redirects, one unquoted `BUMP=` word that is also a command name). Quoting them is behavior-neutral and makes the new job green instead of suppressed.

## Design

1. **Stubs.** `evaluator-gate.yml` and `claude-mention.yml` are copies of the operator's stub shape with the `uses:` line pointing at this repo's own bodies at `develop`, so the repo is gated by the gate it ships. `claude-mention.yml` passes `target: workflows`, the name of the overlay the operator PR adds.
2. **CI.** `build-check.yml`, job `verify`: `actions/checkout` with `persist-credentials: false`; download `actionlint_<VERSION>_linux_amd64.tar.gz` for an exact version, `sha256sum -c` against the pinned checksum, then `actionlint -shellcheck=shellcheck .github/workflows/*.yml`. The version and checksum sit side by side in the step's `env`, bumped together.
3. **Lint debt.** Quote the nine redirects and three `BUMP=` assignments in `_reusable-release-pr.yml` so the gate starts green.
4. **Specs.** `specs/001-shared-ci/` written after the fact from PR #2; `specs/002-fleet-onboarding/` is this folder.

## Surfaces touched

- A `_reusable-*.yml` body: `_reusable-release-pr.yml` changes only in shell quoting; no input, output or behavior changes, so no caller changes.
- A workflow job name that is a required check: `verify` is new and not yet required; requiring it and the `Evaluator` status on the `develop` ruleset is `## Needs from Chris` 2.
- A published surface: README gains a short section on this repo's own workflows.
- A rule stated in more than one doc: none; the new-repo checklist lives once, in the operator's conventions, cited from the operator PR.
- Anything needing a secret: the two stubs, via `secrets: inherit`; the secrets are `## Needs from Chris` 1.
