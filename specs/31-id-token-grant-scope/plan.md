# Plan: README says the Open VSX id-token grant reaches every step of the release run, build_command included

Add one sentence to the README's Open VSX trusted-publishing bullet, right after "Open VSX trusts any ref that runs the registered stub", saying the grant reaches every step of the release run, the caller's `build_command` and whatever it installs included, so any of them can request the ID token Open VSX accepts. No workflow change: the reusable file's "no `permissions:` key" design stays, as the issue asks.

## Surfaces touched

- `README.md` — the Open VSX trusted-publishing bullet gains the sentence; the `marketplace_packages` input description and the workflow comments are left as they are (they describe the grant correctly and say nothing narrower).
- `.github/workflows/_reusable-create-github-release.yml` — none: no body, `permissions:` or input change, so no caller stub is touched.
- `CHANGELOG.md` — none: release tooling writes it from the conventional commit.
