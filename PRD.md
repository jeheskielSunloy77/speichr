# Cachify Studio - Master Product Requirements Document

## Document Metadata

- Product: Cachify Studio
- Document type: Master PRD
- Version: 1.5
- Status: Draft
- Last updated: 2026-02-17
- Owners: Product + Engineering

## Product Overview

Cachify Studio is a local-first desktop application to manage Redis and Memcached caches from one interface. The app targets Linux, macOS, and Windows using Electron and provides practical cache operations for developers and DevOps without requiring a centralized backend service.

## Problem Statement

Redis and Memcached workflows are often split across CLI tools, scripts, and one-off dashboards. This creates slow troubleshooting loops, inconsistent safety controls, and weak traceability for cache changes. Cachify Studio provides a single operational surface with secure local connection storage, key operations, history, and observability.

## Goals

1. Provide a unified Redis + Memcached desktop manager for everyday cache operations.
2. Enable safe and fast read, write, search, and delete workflows.
3. Support multiple saved connections with secure local credential handling.
4. Provide progressive operational visibility and automation in later versions.
5. Keep architecture local-first with no mandatory cloud dependencies.

## Non-Goals

1. No centralized backend API or hosted control plane.
2. No multi-user real-time collaboration service.
3. No managed cloud cache proxy.
4. No automatic production tuning engine in MVP.

## Target Users and Personas

1. Backend developers: inspect and modify cache data during feature delivery.
2. DevOps/SRE: troubleshoot incidents, validate cache health, run guarded bulk actions.
3. QA and support engineers: verify key states and reproduce edge cases safely.

## Platform and Architecture Constraints

1. Desktop shell: Electron.
2. UI stack: React + TypeScript + Vite + shadcn/ui + Tailwind CSS. for the shadcn/ui refer to the components.json which is the config file for the shadcn/ui components, if you want to tweek the design or move the directory to better suit the project structure you can do that but make sure to update the components.json file with the correct path to the components.
3. JavaScript runtime and package manager: Bun.
4. Test runner standard: Vitest (kept as canonical test runner while adopting Bun runtime tooling).
5. Storage model: local-only metadata persistence; no centralized backend.
6. Cache engines: Redis and Memcached are first-class targets in all versions.
7. Packaging: Linux, macOS, and Windows.

## Project Structure Shape

### Canonical Target Structure (Normative)

```text
.
├── PRD.md
├── PRD-V1.md
├── PRD-V2.md
├── PRD-V3.md
├── components.json
├── package.json
├── forge.config.ts
├── vite.main.config.ts
├── vite.preload.config.ts
├── vite.renderer.config.ts
└── src/
    ├── main/
    │   ├── domain/               # Entities, value objects, domain policies/events
    │   ├── application/          # Use-cases, repository/provider interfaces
    │   ├── interface-adapters/   # IPC handlers, DTO mappers, presenters for IPC
    │   ├── infrastructure/       # SQLite/keychain/cache adapters, scheduler, notifications
    │   ├── policies/             # Environment and guardrail policy enforcement
    │   ├── persistence/          # Migration runner, schema, repository implementations
    │   └── index.ts              # Electron main bootstrap/composition root
    ├── preload/
    │   ├── bridge/               # Typed IPC bridge surface only
    │   ├── schemas/              # Runtime schema validation for IPC payloads
    │   └── index.ts
    ├── renderer/
    │   ├── app/                  # App shell/routes/composition
    │   ├── features/             # Feature modules (connections, keys, workflows, etc.)
    │   ├── state/                # React Query + Zustand stores/selectors
    │   ├── presenters/           # DTO to view-model mapping
    │   ├── components/           # Renderer-specific shared UI composition
    │   ├── pages/                # Screen-level containers
    │   └── index.tsx
    └── shared/
        ├── contracts/            # Cross-process contracts and DTO types
        ├── ipc/                  # IPC envelope definitions and channel maps
        └── schemas/              # Shared validation schemas and codecs
```

Ownership notes:
1. `src/main/**` owns domain/application/infrastructure execution and policy enforcement in the main process.
2. `src/preload/**` is limited to typed IPC bridge code and payload validation support.
3. `src/renderer/**` owns React UI composition, feature screens, and UI/query/session state.
4. `src/shared/**` contains only cross-process contracts and schema artifacts; no infrastructure adapters or Electron runtime wiring.

