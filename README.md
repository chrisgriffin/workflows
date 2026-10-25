# workflows

The reusable GitHub Actions workflows and composite actions every repo in the
fleet calls. Public, so a public caller can use them: GitHub refuses a
`uses:` of a reusable workflow or action hosted in a private repo from a
public one (verified live, chrisgriffin/ops#440).

A target commits only a thin trigger stub, the `on:` block plus one job that
`uses:` a workflow here at `@v1`, the floating major tag, so a fix lands once
here and every caller picks it up on release. Every workflow declares the
secrets it reads under `on.workflow_call.secrets`, and a stub passes each one
by name (`secrets:` with `${{ secrets.NAME }}` entries), never
`secrets: inherit`, so a workflow in another repo sees only what the stub
hands it; they are named here, never held here. The caller's `permissions:`
is the ceiling: a stub grants at least what the called job declares, or the
run fails at startup with zero jobs.

## Versions

Releases follow the fleet's own flow, run here on this repo's stubs: every
push to `develop` refreshes the draft `release/next` PR into `main` with the
conventional-commit bump of `package.json`'s version (`feat` minor, `fix`
patch, a breaking change major); merging it tags the merge commit `vX.Y.Z`,
cuts that version's `CHANGELOG.md` section into a GitHub Release, and moves
the floating `vX` tag onto it (`_reusable-create-github-release.yml`'s
`floating_major_tag` input). A caller writes `@v1` and follows every v1
release with no PR of its own; a breaking change is a new major the caller
moves to on purpose. A caller that must pin harder writes the exact `@v1.4.2`.
This repo's own stubs call `@develop`, so the repo is gated by what it ships
before it ships it. The two composite actions are called at `@develop` from
the workflow bodies: both are glue around scripts that live in the operator at
`develop` anyway, so a tag on the glue would pin nothing.

Every GitHub-owned action the bodies use is pinned to a full commit SHA with
its version in a trailing comment; bump the SHA and the comment together.

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
    uses: chrisgriffin/workflows/.github/workflows/_reusable-node-ci.yml@v1
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
    uses: chrisgriffin/workflows/.github/workflows/_reusable-evaluator-gate.yml@v1
    secrets:
      EVALUATOR_FIRE_TOKEN: ${{ secrets.EVALUATOR_FIRE_TOKEN }}
      AUTOFIX_FIRE_TOKEN: ${{ secrets.AUTOFIX_FIRE_TOKEN }}
      OPS_GH_TOKEN: ${{ secrets.OPS_GH_TOKEN }}
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
    uses: chrisgriffin/workflows/.github/workflows/_reusable-claude-mention.yml@v1
    with:
      target: token-atlas
    secrets:
      OPS_GH_TOKEN: ${{ secrets.OPS_GH_TOKEN }}
```

## `_reusable-release-pr.yml` — the rolling release PR

On every push to `develop`, opens or refreshes the draft `release/next` PR
into `main`: computes the conventional-commit bump, splices the changelog,
lists the shipping PRs, and dispatches the operator's conflict sweep.

- Inputs: `extra_build_command`, `extra_add_paths`, `extra_build_gate_command`
  (all empty: no extra build artifact in the release commit).
- Secrets: `RELEASE_PR_TOKEN` (a PAT, so the PR's checks fire),
  `OPS_GH_TOKEN` (the sweep dispatch), `NODE_AUTH_TOKEN` (optional).
- Variables: `RELEASE_AS` (optional), an Actions variable on the calling
  repo, set in its settings rather than by a commit: a plain `X.Y.Z` (say
  `1.0.0`, which a commit never reaches from `0.x`) becomes the next version
  when it is above the commit bump, and a malformed value fails the run.
  Leave it or delete it after the release ships; a value not above the
  current version is ignored.
- The stub grants `contents: write`, `pull-requests: write`, `statuses: write`.

```yaml
jobs:
  release-pr:
    permissions:
      contents: write
      pull-requests: write
      statuses: write
    uses: chrisgriffin/workflows/.github/workflows/_reusable-release-pr.yml@v1
    secrets:
      RELEASE_PR_TOKEN: ${{ secrets.RELEASE_PR_TOKEN }}
      OPS_GH_TOKEN: ${{ secrets.OPS_GH_TOKEN }}
