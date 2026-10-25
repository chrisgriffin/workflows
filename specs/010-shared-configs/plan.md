# Plan: Adopt the shared configs from chrisgriffin/config

## Design

1. `npm install --save-dev github:chrisgriffin/config#v1 prettier eslint@9 globals`. `globals` is listed because `eslint.config.mjs` imports it directly; the lockfile pins the config's commit.
2. `package.json`: `"prettier": "@chrisgriffin/config/prettier"`, and `format`, `format:check`, `lint` and `verify` scripts (`verify` = format check, lint, `npm test`).
3. `eslint.config.mjs`: the base, then `test/**/*.js` as CommonJS with Node and Jest globals.
4. `.prettierignore`: the operator's laid paths (`.git/info/exclude`'s set).
5. `npx prettier --write` on the files it flags (two test files today).
6. `build-check.yml`: a format step and a lint step after `npm ci`; the job id and `name:` stay as they are, so the required check `build / ci` is unchanged.

## Surfaces touched

- a workflow job that is a required check (`build-check.yml`'s `ci`, `build / ci`) — steps added only; job id and name unchanged, so the ruleset needs nothing.
- README § This repo's own workflows — names the new format and lint steps, `npm run verify`, and the config dependency.
- `build-check.yml`'s header comment — names the format and lint steps.
- none for a published surface — no workflow body, input, secret or `permissions:` changes; no caller is affected.