### Current Scaffold Snapshot (2026-02-17)

```text
.
├── PRD.md
├── PRD-V1.md
├── PRD-V2.md
├── PRD-V3.md
├── components.json
├── package.json
├── forge.config.ts
├── vite.main.config.ts
├── vite.preload.config.ts
├── vite.renderer.config.ts
└── src/
    ├── main.ts
    ├── preload.ts
    ├── renderer.tsx
    ├── App.tsx
    ├── index.css
    ├── components/
    │   └── ui/*
    ├── hooks/
    │   └── use-mobile.ts
    └── lib/
        └── utils.ts
```

### Conformance Rules

1. The canonical target structure in this section is normative for future implementation milestones.
2. The current scaffold snapshot is transitional and can be incrementally migrated to the target shape.
3. If shadcn/ui component paths or aliases move, `components.json` must be updated in the same change set.
4. Renderer modules must not directly import infrastructure adapters or main-process runtime code.

## Clean Architecture Blueprint

### Layer Model and Dependency Rule

1. Layers are defined as:
   - Domain: entities, value objects, domain policies, domain events.
   - Application: use-cases, command/query orchestration, repository/provider abstractions.
   - Interface Adapters: IPC handlers, presenters, DTO mappers.
   - Infrastructure: SQLite, keychain, Redis/Memcached adapters, scheduler, desktop notifications.
   - Framework/UI: Electron shell, preload bridge, React UI, shadcn components.
2. Strict dependency rule:
   - Inner layers never import outer layers.
   - Domain imports nothing from Electron, React, SQLite, or cache client libraries.
   - Infrastructure implements interfaces defined by Domain/Application.
3. Versioning rule:
   - New capabilities are additive and introduced through interfaces and capability flags, not direct coupling.

### Runtime Boundaries (Electron)

1. Main process owns:
   - provider/service runtime
   - persistence and migrations
   - keychain access
   - job scheduling and retries
   - policy enforcement (read-only, prod guardrails)
2. Preload process owns typed IPC bridge only.
3. Renderer owns view rendering, local UI state, and query orchestration only.
4. Security defaults are mandatory:
   - `contextIsolation=true`
   - `nodeIntegration=false`
   - strict IPC allowlist and runtime payload validation
5. Renderer must never access raw credentials or direct Node APIs.

### Use-Case and CQRS Style

1. One use-case per action in Application layer.
2. Command use-cases mutate state; query use-cases use dedicated read models.
3. Use-cases cannot execute raw SQL or direct cache client calls.
4. Use-cases return typed DTOs or typed operation errors.

### Repository and Adapter Pattern

1. Repository interfaces are defined in Application layer.
2. SQLite implementations are in Infrastructure layer.
3. Redis/Memcached access is only through provider interfaces.
4. UI and use-cases branch on provider capabilities, not engine-specific conditionals spread across features.

### Capability-Driven Provider Design

1. Providers must expose capability flags at runtime.
2. Required capability contract includes:
   - `supportsTTL`
   - `supportsMonitorStream`
   - `supportsSlowLog`
   - `supportsBulkDeletePreview`
   - `supportsSnapshotRestore`
   - `supportsPatternScan`
3. Unsupported capabilities must degrade gracefully with explicit UI feedback.

### Typed IPC Contract Standard

1. Command envelope fields: `command`, `payload`, `correlationId`.
2. Query envelope fields: `query`, `payload`, `correlationId`.
3. Response envelope fields: `ok`, `data|error`, `correlationId`.
4. Error envelope fields: `code`, `message`, `retryable`, `details`.
5. Every IPC payload is schema-validated at runtime before execution.

### Eventing and Background Execution

1. Use typed in-process event bus for domain/application events.
2. Main-process scheduler handles:
   - retry execution
   - retention cleanup
   - scheduled workflows (V3)
3. Persisted execution state is required for checkpoint/resume compatibility.
4. Renderer-owned long-running background jobs are not allowed.

### Persistence and Migration Policy

