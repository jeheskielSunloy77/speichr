# Cachify Studio - PRD V1 (MVP)

## Delta from previous version.
Initial release definition. No prior product version exists.

## Document Metadata
- Product: Cachify Studio
- Document type: Version PRD (V1)
- Version: 1.1
- Status: Draft
- Last updated: 2026-02-17

## Scope (V1 MVP)
1. Connection management for Redis and Memcached:
   - Create, edit, delete, test connection
   - Save multiple connection profiles
2. Core cache operations:
   - Read key/item value
   - Write/update key/item value
   - Search keys/items by pattern
   - Delete single key/item
3. Safety controls:
   - Confirmation dialog before destructive actions
   - Per-connection read-only mode
4. Visual foundation:
   - Modern, simple UI
   - Dark and light mode support

## Detailed User Flows and UI Screens

### Screen Inventory (V1)
1. Welcome / Onboarding
2. Connections Manager
3. Connection Editor
4. Main Workspace (key list/search/actions)
5. Key/Item Detail Editor
6. Confirmation Dialogs
7. Settings (theme + local preferences)

### User Flow 1: First Connection
1. User opens onboarding screen.
2. User chooses Redis or Memcached.
3. User enters host/port/auth, then clicks "Test Connection."
4. App shows success/failure state.
5. On success, profile is saved and shown in Connections Manager.

### User Flow 2: Read and Inspect
1. User selects a connection in sidebar.
2. App loads paginated key/item list.
3. User clicks a key/item.
4. Detail panel shows value, metadata, TTL info (where supported).

### User Flow 3: Edit Value
1. User opens key/item detail.
2. User edits value and optional TTL.
3. User submits change.
4. App confirms success and refreshes detail.

### User Flow 4: Search
1. User enters pattern query.
2. App returns matching keys/items with pagination.
3. User opens a result to inspect or edit.

### User Flow 5: Delete
1. User triggers delete from list or detail.
2. Confirmation dialog appears.
3. User confirms.
4. Item is deleted and list refreshes.

## Functional Requirements and Edge Cases

### Functional Requirements
1. FR-V1-001: App must store and list multiple connection profiles.
2. FR-V1-002: Credentials must be resolved through OS keychain references.
3. FR-V1-003: App must read and display key/item values.
4. FR-V1-004: App must write/update key/item values.
5. FR-V1-005: App must search keys/items by pattern.
6. FR-V1-006: App must delete single keys/items with confirmation.
7. FR-V1-007: Read-only connections must block write and delete actions.
8. FR-V1-008: App must support dark and light theme switching.
9. FR-V1-009: V1 delivery must include the repository restructuring process toward the canonical `Project Structure Shape` defined in `PRD.md`, with explicit migration checkpoints documented and validated.
10. FR-V1-010: V1 delivery must install and lock all required dependencies for V1, V2, and V3 planned capabilities so the project is dependency-ready for phased implementation.

### Edge Cases
1. Invalid host, TLS, or auth credentials.
2. Connection timeout or dropped session mid-operation.
3. Large keyspaces requiring iterative browsing.
4. Unsupported metadata fields for specific engine/value type.
5. Attempted write/delete on read-only profile.

## API / Interface Behavior in V1 (Subset of Master Contracts)
| Interface | V1 Behavior |
|---|---|
| `ConnectionProfile` | Core fields required; `timeoutMs` defaulted if omitted |
| `SecretStore` | Required for saving and retrieving credentials |
| `CacheProvider.connect/disconnect/ping` | Required |
| `CacheProvider.listKeys/searchKeys` | Required |
| `CacheProvider.getValue/setValue/deleteKey` | Required |
| `HistoryEvent` | Optional minimal app-side entries allowed in V1 |
| `WorkflowTemplate`, `IncidentBundle` | Not in V1 scope |

## Error Handling, Retries, and Constraints
1. Connection and operation errors must be presented with actionable messages.
2. Retry policy is basic in V1:
   - Connection test: up to 1 automatic retry.
   - Runtime operations: no hidden retry loop on destructive actions.
3. UI must not freeze during long list/search operations.
4. Write and delete actions remain blocked for read-only profiles.

## V1 Acceptance Test Scenarios and Exit Criteria

### Happy Path Scenarios
1. Create Redis connection and successfully browse keys.
2. Create Memcached connection and successfully read/write/delete item.
3. Search returns expected keys/items and opens detail panel.

### Failure/Recovery Scenarios
1. Invalid credentials produce clear error with no crash.
2. Network interruption during read returns retryable state.
3. Connection test timeout is handled and reported.

### Safety/Regression Scenarios
1. Delete always requires confirmation.
2. Read-only mode blocks write/delete across all entry points.
3. Existing saved profiles remain usable across app restart.

### Performance Threshold Scenarios
1. Key list renders first page within target latency.
2. Search operations return visible results without blocking renderer.

### Security/Privacy Scenarios
1. Raw credentials are not present in metadata store.
2. Error logs redact secret-like fields.

### Compatibility Scenarios
1. Redis and Memcached both pass baseline connect/read/search/write/delete flows.

### Delivery/Scaffold Scenarios
1. Restructuring process checkpoints are documented and validated against the target `Project Structure Shape` in `PRD.md`.
2. Dependency installation completes successfully for all V1, V2, and V3 planned capabilities with no unresolved required packages.

### V1 Exit Criteria
1. All required V1 tests pass.
2. No P1/P2 security defects for credential handling.
3. No critical crashes in core operation paths.
4. Documentation links to master PRD sections are complete.
5. Repository restructuring process for V1 is documented and accepted against `PRD.md` target structure checkpoints.
6. Required dependencies for V1, V2, and V3 are installed and locked in project manifests/lockfile.

## Out of Scope for V1 (Deferred)
1. Environment guardrails on `prod` tags.
2. Rollback helper and snapshot restore workflows.
3. Workflow templates and execution history.
4. Advanced retry/backoff policies.
5. Observability dashboards, heatmaps, and alerts.
6. Incident bundle preview/export.

## References to Master PRD
1. Shared goals/non-goals: `PRD.md`
2. Security/privacy baseline: `PRD.md`
3. Canonical interfaces and data model: `PRD.md`
4. Global NFRs and risk framework: `PRD.md`
5. Document governance rules: `PRD.md`

## Change Log
| Date | Version | Author | Change |
|---|---|---|---|
| 2026-02-17 | 1.1 | Codex | Added restructuring-process and cross-version dependency-installation requirements plus matching V1 success/exit criteria. |
| 2026-02-17 | 1.0 | Codex | Created V1 PRD with MVP scope, flows, API subset, tests, and deferrals. |
