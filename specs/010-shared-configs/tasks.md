# Tasks: Adopt the shared configs from chrisgriffin/config

- [x] T001 `package.json`, `package-lock.json`: install `github:chrisgriffin/config#v1`, `prettier`, `eslint@9`, `globals`; `npm ls @chrisgriffin/config` red on `develop`, green here.
- [x] T002 `package.json`: `"prettier": "@chrisgriffin/config/prettier"`; `format`, `format:check`, `lint`, `verify` scripts.
- [x] T003 `eslint.config.mjs`: spread the base first; `test/**/*.js` as CommonJS with Jest globals.
- [x] T004 `.prettierignore`: the operator's laid paths.
- [x] T005 `test/create-github-release.test.js`, `test/release-pr.test.js`: formatted.
- [x] T006 `.github/workflows/build-check.yml`: format and lint steps after `npm ci`.
- [x] T007 `npm run verify` and `actionlint` clean; an unformatted file fails `format:check` and an unused variable fails `lint`.

## Surfaces

- [x] T008 Required check `build / ci`: job id and name unchanged; ruleset untouched.
- [x] T009 README § This repo's own workflows: format, lint, `verify`, the config dependency.
- [x] T010 `build-check.yml` header comment: the format and lint steps.
- [x] T011 Published surface: none; no body, input or secret changed.