1. SQLite is the canonical local metadata store.
2. Migrations are forward-only and numbered.
3. Startup runs migration check and creates backup snapshot before applying migrations.
4. Default retention is 30 days and becomes configurable by data class in V3.
5. Secret material is never stored in SQLite; only keychain references are persisted.

### Renderer State Architecture

1. React Query is the standard for async/query state.
2. Zustand is the standard for UI/session state.
3. Presenters/selectors map application DTOs to view models.
4. UI components cannot directly import infrastructure adapters.

### Enforceability and CI Rules

1. CI platform is locked to GitHub Actions.
2. Required GitHub Actions workflows:
   - `ci-pr.yml` on `pull_request`: typecheck, lint, import-boundary checks, unit tests, IPC contract tests, provider capability tests, migration integrity tests.
   - `ci-main.yml` on `push` to `main`: all PR checks plus integration tests and Electron smoke tests on `ubuntu-latest`, `windows-latest`, and `macos-latest`.
   - `ci-nightly.yml` on schedule: full suite including end-to-end tests.
3. Branch protection requires passing checks from the PR workflow before merge.
4. CLI test policy is two-tiered:
   - Canonical test runner for unit/contract/integration suites is Vitest.
   - Fast gate command (`test`) must run unit + contract tests (not unit-only).
   - Full suite command (`test:all`) must run unit + contract + integration + e2e/smoke tests.
5. Local and CI pipelines must call the same underlying scripts to prevent drift.
6. CI must enforce clean-architecture boundaries, IPC schema contracts, provider capability compliance, and migration integrity.

### Major Feature Ownership Matrix

| Feature Area                      | Primary Layer Owner                                  | Runtime Owner           |
| --------------------------------- | ---------------------------------------------------- | ----------------------- |
| Connection management             | Application + Infrastructure adapters                | Main process            |
| Key read/write/search/delete      | Application use-cases + Provider adapters            | Main process            |
| Read-only/prod guardrails         | Domain policies + Application use-cases              | Main process            |
| Workflow templates and execution  | Application use-cases + repositories                 | Main process            |
| History timeline ingestion        | Application event handlers + read-model repositories | Main process            |
| Observability dashboards          | Query use-cases + read-model repositories            | Main process + Renderer |
| Incident bundle generation/export | Application orchestration + infrastructure exporters | Main process            |
| UI composition and interactions   | Framework/UI + Interface adapters                    | Renderer                |

### Delivery Sequence (Implementation Later)

1. Create layer boundaries and dependency enforcement configuration first.
2. Implement typed IPC envelopes and schema validators.
3. Add repository/provider abstractions and adapter implementations.
4. Implement migration runner and startup backup logic.
5. Implement use-cases and read models for V1 flows.
6. Extend to V2/V3 workflows, observability, and governance incrementally.

### Version PRD Reference Policy

1. `PRD-V1.md`, `PRD-V2.md`, and `PRD-V3.md` must reference this blueprint for architecture rules.
2. Version files define feature deltas only; architecture baseline remains in `PRD.md`.

## AI Agent Implementation Workflow

### Execution Scope Per Version

1. When instructed to implement a specific version (`V1`, `V2`, or `V3`), agents must execute that version as a sequence of milestone-complete changes rather than one start-to-finish monolithic change.
2. The workflow applies equally across all versions and must preserve clean architecture and safety constraints defined in this document.
3. "Small and concise" applies to commit scope and diff size; commit message detail remains mandatory.

### Branch and Push Policy

1. Agents must commit on the current checked-out branch only.
2. Agents must not create new branches for version implementation.
3. Agents must not switch branches during version implementation.
4. Agents must not push commits automatically.
5. Agent runs must end with multiple unpushed commits on the current branch.

### Commit Cadence and Granularity

1. Agents must split work into small, cohesive, milestone-based commits.
2. Each commit must represent a meaningful implementation checkpoint.
3. Bundling multiple unrelated milestones into a single commit is not allowed.
4. A complete version implementation from empty version backlog to done state must not be delivered as one commit.

### Minimum Commit Count

1. Minimum commit count per version implementation run is at least 8 commits.
2. If a version can be completed in fewer milestones, agents must further split work into coherent, reviewable slices while preserving logical grouping.

