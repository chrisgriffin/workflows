# Plan: The release commit is written by the release token's account

## Technical context

- The "Configure git" step of `_reusable-release-pr.yml` hardcodes the bot
  as author. `RELEASE_PR_TOKEN` is already a declared secret of the body and
  already pushes the branch and opens the PR.

## Design decisions

1. **Read the author from the token** (`gh api user`), not a hardcoded login:
   the body is public and fleet-wide, and the token is the identity that
   pushes. GITHUB_TOKEN gets 403 on `/user`, so a caller with no PAT keeps
   the bot.
2. **Evidence for the cause:** the same release commit (`bde7254`) built and
   served on a branch Netlify did not see pushed with it, and Netlify's
   `release/next` deploy reads "Unrecognized Git contributor".

## Surfaces touched

- `.github/workflows/_reusable-release-pr.yml` — the Configure git step reads the token's account
- `test/release-pr.test.js` — the step run with `gh` stubbed
- every caller's `release-pr.yml` stub — none: no new input, secret or permission; `RELEASE_PR_TOKEN` is already passed, and the change reaches callers when `v1` moves on the next release
- required check names — none