```

## `_reusable-create-github-release.yml` — the GitHub Release

When a `release/*` or `hotfix/*` PR merges into `main`: reads the version from
`package.json`, cuts that version's changelog section, creates the Release and
tag, and optionally attaches assets, publishes an npm package, or publishes a
VS Code extension to the Marketplace and Open VSX.

- Inputs: `node_version` (`22`), `build_command`, `release_assets`,
  `npm_registry_url`, `npm_scope` (`@chrisgriffin`), `marketplace_packages`
  (all but the first two defaults empty: the bare path), `floating_major_tag`
  (`false`; `true` also moves the `vX` tag onto the release, for a repo
  other repos `uses:` by tag).
- Secrets: `VSCE_PAT` and `OVSX_PAT` (only with `marketplace_packages`;
  `OVSX_PAT` not with trusted publishing, below).
- The stub grants `contents: write` (`packages: write` to publish a package).
- Publishing is its own job, after the release: it downloads the Release's
  assets matching `marketplace_packages` and publishes them to each registry
  it can publish to: the Marketplace with `VSCE_PAT`, Open VSX with
  `OVSX_PAT` or trusted publishing, with `vsce publish --skip-duplicate` and
  `ovsx publish --skip-duplicate`. A registry with no way to publish is
  skipped with a notice; the two are independent, and the job fails if either publish
  failed. A failed publish is retried by re-running the run; the job reads
  the `.vsix` back off the Release, which already exists, and a version
  already on a registry counts as published.
- `VSCE_PAT` is a global Azure DevOps PAT (organization "All accessible
  organizations"), which Microsoft retires on 2026-12-01. After that the PAT
  stops working; remove the secret, and the caller uploads the Release's
  `.vsix` by hand with "Update" on its extension at
  [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage).
- `OVSX_PAT` is an Open VSX access token, from the caller's
  [open-vsx.org](https://open-vsx.org) user settings. The namespace must
  already exist and match the extension's `publisher`
  (`npx ovsx create-namespace <publisher>` once, with the token). Open VSX
  needs only a free account (an Eclipse account and its publisher
  agreement), no card or paid account.
- Open VSX trusted publishing replaces `OVSX_PAT` with the run's GitHub
  OIDC ID token, so no secret is stored. Open VSX requires the first version
  to be published with a token. After that, register the caller's stub
  under Settings > Trusted Publishers on open-vsx.org, using the stub's
  owner, repository and filename (for example
  `create-github-release.yml`). Then grant `id-token: write` beside
  `contents: write` in the stub and stop passing `OVSX_PAT`. A token, when
  passed, still wins. Open VSX trusts any ref that runs the registered
  stub.

```yaml
jobs:
  release:
    if: github.event.pull_request.merged == true
    permissions:
      contents: write
    uses: chrisgriffin/workflows/.github/workflows/_reusable-create-github-release.yml@v1
    with:
      build_command: npm ci && npm run package
      release_assets: ./*.vsix
      marketplace_packages: ./*.vsix
    secrets:
      VSCE_PAT: ${{ secrets.VSCE_PAT }}
      OVSX_PAT: ${{ secrets.OVSX_PAT }}
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
    permissions:
      contents: write
      pull-requests: write
    uses: chrisgriffin/workflows/.github/workflows/_reusable-sync-main-to-develop.yml@v1
    secrets:
      RELEASE_PR_TOKEN: ${{ secrets.RELEASE_PR_TOKEN }}
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
    uses: chrisgriffin/workflows/.github/workflows/_reusable-merge-sweep.yml@v1
    secrets:
      OPS_GH_TOKEN: ${{ secrets.OPS_GH_TOKEN }}
```

## Composite actions

- `.github/actions/pr-loop-gate` — checks the gate script out of
  chrisgriffin/ops at `develop` with `ops-token` and runs it; used by the
  Evaluator gate.
- `.github/actions/dispatch-sweep` — `gh workflow run stale-grade-sweep.yml`
  on chrisgriffin/ops with `token`; used by the Release PR and merge sweep.

## This repo's own workflows

The stubs every target carries, calling the bodies above at `develop` so this
repo is gated by what it ships: `evaluator-gate.yml`, `claude-mention.yml`
(`target: workflows`), `build-check.yml`, and the release flow's
`release-pr.yml`, `create-github-release.yml` (`floating_major_tag: true`)
and `sync-main-to-develop.yml` (§ Versions). `build-check.yml` is a plain
job named `build / ci` (the check every target's ruleset requires; a plain
job's check-run is its job name alone), that downloads an exact `actionlint` release, checks its sha256
against the published checksum, lints every workflow here with shellcheck,
runs `npm run format:check` and `npm run lint`, and runs `npm test`
(§ Tests); a plain job rather than a call of `_reusable-node-ci.yml`, since
that body is one of the files under test. `npm run verify` is the same chain
less actionlint. `package.json` carries the version the release flow bumps,
the test suite's dev dependencies, and
[chrisgriffin/config](https://github.com/chrisgriffin/config) at `#v1`:
Prettier reads its config (`"prettier": "@chrisgriffin/config/prettier"`)
and `eslint.config.mjs` spreads its ESLint base first. `specs/` holds the spec, plan and tasks behind
each change.

## Tests

`test/` holds a Jest suite, one file per body, that parses each workflow with
`js-yaml` and runs the shell that decides something the way the runner would
(`bash -e`, the step's own `env:` names) against throwaway git repos and
fixtures: the CI gate's scope, budget and docs checks, the release PR's
version bump, PR list and changelog splice, the release's changelog cut and
Marketplace publish, the sync's refused-push fallback, the mention hook's guard.
`test/workflows.test.js` pins what every file here follows: `workflow_call`
only, secrets declared by name, a timeout on every job, a full commit SHA on
every GitHub-owned action, nothing under `chrisgriffin/ops/.github`.

The suite moved here from the operator with the bodies (ops#1683, phase B),
so a change to a body is checked by the PR that makes it. Two things it
cannot hold are the operator's: the words of the fleet doc templates, whose
hashes `_reusable-node-ci.yml` carries inline as `MANIFEST`, and the
single-source rules inline as `RULES`. The operator's own suite proves a
tree laid from its templates passes the docs check. Until
[ops#1690](https://github.com/chrisgriffin/ops/pull/1690) merges, nothing
checks either inline copy against its source there, so a change to a
template or a rule in the operator has to be copied here by hand; then its
`npm run check:public-workflows` reads this file live and notices when
either copy drifts.
