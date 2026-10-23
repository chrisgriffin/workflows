# Changelog

Every release of the fleet's shared workflows. Each entry is generated from
the conventional-commit history by the release PR; a caller pinned to the
floating `v1` tag receives every entry under that major on merge.

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