### Conventional Commit Message Standard

1. Every commit message must use the Conventional Commit format.
2. Subject line must stay concise and use this shape: `type(scope): concise summary`.
3. Commit body must be detailed and include:
   - what changed
   - why the change was made
   - validation performed (tests/checks run)
   - follow-up notes or known limitations where relevant
4. Optional footer lines may be used for `BREAKING CHANGE` notes or issue references.
5. Detailed explanation belongs in the body, not in an overlong subject line.

### V1 Example Commit Sequence (only an example, no need to follow this exact sequence as long as milestones are meaningful and reviewable)

1. `chore(scaffold): bootstrap electron + vite + bun workspace`
   - Mandatory first checkpoint for V1 immediately after initial Electron + Vite scaffolding and Bun toolchain setup is complete.
2. `feat(architecture): add initial layer boundaries and IPC contract skeleton`
3. `feat(connections): implement profile CRUD and connection test flow`
4. `feat(core-ops): implement read/write/search/delete workflows`
5. `feat(safety): enforce confirmation dialogs and read-only write/delete blocking`
6. `test(v1): add unit and contract coverage for MVP use-cases`
7. `docs(v1): update implementation notes and operator-facing usage guidance`
8. `chore(v1-gate): finalize release gate alignment and readiness checks`

### Completion Criteria for Agent Runs

1. The implementation run ends with at least 8 local commits for the version scope.
2. Commits are meaningful, milestone-based, and individually reviewable.
3. Commits remain unpushed unless explicitly instructed otherwise by the user.
4. All commit messages satisfy the detailed Conventional Commit standard defined above.

## Security and Privacy Baseline

1. Credentials are stored in OS keychain services; app metadata stores secret references only.
2. History/audit storage defaults to metadata + redacted diff (not full value snapshots).
3. Logs and exports must redact known sensitive fields.
4. Telemetry is off by default in MVP.
5. Destructive actions require explicit user confirmation.

## UX Principles

1. Modern, simple, elegant interface with low cognitive load.
2. Full light and dark mode support, including system-theme detection.
3. Clear status and feedback for connection health, operations, and failures.
4. Strong visual distinction for dangerous actions.
5. Responsive UI behavior on large keyspaces through pagination/streaming.

## Canonical Feature Catalog

### V1 - MVP

1. Connection CRUD for Redis and Memcached.
2. Connection test and status feedback.
3. Core operations: read, write, search, delete.
4. Key/item detail panel with value and TTL editing where supported.
5. Safety confirmations for destructive actions.
6. Per-connection read-only mode.
7. Light/dark theme support.

### V2 - Operations and Safe Automation

1. Environment guardrails for `prod` tagged connections.
2. Rollback helper using recent key-level snapshot restore.
3. Connection policies that can force read-only behavior.
4. Per-profile operation timeout and retry policies.
5. Saved workflow templates:
   - delete by pattern
   - TTL normalize
   - warmup set
   - dry-run preview before execution
6. Workflow history with rerun and rerun-with-edits.
7. Per-workflow-step retry policy (backoff, max attempts, abort conditions).
8. Observability core:
   - connection health dashboard
   - operation trend charts
   - error heatmap by connection/environment
   - unified event timeline (app audit + engine events)
   - slow operation panel
9. Alerts via in-app and desktop notifications.

### V3 - Advanced Observability and Governance

1. Observability advanced:
   - keyspace activity view
   - alert rule builder
   - failed-operation diagnostic drilldown
   - compare-period view
   - incident bundle preview
2. Incident bundle export (timeline + logs + diagnostics).
3. Automation governance:
   - scheduled execution windows
   - failure checkpointing/resume
   - policy packs and execution limits
4. Advanced local retention and storage controls (default 30 days, configurable).

## Release Strategy and Dependency Map

1. V1 establishes secure connections, reliable core operations, and baseline safety.
2. V2 depends on V1 data model and UI shell; adds guardrails, rollback, automation templates, and core observability.
3. V3 depends on V2 history/observability pipelines; adds advanced analytics, exports, and governance controls.

