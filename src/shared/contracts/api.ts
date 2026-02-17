import type {
  ConnectionCapabilitiesRequest,
  ConnectionCreateRequest,
  ConnectionDeleteRequest,
  ConnectionGetRequest,
  ConnectionTestRequest,
  ConnectionUpdateRequest,
  KeyDeleteRequest,
  KeyGetRequest,
  KeyListRequest,
  KeySearchRequest,
  KeySetRequest,
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
}
