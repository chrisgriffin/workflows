# Spec: The release PR's fetches authenticate themselves

## Overview

Since the release and publish paths stopped persisting the checkout's token into `.git/config` (#6), the Release PR body has failed on every private caller: its first `git fetch` carries no credential, so git asks for a username and exits 128 before any release PR is opened or updated. The push already authenticates itself per command; the two fetches before it did not. This repo's own Release PR passed only because an anonymous fetch of a public repo works. Fixes chrisgriffin/ops#1702.

## User scenarios

- A push to `develop` in a private repo runs the Release PR job: the fetch of `main` succeeds with the release token, and the job opens or refreshes `release/next` as it did before #6.
- A future body adds a `git fetch` or `git push` without its own credential: `build / ci` names the line before it merges.

## Functional requirements

- FR-1: Both fetches in `_reusable-release-pr.yml` (the in-sync step's `git fetch origin main --tags` and the version step's tag-race `git fetch --tags --force origin`) carry the release token as a per-command `http.extraheader`, the same token and form the push uses; nothing is written to `.git/config`.
- FR-2: `test/workflows.test.js` holds, for every `_reusable-*.yml` body, that each `git` call reaching the remote (`fetch`, `push`, `pull`, `ls-remote`, `clone`) carries that header. The sync body's own copy of that check becomes a pointer to it.

## Success criteria

- [ ] **Runnable:** `npx jest test/workflows.test.js -t 'carries its own credential'` passes on the PR head; on `develop` it fails on the two release-PR fetches.
- [ ] (after merge) A Release PR run on ops's `develop` finishes green and opens or updates the `release/next` PR into `main`.
- [ ] (after merge) Each target whose Release PR run is red for the same cause is green again on its next run, or has its own issue naming why not.
- [ ] A test or check exists that would have failed before this fix landed.
- [ ] (after merge) **Runnable:** `gh run list --repo chrisgriffin/ops --workflow release-pr.yml --limit 1 --json conclusion --jq '.[0].conclusion'` prints `success` (it prints `failure` today).

## Needs from Chris

none
