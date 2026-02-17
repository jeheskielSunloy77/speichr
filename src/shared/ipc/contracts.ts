import type {
  ConnectionCapabilitiesRequest,
  ConnectionCreateRequest,
  ConnectionDeleteRequest,
  ConnectionGetRequest,
  ConnectionProfile,
  ConnectionTestRequest,
  ConnectionTestResult,
  ConnectionUpdateRequest,
  KeyDeleteRequest,
  KeyGetRequest,
  KeyListRequest,
  KeyListResult,
  KeySearchRequest,
  KeySetRequest,
  KeyValueRecord,
  MutationResult,
  OperationErrorCode,
  ProviderCapabilities,
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

export type CachifyQuery =
  | 'connection.list'
  | 'connection.get'
  | 'provider.capabilities'
  | 'key.list'
  | 'key.search'
  | 'key.get'

export interface CommandPayloadMap {
  'connection.create': ConnectionCreateRequest
  'connection.update': ConnectionUpdateRequest
  'connection.delete': ConnectionDeleteRequest
  'connection.test': ConnectionTestRequest
  'key.set': KeySetRequest
  'key.delete': KeyDeleteRequest
}

export interface QueryPayloadMap {
  'connection.list': Record<string, never>
  'connection.get': ConnectionGetRequest
  'provider.capabilities': ConnectionCapabilitiesRequest
  'key.list': KeyListRequest
  'key.search': KeySearchRequest
  'key.get': KeyGetRequest
}

export interface CommandResultMap {
  'connection.create': ConnectionProfile
  'connection.update': ConnectionProfile
  'connection.delete': MutationResult
  'connection.test': ConnectionTestResult
  'key.set': MutationResult
  'key.delete': MutationResult
}

export interface QueryResultMap {
  'connection.list': ConnectionProfile[]
  'connection.get': ConnectionProfile
  'provider.capabilities': ProviderCapabilities
  'key.list': KeyListResult
  'key.search': KeyListResult
  'key.get': KeyValueRecord
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
