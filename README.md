# workflows

The reusable GitHub Actions workflows and composite actions every repo in the
fleet calls. Public, so a public caller can use them: GitHub refuses a
`uses:` of a reusable workflow or action hosted in a private repo from a
public one (verified live, chrisgriffin/ops#440).

A target commits only a thin trigger stub, the `on:` block plus one job that
`uses:` a workflow here at `@develop`, so a fix lands once and every caller
picks it up on merge. Secrets reach a workflow through the stub's
`secrets: inherit`; they are named here, never held here. The caller's
`permissions:` is the ceiling: a stub grants at least what the called job
declares, or the run fails at startup with zero jobs.

Why the caller side of each workflow looks the way it does (mirror jobs for a
ruleset's required check name, `ready_for_review` in a stub's trigger types,
where a security guard lives) is written once, in the operator's
`shared/agents/build.md` § Reusable workflows, which every target carries.

## `_reusable-node-ci.yml` — the CI gate

Checkout, Node, install, the repo's own gate chain. Also budgets `CLAUDE.md`,
holds `docs/` to the fleet standard, and runs only Prettier on a docs-only PR.

- Inputs: `run` (required: the gate chain), `node_version` (`22`),
  `install_command` (`npm ci`), `skip_draft` (`true`; the stub must then list
  `ready_for_review` in its `pull_request.types`), `claude_md_budget` (empty:
  not budgeted), `docs_owed` (empty: no templated doc owed), `docs_only_paths`
  (empty: every PR runs the full chain).
- Secrets: `NODE_AUTH_TOKEN` (optional, for a private registry; falls back to
  `GITHUB_TOKEN`).
- The calling job grants `contents: read` and `packages: read`.

```yaml
jobs:
  call:
    permissions:
      contents: read
      packages: read
    uses: chrisgriffin/workflows/.github/workflows/_reusable-node-ci.yml@develop
    with:
      run: npm run verify
      claude_md_budget: "8500"
      docs_owed: adr-index architecture releasing testing pr-form
      docs_only_paths: docs/** .claude/** .github/CODEOWNERS
```

## `_reusable-evaluator-gate.yml` — the PR review loop's dispatcher

On every PR event and loop comment, runs the gate script out of
chrisgriffin/ops, which writes the required `Evaluator` commit status and
starts the Evaluator or Autofix routine when the PR owes a run. A pull request
from a fork is skipped, never failed.

- Inputs: none.
- Secrets: `EVALUATOR_FIRE_TOKEN`, `AUTOFIX_FIRE_TOKEN`, `OPS_GH_TOKEN` (reads
  the gate script out of chrisgriffin/ops; `TARGET_TOKEN` in ops itself).
- The stub grants `contents: read`, `issues: write`, `pull-requests: write`,
  `statuses: write`.

```yaml
jobs:
  evaluator:
    uses: chrisgriffin/workflows/.github/workflows/_reusable-evaluator-gate.yml@develop
    secrets: inherit
```

## `_reusable-claude-mention.yml` — the `@claude` responder

Posts a ⏳ placeholder and dispatches the reply to the operator for a real
`@claude` mention by the repo's owner, a member or a collaborator, and for any
comment or review the owner writes. Anyone else gets nothing.

- Inputs: `target` (required: the repo's overlay name in the operator).
- Secrets: `OPS_GH_TOKEN` (dispatches `mention.yml` on chrisgriffin/ops;
  `TARGET_TOKEN` in ops itself).
- The stub grants `issues: write` and `pull-requests: write`.

```yaml
jobs:
  dispatch:
    uses: chrisgriffin/workflows/.github/workflows/_reusable-claude-mention.yml@develop
    with:
      target: token-atlas
    secrets: inherit
```

## `_reusable-release-pr.yml` — the rolling release PR

On every push to `develop`, opens or refreshes the draft `release/next` PR
into `main`: computes the conventional-commit bump, splices the changelog,
lists the shipping PRs, and dispatches the operator's conflict sweep.

- Inputs: `extra_build_command`, `extra_add_paths`, `extra_build_gate_command`
  (all empty: no extra build artifact in the release commit).
- Secrets: `RELEASE_PR_TOKEN` (a PAT, so the PR's checks fire),
  `OPS_GH_TOKEN` (the sweep dispatch), `NODE_AUTH_TOKEN` (optional).
- The stub grants `contents: write`, `pull-requests: write`, `statuses: write`.

```yaml
jobs:
  release-pr:
    permissions:
      contents: write
      pull-requests: write
      statuses: write
    uses: chrisgriffin/workflows/.github/workflows/_reusable-release-pr.yml@develop
    secrets: inherit
```

## `_reusable-create-github-release.yml` — the GitHub Release

When a `release/*` or `hotfix/*` PR merges into `main`: reads the version from
`package.json`, cuts that version's changelog section, creates the Release and
tag, and optionally attaches assets, publishes an npm package, or publishes a
VS Code extension to the Marketplace.

- Inputs: `node_version` (`22`), `build_command`, `release_assets`,
  `npm_registry_url`, `npm_scope` (`@chrisgriffin`), `marketplace_packages`
  (all but the first two defaults empty: the bare path).
- Secrets: `VSCE_PAT` (only with `marketplace_packages`).
- The stub grants `contents: write` (`packages: write` to publish a package).

```yaml
jobs:
  release:
    if: github.event.pull_request.merged == true
    permissions:
      contents: write
    uses: chrisgriffin/workflows/.github/workflows/_reusable-create-github-release.yml@develop
    with:
      build_command: npm ci && npm run package
      release_assets: ./*.vsix
      marketplace_packages: ./*.vsix
    secrets: inherit
```

## `_reusable-sync-main-to-develop.yml` — the merge-back

After every push to `main`, merges `main` into `develop`; a conflict, or a
push the branch ruleset refuses, opens a PR instead of failing silently.

- Inputs: none.
- Secrets: `TARGET_TOKEN` or `RELEASE_PR_TOKEN` (falls back to `GITHUB_TOKEN`).
- The stub grants `contents: write` and `pull-requests: write`.

```yaml
jobs:
  sync:
    uses: chrisgriffin/workflows/.github/workflows/_reusable-sync-main-to-develop.yml@develop
    secrets: inherit
```

## `_reusable-merge-sweep.yml` — the conflict sweep, for a repo with no Release PR

On a push to the integration branch, dispatches the operator's conflict sweep
at once instead of waiting for its cron. A repo that calls
`_reusable-release-pr.yml` already gets this from that job.

- Inputs: none.
- Secrets: `OPS_GH_TOKEN`.

```yaml
jobs:
  dispatch:
    uses: chrisgriffin/workflows/.github/workflows/_reusable-merge-sweep.yml@develop
    secrets: inherit
```

## Composite actions

- `.github/actions/pr-loop-gate` — checks the gate script out of
  chrisgriffin/ops at `develop` with `ops-token` and runs it; used by the
  Evaluator gate.
- `.github/actions/dispatch-sweep` — `gh workflow run stale-grade-sweep.yml`
  on chrisgriffin/ops with `token`; used by the Release PR and merge sweep.

## This repo's own workflows

The three stubs every target carries, calling the bodies above at `develop`
so this repo is gated by what it ships: `evaluator-gate.yml`,
`claude-mention.yml` (`target: workflows`) and `build-check.yml`. The last
is a plain job, `verify`, that downloads an exact `actionlint` release,
checks its sha256 against the published checksum, and lints every workflow
here with shellcheck; there is no Node project to run `_reusable-node-ci.yml`
against. `specs/` holds the spec, plan and tasks behind each change.