| Dependency                   | Used By    | Reason                                                 |
| ---------------------------- | ---------- | ------------------------------------------------------ |
| `ConnectionProfile` baseline | V1, V2, V3 | Stable connection identity and policy storage          |
| Hybrid timeline model        | V2, V3     | Powers observability, incident analysis, and exports   |
| Workflow execution engine    | V2, V3     | Enables automation templates and governance extensions |
| Snapshot/restore primitives  | V2, V3     | Supports rollback and incident tooling                 |

## Canonical Data Model and Interfaces

```ts
export type CacheEngine = 'redis' | 'memcached'
export type EnvironmentTag = 'dev' | 'staging' | 'prod'
export type EventSource = 'app' | 'engine'
export type BackoffStrategy = 'fixed' | 'exponential'
export type OperationErrorCode =
	| 'VALIDATION_ERROR'
	| 'UNAUTHORIZED'
	| 'TIMEOUT'
	| 'CONNECTION_FAILED'
	| 'NOT_SUPPORTED'
	| 'CONFLICT'
	| 'INTERNAL_ERROR'

export interface ProviderCapabilities {
	supportsTTL: boolean
	supportsMonitorStream: boolean
	supportsSlowLog: boolean
	supportsBulkDeletePreview: boolean
	supportsSnapshotRestore: boolean
	supportsPatternScan: boolean
}

export interface ProviderEvent {
	eventType: string
	connectionId: string
	timestamp: string
	payload: Record<string, unknown>
}

export interface ConnectionProfile {
	id: string
	name: string
	engine: CacheEngine
	host: string
	port: number
	dbIndex?: number // Redis only
	tlsEnabled: boolean
	environment: EnvironmentTag
	tags: string[]
	secretRef: string // Keychain handle, not raw credential
	readOnly: boolean
	timeoutMs: number
	retryPolicyId?: string
	createdAt: string
	updatedAt: string
}

// Lifecycle: connect -> operation calls -> disconnect
export interface CacheProvider {
	getCapabilities(): ProviderCapabilities
	connect(profile: ConnectionProfile): Promise<{ connectionId: string }>
	disconnect(connectionId: string): Promise<void>
	ping(connectionId: string): Promise<number>
	listKeys(args: {
		connectionId: string
		cursor?: string
		limit: number
	}): Promise<{ keys: string[]; nextCursor?: string }>
	searchKeys(args: {
		connectionId: string
		pattern: string
		limit: number
	}): Promise<string[]>
	getValue(args: { connectionId: string; key: string }): Promise<unknown>
	setValue(args: {
		connectionId: string
		key: string
		value: unknown
		ttlSeconds?: number
	}): Promise<void>
	deleteKey(args: { connectionId: string; key: string }): Promise<void>
	getStats(args: { connectionId: string }): Promise<ObservabilitySnapshot>
	subscribeEvents?(
		args: { connectionId: string; eventTypes?: string[] },
		onEvent: (event: ProviderEvent) => void,
	): Promise<() => void>
}

export interface SecretStore {
	saveSecret(profileId: string, payload: Record<string, string>): Promise<void>
	getSecret(profileId: string): Promise<Record<string, string>>
	deleteSecret(profileId: string): Promise<void>
}

export interface WorkflowTemplate {
	id: string
	name: string
	kind: 'deleteByPattern' | 'ttlNormalize' | 'warmupSet'
	parameters: Record<string, unknown>
	requiresApprovalOnProd: boolean
	supportsDryRun: boolean
}

export interface WorkflowExecutionPolicy {
	id: string
	maxAttempts: number
	backoffMs: number
	backoffStrategy: BackoffStrategy
	abortOnErrorRate: number
}

export interface HistoryEvent {
	id: string
	timestamp: string
	source: EventSource
	connectionId: string
	action: string
	keyOrPattern: string
	durationMs: number
	status: 'success' | 'error' | 'blocked'
	redactedDiff?: string
}

export interface ObservabilitySnapshot {
	timestamp: string
	latencyP50Ms: number
	latencyP95Ms: number
	errorRate: number
	reconnectCount: number
	opsPerSecond: number
	slowOpCount: number
}

export interface IncidentBundle {
	id: string
	from: string
	to: string
	connectionIds: string[]
	includes: Array<'timeline' | 'logs' | 'diagnostics' | 'metrics'>
	redactionProfile: 'default' | 'strict'
	checksum: string
}

export interface SnapshotRecord {
	id: string
	connectionId: string
	key: string
	capturedAt: string
	redactedValueHash: string
	ttlSeconds?: number
}

export interface WorkflowExecutionRecord {
	id: string
	workflowTemplateId: string
	connectionId: string
	startedAt: string
	finishedAt?: string
	status: 'pending' | 'running' | 'success' | 'error' | 'aborted'
	retryCount: number
	checkpointToken?: string
}

export interface OperationError {
	code: OperationErrorCode
	message: string
	retryable: boolean
	details?: Record<string, unknown>
}

export interface IpcCommandEnvelope<TPayload> {
	command: string
	payload: TPayload
	correlationId: string
}

export interface IpcQueryEnvelope<TPayload> {
	query: string
	payload: TPayload
	correlationId: string
}

export interface IpcResponseEnvelope<TData> {
	ok: boolean
	correlationId: string
	data?: TData
	error?: OperationError
}

export interface ConnectionRepository {
	save(profile: ConnectionProfile): Promise<void>
	findById(id: string): Promise<ConnectionProfile | null>
	list(): Promise<ConnectionProfile[]>
	delete(id: string): Promise<void>
}

export interface HistoryRepository {
	append(event: HistoryEvent): Promise<void>
	query(args: {
		connectionId?: string
		from?: string
		to?: string
		limit: number
	}): Promise<HistoryEvent[]>
	purgeOlderThan(timestamp: string): Promise<number>
}

export interface ObservabilityRepository {
	append(snapshot: ObservabilitySnapshot): Promise<void>
	querySeries(args: {
		connectionId?: string
		from: string
		to: string
		interval: string
	}): Promise<ObservabilitySnapshot[]>
	purgeOlderThan(timestamp: string): Promise<number>
}

export interface WorkflowRepository {
	saveTemplate(template: WorkflowTemplate): Promise<void>
	listTemplates(): Promise<WorkflowTemplate[]>
	saveExecution(execution: WorkflowExecutionRecord): Promise<void>
	listExecutions(args: {
		workflowTemplateId?: string
		limit: number
	}): Promise<WorkflowExecutionRecord[]>
}

export interface SnapshotRepository {
	save(record: SnapshotRecord): Promise<void>
	findLatest(args: {
		connectionId: string
		key: string
	}): Promise<SnapshotRecord | null>
}
```

