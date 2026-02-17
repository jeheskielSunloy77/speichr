import type {
  AlertListRequest,
  AlertMarkReadRequest,
  AlertRuleCreateRequest,
  AlertRuleDeleteRequest,
  AlertRuleUpdateRequest,
  ComparePeriodsRequest,
  ConnectionCapabilitiesRequest,
  ConnectionCreateRequest,
  ConnectionDeleteRequest,
  ConnectionGetRequest,
  ConnectionTestRequest,
  ConnectionUpdateRequest,
  FailedOperationDrilldownRequest,
  GovernanceAssignmentListRequest,
  GovernanceAssignmentRequest,
  GovernancePolicyPackCreateRequest,
  GovernancePolicyPackDeleteRequest,
  GovernancePolicyPackUpdateRequest,
  HistoryQueryRequest,
  IncidentBundleExportRequest,
  IncidentBundleListRequest,
  IncidentBundlePreviewRequest,
  KeyDeleteRequest,
  KeyGetRequest,
  KeyspaceActivityRequest,
  KeyListRequest,
  KeySearchRequest,
  KeySetRequest,
  ObservabilityDashboardRequest,
  RetentionPolicyUpdateRequest,
  RetentionPurgeRequest,
  RollbackRestoreRequest,
  SnapshotListRequest,
  WorkflowExecuteRequest,
  WorkflowExecutionGetRequest,
  WorkflowExecutionListRequest,
  WorkflowResumeRequest,
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
  resumeWorkflow: (
    payload: WorkflowResumeRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['workflow.resume']>>
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
  getKeyspaceActivity: (
    payload: KeyspaceActivityRequest,
  ) => Promise<IpcResponseEnvelope<QueryResultMap['observability.keyspaceActivity']>>
  getFailedOperationDrilldown: (
    payload: FailedOperationDrilldownRequest,
  ) => Promise<
    IpcResponseEnvelope<QueryResultMap['observability.failedOperations']>
  >
  comparePeriods: (
    payload: ComparePeriodsRequest,
  ) => Promise<IpcResponseEnvelope<QueryResultMap['observability.comparePeriods']>>
  previewIncidentBundle: (
    payload: IncidentBundlePreviewRequest,
  ) => Promise<IpcResponseEnvelope<QueryResultMap['incident.bundle.preview']>>
  listIncidentBundles: (
    payload: IncidentBundleListRequest,
  ) => Promise<IpcResponseEnvelope<QueryResultMap['incident.bundle.list']>>
  exportIncidentBundle: (
    payload: IncidentBundleExportRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['incident.bundle.export']>>
  listAlerts: (
    payload: AlertListRequest,
  ) => Promise<IpcResponseEnvelope<QueryResultMap['alert.list']>>
  markAlertRead: (
    payload: AlertMarkReadRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['alert.markRead']>>
  listAlertRules: () => Promise<IpcResponseEnvelope<QueryResultMap['alert.rule.list']>>
  createAlertRule: (
    payload: AlertRuleCreateRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['alert.rule.create']>>
  updateAlertRule: (
    payload: AlertRuleUpdateRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['alert.rule.update']>>
  deleteAlertRule: (
    payload: AlertRuleDeleteRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['alert.rule.delete']>>
  listPolicyPacks: () => Promise<IpcResponseEnvelope<QueryResultMap['policy.pack.list']>>
  createPolicyPack: (
    payload: GovernancePolicyPackCreateRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['policy.pack.create']>>
  updatePolicyPack: (
    payload: GovernancePolicyPackUpdateRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['policy.pack.update']>>
  deletePolicyPack: (
    payload: GovernancePolicyPackDeleteRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['policy.pack.delete']>>
  assignPolicyPack: (
    payload: GovernanceAssignmentRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['policy.pack.assign']>>
  listPolicyPackAssignments: (
    payload: GovernanceAssignmentListRequest,
  ) => Promise<IpcResponseEnvelope<QueryResultMap['policy.pack.assignment.list']>>
  listRetentionPolicies: () => Promise<
    IpcResponseEnvelope<QueryResultMap['retention.policy.list']>
  >
  updateRetentionPolicy: (
    payload: RetentionPolicyUpdateRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['retention.policy.update']>>
  purgeRetentionData: (
    payload: RetentionPurgeRequest,
  ) => Promise<IpcResponseEnvelope<CommandResultMap['retention.purge']>>
  getStorageSummary: () => Promise<IpcResponseEnvelope<QueryResultMap['storage.summary']>>
}
