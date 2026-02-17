import { Client as MemjsClient } from 'memjs'
import { createClient, type RedisClientType } from 'redis'

import type {
  ConnectionDraft,
  ConnectionProfile,
  ConnectionSecret,
  ConnectionTestResult,
  KeyListResult,
  KeyValueRecord,
  ProviderCapabilities,
} from '../../../shared/contracts/cache'

import type {
  CacheGateway,
  MemcachedKeyIndexRepository,
} from '../../application/ports'
import { OperationFailure } from '../../domain/operation-failure'

const REDIS_CAPABILITIES: ProviderCapabilities = {
  supportsTTL: true,
  supportsMonitorStream: false,
  supportsSlowLog: false,
  supportsBulkDeletePreview: false,
  supportsSnapshotRestore: false,
  supportsPatternScan: true,
}

const MEMCACHED_CAPABILITIES: ProviderCapabilities = {
  supportsTTL: true,
  supportsMonitorStream: false,
  supportsSlowLog: false,
  supportsBulkDeletePreview: false,
  supportsSnapshotRestore: false,
  supportsPatternScan: true,
}

const MAX_SCAN_LOOP = 25

type EngineConnection = Pick<
  ConnectionProfile,
  'engine' | 'host' | 'port' | 'dbIndex' | 'tlsEnabled' | 'timeoutMs'
>

export class DefaultCacheGateway implements CacheGateway {
  public constructor(
    private readonly memcachedIndexRepository: MemcachedKeyIndexRepository,
  ) {}

  public getCapabilities(
    profile: Pick<ConnectionProfile, 'engine'>,
  ): ProviderCapabilities {
    return profile.engine === 'redis'
      ? REDIS_CAPABILITIES
      : MEMCACHED_CAPABILITIES
  }

  public async testConnection(
    profile: ConnectionDraft,
    secret: ConnectionSecret,
  ): Promise<ConnectionTestResult> {
    if (profile.engine === 'redis') {
      return this.testRedisConnection(profile, secret)
    }

    return this.testMemcachedConnection(profile, secret)
  }

  public async listKeys(
    profile: ConnectionProfile,
    secret: ConnectionSecret,
    args: { cursor?: string; limit: number },
  ): Promise<KeyListResult> {
    if (profile.engine === 'redis') {
      return this.redisListKeys(profile, secret, args)
    }

    const keys = await this.memcachedIndexRepository.listKeys(profile.id, args.limit)

    return {
      keys,
      nextCursor: undefined,
    }
  }

  public async searchKeys(
    profile: ConnectionProfile,
    secret: ConnectionSecret,
    args: { pattern: string; limit: number; cursor?: string },
  ): Promise<KeyListResult> {
    if (profile.engine === 'redis') {
      return this.redisSearchKeys(profile, secret, args)
    }

    const keys = await this.memcachedIndexRepository.searchKeys(
      profile.id,
      args.pattern,
      args.limit,
      args.cursor,
    )
    const nextCursor =
      keys.length === args.limit && keys.length > 0
        ? keys[keys.length - 1]
        : undefined

    return {
      keys,
      nextCursor,
    }
  }

  public async getValue(
    profile: ConnectionProfile,
    secret: ConnectionSecret,
    key: string,
  ): Promise<KeyValueRecord> {
    if (profile.engine === 'redis') {
      return this.redisGetValue(profile, secret, key)
    }

    const client = this.createMemcachedClient(profile, secret)
    try {
      const result = await client.get(key)
      await this.memcachedIndexRepository.upsertKey(profile.id, key)

      const rawValue = result.value
      const value = rawValue ? rawValue.toString('utf8') : null

      return {
        key,
        value,
        ttlSeconds: null,
        supportsTTL: true,
      }
    } catch (error) {
      throw this.toConnectionFailure(error)
    } finally {
      client.quit()
    }
  }

  public async setValue(
    profile: ConnectionProfile,
    secret: ConnectionSecret,
    args: { key: string; value: string; ttlSeconds?: number },
  ): Promise<void> {
    if (profile.engine === 'redis') {
      await this.redisSetValue(profile, secret, args)
      return
    }

    const client = this.createMemcachedClient(profile, secret)
    try {
      await client.set(args.key, args.value, {
        expires: args.ttlSeconds ?? 0,
      })
      await this.memcachedIndexRepository.upsertKey(profile.id, args.key)
    } catch (error) {
      throw this.toConnectionFailure(error)
    } finally {
      client.quit()
    }
  }

  public async deleteKey(
    profile: ConnectionProfile,
    secret: ConnectionSecret,
    key: string,
  ): Promise<void> {
    if (profile.engine === 'redis') {
      await this.redisDeleteKey(profile, secret, key)
      return
    }

    const client = this.createMemcachedClient(profile, secret)
    try {
      await client.delete(key)
      await this.memcachedIndexRepository.removeKey(profile.id, key)
    } catch (error) {
      throw this.toConnectionFailure(error)
    } finally {
      client.quit()
    }
  }

  private async testRedisConnection(
    profile: EngineConnection,
    secret: ConnectionSecret,
  ): Promise<ConnectionTestResult> {
    const client = this.createRedisClient(profile, secret)
    const startedAt = Date.now()

    try {
      await client.connect()
      await client.ping()

      return {
        latencyMs: Date.now() - startedAt,
        capabilities: REDIS_CAPABILITIES,
      }
    } catch (error) {
      throw this.toConnectionFailure(error)
    } finally {
      await this.disconnectRedisClient(client)
    }
  }

