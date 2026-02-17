import { v4 as uuidv4 } from 'uuid'

import type {
  ConnectionCapabilitiesRequest,
  ConnectionCreateRequest,
  ConnectionDeleteRequest,
  ConnectionGetRequest,
  ConnectionProfile,
  ConnectionTestRequest,
  ConnectionUpdateRequest,
  KeyDeleteRequest,
  KeyGetRequest,
  KeyListRequest,
  KeyListResult,
  KeySearchRequest,
  KeySetRequest,
  KeyValueRecord,
  MutationResult,
  ProviderCapabilities,
} from '../../shared/contracts/cache'

import { OperationFailure } from '../domain/operation-failure'
import { assertConnectionWritable } from '../policies/read-only-policy'
import type {
  CacheGateway,
  ConnectionRepository,
  MemcachedKeyIndexRepository,
  SecretStore,
} from './ports'

export class CachifyService {
  public constructor(
    private readonly connectionRepository: ConnectionRepository,
    private readonly secretStore: SecretStore,
    private readonly memcachedKeyIndexRepository: MemcachedKeyIndexRepository,
    private readonly cacheGateway: CacheGateway,
  ) {}

  public async listConnections(): Promise<ConnectionProfile[]> {
    return this.connectionRepository.list()
  }

  public async getConnection(
    payload: ConnectionGetRequest,
  ): Promise<ConnectionProfile> {
    const profile = await this.connectionRepository.findById(payload.id)

    if (!profile) {
      throw new OperationFailure(
        'VALIDATION_ERROR',
        'Connection profile was not found.',
        false,
        { id: payload.id },
      )
    }

    return profile
  }

  public async createConnection(
    payload: ConnectionCreateRequest,
  ): Promise<ConnectionProfile> {
    const now = new Date().toISOString()
    const normalizedProfile = normalizeDraft(payload.profile)
    const id = uuidv4()

    const profile: ConnectionProfile = {
      id,
      ...normalizedProfile,
      secretRef: id,
      createdAt: now,
      updatedAt: now,
    }

    let profileSaved = false
    try {
      await this.connectionRepository.save(profile)
      profileSaved = true
      await this.secretStore.saveSecret(profile.id, payload.secret)

      return profile
    } catch (error) {
      let rollbackSucceeded = false

      if (profileSaved) {
        try {
          await this.connectionRepository.delete(profile.id)
          rollbackSucceeded = true
        } catch (rollbackError) {
          void rollbackError
        }
      }

      throw new OperationFailure(
        'INTERNAL_ERROR',
        'Connection profile could not be saved securely. Please try again.',
        false,
        {
          rollbackAttempted: profileSaved,
          rollbackSucceeded: profileSaved ? rollbackSucceeded : undefined,
          stage: profileSaved ? 'secret-store' : 'metadata-store',
          cause: error instanceof Error ? error.message : 'unknown',
        },
      )
    }
  }

  public async updateConnection(
    payload: ConnectionUpdateRequest,
  ): Promise<ConnectionProfile> {
    const existing = await this.connectionRepository.findById(payload.id)

    if (!existing) {
      throw new OperationFailure(
        'VALIDATION_ERROR',
        'Connection profile was not found.',
        false,
        { id: payload.id },
      )
    }

    const normalizedProfile = normalizeDraft(payload.profile)

    const profile: ConnectionProfile = {
      ...existing,
      ...normalizedProfile,
      updatedAt: new Date().toISOString(),
    }

    await this.connectionRepository.save(profile)

    if (payload.secret) {
      await this.secretStore.saveSecret(profile.id, payload.secret)
    }

    return profile
  }

  public async deleteConnection(
    payload: ConnectionDeleteRequest,
  ): Promise<MutationResult> {
    await this.connectionRepository.delete(payload.id)
    await this.secretStore.deleteSecret(payload.id)
    await this.memcachedKeyIndexRepository.deleteByConnectionId(payload.id)

    return {
      success: true,
    }
  }

