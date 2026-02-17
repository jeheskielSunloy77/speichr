import { ipcRenderer } from 'electron'

import type { CachifyApi } from '../../shared/contracts/api'
import type {
  CommandPayloadMap,
  CommandResultMap,
  IpcResponseEnvelope,
  QueryPayloadMap,
  QueryResultMap,
} from '../../shared/ipc/contracts'
import {
  IPC_COMMAND_CHANNEL,
  IPC_QUERY_CHANNEL,
} from '../../shared/ipc/contracts'
import {
  commandEnvelopeSchema,
  queryEnvelopeSchema,
} from '../schemas/ipc'

const createCorrelationId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const invokeCommand = async <TCommand extends keyof CommandPayloadMap>(
  command: TCommand,
  payload: CommandPayloadMap[TCommand],
): Promise<IpcResponseEnvelope<CommandResultMap[TCommand]>> => {
  const envelope = commandEnvelopeSchema.parse({
    command,
    payload,
    correlationId: createCorrelationId(),
  })

  return ipcRenderer.invoke(IPC_COMMAND_CHANNEL, envelope)
}

const invokeQuery = async <TQuery extends keyof QueryPayloadMap>(
  query: TQuery,
  payload: QueryPayloadMap[TQuery],
): Promise<IpcResponseEnvelope<QueryResultMap[TQuery]>> => {
  const envelope = queryEnvelopeSchema.parse({
    query,
    payload,
    correlationId: createCorrelationId(),
  })

  return ipcRenderer.invoke(IPC_QUERY_CHANNEL, envelope)
}

export const cachifyApi: CachifyApi = {
  listConnections: () => invokeQuery('connection.list', {}),
  getConnection: (payload) => invokeQuery('connection.get', payload),
  createConnection: (payload) => invokeCommand('connection.create', payload),
  updateConnection: (payload) => invokeCommand('connection.update', payload),
  deleteConnection: (payload) => invokeCommand('connection.delete', payload),
  testConnection: (payload) => invokeCommand('connection.test', payload),
  getCapabilities: (payload) => invokeQuery('provider.capabilities', payload),
  listKeys: (payload) => invokeQuery('key.list', payload),
  searchKeys: (payload) => invokeQuery('key.search', payload),
  getKey: (payload) => invokeQuery('key.get', payload),
  setKey: (payload) => invokeCommand('key.set', payload),
  deleteKey: (payload) => invokeCommand('key.delete', payload),
  listSnapshots: (payload) => invokeQuery('snapshot.list', payload),
  restoreSnapshot: (payload) => invokeCommand('rollback.restore', payload),
  listWorkflowTemplates: () => invokeQuery('workflow.template.list', {}),
  createWorkflowTemplate: (payload) =>
    invokeCommand('workflow.template.create', payload),
  updateWorkflowTemplate: (payload) =>
    invokeCommand('workflow.template.update', payload),
  deleteWorkflowTemplate: (payload) =>
    invokeCommand('workflow.template.delete', payload),
  previewWorkflow: (payload) => invokeQuery('workflow.preview', payload),
  executeWorkflow: (payload) => invokeCommand('workflow.execute', payload),
  rerunWorkflow: (payload) => invokeCommand('workflow.rerun', payload),
  listWorkflowExecutions: (payload) =>
    invokeQuery('workflow.execution.list', payload),
  getWorkflowExecution: (payload) =>
    invokeQuery('workflow.execution.get', payload),
  listHistory: (payload) => invokeQuery('history.list', payload),
  getObservabilityDashboard: (payload) =>
    invokeQuery('observability.dashboard', payload),
  listAlerts: (payload) => invokeQuery('alert.list', payload),
  markAlertRead: (payload) => invokeCommand('alert.markRead', payload),
}