  private async testMemcachedConnection(
    profile: EngineConnection,
    secret: ConnectionSecret,
  ): Promise<ConnectionTestResult> {
    const client = this.createMemcachedClient(profile, secret)
    const startedAt = Date.now()

    try {
      await client.get('__cachify_healthcheck__')

      return {
        latencyMs: Date.now() - startedAt,
        capabilities: MEMCACHED_CAPABILITIES,
      }
    } catch (error) {
      throw this.toConnectionFailure(error)
    } finally {
      client.quit()
    }
  }

  private async redisListKeys(
    profile: ConnectionProfile,
    secret: ConnectionSecret,
    args: { cursor?: string; limit: number },
  ): Promise<KeyListResult> {
    const client = this.createRedisClient(profile, secret)

    try {
      await client.connect()

      const scanResult = await client.scan(args.cursor ?? '0', {
        MATCH: '*',
        COUNT: args.limit,
      })
      const nextCursor = toRedisText(scanResult.cursor)

      return {
        keys: scanResult.keys.map(toRedisText),
        nextCursor: nextCursor === '0' ? undefined : nextCursor,
      }
    } catch (error) {
      throw this.toConnectionFailure(error)
    } finally {
      await this.disconnectRedisClient(client)
    }
  }

  private async redisSearchKeys(
    profile: ConnectionProfile,
    secret: ConnectionSecret,
    args: { pattern: string; limit: number; cursor?: string },
  ): Promise<KeyListResult> {
    const client = this.createRedisClient(profile, secret)
    const keySet = new Set<string>()

    try {
      await client.connect()

      let cursor = args.cursor ?? '0'
      let loopCount = 0

      do {
        const scanResult = await client.scan(cursor, {
          MATCH: args.pattern,
          COUNT: Math.min(500, Math.max(args.limit, 50)),
        })

        scanResult.keys.forEach((key) => keySet.add(toRedisText(key)))

        cursor = toRedisText(scanResult.cursor)
        loopCount += 1
      } while (
        cursor !== '0' &&
        keySet.size < args.limit &&
        loopCount < MAX_SCAN_LOOP
      )

      return {
        keys: Array.from(keySet).slice(0, args.limit),
        nextCursor: cursor === '0' ? undefined : cursor,
      }
    } catch (error) {
      throw this.toConnectionFailure(error)
    } finally {
      await this.disconnectRedisClient(client)
    }
  }

  private async redisGetValue(
    profile: ConnectionProfile,
    secret: ConnectionSecret,
    key: string,
  ): Promise<KeyValueRecord> {
    const client = this.createRedisClient(profile, secret)

    try {
      await client.connect()

      const [value, ttl] = await Promise.all([client.get(key), client.ttl(key)])
      const ttlNumber = Number(ttl)

      return {
        key,
        value: value === null ? null : toRedisText(value),
        ttlSeconds: Number.isFinite(ttlNumber) && ttlNumber >= 0 ? ttlNumber : null,
        supportsTTL: true,
      }
    } catch (error) {
      throw this.toConnectionFailure(error)
    } finally {
      await this.disconnectRedisClient(client)
    }
  }

  private async redisSetValue(
    profile: ConnectionProfile,
    secret: ConnectionSecret,
    args: { key: string; value: string; ttlSeconds?: number },
  ): Promise<void> {
    const client = this.createRedisClient(profile, secret)

    try {
      await client.connect()
      if (typeof args.ttlSeconds === 'number') {
        await client.set(args.key, args.value, {
          EX: args.ttlSeconds,
        })
      } else {
        await client.set(args.key, args.value)
      }
    } catch (error) {
      throw this.toConnectionFailure(error)
    } finally {
      await this.disconnectRedisClient(client)
    }
  }

  private async redisDeleteKey(
    profile: ConnectionProfile,
    secret: ConnectionSecret,
    key: string,
  ): Promise<void> {
    const client = this.createRedisClient(profile, secret)

    try {
      await client.connect()
      await client.del(key)
    } catch (error) {
      throw this.toConnectionFailure(error)
    } finally {
      await this.disconnectRedisClient(client)
    }
  }

  private createRedisClient(
    profile: EngineConnection,
    secret: ConnectionSecret,
  ): RedisClientType {
    const socketBase = {
      host: profile.host,
      port: profile.port,
      connectTimeout: profile.timeoutMs,
    }

    const socket = profile.tlsEnabled
      ? {
          ...socketBase,
          tls: true as const,
        }
      : socketBase

    return createClient({
      socket,
      database: profile.dbIndex,
      username: secret.username,
      password: secret.password,
    })
  }

  private createMemcachedClient(
    profile: EngineConnection,
    secret: ConnectionSecret,
  ) {
    return MemjsClient.create(`${profile.host}:${profile.port}`, {
      username: secret.username,
      password: secret.password,
      timeout: Math.max(0.1, profile.timeoutMs / 1000),
      conntimeout: Math.max(0.2, (profile.timeoutMs * 2) / 1000),
    })
  }

  private toConnectionFailure(cause: unknown): OperationFailure {
    const message =
      cause instanceof Error
        ? cause.message
        : 'Connection operation failed unexpectedly.'

    return new OperationFailure('CONNECTION_FAILED', message, true)
  }

  private async disconnectRedisClient(client: RedisClientType): Promise<void> {
    if (!client.isOpen) {
      return
    }

    await client.disconnect().catch((error: unknown): void => {
      void error
    })
  }
}

const toRedisText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('utf8')
  }

  return String(value)
}
