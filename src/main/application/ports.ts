import type {
  ConnectionDraft,
  ConnectionProfile,
  ConnectionSecret,
  ConnectionTestResult,
  KeyListResult,
  KeyValueRecord,
  ProviderCapabilities,
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
