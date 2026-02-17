import type {
  AlertEvent,
  AlertListRequest,
  ConnectionDraft,
  ConnectionProfile,
  ConnectionSecret,
  ConnectionTestResult,
  HistoryEvent,
  HistoryQueryRequest,
  KeyListResult,
  KeyValueRecord,
  ObservabilitySnapshot,
  ProviderCapabilities,
  SnapshotRecord,
  WorkflowExecutionListRequest,
  WorkflowExecutionRecord,
  WorkflowTemplate,
} from '../../shared/contracts/cache'

export interface ConnectionRepository {
  list: () => Promise<ConnectionProfile[]>
  findById: (id: string) => Promise<ConnectionProfile | null>
  save: (profile: ConnectionProfile) => Promise<void>
  delete: (id: string) => Promise<void>
}

export interface SecretStore {
  saveSecret: (profileId: string, secret: ConnectionSecret) => Promise<void>
  getSecret: (profileId: string) => Promise<ConnectionSecret>
  deleteSecret: (profileId: string) => Promise<void>
}

export interface MemcachedKeyIndexRepository {
  listKeys: (connectionId: string, limit: number) => Promise<string[]>
  searchKeys: (
    connectionId: string,
    pattern: string,
    limit: number,
    cursor?: string,
  ) => Promise<string[]>
  upsertKey: (connectionId: string, key: string) => Promise<void>
  removeKey: (connectionId: string, key: string) => Promise<void>
  deleteByConnectionId: (connectionId: string) => Promise<void>
}

export interface SnapshotRepository {
  save: (record: SnapshotRecord) => Promise<void>
  list: (args: {
    connectionId: string
    key?: string
    limit: number
  }) => Promise<SnapshotRecord[]>
  findLatest: (args: {
    connectionId: string
    key: string
  }) => Promise<SnapshotRecord | null>
  findById: (id: string) => Promise<SnapshotRecord | null>
}

export interface WorkflowTemplateRepository {
  save: (template: WorkflowTemplate) => Promise<void>
  list: () => Promise<WorkflowTemplate[]>
  findById: (id: string) => Promise<WorkflowTemplate | null>
  delete: (id: string) => Promise<void>
}

export interface WorkflowExecutionRepository {
  save: (record: WorkflowExecutionRecord) => Promise<void>
  list: (args: WorkflowExecutionListRequest) => Promise<WorkflowExecutionRecord[]>
  findById: (id: string) => Promise<WorkflowExecutionRecord | null>
}

export interface HistoryRepository {
  append: (event: HistoryEvent) => Promise<void>
  query: (args: HistoryQueryRequest) => Promise<HistoryEvent[]>
}

export interface ObservabilityRepository {
  append: (snapshot: ObservabilitySnapshot) => Promise<void>
  query: (args: {
    connectionId?: string
    from?: string
    to?: string
    limit: number
  }) => Promise<ObservabilitySnapshot[]>
}

export interface AlertRepository {
  append: (event: AlertEvent) => Promise<void>
  list: (request: AlertListRequest) => Promise<AlertEvent[]>
  markRead: (id: string) => Promise<void>
}

export interface NotificationPublisher {
  notify: (alert: Pick<AlertEvent, 'title' | 'message'>) => Promise<void>
}

export interface CacheGateway {
  testConnection: (
    profile: ConnectionDraft,
    secret: ConnectionSecret,
  ) => Promise<ConnectionTestResult>
  getCapabilities: (
    profile: Pick<ConnectionProfile, 'engine'>,
  ) => ProviderCapabilities
  listKeys: (
    profile: ConnectionProfile,
    secret: ConnectionSecret,
    args: { cursor?: string; limit: number },
  ) => Promise<KeyListResult>
  searchKeys: (
    profile: ConnectionProfile,
    secret: ConnectionSecret,
    args: { pattern: string; limit: number; cursor?: string },
  ) => Promise<KeyListResult>
  getValue: (
    profile: ConnectionProfile,
    secret: ConnectionSecret,
    key: string,
  ) => Promise<KeyValueRecord>
  setValue: (
    profile: ConnectionProfile,
    secret: ConnectionSecret,
    args: { key: string; value: string; ttlSeconds?: number },
  ) => Promise<void>
  deleteKey: (
    profile: ConnectionProfile,
    secret: ConnectionSecret,
    key: string,
  ) => Promise<void>
}
