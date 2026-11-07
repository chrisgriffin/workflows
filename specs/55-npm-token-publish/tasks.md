# Tasks: an optional NPM_TOKEN secret on the release workflow

## Phase 1: Red

- [x] [T001] Extend `test/create-github-release.test.js`: the declared secrets are `VSCE_PAT`, `OVSX_PAT`, `NPM_TOKEN`; the `Publish package` step's `NODE_AUTH_TOKEN` is `${{ secrets.NPM_TOKEN || secrets.GITHUB_TOKEN }}`; run it red

## Phase 2: Green

- [x] [T002] Declare `NPM_TOKEN` (optional) under `on.workflow_call.secrets` in `_reusable-create-github-release.yml`
- [x] [T003] Point the `Publish package` step's `NODE_AUTH_TOKEN` at `NPM_TOKEN || GITHUB_TOKEN`
- [x] [T004] README: `NPM_TOKEN` in the workflow's secrets bullet and the publish paragraph, naming which registry needs it
- [x] [T005] `npm run verify` green

## Phase 3: Surfaces

- [x] [T006] PR body records that no current caller's `secrets:` list changes (the secret is optional and new) and that design-delta's stub is the first to pass it
