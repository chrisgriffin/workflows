# Tasks: README says the Open VSX id-token grant reaches every step of the release run, build_command included

## Phase 1: change

- [ ] [T001] Add the grant-scope sentence after "trusts any ref" in `README.md`'s Open VSX trusted-publishing bullet.
- [ ] [T002] Run `grep -A2 "trusts any ref" README.md | grep -c build_command` (expect `1`+) and `npm run verify`.

## Phase 2: surfaces

- [ ] [T003] `README.md` — the Open VSX trusted-publishing bullet carries the sentence (T001).
