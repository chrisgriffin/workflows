# Tasks: README says the Open VSX id-token grant reaches every step of the release run, build_command included

## Phase 1: change

- [x] [T001] Add the grant-scope sentence after "trusts any ref" in `README.md`'s Open VSX trusted-publishing bullet.
- [x] [T002] Run `grep -A2 "trusts any ref" README.md | grep -c build_command` (expect `1`+) and `npm run verify`.

## Phase 2: surfaces

- [x] [T003] `README.md` — the Open VSX trusted-publishing bullet carries the sentence (T001).
- [x] [T004] `.github/workflows/_reusable-create-github-release.yml` — the `release` and `marketplace` job comments say the step's environment carries the ID-token request variables under the grant (comments only).
