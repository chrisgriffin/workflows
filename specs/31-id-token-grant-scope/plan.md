# Plan: README says the Open VSX id-token grant reaches every step of the release run, build_command included

Add one sentence to the README's Open VSX trusted-publishing bullet, right after "Open VSX trusts any ref that runs the registered stub", saying the grant reaches every step of the release run, the caller's `build_command` and whatever it installs included, so any of them can request the ID token Open VSX accepts. No workflow behaviour change (two of its comments are corrected to match): the reusable file's "no `permissions:` key" design stays, as the issue asks.

## Surfaces touched

- `README.md` — the Open VSX trusted-publishing bullet gains the sentence; the `marketplace_packages` input description is left as it is.
- `.github/workflows/_reusable-create-github-release.yml` — comments only: the `release` job's note (build_command "runs in a tree that holds no token") and the `marketplace` job's note ("Each tool sees only its own token") read narrower than the grant, so each now says the step's environment carries the ID-token request variables when the caller grants `id-token: write`. No body, `permissions:` or input change, so no caller stub is touched.
- `CHANGELOG.md` — none: release tooling writes it from the conventional commit.
