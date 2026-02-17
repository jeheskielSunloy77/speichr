import type {
  AlertListRequest,
  AlertMarkReadRequest,
  ConnectionCapabilitiesRequest,
  ConnectionCreateRequest,
  ConnectionDeleteRequest,
  ConnectionGetRequest,
  ConnectionTestRequest,
  ConnectionUpdateRequest,
  HistoryQueryRequest,
  KeyDeleteRequest,
  KeyGetRequest,
  KeyListRequest,
  KeySearchRequest,
  KeySetRequest,
  ObservabilityDashboardRequest,
  RollbackRestoreRequest,
  SnapshotListRequest,
  WorkflowExecuteRequest,
  WorkflowExecutionGetRequest,
  WorkflowExecutionListRequest,
  WorkflowRerunRequest,
  WorkflowTemplateCreateRequest,
  WorkflowTemplateDeleteRequest,
  WorkflowTemplatePreviewRequest,
  WorkflowTemplateUpdateRequest,
} from './cache'
import type {
  CommandResultMap,
  IpcResponseEnvelope,
  QueryResultMap,
} from '../ipc/contracts'

export interface CachifyApi {
  listConnections: () => Promise<IpcResponseEnvelope<QueryResultMap['connection.list']>>
  getConnection: (
    payload: ConnectionGetRequest,
  ) => Promise<IpcResponseEnvelope<QueryResultMap['connection.get']>>
  createConnection: (
    payload: ConnectionCreateRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['connection.create']>>
  updateConnection: (
    payload: ConnectionUpdateRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['connection.update']>>
  deleteConnection: (
    payload: ConnectionDeleteRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['connection.delete']>>
  testConnection: (
    payload: ConnectionTestRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['connection.test']>>
  getCapabilities: (
    payload: ConnectionCapabilitiesRequest,
  ) => Promise<IpcResponseEnvelope<QueryResultMap['provider.capabilities']>>
  listKeys: (
    payload: KeyListRequest,
  ) => Promise<IpcResponseEnvelope<QueryResultMap['key.list']>>
  searchKeys: (
    payload: KeySearchRequest,
  ) => Promise<IpcResponseEnvelope<QueryResultMap['key.search']>>
  getKey: (
    payload: KeyGetRequest,
  ) => Promise<IpcResponseEnvelope<QueryResultMap['key.get']>>
  setKey: (
    payload: KeySetRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['key.set']>>
  deleteKey: (
    payload: KeyDeleteRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['key.delete']>>
  listSnapshots: (
    payload: SnapshotListRequest,
  ) => Promise<IpcResponseEnvelope<QueryResultMap['snapshot.list']>>
  restoreSnapshot: (
    payload: RollbackRestoreRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['rollback.restore']>>
  listWorkflowTemplates: () => Promise<
    IpcResponseEnvelope<QueryResultMap['workflow.template.list']>
  >
  createWorkflowTemplate: (
    payload: WorkflowTemplateCreateRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['workflow.template.create']>>
  updateWorkflowTemplate: (
    payload: WorkflowTemplateUpdateRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['workflow.template.update']>>
  deleteWorkflowTemplate: (
    payload: WorkflowTemplateDeleteRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['workflow.template.delete']>>
  previewWorkflow: (
    payload: WorkflowTemplatePreviewRequest,
  ) => Promise<IpcResponseEnvelope<QueryResultMap['workflow.preview']>>
  executeWorkflow: (
    payload: WorkflowExecuteRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['workflow.execute']>>
  rerunWorkflow: (
    payload: WorkflowRerunRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['workflow.rerun']>>
  listWorkflowExecutions: (
    payload: WorkflowExecutionListRequest,
  ) => Promise<IpcResponseEnvelope<QueryResultMap['workflow.execution.list']>>
  getWorkflowExecution: (
    payload: WorkflowExecutionGetRequest,
  ) => Promise<IpcResponseEnvelope<QueryResultMap['workflow.execution.get']>>
  listHistory: (
    payload: HistoryQueryRequest,
  ) => Promise<IpcResponseEnvelope<QueryResultMap['history.list']>>
  getObservabilityDashboard: (
    payload: ObservabilityDashboardRequest,
  ) => Promise<IpcResponseEnvelope<QueryResultMap['observability.dashboard']>>
  listAlerts: (
    payload: AlertListRequest,
  ) => Promise<IpcResponseEnvelope<QueryResultMap['alert.list']>>
  markAlertRead: (
    payload: AlertMarkReadRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['alert.markRead']>>
}
