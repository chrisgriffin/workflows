# Plan: override glob and minimatch to their patched majors

Same fix as chrisgriffin.io's for the same advisory: two bounded `overrides`
entries in `package.json`, `"glob@>=9 <15": "^14.0.2"` and
`"minimatch@>=7 <12": "^11.0.1"`, then `npm install` to rewrite the lockfile.
The bounds keep ESLint's `minimatch@3` out of reach (its API differs) and
never force a future `glob@15`/`minimatch@12` down. `glob@14` and
`minimatch@11` support Node 22, which CI runs. Jest is the only consumer of
`glob`; the full suite runs under the override.

## Surfaces touched

- none — `package.json` and `package-lock.json` are dev tooling only; no
  reusable workflow body, required check name, published surface or doc
  names these dependencies (grep of `README.md`, `CHANGELOG.md` and
  `.github/` for `minimatch`, `glob`, `overrides` finds nothing).
