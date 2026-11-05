# Spec: The release job reads a publish back from the registry

**Issue**: [#33](https://github.com/chrisgriffin/workflows/issues/33)

## Overview

The `marketplace` job of `_reusable-create-github-release.yml` treats `vsce publish` and `ovsx publish` exiting 0 as the publish having happened. It never asks the registry, so a publish the registry accepted and does not serve looks identical to one that worked. Chris requested this on 2026-11-04: fail the job when a publish can't be verified, and report an unreachable registry as unchecked, distinct from a verified failure.

## User scenarios

- A caller publishes to both registries and both serve the version: the job is green and its log names each registry, namespace and version it verified.
- A registry takes a few minutes to show a new version: the job waits, within a bound, and goes green.
- A registry answers and does not serve the version after that bound: the job is red and the log says `MISSING`.
- A registry cannot be reached or read after that bound: the job is red and the log says `UNCHECKED`, so nobody reads an outage as a lost publish.
- A caller with no way to publish to a registry, or passing no `marketplace_packages`: nothing changes, and no registry is asked.

## Functional requirements

- FR-1: After the publishes, the step reads back only what this run published: a registry whose publish exited 0, never one it skipped or whose publish failed.
- FR-2: The extension's publisher, name and version come from each `.vsix` matched by `marketplace_packages`, since that is what the tools published. A `.vsix` that cannot be read reds the job rather than leaving nothing to check.
- FR-3: Open VSX is read at `GET /api/<namespace>/<name>/<version>`: 200 with that version is verified, its own 404 with `error` is missing, anything else is unchecked.
- FR-4: The Marketplace is read through its public gallery query with flags 33 (`IncludeVersions`, `ExcludeNonValidated`): a 200 listing that version is verified, a 200 without it is missing, anything else is unchecked.
- FR-5: The bound is named: 20 tries, 30 seconds apart, about ten minutes, shared across the checks. The last try's answer decides between missing and unchecked. A registry that verifies stops being asked.
- FR-6: `MISSING` and `UNCHECKED` both red the job, each in its own `::error::` naming the registry, the namespace and the version, and neither stops the other registry being checked.
- FR-7: The job's `timeout-minutes` holds the whole bound for one extension identity (publisher, name, version) with every try hanging to curl's `--max-time`, on top of the publishes. Packages sharing an identity, such as one extension's platform-specific `.vsix` files, are read once per registry and reported once. Corrected in review: FR-7 first stated the bound unconditionally, but `marketplace_packages` is a glob, and each further identity it matches adds 2 × 20 × 15 s to the worst case, so a caller publishing more than one extension raises the timeout first. Only `token-atlas` passes the input, with one extension.
- FR-8: No token reaches a read: both APIs are public. No new input, secret or `permissions:` key.

## Success criteria

- [x] A release run that publishes to a registry verifies afterwards that the published version is actually retrievable from that registry, and fails the job when it is not.
- [x] A run that **skips** a registry — no token and no `id-token: write` — still skips quietly as it does today. A skip is not a failure and must not become one.
- [x] The verification names the registry, the namespace and the version it checked, so a reader of the log can tell what was asserted.
- [x] A transient registry outage does not silently pass as "verified": an unreachable registry is reported as unchecked, distinct from a verified failure.
- [x] **Runnable:** `npx jest test/create-github-release.test.js -t 'reads the publish back' 2>&1 | grep '^Tests:' | grep -v failed | grep -c passed` prints `1`. These tests red the job as `MISSING` when a registry answers without the version and as `UNCHECKED` when it cannot be reached, and leave a skipped registry green. It prints `0` on `develop`, where none match.
