# Spec: README says the Open VSX id-token grant reaches every step of the release run, build_command included

Issue: [workflows#31](https://github.com/chrisgriffin/workflows/issues/31)

## Overview

The README's Open VSX trusted-publishing passage tells a caller to grant `id-token: write` in its stub. `_reusable-create-github-release.yml` declares no `permissions:` key, so that grant reaches every job of the run, the `release` job's `build_command` included, and any of those steps can request the same ID token Open VSX accepts. The README does not say so; a caller deciding whether to grant it should know what it is trusting.

## User scenarios

- A caller reading the passage before turning on trusted publishing learns that the grant is not scoped to the Open VSX publish step, and that its own `build_command`, and whatever that installs, can request the ID token too.

## Functional requirements

- **FR-1** The README's Open VSX trusted-publishing passage says the caller's `id-token: write` reaches every step in the release run, `build_command` included, not only the Open VSX publish step.
- **FR-2** Docs only: no workflow, `permissions:` or input changes. Narrowing the grant to the `marketplace` job is a separate design call (the issue's Context).

## Success criteria

- [ ] The README's Open VSX trusted-publishing passage says that the caller's `id-token: write` reaches every step in the release run, `build_command` included, not only the Open VSX publish step.
- [ ] **Runnable:** `grep -A2 "trusts any ref" README.md | grep -c build_command` prints `1` or more (it prints `0` on `develop` today). This is a docs-only ticket, so the repo's verify gate is the other half of the check.
- [ ] `npm test` and the repo's verify gate pass.
