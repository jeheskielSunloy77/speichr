export type CacheEngine = 'redis' | 'memcached'
export type EnvironmentTag = 'dev' | 'staging' | 'prod'
export type EventSource = 'app' | 'engine'
export type BackoffStrategy = 'fixed' | 'exponential'
export type WorkflowKind = 'deleteByPattern' | 'ttlNormalize' | 'warmupSet'
export type WorkflowExecutionStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'error'
  | 'aborted'
export type AlertSeverity = 'info' | 'warning' | 'critical'

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

export interface ConnectionProfile {
  id: string
  name: string
  engine: CacheEngine
  host: string
  port: number
  dbIndex?: number
  tlsEnabled: boolean
  environment: EnvironmentTag
  tags: string[]
  secretRef: string
  readOnly: boolean
  forceReadOnly?: boolean
  timeoutMs: number
  retryMaxAttempts?: number
  retryBackoffMs?: number
  retryBackoffStrategy?: BackoffStrategy
  retryAbortOnErrorRate?: number
  createdAt: string
  updatedAt: string
}

export interface ConnectionSecret {
  username?: string
  password?: string
  token?: string
}

export interface ConnectionDraft {
  name: string
  engine: CacheEngine
  host: string
  port: number
  dbIndex?: number
  tlsEnabled: boolean
  environment: EnvironmentTag
  tags: string[]
  readOnly: boolean
  forceReadOnly?: boolean
  timeoutMs: number
  retryMaxAttempts?: number
  retryBackoffMs?: number
  retryBackoffStrategy?: BackoffStrategy
  retryAbortOnErrorRate?: number
}

export interface ConnectionCreateRequest {
  profile: ConnectionDraft
  secret: ConnectionSecret
}

export interface ConnectionUpdateRequest {
  id: string
  profile: ConnectionDraft
  secret?: ConnectionSecret
}

export interface ConnectionDeleteRequest {
  id: string
}

export interface ConnectionGetRequest {
  id: string
}

export interface ConnectionTestRequest {
  connectionId?: string
  profile: ConnectionDraft
  secret: ConnectionSecret
}

export interface ConnectionTestResult {
  latencyMs: number
  capabilities: ProviderCapabilities
}

export interface ConnectionCapabilitiesRequest {
  connectionId: string
}

export interface KeyListRequest {
  connectionId: string
  cursor?: string
  limit: number
}

export interface KeySearchRequest {
  connectionId: string
  pattern: string
  cursor?: string
  limit: number
}

export interface KeyGetRequest {
  connectionId: string
  key: string
}

export interface KeySetRequest {
  connectionId: string
  key: string
  value: string
  ttlSeconds?: number
}

export interface KeyDeleteRequest {
  connectionId: string
  key: string
  guardrailConfirmed?: boolean
}

export interface KeyListResult {
  keys: string[]
  nextCursor?: string
}

export interface KeyValueRecord {
  key: string
  value: string | null
  ttlSeconds: number | null
  supportsTTL: boolean
}

export interface MutationResult {
  success: true
}

export interface SnapshotRecord {
  id: string
  connectionId: string
  key: string
  capturedAt: string
  redactedValueHash: string
  value: string | null
  ttlSeconds?: number
  reason: 'set' | 'delete' | 'workflow'
}

export interface SnapshotListRequest {
  connectionId: string
  key?: string
  limit: number
}

export interface RollbackRestoreRequest {
  connectionId: string
  key: string
  snapshotId?: string
  guardrailConfirmed?: boolean
}

export interface WorkflowTemplate {
  id: string
  name: string
  kind: WorkflowKind
  parameters: Record<string, unknown>
  requiresApprovalOnProd: boolean
  supportsDryRun: boolean
  createdAt: string
  updatedAt: string
}

export interface WorkflowTemplateDraft {
  name: string
  kind: WorkflowKind
  parameters: Record<string, unknown>
  requiresApprovalOnProd: boolean
  supportsDryRun: boolean
}

export interface WorkflowTemplateCreateRequest {
  template: WorkflowTemplateDraft
}

export interface WorkflowTemplateUpdateRequest {
  id: string
  template: WorkflowTemplateDraft
}

export interface WorkflowTemplateDeleteRequest {
  id: string
}