  public async testConnection(
    payload: ConnectionTestRequest,
  ): Promise<{ latencyMs: number; capabilities: ProviderCapabilities }> {
    const normalizedProfile = normalizeDraft(payload.profile)
    const resolvedSecret = await this.resolveTestSecret(payload)

    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.cacheGateway.testConnection(
          normalizedProfile,
          resolvedSecret,
        )
      } catch (error) {
        lastError = error
      }
    }

    if (lastError instanceof OperationFailure) {
      throw lastError
    }

    throw new OperationFailure(
      'CONNECTION_FAILED',
      'Connection test failed after retry.',
      true,
    )
  }

  public async getCapabilities(
    payload: ConnectionCapabilitiesRequest,
  ): Promise<ProviderCapabilities> {
    const profile = await this.requireConnection(payload.connectionId)
    return this.cacheGateway.getCapabilities(profile)
  }

  public async listKeys(payload: KeyListRequest): Promise<KeyListResult> {
    const { profile, secret } = await this.requireProfileWithSecret(
      payload.connectionId,
    )

    return this.cacheGateway.listKeys(profile, secret, {
      cursor: payload.cursor,
      limit: payload.limit,
    })
  }

  public async searchKeys(payload: KeySearchRequest): Promise<KeyListResult> {
    const { profile, secret } = await this.requireProfileWithSecret(
      payload.connectionId,
    )

    return this.cacheGateway.searchKeys(profile, secret, {
      pattern: payload.pattern,
      cursor: payload.cursor,
      limit: payload.limit,
    })
  }

  public async getKey(payload: KeyGetRequest): Promise<KeyValueRecord> {
    const { profile, secret } = await this.requireProfileWithSecret(
      payload.connectionId,
    )

    return this.cacheGateway.getValue(profile, secret, payload.key)
  }

  public async setKey(payload: KeySetRequest): Promise<MutationResult> {
    const { profile, secret } = await this.requireProfileWithSecret(
      payload.connectionId,
    )
    assertConnectionWritable(profile)

    await this.cacheGateway.setValue(profile, secret, {
      key: payload.key,
      value: payload.value,
      ttlSeconds: payload.ttlSeconds,
    })

    return {
      success: true,
    }
  }

  public async deleteKey(payload: KeyDeleteRequest): Promise<MutationResult> {
    const { profile, secret } = await this.requireProfileWithSecret(
      payload.connectionId,
    )
    assertConnectionWritable(profile)

    await this.cacheGateway.deleteKey(profile, secret, payload.key)

    return {
      success: true,
    }
  }

  private async requireConnection(id: string): Promise<ConnectionProfile> {
    const profile = await this.connectionRepository.findById(id)

    if (!profile) {
      throw new OperationFailure(
        'VALIDATION_ERROR',
        'Connection profile was not found.',
        false,
        { id },
      )
    }

    return profile
  }

  private async requireProfileWithSecret(
    id: string,
  ): Promise<{
    profile: ConnectionProfile
    secret: ConnectionCreateRequest['secret']
  }> {
    const profile = await this.requireConnection(id)
    const secret = await this.secretStore.getSecret(id)

    return {
      profile,
      secret,
    }
  }

  private async resolveTestSecret(
    payload: ConnectionTestRequest,
  ): Promise<ConnectionCreateRequest['secret']> {
    if (!payload.connectionId) {
      return payload.secret
    }

    await this.requireConnection(payload.connectionId)
    const storedSecret = await this.secretStore.getSecret(payload.connectionId)

    return mergeSecretOverlay(storedSecret, payload.secret)
  }
}

const normalizeDraft = (
  draft: ConnectionCreateRequest['profile'],
): Omit<
  ConnectionProfile,
  'id' | 'secretRef' | 'createdAt' | 'updatedAt'
> => ({
  name: draft.name.trim(),
  engine: draft.engine,
  host: draft.host.trim(),
  port: draft.port,
  dbIndex: draft.engine === 'redis' ? draft.dbIndex : undefined,
  tlsEnabled: draft.tlsEnabled,
  environment: draft.environment,
  tags: normalizeTags(draft.tags),
  readOnly: draft.readOnly,
  timeoutMs: draft.timeoutMs || 5000,
})

const normalizeTags = (tags: string[]): string[] => {
  const normalized = tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)

  return Array.from(new Set(normalized))
}

const mergeSecretOverlay = (
  baseSecret: ConnectionCreateRequest['secret'],
  secretOverlay: ConnectionCreateRequest['secret'],
): ConnectionCreateRequest['secret'] => ({
  username:
    secretOverlay.username === undefined
      ? baseSecret.username
      : secretOverlay.username,
  password:
    secretOverlay.password === undefined
      ? baseSecret.password
      : secretOverlay.password,
  token: secretOverlay.token === undefined ? baseSecret.token : secretOverlay.token,
})
