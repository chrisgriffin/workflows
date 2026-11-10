# Spec: The release commit is written by the release token's account, not github-actions[bot]

## Overview

`_reusable-release-pr.yml` writes every release commit as `github-actions[bot]`.
Netlify refuses to build a private repo's commit from an author it does not
recognize, so chrisgriffin.io's release PR never gets a deploy preview
("Unrecognized Git contributor"), while feature branches, whose commits are
cgio-agent's, build fine. The release commit should be written by the account
behind `RELEASE_PR_TOKEN` (cgio-agent across the fleet, per the identity rule).

## Functional requirements

- **FR-1** With a `RELEASE_PR_TOKEN` that can read `/user`, the release commit's
  author is that account's login and `<id>+<login>@users.noreply.github.com`.
- **FR-2** With only `GITHUB_TOKEN` (which cannot read `/user`), it stays
  `github-actions[bot]`.

## Success criteria

- [ ] **Runnable:** `npx jest test/release-pr.test.js` exits 0 with a test that the Configure git step sets the author to the token's login and `<id>+<login>@users.noreply.github.com`, and to `github-actions[bot]` when the token cannot read its user.
- [ ] `npm run verify` passes.
- [ ] after-merge: once `v1` moves, the next chrisgriffin.io `release/next` commit is authored by cgio-agent and its PR's "Deploy preview" link answers HTTP 200.
