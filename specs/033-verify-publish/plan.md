# Plan: The release job reads a publish back from the registry

## Technical context

- The `marketplace` job is one `run:` step with no checkout, so the extension's identity comes from the `.vsix` it downloaded (`extension/package.json`). `curl` and `unzip` are on the `ubuntu-latest` image; `node` is the job's own `setup-node`.
- Read live on 2026-11-04. Open VSX: a served version is 200 with `version`, an absent one 404 with `error`. Marketplace gallery query: a served version is listed under `results[].extensions[].versions[]`, an absent extension is 200 with `extensions: []`.
- vsce's own output says the listing "might take a few minutes", and a version can sit on Open VSX unlisted, so an absent answer right after a publish means nothing until a bound has passed.
- Bash runs with `-e` and no `pipefail`. A curl failure must not end the script, and `unzip | node` must fail on node's parse of empty output.

## Design

1. `publish_to` records each registry in `PUBLISHED` or `FAILED`, in place of the three `|| FAILED=` lines.
2. `read_back` makes one read and prints `verified`, `missing` or `unchecked`.
3. A loop of `READ_BACK_TRIES` (20) tries, `READ_BACK_WAIT` (30) seconds apart, drops what verifies and keeps the last answer for the rest.
4. Each `missing` or `unchecked` left gets its own `::error::`, then the existing `Publish failed:` error, then `exit 1`.
5. `timeout-minutes` goes from 10 to 25: 19 waits of 30 seconds, 20 tries against two registries at a 15-second `--max-time`, and five minutes for the publishes.

Tries, not a wall clock, so a test can run the whole bound with `sleep` stubbed.

## Out of scope

- `npm publish` in the `release` job: the issue names the two extension registries in the `marketplace` job.

## Surfaces touched

- `.github/workflows/_reusable-create-github-release.yml`: every calling stub, enumerated by content on each target's `develop`. One passes `marketplace_packages`, token-atlas, and it picks this up at `@v1` with no stub change: no input, secret or `permissions:` key changed. Every other stub never starts the job, and this repo's own stub (`create-github-release.yml`) is one of those.
- `test/create-github-release.test.js`: the tests beside the body.
- `README.md`: the workflow's section and § Tests.
- `CHANGELOG.md`: written by the release flow, not by hand.
