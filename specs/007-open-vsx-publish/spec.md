# Spec: Publish VS Code extensions to Open VSX on release

## Overview

A released VS Code extension reaches only the Microsoft Marketplace. Open VSX (open-vsx.org) is the open registry that VS Code-based editors outside Microsoft's install from, and needs only a free account. The `marketplace` job of `_reusable-create-github-release.yml` (from #17) publishes the Release's `.vsix` there too, with the caller's `OVSX_PAT`, independent of the Marketplace publish and with the same retry behavior. Fixes #18. Stacked on #17.

## User scenarios

- A caller with `OVSX_PAT` merges its release PR: the `.vsix` is published to the Marketplace (with `VSCE_PAT`) and to Open VSX.
- A caller with only one of the two tokens: the other registry is skipped with a notice.
- The Marketplace publish fails but Open VSX succeeds (or the reverse): both are attempted, and the run is red; a re-run retries, and the registry that already has the version is green.

## Functional requirements

- FR-1: `OVSX_PAT` is declared beside `VSCE_PAT`, optional.
- FR-2: The publish step runs `ovsx publish --skip-duplicate --packagePath $PACKAGES` (ovsx pinned to an exact version) with the token only in the environment, and without `VSCE_PAT` in ovsx's environment nor `OVSX_PAT` in vsce's.
- FR-3: Each registry with no token: a notice. A failed publish does not stop the other; the step fails at the end naming each that failed. Neither token: one notice, nothing downloaded.
- FR-4: README documents `OVSX_PAT` and the no-card account.

## Success criteria

- [ ] The release publishes the Release's `.vsix` to Open VSX with the caller's `OVSX_PAT` secret; with none it skips green with a notice.
- [ ] The Marketplace and Open VSX publishes are independent: one failing never skips the other, and the run fails if either failed.
- [ ] A re-run retries the Open VSX publish like the Marketplace one, and a version already on Open VSX counts as published.
- [ ] The README documents `OVSX_PAT` (an Open VSX access token whose namespace must already exist and match the extension's publisher) and that Open VSX needs no card or paid account.
- [ ] **Runnable:** `npx jest test/create-github-release.test.js -t 'marketplace job'` passes on the PR head; on `develop` it fails.

## Needs from Chris

1. Create the Open VSX access token and namespace, then add the token as token-atlas's `OVSX_PAT` repository secret. Where: sign in at open-vsx.org with an Eclipse account, accept the publisher agreement, create a token under Settings > Access Tokens, run `npx ovsx create-namespace <publisher>` once with `OVSX_PAT` set to the token, then token-atlas Settings > Secrets and variables > Actions. When: after merge.
