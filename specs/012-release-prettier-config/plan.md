# Plan: release-pr formats CHANGELOG.md with a caller's packaged Prettier config

## Design

In "Install the changelog tooling", a `node -e` reads `package.json`'s `prettier` field. For a package specifier, it prints the specifier and the install spec: the caller's own dependency spec (a `github:` or other protocol spec as is, a range as `pkg@range`), or the bare name. The spec joins the one `npm install --prefix /tmp/rp-tools` (a second `--no-save` install would prune the first), and the resolved config path goes to `$GITHUB_ENV` as `RP_PRETTIER_CONFIG`. The format line passes `--config "$RP_PRETTIER_CONFIG"` only when it is set.

## Surfaces touched

- `.github/workflows/_reusable-release-pr.yml`: this repo's own `release-pr.yml` calls it at `@develop`, so its next release run uses the fix on merge; callers on `v1` get it when `v1` moves with that release.
- A caller that lists `CHANGELOG.md` in `.prettierignore` is unaffected: Prettier skips the file either way.
- `test/release-pr.test.js`: runs the parser from the workflow text; the existing format-line assertion now names the `--config` form.
