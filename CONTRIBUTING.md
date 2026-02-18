# Contributing

## Setup

```bash
bun install
```

## Run Locally

```bash
bun run start
```

## Quality Gates

Before opening a PR, run:

```bash
bun run typecheck
bun run lint
bun run check:boundaries
bun run check:migrations
bun run check:release:readiness
bun run test:all
```

## Pull Requests

- Keep PRs focused and scoped.
- Include tests for behavior changes.
- Update `CHANGELOG.md` for user-visible changes.

## Release Notes

Releases are tag-driven (`v*.*.*`) and produced by GitHub Actions as draft releases with attached artifacts and checksums.