Contract ownership and mandatory tests:

1. Application-owned contracts (`CacheProvider`, repositories, IPC envelopes, domain models) must have contract tests.
2. Infrastructure adapters (SQLite/keychain/provider/IPC handlers) must pass those contract tests in CI.

## Global Non-Functional Requirements

### Performance

1. Initial connection dashboard load under 2 seconds on standard developer hardware.
2. Search interaction under 500 ms for visible result sets.
3. Key browsing must stream/paginate to avoid renderer freezes.

### Reliability

1. Operation failures must return actionable errors without app crash.
2. Connection drop and reconnect states must be visible.
3. Duplicate destructive submission must be prevented.

### Accessibility

1. Keyboard navigable core workflows.
2. Adequate contrast in light and dark themes.
3. Clear labels and focus states for inputs and destructive actions.

## Global Risks and Mitigations

| Risk                                         | Impact | Mitigation                                                                  |
| -------------------------------------------- | ------ | --------------------------------------------------------------------------- |
| Large keyspaces cause UI lag                 | High   | Streaming/pagination, virtualization, operation caps                        |
| Credential exposure                          | High   | OS keychain storage, redaction pipeline, secret references only             |
| Redis vs Memcached behavior mismatch         | Medium | Capability flags, per-engine adapters, clear unsupported-state UX           |
| Unsafe bulk operations                       | High   | Dry-run first, prod guardrails, confirmations, rollback helper              |
| Local data growth from observability         | Medium | 30-day default retention, configurable purge policies                       |
| Layer leakage across architecture boundaries | High   | CI-enforced dependency rules and forbidden import checks                    |
| IPC contract drift between renderer and main | Medium | Typed envelopes, runtime schema validation, contract tests                  |
| Scheduler inconsistency across restarts      | Medium | Persisted job state, idempotency keys, deterministic retry/backoff policies |
| CI feedback loop becomes too slow            | Medium | Two-tier test strategy: fast PR/local gate and full suite on main/nightly   |

