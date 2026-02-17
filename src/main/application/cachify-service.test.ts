import { describe, expect, it, vi } from 'vitest'

import type {
  ConnectionCreateRequest,
  ConnectionProfile,
  ConnectionSecret,
  ProviderCapabilities,
} from '../../shared/contracts/cache'

import { OperationFailure } from '../domain/operation-failure'
import { CachifyService } from './cachify-service'
import type {
  CacheGateway,
  ConnectionRepository,
  MemcachedKeyIndexRepository,
  SecretStore,
} from './ports'

class InMemoryConnectionRepository implements ConnectionRepository {
  private readonly map = new Map<string, ConnectionProfile>()

  public async list(): Promise<ConnectionProfile[]> {
    return Array.from(this.map.values())
  }

  public async findById(id: string): Promise<ConnectionProfile | null> {
    return this.map.get(id) ?? null
  }

  public async save(profile: ConnectionProfile): Promise<void> {
    this.map.set(profile.id, profile)
  }

  public async delete(id: string): Promise<void> {
    this.map.delete(id)
  }
}

class InMemorySecretStore implements SecretStore {
  public readonly map = new Map<string, ConnectionSecret>()

  public async saveSecret(
    profileId: string,
    secret: ConnectionSecret,
  ): Promise<void> {
    this.map.set(profileId, secret)
  }

  public async getSecret(profileId: string): Promise<ConnectionSecret> {
    const secret = this.map.get(profileId)
    if (!secret) {
      throw new Error('missing secret')
    }

    return secret
  }

  public async deleteSecret(profileId: string): Promise<void> {
    this.map.delete(profileId)
  }
}

class InMemoryMemcachedIndexRepository
  implements MemcachedKeyIndexRepository
{
  public async listKeys(
    connectionId: string,
    limit: number,
  ): Promise<string[]> {
    void connectionId
    void limit
    return []
  }

  public async searchKeys(
    connectionId: string,
    pattern: string,
    limit: number,
    cursor?: string,
  ): Promise<string[]> {
    void connectionId
    void pattern
    void limit
    void cursor
    return []
  }

  public async upsertKey(connectionId: string, key: string): Promise<void> {
    void connectionId
    void key
  }

  public async removeKey(connectionId: string, key: string): Promise<void> {
    void connectionId
    void key
  }

  public async deleteByConnectionId(connectionId: string): Promise<void> {
    void connectionId
  }
}

const capabilities: ProviderCapabilities = {
  supportsTTL: true,
  supportsMonitorStream: false,
  supportsSlowLog: false,
  supportsBulkDeletePreview: false,
  supportsSnapshotRestore: false,
  supportsPatternScan: true,
}

const createGatewayMock = (overrides?: Partial<CacheGateway>): CacheGateway => {
  const base: CacheGateway = {
    testConnection: vi.fn(async () => ({ latencyMs: 5, capabilities })),
    getCapabilities: vi.fn(() => capabilities),
    listKeys: vi.fn(async () => ({ keys: [], nextCursor: undefined })),
    searchKeys: vi.fn(async () => ({ keys: [], nextCursor: undefined })),
    getValue: vi.fn(async (profile, _secret, key) => ({
      key,
      value: null,
      ttlSeconds: null,
      supportsTTL: profile.engine === 'redis',
    })),
    setValue: vi.fn(async () => undefined),
    deleteKey: vi.fn(async () => undefined),
  }

  return {
    ...base,
    ...overrides,
  }
}

const createConnectionPayload = (): ConnectionCreateRequest => ({
  profile: {
    name: 'local redis',
    engine: 'redis',
    host: '127.0.0.1',
    port: 6379,
    dbIndex: 0,
    tlsEnabled: false,
    environment: 'dev',
    tags: ['local'],
    readOnly: false,
    forceReadOnly: false,
    timeoutMs: 5000,
    retryMaxAttempts: 2,
    retryBackoffMs: 10,
    retryBackoffStrategy: 'fixed',
    retryAbortOnErrorRate: 1,
  },
  secret: {
    password: 'secret',
  },
})

