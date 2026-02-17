# Cachify Studio V3 Implementation Notes

## Scope Snapshot

This implementation targets `PRD-V3.md` advanced observability and governance requirements while keeping V1/V2 behavior compatible.

## Implemented V3 Areas

## 1. Advanced Observability Panels

- Keyspace activity analytics:
  - top touched pattern ranking
  - temporal distribution buckets
- Failed-operation diagnostic drilldown:
  - retry attempt context
  - related timeline events
  - latest snapshot context where available
- Compare-period analytics:
  - baseline vs compare windows
  - operation count, error rate, latency p95, slow-op deltas
- Incident bundle workflows:
  - preview counts and checksum preview
  - export with redaction profile (`default` / `strict`)
  - persisted bundle history list

## 2. Alert Rule Builder

- Rule manager in renderer:
  - create/update/delete rule lifecycle
  - metric and threshold controls
  - lookback window and severity controls
  - connection/environment scoping
  - enabled/disabled state

## 3. Governance Policy Packs and Scheduling

- Governance policy pack CRUD with:
  - environment allowlists
  - max workflow item limits
  - max retry attempt caps
  - scheduling windows (`UTC`) and enable/disable controls
- Connection assignment flow for policy packs.
- Runtime governance enforcement:
  - blocks disallowed environment execution
  - blocks execution outside approved windows
  - applies policy-bound retry/item caps

## 4. Checkpoint/Resume Automation

- Workflow executions persist checkpoint markers and governance metadata.
- Resume flow continues from the saved checkpoint token.
- Renderer workflow history exposes checkpoint-aware resume action.

## 5. Retention and Storage Controls

- Retention policy controls by dataset:
  - timeline events
  - observability snapshots
  - workflow history
  - incident artifacts
- Storage summary with over-budget visibility.
- Manual purge controls with dry-run support and result feedback.
- Runtime retention enforcement:
  - budget warning alerts
  - auto-purge for over-budget datasets with `autoPurgeOldest` enabled

## Persistence and Migration Notes

- V3 tables/entities:
  - `alert_rules`
  - `governance_policy_packs`
  - `governance_assignments`
  - `incident_bundles`
  - `retention_policies`
- V3 workflow execution fields:
  - `checkpoint_token`
  - `policy_pack_id`
  - `schedule_window_id`
  - `resumed_from_execution_id`

## Validation

Run:

```bash
bun run typecheck
bun run lint
bun run test:all
```

## Known Tradeoffs

- Incident export currently executes in-process and reports completion state, without resumable chunk progress UI.
- Compare-period data is returned as full computed deltas rather than renderer-side streaming visualizations.
