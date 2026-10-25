# Spec: Adopt the shared configs from chrisgriffin/config

## Overview

This repo has no formatter or linter. It adopts the fleet's shared Prettier and ESLint configs from [chrisgriffin/config](https://github.com/chrisgriffin/config), installed as `github:chrisgriffin/config#v1`, so it formats and lints the way every other repo does, and CI holds it there. Fixes #24.

## User scenarios

- A contributor runs `npm run verify` and gets the same format and lint verdict CI gives.
- A PR that leaves a file unformatted, or adds a lint error, fails `build / ci`.

## Functional requirements

- FR-1: `package.json` sets `"prettier": "@chrisgriffin/config/prettier"`; the repo carries no Prettier config of its own.
- FR-2: `eslint.config.mjs` spreads `@chrisgriffin/config/eslint` first, then adds what is this repo's own: the Jest suite under `test/` is CommonJS with Jest globals.
- FR-3: `build-check.yml` runs `npm run format:check` and `npm run lint` after `npm ci`, in the same `build / ci` job.
- FR-4: Paths the operator lays at runtime (never tracked) are in `.prettierignore`, so a shift's own format check stays green.

## Success criteria

- [ ] Prettier reads `@chrisgriffin/config/prettier` instead of a config of this repo's own, every file is formatted with it, and CI fails on an unformatted file.
- [ ] ESLint runs from an `eslint.config.mjs` that spreads `@chrisgriffin/config/eslint` first, reports no errors, and CI fails on a lint error.
- [ ] **Runnable:** `npm ls @chrisgriffin/config` exits 0 and the repo's verify gate passes. On `develop`, `npm ls @chrisgriffin/config` exits 1.

## Needs from Chris

none
