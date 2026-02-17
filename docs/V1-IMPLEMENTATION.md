# Cachify Studio V1 Implementation Notes

## Scope Snapshot

This implementation targets the V1 MVP definition in `PRD-V1.md` and the architecture/layout rules in `PRD.md`.

## Restructure Checkpoints (FR-V1-009)

1. Migrated process entry points to canonical structure:
   - `src/main/index.ts`
   - `src/preload/index.ts`
   - `src/renderer/index.tsx`
2. Migrated renderer ownership paths:
   - `src/renderer/app/*`
   - `src/renderer/components/ui/*`
   - `src/renderer/hooks/*`
   - `src/renderer/lib/*`
   - `src/renderer/styles/*`
3. Added shared contract/schema boundaries:
   - `src/shared/contracts/*`
   - `src/shared/ipc/*`
   - `src/shared/schemas/*`
4. Updated project/tooling config for moved paths:
   - `forge.config.ts` build entries
   - `index.html` renderer entry script
   - `tsconfig.json` path mappings
   - `vite.renderer.config.ts` aliases
   - `components.json` CSS and alias paths

## Dependency Readiness (FR-V1-010)

Installed and lockfile-pinned runtime/tooling dependencies needed for V1 delivery and V2/V3-ready foundations:

- Runtime foundations: `redis`, `memjs`, `better-sqlite3`, `keytar`, `zod`, `uuid`, `react-router-dom`
- Testing/type tooling: `vitest`, `@vitest/coverage-v8`, `jsdom`, `@types/*`, `typescript@5.x`

## Implemented V1 Features

- Connection management:
  - create/edit/delete profiles
  - connection test workflow in editor dialog
  - multiple saved profiles via SQLite persistence
- Core cache operations:
  - list/search keys
  - get value detail
  - set/update key value
  - delete single key
- Safety controls:
  - confirmation dialog for destructive delete actions
  - per-connection read-only mode blocks writes/deletes in UI and main process policy
- Visual foundation:
  - light/dark/system theme support
  - onboarding when no profiles exist
  - settings dialog

## V1 Hardening Updates

- Workspace query UX:
  - inline error states for capabilities, key list, and key detail queries
  - retry actions for retryable query failures
  - one-shot query error toasts keyed by query error update timestamp
- Retryable error semantics:
  - renderer-side operation errors now preserve `retryable` metadata from IPC responses
  - retry controls are conditionally shown based on retryability
- Cursor-based search pagination:
  - `key.search` now accepts optional `cursor`
  - Redis search returns continuation cursor when more scan pages remain
  - Memcached indexed search supports cursor filtering and continuation cursor output
  - renderer now supports loading next page for search results (not only list mode)
- Connection create safety:
  - create flow now performs compensating rollback of profile metadata if secret storage fails
  - safe error payload reports rollback metadata without exposing credentials
- Edit-mode connection test:
  - optional `connectionId` in `connection.test` enables stored-secret fallback
  - blank credential fields in edit mode now test with stored keychain secret by default

## Storage and Security

- Metadata persistence: local SQLite database in app user data directory.
- Secrets: keychain-backed storage through `keytar` (`CACHIFY_SECRET_STORE=memory` fallback for controlled contexts).
- IPC: typed command/query envelopes with runtime schema validation and structured operation errors.

## Testing

- Unit/contract coverage added for:
  - read-only policy behavior
  - service-level mutation blocking
  - IPC schema envelope validation
  - create rollback behavior when secret persistence fails
  - edit-mode connection test secret fallback/overlay behavior
  - renderer IPC error unwrap preserving `retryable` metadata
  - provider search pagination continuation behavior for Redis and Memcached

Run:

```bash
bun run typecheck
bun run lint
bun run test
```

## Known MVP Tradeoffs

- Memcached key discovery is based on app-indexed keys (keys observed through app operations).
- Advanced V2/V3 capabilities (guardrails on prod tags, rollback, workflows, observability dashboards, governance) remain deferred by design.
