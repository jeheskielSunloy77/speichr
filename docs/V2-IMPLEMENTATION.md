# Cachify Studio V2 Implementation Notes

## Scope Snapshot

This implementation targets the V2 requirements in `PRD-V2.md` while preserving V1 behavior defined in `PRD-V1.md`.

## Implemented V2 Areas

## 1. Guardrails and Policy Enforcement

- Production guardrails:
  - Destructive key delete and rollback restore actions require explicit confirmation for `prod` connections.
  - Workflow execution on `prod` enforces guardrail confirmation when template policy requires approval.
- Connection policy enforcement:
  - Added support for `forceReadOnly` policy at profile level.
  - Main-process mutation paths enforce read-only and force-read-only policy checks.

## 2. Timeout and Retry Policies

- Per-profile retry settings are now persisted and enforced:
  - `retryMaxAttempts`
  - `retryBackoffMs`
  - `retryBackoffStrategy` (`fixed` or `exponential`)
  - `retryAbortOnErrorRate`
- Timeout policy is applied through operation-level timeout wrappers.
- Workflow steps support retry policy overrides, including abort by observed error rate.

## 3. Rollback Helper and Snapshots

- Added key-level snapshot repository and persistence table.
- Mutations capture latest pre-change snapshot where possible.
- Rollback helper restores from latest or explicit snapshot ID.
- Renderer includes rollback dialog with snapshot list and restore actions.

## 4. Workflow Templates and Execution History

- Added workflow template model and persistence:
  - create/update/delete custom templates
  - built-in templates for `deleteByPattern`, `ttlNormalize`, `warmupSet`
- Added dry-run preview API and renderer UX.
- Added execution engine with step result tracking.
- Added execution history with `rerun` and `rerun-with-edits` support.

## 5. Observability Core

- Added timeline/history event persistence.
- Added operation telemetry sampling and observability snapshot persistence.
- Added dashboard query model returning:
  - connection health summary
  - operation trend buckets
  - error heatmap
  - unified timeline
  - slow operation feed
- Added renderer dashboard panel with tables/cards for all required core views.

## 6. Alerts (In-App + Desktop)

- Added alert repository and query/mark-read flows.
- Added alert emission from policy/observability/workflow events.
- Added desktop notification publisher integration.
- Added renderer alert center UI with unread filtering and mark-as-read.

## Persistence and Migration Notes

- `connection_profiles` now includes V2 policy/retry columns with compatibility-safe migration behavior.
- New V2 tables:
  - `key_snapshots`
  - `workflow_templates`
  - `workflow_executions`
  - `history_events`
  - `observability_snapshots`
  - `alert_events`
- Existing V1 data remains valid; V2 columns use defaults for upgraded profiles.

## Renderer UX Additions

- Main workspace now includes V2 tabs:
  - `Workspace`
  - `Workflows`
  - `Observability`
  - `Alerts`
- Connection editor now exposes V2 policy/retry controls.

## Testing

- Extended service and policy tests for V2 behavior:
  - force read-only blocking
  - production guardrail enforcement
  - rollback flow
  - workflow dry-run history
  - policy alert generation
- Added SQLite repository test suite for V2 entities.
  - Suite auto-skips when `better-sqlite3` native bindings are ABI-incompatible in the active runtime.

Run:

```bash
bun run typecheck
bun run lint
bun run test
```

## Known V2 Tradeoffs

- Dashboard rendering is table/card-based; charts are represented through aggregated trend datasets rather than graphical plotting.
- Desktop notification behavior depends on OS support and runtime environment.
- SQLite persistence tests are skipped automatically when native module ABI mismatch is detected.
