import { describe, expect, it, vi } from 'vitest'

import type { ConnectionProfile } from '../../../shared/contracts/cache'
import type { CacheGateway, ConnectionRepository } from '../../application/ports'
import { ProviderEngineEventIngestor } from './provider-engine-event-ingestor'

const createProfile = (
  id: string,
  engine: ConnectionProfile['engine'],
): ConnectionProfile => ({
  id,
  name: id,
  engine,
  host: '127.0.0.1',
  port: engine === 'redis' ? 6379 : 11211,
  dbIndex: engine === 'redis' ? 0 : undefined,
  tlsEnabled: false,
  environment: 'dev',
  tags: [],
  secretRef: id,
  readOnly: false,
  timeoutMs: 5000,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

describe('ProviderEngineEventIngestor', () => {
  it('checks provider capabilities for known profiles on start', async () => {
    const connectionRepository: ConnectionRepository = {
      list: vi.fn(async () => [
        createProfile('redis-1', 'redis'),
        createProfile('mem-1', 'memcached'),
      ]),
      findById: vi.fn(async () => null),
      save: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    }

    const cacheGateway: CacheGateway = {
      testConnection: vi.fn(async () => {
        throw new Error('not needed')
      }),
      getCapabilities: vi.fn(() => ({
        supportsTTL: true,
        supportsMonitorStream: false,
        supportsSlowLog: false,
        supportsBulkDeletePreview: false,
        supportsSnapshotRestore: false,
        supportsPatternScan: true,
      })),
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

    const ingestor = new ProviderEngineEventIngestor(
      connectionRepository,
      cacheGateway,
    )

    await ingestor.start({
      onEvent: async () => undefined,
    })

    expect(connectionRepository.list).toHaveBeenCalledTimes(1)
    expect(cacheGateway.getCapabilities).toHaveBeenCalledTimes(2)
  })
})
