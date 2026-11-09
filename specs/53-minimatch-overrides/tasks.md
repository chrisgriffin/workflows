# Tasks: override glob and minimatch to their patched majors

## Phase 1: Fix

- [x] [T001] Add the bounded `glob` and `minimatch` `overrides` to `package.json`
- [x] [T002] Regenerate `package-lock.json` with `npm install`
- [x] [T003] Confirm `npm ls minimatch glob --all` shows only `minimatch@3.1.5`/`11.0.5` and `glob@14.0.4`
- [x] [T004] Run `npm run verify` green
- [x] [T005] Name the cause on chrisgriffin/workflows#53

## Phase 2: After merge

- [ ] [T006] (after merge) Dependabot's next `npm_and_yarn` run on `develop` finishes green
- [ ] [T007] (after merge) Incident `1e0a78f80292` reads `resolved_at` as a timestamp

## Phase 3: Surfaces

- none — see plan.md § Surfaces touched
