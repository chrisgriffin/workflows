# Changelog

Every release of the fleet's shared workflows. Each entry is generated from
the conventional-commit history by the release PR; a caller pinned to the
floating `v1` tag receives every entry under that major on merge.

## [1.7.1](https://github.com/chrisgriffin/workflows/compare/v1.7.0...v1.7.1) (2026-11-09)

### Bug Fixes

- **release-pr:** warn when the release token cannot read its user ([74889dd](https://github.com/chrisgriffin/workflows/commit/74889dd44206fd699f6b1b035deb9379deb11554))
- **release-pr:** write the release commit as the token's account ([e674aa9](https://github.com/chrisgriffin/workflows/commit/e674aa9ac43cfd89a02c0fa330fc00c033b86d19)), closes [#60](https://github.com/chrisgriffin/workflows/issues/60)

## [1.7.0](https://github.com/chrisgriffin/workflows/compare/v1.6.1...v1.7.0) (2026-11-06)

### Features

- **release:** publish with the caller's NPM_TOKEN, falling back to GITHUB_TOKEN ([c9abae7](https://github.com/chrisgriffin/workflows/commit/c9abae7367e3387d2aa43237a96050193bc0bba4))

### Bug Fixes

- **ci:** a draft PR runs no Evaluator gate and no build / ci ([034fb07](https://github.com/chrisgriffin/workflows/commit/034fb07275961ca040189a4fa902b8bbc5a27ded)), closes [#48](https://github.com/chrisgriffin/workflows/issues/48)
- **ci:** let converted_to_draft through the draft skip ([f8bb8c4](https://github.com/chrisgriffin/workflows/commit/f8bb8c4d803f5a82eade961e712d6b32eb0ca7ac))
- **deps:** override glob and minimatch to their patched majors ([639ae34](https://github.com/chrisgriffin/workflows/commit/639ae34f14bc8a7a3f63d2fd2b093d080fdc9960))
- **evaluator-gate:** run one gate per PR at a time ([8746aa1](https://github.com/chrisgriffin/workflows/commit/8746aa19d7e3c89c106b65ff954d8a60c96eacbf))
- **release:** send NPM_TOKEN to the build step's installs too ([636d407](https://github.com/chrisgriffin/workflows/commit/636d407b6ee667208ddb374d3c5c3f0affc21c72))

### Documentation

- **evaluator-gate:** say what a superseded waiting run loses ([6cb0dca](https://github.com/chrisgriffin/workflows/commit/6cb0dca31492cb262ce9f0c6b090be085c44502d))
- **release:** correct the workflow comments that read narrower than the id-token grant ([bb2b799](https://github.com/chrisgriffin/workflows/commit/bb2b7991c258708452f328818367976609c2ec7f))
- **release:** say the Open VSX id-token grant reaches every step of the release run ([174e5ed](https://github.com/chrisgriffin/workflows/commit/174e5edb16229a1743a2119b9ddb36e3be5129ea))
- **spec:** Dependabot's minimatch security update fails on develop ([62825bc](https://github.com/chrisgriffin/workflows/commit/62825bc6a08d81474a2fa72e248b92d9f2bf6bc2))
- **spec:** narrow the minimatch cause to parents of affected copies ([5461cc4](https://github.com/chrisgriffin/workflows/commit/5461cc4f9e6c3108ce7d5bd4e1b0d2e66dd35ccb))
- **spec:** README says the Open VSX id-token grant reaches every step of the release run ([521bc37](https://github.com/chrisgriffin/workflows/commit/521bc37a3edb4aedc8f7361f2938a4e1bc1e5a26))
- **specs:** 48-draft-skip spec, plan and tasks ([eae1f57](https://github.com/chrisgriffin/workflows/commit/eae1f57616bc3d59aa7e118476aa2b966d8c3322))
- **spec:** the shared release workflow publishes to npmjs when a caller passes an NPM_TOKEN secret ([cecf4a0](https://github.com/chrisgriffin/workflows/commit/cecf4a093619ae9fb09a8fb5e91e2624a2ed950c))

## [1.6.1](https://github.com/chrisgriffin/workflows/compare/v1.6.0...v1.6.1) (2026-11-04)

### Bug Fixes

- **create-github-release:** read a publish back from the registry ([653784e](https://github.com/chrisgriffin/workflows/commit/653784e426ecb8b4883b201a6fa30f0a63b5be98))
- **create-github-release:** read one extension identity once per registry ([c07a9b7](https://github.com/chrisgriffin/workflows/commit/c07a9b7b93ab7ea0e730fc1077faf259d4941763))
- **node-ci:** carry the new releasing template hash in the docs manifest ([924e358](https://github.com/chrisgriffin/workflows/commit/924e358854f2e072a39021915bad9c1c5f0f7777))

### Documentation

- **spec:** the docs manifest carries the new releasing template hash ([9402d15](https://github.com/chrisgriffin/workflows/commit/9402d1570290e9b57b3a5d658ac227867964e9f7))
- **spec:** the merge order puts this PR and a v1 release first ([d8d0840](https://github.com/chrisgriffin/workflows/commit/d8d08400f2dd793ee3b6e91628cc410ae531b429))
- **spec:** the release job reads a publish back from the registry ([fe96e88](https://github.com/chrisgriffin/workflows/commit/fe96e885bb01686099781eb4c2164d2abca085ff))

## [1.6.0](https://github.com/chrisgriffin/workflows/compare/v1.5.0...v1.6.0) (2026-10-29)

### Features

- **evaluator-gate:** hand the gate a user token so it can resolve a review thread ([4eb6f6d](https://github.com/chrisgriffin/workflows/commit/4eb6f6dbb5285a8b51eb656116de136ef34dee47)), closes [#39](https://github.com/chrisgriffin/workflows/issues/39)

### Bug Fixes

- **evaluator-gate:** never hand the gate RELEASE_PR_TOKEN, and read the script with TARGET_TOKEN only in ops ([fc0656c](https://github.com/chrisgriffin/workflows/commit/fc0656cc8019e81848b086430237c1520459b5f9))
- **evaluator-gate:** say which writes use the user token and pin both secrets exactly ([51edd5a](https://github.com/chrisgriffin/workflows/commit/51edd5a0e0a053a88bdbb622555f60b8acc05e89))

### Documentation

- **evaluator-gate:** one path for a by-name target's user token, under the TARGET_TOKEN key ([67c7d0a](https://github.com/chrisgriffin/workflows/commit/67c7d0aba2c19fd1775b6eb0fe351389a523a2ab))
- **evaluator-gate:** TARGET_TOKEN is also where a named-secrets target passes its user token ([2814d4b](https://github.com/chrisgriffin/workflows/commit/2814d4ba64498725dc87b5af7447098b6ede024c))
- **spec:** fixed-string grep for the runnable line ([3b24e4c](https://github.com/chrisgriffin/workflows/commit/3b24e4c437e7d06bf89c5686c7d0b1c3169ec5c8))

## [1.5.0](https://github.com/chrisgriffin/workflows/compare/v1.4.0...v1.5.0) (2026-10-26)

### Features

- **release-pr:** a version_files input keeps manifests on the package version ([6769d43](https://github.com/chrisgriffin/workflows/commit/6769d4351a1d90bf04fd8eeaf4218d95ebe9e936)), closes [#34](https://github.com/chrisgriffin/workflows/issues/34)

### Bug Fixes

- **release-pr:** format CHANGELOG.md with a caller's packaged Prettier config ([d25b0b0](https://github.com/chrisgriffin/workflows/commit/d25b0b0544d12d285cca9d2ff1ff0240f7ae4ed0)), closes [#36](https://github.com/chrisgriffin/workflows/issues/36)

### Documentation

- **release-pr:** list version_files among the README's inputs ([b287e18](https://github.com/chrisgriffin/workflows/commit/b287e182ea6804c6710a3a695a6339ba215f95b3))

### Build System

- adopt the shared Prettier and ESLint configs ([e106d0f](https://github.com/chrisgriffin/workflows/commit/e106d0f059da82b53a4adf7ec901506849aa97c6))

## [1.4.0](https://github.com/chrisgriffin/workflows/compare/v1.3.0...v1.4.0) (2026-10-24)

### Features

- **release:** publish to Open VSX with trusted publishing ([f03c08f](https://github.com/chrisgriffin/workflows/commit/f03c08f0fb8237cc4c2c72dd05ab028d9fb44f08)), closes [#22](https://github.com/chrisgriffin/workflows/issues/22)

### Bug Fixes

- **release-pr:** start CHANGELOG.md on a repo's first release ([63f23d0](https://github.com/chrisgriffin/workflows/commit/63f23d06d9d741120fddc3af1e8a1b2020e69670)), closes [#27](https://github.com/chrisgriffin/workflows/issues/27)

### Documentation

- **readme:** name both ways the publish job reaches Open VSX ([755fb38](https://github.com/chrisgriffin/workflows/commit/755fb38e779e998f98ae1b7fea83b226edab0d4a))
- **spec:** mark the config re-run as the after-merge task ([5e58de2](https://github.com/chrisgriffin/workflows/commit/5e58de231eb2f4f068baf8e4faa729ddb28b4b2e))

## [1.3.0](https://github.com/chrisgriffin/workflows/compare/v1.2.0...v1.3.0) (2026-10-23)

### Features

- **release-pr:** let the caller's RELEASE_AS variable force the next version ([c7ef457](https://github.com/chrisgriffin/workflows/commit/c7ef457adf835ffe7d17e72d9392687237278731)), closes [#13](https://github.com/chrisgriffin/workflows/issues/13)

## [1.2.0](https://github.com/chrisgriffin/workflows/compare/v1.1.0...v1.2.0) (2026-10-22)

### Features

- **ci:** publish VS Code extensions to Open VSX on release ([a481b9d](https://github.com/chrisgriffin/workflows/commit/a481b9dc433da8089136638e6665702b964e5ce1)), closes [#18](https://github.com/chrisgriffin/workflows/issues/18)

### Bug Fixes

- **ci:** authenticate the release PR's fetches on a private caller ([15bdb37](https://github.com/chrisgriffin/workflows/commit/15bdb37f6f8918663104023da04f648369939e14))
- **ci:** let a re-run retry a failed Marketplace publish ([df0115c](https://github.com/chrisgriffin/workflows/commit/df0115c3be414e677fb9d29e5248f53035f8d2f1)), closes [#16](https://github.com/chrisgriffin/workflows/issues/16)

## 1.1.0 (2026-10-21)

### Features

- **ci:** host the fleet's reusable workflows and actions here ([4d3d4a9](https://github.com/chrisgriffin/workflows/commit/4d3d4a9eb19c696333b959680494f544e728c099))
- **ci:** release these workflows by version, with a floating v1 tag ([d0a80bc](https://github.com/chrisgriffin/workflows/commit/d0a80bce979942af781b377078126c3d5d39dfef))
- **ci:** run the fleet's own stubs on this repo ([681d821](https://github.com/chrisgriffin/workflows/commit/681d82118d5317a0a6f1d6e010e65504fa83b418))

### Bug Fixes

- **ci:** harden the release and publish paths for public callers ([9066e94](https://github.com/chrisgriffin/workflows/commit/9066e946c8dc50d698467e9ee02986b32cf32825))
- **ci:** keep inherit on this repo's own Evaluator stub until the declarations land ([cfe0a84](https://github.com/chrisgriffin/workflows/commit/cfe0a8467932e76ca36841060e5276065db0ba77))
- **ci:** name the CI job `build / ci` so the ruleset's required check exists ([aea39ad](https://github.com/chrisgriffin/workflows/commit/aea39ad6ee1c8520bea6fc4dc2b0db5bbbfebc29))
- **ci:** name the lint job ci so the check reports as build / ci ([eb2f85e](https://github.com/chrisgriffin/workflows/commit/eb2f85e9cc9d02b5c52101c5f01824b742a7d1e0))

### Documentation

- README names the operator drift check by its PR ([f88b46a](https://github.com/chrisgriffin/workflows/commit/f88b46a13b9ac299377c4b80de63cbe75c7091b6))
- README says the operator drift check lands with ops[#1690](https://github.com/chrisgriffin/workflows/issues/1690) ([e0be5b0](https://github.com/chrisgriffin/workflows/commit/e0be5b0b8ba282dc527a258651ccd3a5e6efc210))
- README stops naming a drift check that does not exist ([a60e56e](https://github.com/chrisgriffin/workflows/commit/a60e56e145f2b39742fc7832198ea0e44b2a17d9))
- **spec:** tick the paperwork tasks for 002 ([533ebf8](https://github.com/chrisgriffin/workflows/commit/533ebf81bec593dfa701f3462ffabac6871a5867))
- **spec:** tick the paperwork tasks for 003 ([2b508d5](https://github.com/chrisgriffin/workflows/commit/2b508d503d1b956fe380191e22a9549f02aa9413))