const createStoredProfile = (): ConnectionProfile => ({
  id: 'stored-1',
  name: 'stored redis',
  engine: 'redis',
  host: '127.0.0.1',
  port: 6379,
  dbIndex: 0,
  tlsEnabled: false,
  environment: 'dev',
  tags: [],
  secretRef: 'stored-1',
  readOnly: false,
  forceReadOnly: false,
  timeoutMs: 5000,
  retryMaxAttempts: 2,
  retryBackoffMs: 10,
  retryBackoffStrategy: 'fixed',
  retryAbortOnErrorRate: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

describe('CachifyService', () => {
  it('creates and stores connection profiles with keychain references', async () => {
    const repository = new InMemoryConnectionRepository()
    const secretStore = new InMemorySecretStore()
    const memcachedIndex = new InMemoryMemcachedIndexRepository()
    const gateway = createGatewayMock()

    const service = new CachifyService(
      repository,
      secretStore,
      memcachedIndex,
      gateway,
    )

    const created = await service.createConnection(createConnectionPayload())

    expect(created.id).toBeTruthy()
    expect(created.secretRef).toBe(created.id)

    const stored = await repository.findById(created.id)
    expect(stored?.name).toBe('local redis')
    expect(secretStore.map.get(created.id)?.password).toBe('secret')
  })

  it('blocks writes on read-only profiles', async () => {
    const repository = new InMemoryConnectionRepository()
    const secretStore = new InMemorySecretStore()
    const memcachedIndex = new InMemoryMemcachedIndexRepository()
    const setValueMock = vi.fn(async () => undefined)
    const gateway = createGatewayMock({ setValue: setValueMock })

    const profile: ConnectionProfile = {
      id: 'readonly-1',
      name: 'readonly redis',
      engine: 'redis',
      host: '127.0.0.1',
      port: 6379,
      dbIndex: 0,
      tlsEnabled: false,
      environment: 'dev',
      tags: [],
      secretRef: 'readonly-1',
      readOnly: true,
      forceReadOnly: false,
      timeoutMs: 5000,
      retryMaxAttempts: 2,
      retryBackoffMs: 10,
      retryBackoffStrategy: 'fixed',
      retryAbortOnErrorRate: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await repository.save(profile)
    await secretStore.saveSecret(profile.id, { password: 'secret' })

    const service = new CachifyService(
      repository,
      secretStore,
      memcachedIndex,
      gateway,
    )

    await expect(
      service.setKey({
        connectionId: profile.id,
        key: 'test:key',
        value: 'value',
      }),
    ).rejects.toBeInstanceOf(OperationFailure)

    expect(setValueMock).not.toHaveBeenCalled()
  })

  it('rolls back metadata when secret storage fails during create', async () => {
    const repository = new InMemoryConnectionRepository()
    const memcachedIndex = new InMemoryMemcachedIndexRepository()
    const gateway = createGatewayMock()
    const secretStore: SecretStore = {
      saveSecret: vi.fn(async () => {
        throw new Error('keychain unavailable')
      }),
      getSecret: vi.fn(async () => ({ password: 'secret' })),
      deleteSecret: vi.fn(async () => undefined),
    }

    const service = new CachifyService(
      repository,
      secretStore,
      memcachedIndex,
      gateway,
    )

    await expect(service.createConnection(createConnectionPayload())).rejects.toEqual(
      expect.objectContaining({
        name: 'OperationFailure',
        code: 'INTERNAL_ERROR',
      }),
    )

    const profiles = await repository.list()
    expect(profiles).toHaveLength(0)
  })

  it('uses stored secret for edit-mode connection tests when secret input is blank', async () => {
    const repository = new InMemoryConnectionRepository()
    const secretStore = new InMemorySecretStore()
    const memcachedIndex = new InMemoryMemcachedIndexRepository()
    const testConnectionMock = vi.fn(async () => ({ latencyMs: 7, capabilities }))
    const gateway = createGatewayMock({ testConnection: testConnectionMock })
    const storedProfile = createStoredProfile()

    await repository.save(storedProfile)
    await secretStore.saveSecret(storedProfile.id, {
      username: 'stored-user',
      password: 'stored-pass',
    })

    const service = new CachifyService(
      repository,
      secretStore,
      memcachedIndex,
      gateway,
    )

    await service.testConnection({
      connectionId: storedProfile.id,
      profile: createConnectionPayload().profile,
      secret: {},
    })

    expect(testConnectionMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        username: 'stored-user',
        password: 'stored-pass',
      }),
    )
  })

  it('overlays provided edit-mode test secret fields on top of stored secret', async () => {
    const repository = new InMemoryConnectionRepository()
    const secretStore = new InMemorySecretStore()
    const memcachedIndex = new InMemoryMemcachedIndexRepository()
    const testConnectionMock = vi.fn(async () => ({ latencyMs: 9, capabilities }))
    const gateway = createGatewayMock({ testConnection: testConnectionMock })
    const storedProfile = createStoredProfile()

    await repository.save(storedProfile)
    await secretStore.saveSecret(storedProfile.id, {
      username: 'stored-user',
      password: 'stored-pass',
      token: 'stored-token',
    })

    const service = new CachifyService(
      repository,
      secretStore,
      memcachedIndex,
      gateway,
    )

    await service.testConnection({
      connectionId: storedProfile.id,
      profile: createConnectionPayload().profile,
      secret: {
        password: 'override-pass',
      },
    })

    expect(testConnectionMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        username: 'stored-user',
        password: 'override-pass',
        token: 'stored-token',
      }),
    )
  })

  it('blocks writes when forced read-only policy is enabled', async () => {
    const repository = new InMemoryConnectionRepository()
    const secretStore = new InMemorySecretStore()
    const memcachedIndex = new InMemoryMemcachedIndexRepository()
    const setValueMock = vi.fn(async () => undefined)
    const gateway = createGatewayMock({ setValue: setValueMock })

    const profile: ConnectionProfile = {
      ...createStoredProfile(),
      id: 'forced-ro-1',
      secretRef: 'forced-ro-1',
      forceReadOnly: true,
    }

    await repository.save(profile)
    await secretStore.saveSecret(profile.id, { password: 'secret' })

    const service = new CachifyService(
      repository,
      secretStore,
      memcachedIndex,
      gateway,
    )

    await expect(
      service.setKey({
        connectionId: profile.id,
        key: 'blocked:key',
        value: 'value',
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'UNAUTHORIZED',
      }),
    )
    expect(setValueMock).not.toHaveBeenCalled()
  })

  it('enforces prod guardrail for destructive deletes', async () => {
    const repository = new InMemoryConnectionRepository()
    const secretStore = new InMemorySecretStore()
    const memcachedIndex = new InMemoryMemcachedIndexRepository()
    const deleteKeyMock = vi.fn(async () => undefined)
    const gateway = createGatewayMock({ deleteKey: deleteKeyMock })

    const profile: ConnectionProfile = {
      ...createStoredProfile(),
      id: 'prod-1',
      environment: 'prod',
      secretRef: 'prod-1',
    }

    await repository.save(profile)
    await secretStore.saveSecret(profile.id, { password: 'secret' })

    const service = new CachifyService(
      repository,
      secretStore,
      memcachedIndex,
      gateway,
    )

    await expect(
      service.deleteKey({
        connectionId: profile.id,
        key: 'prod:key',
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'UNAUTHORIZED',
      }),
    )

    expect(deleteKeyMock).not.toHaveBeenCalled()

    await expect(
      service.deleteKey({
        connectionId: profile.id,
        key: 'prod:key',
        guardrailConfirmed: true,
      }),
    ).resolves.toEqual({
      success: true,
    })

    expect(deleteKeyMock).toHaveBeenCalledTimes(1)
  })

  it('restores keys from latest snapshot records', async () => {
    const repository = new InMemoryConnectionRepository()
    const secretStore = new InMemorySecretStore()
    const memcachedIndex = new InMemoryMemcachedIndexRepository()
    const setValueMock = vi.fn(async () => undefined)
    const getValueMock = vi
      .fn()
      .mockResolvedValueOnce({
        key: 'user:1',
        value: 'old-value',
        ttlSeconds: 120,
        supportsTTL: true,
      })
      .mockResolvedValueOnce({
        key: 'user:1',
        value: 'current-value',
        ttlSeconds: 90,
        supportsTTL: true,
      })
    const gateway = createGatewayMock({
      getValue: getValueMock,
      setValue: setValueMock,
    })

    const profile: ConnectionProfile = {
      ...createStoredProfile(),
      id: 'rollback-1',
      secretRef: 'rollback-1',
    }

    await repository.save(profile)
    await secretStore.saveSecret(profile.id, { password: 'secret' })

    const service = new CachifyService(
      repository,
      secretStore,
      memcachedIndex,
      gateway,
    )

    await service.setKey({
      connectionId: profile.id,
      key: 'user:1',
      value: 'new-value',
      ttlSeconds: 30,
    })

    await service.restoreSnapshot({
      connectionId: profile.id,
      key: 'user:1',
    })

    expect(setValueMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({
        key: 'user:1',
        value: 'old-value',
        ttlSeconds: 120,
      }),
    )
  })

  it('executes workflow dry-runs without mutating keys and stores execution records', async () => {
    const repository = new InMemoryConnectionRepository()
    const secretStore = new InMemorySecretStore()
    const memcachedIndex = new InMemoryMemcachedIndexRepository()
    const deleteKeyMock = vi.fn(async () => undefined)
    const searchKeysMock = vi.fn(async () => ({
      keys: ['session:1', 'session:2'],
      nextCursor: undefined,
    }))
    const gateway = createGatewayMock({
      deleteKey: deleteKeyMock,
      searchKeys: searchKeysMock,
    })

    const profile: ConnectionProfile = {
      ...createStoredProfile(),
      id: 'workflow-1',
      secretRef: 'workflow-1',
    }

    await repository.save(profile)
    await secretStore.saveSecret(profile.id, { password: 'secret' })

    const service = new CachifyService(
      repository,
      secretStore,
      memcachedIndex,
      gateway,
    )

    const execution = await service.executeWorkflow({
      connectionId: profile.id,
      template: {
        name: 'Delete sessions',
        kind: 'deleteByPattern',
        parameters: {
          pattern: 'session:*',
          limit: 50,
        },
        requiresApprovalOnProd: true,
        supportsDryRun: true,
      },
      dryRun: true,
    })

    expect(execution.status).toBe('success')
    expect(execution.dryRun).toBe(true)
    expect(deleteKeyMock).not.toHaveBeenCalled()

    const history = await service.listWorkflowExecutions({
      connectionId: profile.id,
      limit: 20,
    })

    expect(history).toHaveLength(1)
    expect(history[0].id).toBe(execution.id)
  })

  it('creates policy alerts for blocked operations', async () => {
    const repository = new InMemoryConnectionRepository()
    const secretStore = new InMemorySecretStore()
    const memcachedIndex = new InMemoryMemcachedIndexRepository()
    const gateway = createGatewayMock()

    const profile: ConnectionProfile = {
      ...createStoredProfile(),
      id: 'alert-1',
      secretRef: 'alert-1',
      forceReadOnly: true,
    }

    await repository.save(profile)
    await secretStore.saveSecret(profile.id, { password: 'secret' })

    const service = new CachifyService(
      repository,
      secretStore,
      memcachedIndex,
      gateway,
    )

    await expect(
      service.setKey({
        connectionId: profile.id,
        key: 'alert:key',
        value: 'value',
      }),
    ).rejects.toBeInstanceOf(OperationFailure)

    const alerts = await service.listAlerts({ limit: 20, unreadOnly: false })
    expect(alerts.length).toBeGreaterThan(0)
    expect(alerts[0].source).toBe('policy')
  })
})
