# Plan: an optional NPM_TOKEN secret on the release workflow

One secret and one expression. `on.workflow_call.secrets` gains
`NPM_TOKEN`, `required: false`, declared beside `VSCE_PAT` and `OVSX_PAT`
with the same shape. The `Publish package` step's env becomes
`NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN || secrets.GITHUB_TOKEN }}`, the
`||` fallback `_reusable-release-pr.yml` already uses for
`RELEASE_PR_TOKEN || GITHUB_TOKEN`. The build step's `NODE_AUTH_TOKEN`
takes the same expression: setup-node's `registry-url` writes the only
`.npmrc` auth line, for `npm_registry_url`, so a `build_command`'s installs
go to the publish registry too, and on npmjs `GITHUB_TOKEN` is an E401 and a
token sent off GitHub. No new job, no new input: `npm_registry_url` already selects the
registry, and setup-node's `registry-url` already writes the `.npmrc` line
that reads `NODE_AUTH_TOKEN`.

The test extends the existing secrets assertion to the three names and adds
one for the publish step's token expression, red before the change.

## Surfaces touched

- `_reusable-create-github-release.yml` body (build.md § Fleet surfaces: a
  `_reusable-*.yml` body): the secret is new and optional, so no current
  caller's `secrets:` list changes; the one stub that will pass it is
  design-delta's, which does not exist yet and is filed as its own work. No
  `permissions:` change, so no caller's ceiling moves.
- The README's `_reusable-create-github-release.yml` section (a published
  surface's docs): the secrets bullet and the publish paragraph.
- `test/create-github-release.test.js`: the shape test beside the body, in
  this repo, never in ops.
- No required check name, no cron, no plugin, no vault `covers:` path names
  this file's secrets.
