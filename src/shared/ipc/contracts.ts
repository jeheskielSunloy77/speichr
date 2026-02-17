import type {
  AlertEvent,
  AlertListRequest,
  AlertMarkReadRequest,
  ConnectionCapabilitiesRequest,
  ConnectionCreateRequest,
  ConnectionDeleteRequest,
  ConnectionGetRequest,
  ConnectionProfile,
  ConnectionTestRequest,
  ConnectionTestResult,
  ConnectionUpdateRequest,
  HistoryEvent,
  HistoryQueryRequest,
  KeyDeleteRequest,
  KeyGetRequest,
  KeyListRequest,
  KeyListResult,
  KeySearchRequest,
  KeySetRequest,
  KeyValueRecord,
  MutationResult,
  ObservabilityDashboard,
  ObservabilityDashboardRequest,
  OperationErrorCode,
  ProviderCapabilities,
  RollbackRestoreRequest,
  SnapshotListRequest,
  SnapshotRecord,
  WorkflowDryRunPreview,
  WorkflowExecuteRequest,
  WorkflowExecutionGetRequest,
  WorkflowExecutionListRequest,
  WorkflowExecutionRecord,
  WorkflowRerunRequest,
  WorkflowTemplate,
  WorkflowTemplateCreateRequest,
  WorkflowTemplateDeleteRequest,
  WorkflowTemplatePreviewRequest,
  WorkflowTemplateUpdateRequest,
} from '../contracts/cache'

export const IPC_COMMAND_CHANNEL = 'cachify:command'
export const IPC_QUERY_CHANNEL = 'cachify:query'

export type CachifyCommand =
  | 'connection.create'
  | 'connection.update'
  | 'connection.delete'
  | 'connection.test'
  | 'key.set'
  | 'key.delete'
  | 'rollback.restore'
  | 'workflow.template.create'
  | 'workflow.template.update'
  | 'workflow.template.delete'
  | 'workflow.execute'
  | 'workflow.rerun'
  | 'alert.markRead'

export type CachifyQuery =
  | 'connection.list'
  | 'connection.get'
  | 'provider.capabilities'
  | 'key.list'
  | 'key.search'
  | 'key.get'
  | 'snapshot.list'
  | 'workflow.template.list'
  | 'workflow.preview'
  | 'workflow.execution.list'
  | 'workflow.execution.get'
  | 'history.list'
  | 'observability.dashboard'
  | 'alert.list'

export interface CommandPayloadMap {
  'connection.create': ConnectionCreateRequest
  'connection.update': ConnectionUpdateRequest
  'connection.delete': ConnectionDeleteRequest
  'connection.test': ConnectionTestRequest
  'key.set': KeySetRequest
  'key.delete': KeyDeleteRequest
  'rollback.restore': RollbackRestoreRequest
  'workflow.template.create': WorkflowTemplateCreateRequest
  'workflow.template.update': WorkflowTemplateUpdateRequest
  'workflow.template.delete': WorkflowTemplateDeleteRequest
  'workflow.execute': WorkflowExecuteRequest
  'workflow.rerun': WorkflowRerunRequest
  'alert.markRead': AlertMarkReadRequest
}

export interface QueryPayloadMap {
  'connection.list': Record<string, never>
  'connection.get': ConnectionGetRequest
  'provider.capabilities': ConnectionCapabilitiesRequest
  'key.list': KeyListRequest
  'key.search': KeySearchRequest
  'key.get': KeyGetRequest
  'snapshot.list': SnapshotListRequest
  'workflow.template.list': Record<string, never>
  'workflow.preview': WorkflowTemplatePreviewRequest
  'workflow.execution.list': WorkflowExecutionListRequest
  'workflow.execution.get': WorkflowExecutionGetRequest
  'history.list': HistoryQueryRequest
  'observability.dashboard': ObservabilityDashboardRequest
  'alert.list': AlertListRequest
}

export interface CommandResultMap {
  'connection.create': ConnectionProfile
  'connection.update': ConnectionProfile
  'connection.delete': MutationResult
  'connection.test': ConnectionTestResult
  'key.set': MutationResult
  'key.delete': MutationResult
  'rollback.restore': MutationResult
  'workflow.template.create': WorkflowTemplate
  'workflow.template.update': WorkflowTemplate
  'workflow.template.delete': MutationResult
  'workflow.execute': WorkflowExecutionRecord
  'workflow.rerun': WorkflowExecutionRecord
  'alert.markRead': MutationResult
}

export interface QueryResultMap {
  'connection.list': ConnectionProfile[]
  'connection.get': ConnectionProfile
  'provider.capabilities': ProviderCapabilities
  'key.list': KeyListResult
  'key.search': KeyListResult
  'key.get': KeyValueRecord
  'snapshot.list': SnapshotRecord[]
  'workflow.template.list': WorkflowTemplate[]
  'workflow.preview': WorkflowDryRunPreview
  'workflow.execution.list': WorkflowExecutionRecord[]
  'workflow.execution.get': WorkflowExecutionRecord
  'history.list': HistoryEvent[]
  'observability.dashboard': ObservabilityDashboard
  'alert.list': AlertEvent[]
}

export interface OperationError {
  code: OperationErrorCode
  message: string
  retryable: boolean
  details?: Record<string, unknown>
}

export interface IpcCommandEnvelope<
  TPayload,
  TCommand extends CachifyCommand = CachifyCommand,
> {
  command: TCommand
  payload: TPayload
  correlationId: string
}

export interface IpcQueryEnvelope<
  TPayload,
  TQuery extends CachifyQuery = CachifyQuery,
> {
  query: TQuery
  payload: TPayload
  correlationId: string
}

export interface IpcResponseEnvelope<TData> {
  ok: boolean
  correlationId: string
  data?: TData
  error?: OperationError
}

export type AnyCommandEnvelope = {
  [K in keyof CommandPayloadMap]: IpcCommandEnvelope<CommandPayloadMap[K], K>
}[keyof CommandPayloadMap]

export type AnyQueryEnvelope = {
  [K in keyof QueryPayloadMap]: IpcQueryEnvelope<QueryPayloadMap[K], K>
}[keyof QueryPayloadMap]
