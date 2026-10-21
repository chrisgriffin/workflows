# Plan: The bodies' tests live beside the bodies

## Technical context

- The operator's suites that read a body or an action: `ci/test/{reusable-workflows,ci-minutes,node-ci-docs-only,release-pr-duplicate-pr-number,reusable-create-github-release,reusable-marketplace-publish,reusable-release-pr,sync-refused-push,bookkeeping-merge-token}.test.js`, `shift/test/{claude-mention-guard,mention-placeholder,owner-comment-reply}.test.js`, `repo/test/{claude-md-budget,docs-standard,pr-reviewer-requests}.test.js`, `pr-loop/test/action.test.mjs`. Jest, `js-yaml`, real `git`, `bash`, `awk` and `jq` on PATH.
- The bodies here differ from the operator's copies where phase A hardened them: inputs in place of per-repo tables, `"$GITHUB_OUTPUT"` quoted, exact tool versions, per-command push headers, the association gate on the mention hook, the fork skip on the gate. The tests pin the files as they are here.
- This branch is stacked on `003-versioned-releases` (#6): both add `package.json`, and the secrets-by-name and SHA-pin rules this suite enforces are that PR's work.

## Design

1. **Tooling.** `jest` and `js-yaml` as dev dependencies, `"jest": {"testEnvironment": "node"}` in `package.json`, `npm test` = `jest`, `.gitignore` for `node_modules/`.
2. **Suites.** Each operator file's body-reading half moves, with its path pointed at `.github/workflows/` here, its fixtures' repo names neutralised, and its table assertions rewritten as input assertions. Tests about a stub in the operator (its `evaluator-gate.yml`, `self-mention.yml`, `mention.yml`, `build-check.yml`, CODEOWNERS, `build.md`) stay there.
3. **No fixture from the templates.** The docs-check cases build each tree in tmp from the inline `MANIFEST`'s shape; the template words are the operator's and would carry its private links here. The operator keeps the checker's copy and the conforming-tree case.
4. **CI.** `build-check.yml`: setup-node (SHA-pinned, `cache: npm`), `npm ci`, `npm test`, after actionlint. The job stays `ci`.
5. **README.** `## Tests`, naming what the operator still holds; the own-workflows paragraph no longer says there is no Node project.

## Surfaces touched

- a `_reusable-*.yml` body — none changed; every calling stub is unaffected.
- a workflow job name that is a required check — `build / ci` keeps its name.
- a published surface — `README.md` § Tests and § This repo's own workflows.
- the operator — its copies of these tests are deleted by phase B's last PR there, which names this one; until then both run.
