# Plan: The release PR's fetches authenticate themselves

## Technical context

- Failing line on every private caller's run since #6: `fatal: could not read Username for 'https://github.com': No such device or address`, exit 128, in the step `Skip if there is nothing releasable ahead of main`, right after its script header: the first network command there is `git fetch origin main --tags`.
- `actions/checkout` with `persist-credentials: false` clones with the token and then removes it; a later fetch is anonymous. Public repos allow an anonymous fetch, private repos refuse it.
- `_reusable-sync-main-to-develop.yml` already authenticates its fetch and push per command, and `_reusable-create-github-release.yml` makes no git network call after its checkout (it writes through `gh`), so only the release PR body is affected.

## Design

1. In the in-sync step and the version step, add `RELEASE_PR_TOKEN` (the checkout's own fallback chain) to the step `env:` and prefix each fetch with `git -c "http.extraheader=AUTHORIZATION: basic $AUTH"`, `AUTH` built exactly as the push builds it.
2. Keep the tag-race fetch's `|| true`: it is a best-effort refresh. With the header it now actually refreshes on a private caller instead of silently doing nothing.
3. One fleet rule in `test/workflows.test.js` over every body's `run:` lines; the sync suite's narrower loop is removed in favor of it.

## Surfaces touched

- a `_reusable-*.yml` body (`_reusable-release-pr.yml`): no input, secret or `permissions:` change, so no calling stub changes; every caller picks it up when the floating `v1` tag moves with the next release.
- a workflow job name that is a required check: none renamed.
- a published surface: none; README's description of the body still holds.