## Master Acceptance Criteria

1. All V1/V2/V3 PRD files exist and remain internally consistent.
2. Shared policies are defined once in `PRD.md` and referenced by version files.
3. All public interfaces listed in this document are version-mapped with deltas.
4. Safety and privacy requirements are represented in each version release gate.
5. Traceability matrix covers every canonical feature.
6. Clean Architecture dependency rules are documented and testable in CI.
7. Every major feature is mapped to an owner layer and runtime process.
8. All public contracts define adapter ownership and required contract tests.
9. GitHub Actions is the canonical CI platform with PR, main, and nightly workflows defined.
10. CLI test commands are documented with fast gate and full suite coverage expectations.
11. AI-agent implementation runs follow the milestone-based commit workflow, including current-branch-only execution, minimum 8 commits, and unpushed completion by default.

## Success Metrics

1. Time-to-first-successful-connection.
2. Core operation completion rate (read/write/search/delete).
3. Crash-free session rate.
4. P50/P95 operation latency by engine.
5. Failed destructive action prevention rate.
6. Incident investigation time reduction after V3 rollout.

## Consolidated Cross-Version Test Matrix

| Capability                                          | V1       | V2                        | V3                              |
| --------------------------------------------------- | -------- | ------------------------- | ------------------------------- |
| Connection management and secure credential storage | Required | Regression required       | Regression required             |
| Core key operations (read/write/search/delete)      | Required | Regression required       | Regression required             |
| Read-only enforcement                               | Required | Enhanced via policy       | Enhanced via governance         |
| Prod guardrails                                     | Deferred | Required                  | Regression required             |
| Rollback helper                                     | Deferred | Required                  | Regression required             |
| Workflow templates and dry-run                      | Deferred | Required                  | Enhanced                        |
| Workflow history and rerun                          | Deferred | Required                  | Enhanced                        |
| Observability dashboard                             | Deferred | Core required             | Advanced required               |
| Alerts                                              | Deferred | In-app + desktop required | Rule-based enhancement required |
| Incident bundle export                              | Deferred | Deferred                  | Required                        |
| Advanced retention controls                         | Deferred | Baseline retention        | Required                        |

## Architecture Validation Scenarios

1. Dependency rule checks fail CI for forbidden cross-layer imports.
2. IPC schema validation rejects malformed payloads with typed `OperationError`.
3. Renderer cannot access raw Node APIs or credential material directly.
4. Capability compliance tests confirm unsupported features degrade gracefully.
5. Forward-only migration tests preserve existing data across schema upgrades.
6. Scheduler tests validate deterministic retry, backoff, and abort behavior.
7. Redaction tests verify history/log/export paths never store raw secrets.
8. Cross-version regression tests verify V1 flows remain intact after V2/V3 additions.
9. GitHub Actions PR workflow blocks merge when any required check fails.
10. CLI fast gate (`test`) and CI PR checks execute the same unit + contract test scripts.
11. Full suite (`test:all`) is executed in CI main/nightly workflows and covers integration + e2e/smoke paths.

## Traceability Matrix (Feature -> Version PRD File)

| Feature                                          | Source Version File |
| ------------------------------------------------ | ------------------- |
| Connection CRUD and testing                      | `PRD-V1.md`         |
| Core read/write/search/delete operations         | `PRD-V1.md`         |
| Key detail editor and TTL                        | `PRD-V1.md`         |
| Dark/light mode                                  | `PRD-V1.md`         |
| Destructive action confirmations                 | `PRD-V1.md`         |
| Per-connection read-only mode                    | `PRD-V1.md`         |
| Environment guardrails on prod tags              | `PRD-V2.md`         |
| Rollback helper via key-level snapshots          | `PRD-V2.md`         |
| Connection policy enforcement                    | `PRD-V2.md`         |
| Per-profile timeout/retry policy                 | `PRD-V2.md`         |
| Saved workflow templates + dry-run               | `PRD-V2.md`         |
| Workflow history rerun/rerun-with-edits          | `PRD-V2.md`         |
| Step retry policy (backoff/max attempts/abort)   | `PRD-V2.md`         |
| Connection health dashboard                      | `PRD-V2.md`         |
| Operation trends and error heatmap               | `PRD-V2.md`         |
| Unified timeline and slow operation panel        | `PRD-V2.md`         |
| In-app + desktop alerts                          | `PRD-V2.md`         |
| Keyspace activity and alert rule builder         | `PRD-V3.md`         |
| Failed operation drilldown and compare periods   | `PRD-V3.md`         |
| Incident bundle preview and export               | `PRD-V3.md`         |
| Automation scheduling/checkpointing/policy packs | `PRD-V3.md`         |
| Advanced retention and storage controls          | `PRD-V3.md`         |

