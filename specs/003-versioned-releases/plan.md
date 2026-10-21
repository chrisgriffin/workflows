# Plan: Versioned releases, and the hardening a caller can see

## Technical context

- The release flow already exists as three reusable bodies here; this repo just never called them on itself. `_reusable-release-pr.yml` reads and bumps `package.json`, splices `CHANGELOG.md`, and tolerates a repo with no version header; it does not tolerate a missing `package-lock.json` (an unconditional `git add`), so that line is the one body change the flow needs.
- `gh release create` with no `--target` tags the default branch's head. This repo's default branch is `develop`, so the tag would land on unreleased work; `github.event.pull_request.merge_commit_sha` is the commit that merged into `main` on the `closed` event, for a merge, squash or rebase.
- A floating tag is a plain ref: `POST /git/refs` the first time, `PATCH /git/refs/tags/vN` with `force` after, both `contents: write` on `GITHUB_TOKEN`, which the stub already grants for the Release.
- Declaring `on.workflow_call.secrets` is backward compatible: a caller on `secrets: inherit` still satisfies it, so the six targets' current stubs (still on ops's copies) and ops's own (on `@develop` here) keep running until each repoints with named secrets. `required: false` everywhere because ops passes `TARGET_TOKEN` where a target passes `OPS_GH_TOKEN`.
- The live check behind FR-5: a workflow with `permissions: issues: write` alone, posting an issue comment on a pull request in a public repo, fails `403 Resource not accessible by integration` (cgio-agent/workflows-canary run 39549641154). `pull-requests: write` stays.
- Creating `main` is refused for cgio-agent (422): the ruleset covers `main`, enforces on create, names no bypass actor. An admin step, in the spec's Needs from Chris.

## Design

1. **Release flow on this repo.** `release-pr.yml`, `create-github-release.yml`, `sync-main-to-develop.yml`, the fleet's stub shape with named secrets and `@develop`; `package.json` at `1.0.0`, `private`, no dependencies; `CHANGELOG.md` with the title the splice looks for. The first release is the conventional bump from `1.0.0` over the history since no tag exists (`feat` commits present, so `v1.1.0`); `v1` floats to it.
2. **`floating_major_tag`.** A boolean input on `_reusable-create-github-release.yml`, default `false`, and one step after the Release: derive `v<major>`, create or force-move it to `merge_commit_sha`. `--target` on the Release itself for every caller.
3. **Named secrets.** Each body declares exactly the names its steps read; the three new release stubs pass them by name. `evaluator-gate.yml` and `claude-mention.yml` run from the PR head (a pull_request event; a review event, pull_request_review or pull_request_review_comment) against the body on `develop`, which declares nothing until this merges, so naming their secrets here startup-fails the run (seen live on this PR's own gate on its first push, and on #8's Claude Mention at the review that approved it); both keep `inherit` and the next PR flips them. Header comments stop saying `secrets: inherit`.
4. **Credentials.** `persist-credentials: false` on the node-ci and sync checkouts; the sync's `git fetch` and both `git push` calls take the per-command `http.extraheader` the release PR's push already uses.
5. **Mention.** `TARGET` in the dispatch step's `env:`; permissions unchanged, with the live result in a comment.
6. **Pins.** `actions/checkout` v5.1.0, `actions/setup-node` v5.0.0, `actions/github-script` v7.1.0, full SHAs with the version as a trailing comment, in every body, both actions and `build-check.yml`.
7. **README.** A `## Versions` section; every example at `@v1` with named secrets; the new input; the release stubs under this repo's own workflows.

## Surfaces touched

- A `_reusable-*.yml` body: every caller keeps working (declared secrets accept `inherit`; no `permissions:` change; the new input defaults off). The targets repoint in phase B's per-repo PRs, ops's stubs in its deletion PR, each passing named secrets.
- A workflow job name that is a required check: none renamed; the release PR's `build / ci` and `Evaluator` are what the existing ruleset already requires on `main`.
- A published surface: README (version policy, inputs, secrets); the Release and tags are new.
- A rule stated in more than one doc: the caller-side rules stay in the operator's `build.md` § Reusable workflows; this README points at it. ops's docs saying which pin convention and why are the phase-B ops PR's.
- Anything needing a secret or an admin action: `RELEASE_PR_TOKEN`, the `main` branch, the merge-back PR, in the spec's Needs from Chris.
