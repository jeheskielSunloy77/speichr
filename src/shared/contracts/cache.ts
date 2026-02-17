export type CacheEngine = 'redis' | 'memcached'
export type EnvironmentTag = 'dev' | 'staging' | 'prod'

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
  timeoutMs: number
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
  timeoutMs: number
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
