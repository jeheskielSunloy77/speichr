# Cachify Studio - PRD V2 (Operations and Safe Automation)

## Delta from previous version.
Builds on V1 by adding production safety guardrails, rollback support, policy-driven execution, safe automation templates, and core observability.

## Document Metadata
- Product: Cachify Studio
- Document type: Version PRD (V2)
- Version: 1.0
- Status: Draft
- Last updated: 2026-02-17

## Scope Additions (V2)
1. Environment guardrails:
   - Stricter confirmations for connections tagged `prod`
   - Additional friction for wildcard destructive actions
2. Rollback helper:
   - Restore recent key-level snapshots for supported operations
3. Connection policies:
   - Force read-only mode on selected profiles
4. Per-profile timeout and retry:
   - Configurable operation timeout
   - Configurable retry behavior by profile
5. Saved workflow templates with dry-run:
   - delete by pattern
   - TTL normalize
   - warmup set
6. Workflow history:
   - Execution timeline
   - Rerun and rerun-with-edits
7. Workflow-step retry policy:
   - Backoff strategy
   - Max attempts
   - Abort conditions
8. Observability core:
   - Connection health dashboard
   - Operation trend charts
   - Error heatmap by connection/environment
   - Unified event timeline (app audit + engine events)
   - Slow operation panel
9. Alerts:
   - In-app notifications
   - Desktop notifications

## Data, UX, and API Deltas from V1

### Data Deltas
1. `ConnectionProfile` adds explicit environment and policy fields usage.
2. New local entities:
   - `SnapshotRecord`
   - `WorkflowExecutionRecord`
   - `AlertRule` (baseline threshold form)
3. Timeline retention starts with default 30 days configurable policy.

### UX Deltas
1. New screens:
   - Observability Dashboard
   - Workflow Templates
   - Workflow Execution History
   - Rollback helper dialog
2. New interaction patterns:
   - Dry-run preview before workflow execution
   - Guardrail confirmation flow for `prod`
   - Policy indicators (read-only forced, timeout/retry profile)

### API Deltas
1. `CacheProvider` usage expands with stats and event subscription where supported.
2. `WorkflowTemplate` and `WorkflowExecutionPolicy` become active contracts.
3. `HistoryEvent` becomes required for timeline-backed features.
4. `ObservabilitySnapshot` becomes required for dashboard views.

## Migration and Compatibility Notes from V1
1. V1 connection profiles remain valid and auto-upgrade with default policy values:
   - `environment`: `dev` if unset
   - `timeoutMs`: sane default
   - retry policy: disabled unless configured
2. Existing read-only flag behavior remains backward compatible.
3. Engines lacking a feature must degrade gracefully with capability messaging.
4. V1 core operation UX remains intact; new flows are additive.

## Functional Requirements (V2 Additions)
1. FR-V2-001: `prod` tagged connections require enhanced destructive confirmations.
2. FR-V2-002: Snapshot-backed rollback supports recent key-level restore.
3. FR-V2-003: Forced read-only policy blocks writes/deletes and workflow mutations.
4. FR-V2-004: Timeout/retry policies apply consistently to direct operations and workflows.
5. FR-V2-005: Template workflows must support dry-run previews before execute.
6. FR-V2-006: Workflow history supports rerun and rerun-with-edits.
7. FR-V2-007: Step-level retry logic honors backoff, max attempts, and abort rules.
8. FR-V2-008: Dashboard surfaces health, trends, heatmap, timeline, and slow-op data.
9. FR-V2-009: Alert notifications must trigger in-app and via desktop channel.

## V2 Acceptance Test Scenarios and Release Gates

### Happy Path Scenarios
1. User runs a template workflow in dry-run, reviews preview, then executes successfully.
2. User reruns a prior workflow with edited parameters and receives expected results.
3. Dashboard updates connection health and operation trends in near real time.

### Failure/Recovery Scenarios
1. Workflow step failure triggers configured retry and abort behavior.
2. Timeout policy correctly cancels long-running operation and records failure event.
3. Rollback helper restores previous key value after failed bulk mutation.

### Safety/Regression Scenarios
1. `prod` guardrail confirmation appears for all destructive paths.
2. Forced read-only policies override manual action attempts.
3. V1 operation paths behave unchanged when V2 features are disabled.

### Performance Threshold Scenarios
1. Timeline and dashboard load under target for default retention window.
2. Dry-run preview handles high key counts with paged presentation.

### Security/Privacy Scenarios
1. Snapshot and timeline records follow redaction policy.
2. Notifications do not expose sensitive value payloads.

### Compatibility Scenarios
1. Upgraded V1 profiles load without manual migration steps.
2. Redis and Memcached both execute supported template workflows with capability-aware UI messaging.

### V2 Release Gates
1. All V2 scenarios pass with no critical safety regressions.
2. Guardrails and read-only policy enforcement validated in all destructive entry points.
3. Rollback helper validated for supported operations.
4. Dashboard and alert channels validated across supported desktop platforms.

## References to Master PRD
1. Shared product context and governance: `PRD.md`
2. Canonical feature catalog and release dependencies: `PRD.md`
3. Canonical interface/type contracts: `PRD.md`
4. Global NFRs, risk model, and metrics: `PRD.md`

## Change Log
| Date | Version | Author | Change |
|---|---|---|---|
| 2026-02-17 | 1.0 | Codex | Created V2 PRD with ops safety features, safe automation, core observability, and release gates. |
