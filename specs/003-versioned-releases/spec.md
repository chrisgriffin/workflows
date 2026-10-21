# Spec: Versioned releases, and the hardening a caller can see

## Overview

Every caller of this repo's workflows writes `@develop`, so a merge here changes every repo's CI with no review on the caller's side, and the public bodies still carry the phase-A debts that change a caller: secrets reach them by `secrets: inherit`, two checkouts persist a token, GitHub-owned actions float on a major tag. This gives the repo the fleet's own release flow (the `release/next` PR, the `vX.Y.Z` tag and Release) plus a floating `v1` tag a caller pins to, and lands the caller-visible hardening from chrisgriffin/ops#1685 that touches only this repo, so phase B's repoints can write `@v1` and name their secrets.

## User scenarios

- A push to `develop` here refreshes a draft `release/next` PR into `main`; merging it tags the merge commit `v1.x.y`, creates the Release from `CHANGELOG.md`, and moves the `v1` tag onto it.
- A target writes `uses: chrisgriffin/workflows/.github/workflows/_reusable-node-ci.yml@v1` and gets every v1 release without a PR of its own.
- A stub passes `secrets:` by name; a secret it does not pass is simply unset in the called workflow, and one it names that the body does not declare fails the run at startup, which is the point.
- A caller's `build_command` or gate chain runs in a tree that holds no token; the sync's pushes carry the token per command.
- A repo whose default branch is `develop` releases: the tag lands on `main`'s merge commit, not on `develop`'s head.

## Functional requirements

- FR-1: `_reusable-create-github-release.yml` takes `floating_major_tag` (boolean, default `false`); when true it creates or force-moves `v<major>` to the released commit after the Release exists. The Release's tag targets `github.event.pull_request.merge_commit_sha`.
- FR-2: This repo carries `release-pr.yml`, `create-github-release.yml` (`floating_major_tag: true`) and `sync-main-to-develop.yml`, calling its own bodies at `develop`, plus the `package.json` and `CHANGELOG.md` the flow reads. The first release bumps from `1.0.0` so the floating tag is `v1`.
- FR-3: Every `_reusable-*.yml` declares the secrets it reads under `on.workflow_call.secrets`; this repo's own stubs pass them by name, except `evaluator-gate.yml` and `claude-mention.yml`: a pull_request event, and a review event (pull_request_review, pull_request_review_comment), run the stub from the PR head against the body on `develop`, so both keep `secrets: inherit` until the declarations are on `develop` and are flipped in the PR after this one.
- FR-4: Every `actions/checkout` here sets `persist-credentials: false`; the sync's fetch and pushes authenticate per command with the same header the release PR's push uses.
- FR-5: `_reusable-claude-mention.yml` reads `inputs.target` from `env:`; its `permissions:` keeps `pull-requests: write` because `issues: write` alone cannot post the placeholder on a PR thread (403, checked live).
- FR-6: Every GitHub-owned action is pinned to a full commit SHA with its version in a trailing comment.
- FR-7: `_reusable-release-pr.yml` adds `package-lock.json` to the release commit only when the file exists, so a repo with no dependencies can release.
- FR-8: README documents the version policy (`@v1`), the explicit `secrets:` form in every example, the new input, and this repo's release stubs.

## Success criteria

- [ ] **Runnable:** `grep -rl 'actions/checkout' .github | xargs grep -L 'persist-credentials: false' | wc -l | tr -d ' '` prints `0` on the PR head (`2` on `develop` today).
- [ ] `grep -rlE '^\s+secrets: inherit' .github/workflows` prints only `.github/workflows/claude-mention.yml` and `.github/workflows/evaluator-gate.yml` on the PR head (three files on `develop` today), and every `_reusable-*.yml` has an `on.workflow_call.secrets` block (`grep -L '^    secrets:' .github/workflows/_reusable-*.yml` prints nothing).
- [ ] `grep -rhoE 'uses: actions/[a-z-]+@[^ ]+' .github | grep -vE '@[0-9a-f]{40}$'` prints nothing on the PR head.
- [ ] `actionlint -no-color -shellcheck=shellcheck .github/workflows/*.yml; echo "exit $?"` prints `exit 0`, and the public canary's `ci / ci` run against this branch concludes `success`.
- [ ] after-merge: the first push to `develop` opens `release/next`; merging it (Chris) produces the `v1.x.y` Release and the `v1` tag at `main`'s merge commit.

## Needs from Chris

1. Create `main` from `develop`'s head, as admin, before merging this PR: `gh api -X POST repos/chrisgriffin/workflows/git/refs -f ref=refs/heads/main -f sha=$(gh api repos/chrisgriffin/workflows/git/ref/heads/develop --jq .object.sha)`. The ruleset covers `main` and enforces its required checks on branch creation with no bypass actor, so the same call as cgio-agent returned 422 (this session); it needs a bypass or the ruleset's "enforce on create" off for the one call.
2. Add the repository secret `RELEASE_PR_TOKEN` on chrisgriffin/workflows, as admin, before merging: the same value the other targets hold, stored under the 1Password item that holds theirs. Without it the release PR is opened by `GITHUB_TOKEN`, whose events start no workflow, so its required `build / ci` check never runs and the PR cannot merge.
3. After the first release, merge the `sync/main-to-develop-*` PR it opens: the `develop` ruleset names no bypass actor, so the merge-back cannot push directly.
