# Plan: Start CHANGELOG.md on a repo's first Release PR

## Design

1. One line before the awk splice: `[ -f CHANGELOG.md ] || printf '# Changelog\n' > CHANGELOG.md`. The splice's no-version-header branch (ops#1241) already puts the entry after the title.
2. A test runs the step's lines from that check through the `mv` in an empty directory.

## Surfaces touched

- a `_reusable-*.yml` body (`_reusable-release-pr.yml`): no input, secret or `permissions:` change; every caller is unaffected unless it has no `CHANGELOG.md`.