## Assumptions and Defaults

1. Files live in repo root: `PRD.md`, `PRD-V1.md`, `PRD-V2.md`, `PRD-V3.md`.
2. No centralized backend in any version.
3. Redis and Memcached remain first-class targets in all versions.
4. Local history is hybrid: app audit + engine events where available.
5. History storage default is metadata + redacted diff.
6. Retention default is 30 days and user-configurable.
7. Clean Architecture dependency rule is strict and enforced in CI (not advisory).
8. Main process owns providers, persistence, secrets, and scheduling.
9. SQLite remains canonical metadata storage with forward-only migrations.
10. React Query is the default async/query state manager in renderer.
11. Zustand is the default UI/session state manager in renderer.
12. Domain/Application events use an in-process typed event bus.
13. Dedicated read-model repositories are required for observability and timeline queries.
14. GitHub Actions is the canonical CI runner platform.
15. Test execution follows two tiers: fast gate and full suite.
16. Fast gate includes unit and contract tests; full suite adds integration and end-to-end/smoke tests.
17. Bun is the default JavaScript runtime/package manager for local and CI scripts.
18. Vitest remains the default test runner unless a future PRD revision explicitly changes this policy.
19. Target structure in `Project Structure Shape` is the canonical repository layout baseline.

## Document Governance Rules

1. `PRD.md` is source of truth for shared context and global policy.
2. Version PRDs must reference `PRD.md` for shared content to avoid duplication drift.
3. Each version PRD starts with "Delta from previous version."
4. New global policy changes must update `PRD.md` first, then version references.
5. Each PRD file maintains its own change log section.
6. New features must declare layer ownership and runtime process ownership.
7. New persisted storage fields must include migration notes and compatibility impact.
8. New engine-specific behavior must include capability flag updates and fallback UX notes.
9. Any new test type must be mapped in both GitHub Actions workflows and CLI test scripts.
10. AI-agent implementation and commit-process policy changes must be authored and maintained in the `AI Agent Implementation Workflow` section of `PRD.md`.

## Version File Index

1. MVP detail: `PRD-V1.md`
2. Operations and safe automation detail: `PRD-V2.md`
3. Advanced observability and governance detail: `PRD-V3.md`

## Change Log

| Date       | Version | Author | Change                                                                                                                                                                                         |
| ---------- | ------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-17 | 1.5     | Codex  | Added `Project Structure Shape` with canonical target tree, current scaffold snapshot, and conformance rules for structure migration and `components.json` alias alignment.                    |
| 2026-02-17 | 1.4     | Codex  | Updated stack policy to adopt Bun as runtime/package manager while retaining Vitest as the canonical test runner; aligned scaffold, test policy, and assumptions.                              |
| 2026-02-17 | 1.3     | Codex  | Added AI-agent implementation workflow with current-branch-only commits, minimum 8 milestone commits per version, detailed Conventional Commit requirements, and unpushed completion defaults. |
| 2026-02-17 | 1.2     | Codex  | Locked CI to GitHub Actions and added two-tier CLI/CI test execution policy (fast gate + full suite).                                                                                          |
| 2026-02-17 | 1.1     | Codex  | Added strict Clean Architecture blueprint with enforceable layer rules, IPC/repository contracts, architecture validation scenarios, and governance updates.                                   |
| 2026-02-17 | 1.0     | Codex  | Created master PRD with cross-version model, interfaces, traceability, and governance.                                                                                                         |
