# Spec: The shared release workflow publishes to npmjs when a caller passes an NPM_TOKEN secret

Issue: chrisgriffin/workflows#55

## Overview

`_reusable-create-github-release.yml` publishes an npm package after it
cuts a release when the caller sets `npm_registry_url`, but its publish step
always authenticates with the automatic `GITHUB_TOKEN`. GitHub Packages
accepts that token; the public npm registry does not. A caller that
publishes to npmjs has no way to hand the workflow a token of its own, so
the publish step fails there.

The shape for a caller-supplied token already exists in this file:
`VSCE_PAT` and `OVSX_PAT` are optional secrets declared under
`on.workflow_call.secrets` and passed by name from a stub. `NPM_TOKEN`
follows it. The publish step uses it as `NODE_AUTH_TOKEN` when the caller
passed one and falls back to `GITHUB_TOKEN` when not, so every current
caller (resume-kit and design-drift, publishing to GitHub Packages) is
unchanged.

## User scenarios

- A public package's stub passes `npm_registry_url:
https://registry.npmjs.org` and `NPM_TOKEN`, and the release run publishes
  the package to npmjs.
- resume-kit's stub passes no `NPM_TOKEN`, and its next release publishes to
  GitHub Packages exactly as today.
- A maintainer reading the README's `_reusable-create-github-release.yml`
  section learns `NPM_TOKEN` is optional and which registry needs it.

## Functional requirements

- FR-1: `on.workflow_call.secrets` declares `NPM_TOKEN`, optional, with a
  description naming when it is read and which registry needs it.
- FR-2: The `Publish package` step's `NODE_AUTH_TOKEN` is `NPM_TOKEN` when
  the caller passed one, else `GITHUB_TOKEN`.
- FR-3: The README's section on this workflow lists `NPM_TOKEN` among the
  secrets and says the public npm registry needs it and GitHub Packages does
  not.
- FR-4: `test/create-github-release.test.js` holds the declared secrets and
  the publish step's token expression.
- FR-5: `npm run verify` stays green.

## Success criteria

- [ ] A caller that passes `NPM_TOKEN` and `npm_registry_url: https://registry.npmjs.org` publishes its package to npmjs in the release run.
- [ ] A caller that passes no `NPM_TOKEN` publishes to GitHub Packages exactly as today (resume-kit's next release proves it).
- [ ] The workflow's `secrets:` block and the README's secrets list name `NPM_TOKEN` as optional and say which registry needs it.
- [ ] **Runnable:** `grep -c "NPM_TOKEN" .github/workflows/_reusable-create-github-release.yml` prints at least 2 (prints 0 on `develop` today).