export interface WorkflowTemplatePreviewRequest {
  connectionId: string
  templateId?: string
  template?: WorkflowTemplateDraft
  parameterOverrides?: Record<string, unknown>
  cursor?: string
  limit?: number
}

export interface WorkflowStepRetryPolicy {
  maxAttempts: number
  backoffMs: number
  backoffStrategy: BackoffStrategy
  abortOnErrorRate: number
}

export interface WorkflowDryRunPreviewItem {
  key: string
  action: 'delete' | 'setTtl' | 'setValue'
  currentTtlSeconds?: number | null
  nextTtlSeconds?: number | null
  valuePreview?: string
}

export interface WorkflowDryRunPreview {
  kind: WorkflowKind
  estimatedCount: number
  truncated: boolean
  nextCursor?: string
  items: WorkflowDryRunPreviewItem[]
}

export interface WorkflowStepResult {
  step: string
  status: 'success' | 'error' | 'skipped'
  attempts: number
  durationMs: number
  message?: string
}

export interface WorkflowExecutionRecord {
  id: string
  workflowTemplateId?: string
  workflowName: string
  workflowKind: WorkflowKind
  connectionId: string
  startedAt: string
  finishedAt?: string
  status: WorkflowExecutionStatus
  retryCount: number
  dryRun: boolean
  parameters: Record<string, unknown>
  stepResults: WorkflowStepResult[]
  errorMessage?: string
}

export interface WorkflowExecuteRequest {
  connectionId: string
  templateId?: string
  template?: WorkflowTemplateDraft
  parameterOverrides?: Record<string, unknown>
  dryRun?: boolean
  guardrailConfirmed?: boolean
  retryPolicy?: WorkflowStepRetryPolicy
}

export interface WorkflowRerunRequest {
  executionId: string
  parameterOverrides?: Record<string, unknown>
  dryRun?: boolean
  guardrailConfirmed?: boolean
}

export interface WorkflowExecutionListRequest {
  connectionId?: string
  templateId?: string
  limit: number
}

export interface WorkflowExecutionGetRequest {
  id: string
}

export interface HistoryEvent {
  id: string
  timestamp: string
  source: EventSource
  connectionId: string
  environment: EnvironmentTag
  action: string
  keyOrPattern: string
  durationMs: number
  status: 'success' | 'error' | 'blocked'
  redactedDiff?: string
  errorCode?: OperationErrorCode
  retryable?: boolean
  details?: Record<string, unknown>
}

export interface HistoryQueryRequest {
  connectionId?: string
  from?: string
  to?: string
  limit: number
}

export interface ObservabilitySnapshot {
  id: string
  connectionId: string
  timestamp: string
  latencyP50Ms: number
  latencyP95Ms: number
  errorRate: number
  reconnectCount: number
  opsPerSecond: number
  slowOpCount: number
}

export interface ConnectionHealthSummary {
  connectionId: string
  connectionName: string
  environment: EnvironmentTag
  status: 'healthy' | 'degraded' | 'offline'
  latencyP95Ms: number
  errorRate: number
  opsPerSecond: number
  slowOpCount: number
}

export interface OperationTrendPoint {
  bucket: string
  operationCount: number
  errorCount: number
  avgDurationMs: number
}

export interface ErrorHeatmapCell {
  connectionId: string
  environment: EnvironmentTag
  errorCount: number
}

export interface ObservabilityDashboard {
  generatedAt: string
  health: ConnectionHealthSummary[]
  trends: OperationTrendPoint[]
  heatmap: ErrorHeatmapCell[]
  timeline: HistoryEvent[]
  slowOperations: HistoryEvent[]
}

export interface ObservabilityDashboardRequest {
  connectionId?: string
  from?: string
  to?: string
  intervalMinutes?: number
  limit?: number
}

export interface AlertEvent {
  id: string
  createdAt: string
  connectionId?: string
  environment?: EnvironmentTag
  severity: AlertSeverity
  title: string
  message: string
  source: 'app' | 'policy' | 'workflow' | 'observability'
  read: boolean
}

export interface AlertListRequest {
  unreadOnly?: boolean
  limit: number
}

export interface AlertMarkReadRequest {
  id: string
}
