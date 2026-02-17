import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ConnectionProfile,
  ConnectionSecret,
} from '../../../shared/contracts/cache'
import type { MemcachedKeyIndexRepository } from '../../application/ports'
import { DefaultCacheGateway } from './cache-gateway'

const redisScanMock = vi.fn()
const redisConnectMock = vi.fn(async () => undefined)
const redisDisconnectMock = vi.fn(async () => undefined)

vi.mock('redis', () => ({
  createClient: vi.fn(() => ({
    connect: redisConnectMock,
    scan: redisScanMock,
    disconnect: redisDisconnectMock,
    isOpen: true,
  })),
}))

vi.mock('memjs', () => ({
  Client: {
    create: vi.fn(() => ({
      quit: vi.fn(),
    })),
  },
}))

const redisProfile: ConnectionProfile = {
  id: 'redis-1',
  name: 'redis',
  engine: 'redis',
  host: '127.0.0.1',
  port: 6379,
  dbIndex: 0,
  tlsEnabled: false,
  environment: 'dev',
  tags: [],
  secretRef: 'redis-1',
  readOnly: false,
  timeoutMs: 5000,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const memcachedProfile: ConnectionProfile = {
  ...redisProfile,
  id: 'mem-1',
  name: 'memcached',
  engine: 'memcached',
  port: 11211,
}

const secret: ConnectionSecret = {}

const createMemcachedRepository = (
  keys: string[],
): MemcachedKeyIndexRepository => ({
  listKeys: vi.fn(async () => []),
  searchKeys: vi.fn(async () => keys),
  upsertKey: vi.fn(async () => undefined),
  removeKey: vi.fn(async () => undefined),
  deleteByConnectionId: vi.fn(async () => undefined),
})

describe('DefaultCacheGateway search pagination', () => {
  beforeEach(() => {
    redisScanMock.mockReset()
    redisConnectMock.mockClear()
    redisDisconnectMock.mockClear()
  })

  it('returns redis nextCursor when the scan has more pages', async () => {
    redisScanMock.mockResolvedValueOnce({
      keys: ['a', 'b'],
      cursor: '23',
    })

    const gateway = new DefaultCacheGateway(createMemcachedRepository([]))

    const result = await gateway.searchKeys(redisProfile, secret, {
      pattern: 'user:*',
      limit: 2,
      cursor: '0',
    })

    expect(result.keys).toEqual(['a', 'b'])
    expect(result.nextCursor).toBe('23')
    expect(redisScanMock).toHaveBeenCalledWith('0', {
      MATCH: 'user:*',
      COUNT: 50,
    })
  })

  it('clears redis nextCursor when scan reaches terminal cursor', async () => {
    redisScanMock.mockResolvedValueOnce({
      keys: ['a'],
      cursor: '0',
    })

    const gateway = new DefaultCacheGateway(createMemcachedRepository([]))

    const result = await gateway.searchKeys(redisProfile, secret, {
      pattern: 'user:*',
      limit: 10,
      cursor: '11',
    })

    expect(result.keys).toEqual(['a'])
    expect(result.nextCursor).toBeUndefined()
    expect(redisScanMock).toHaveBeenCalledWith('11', {
      MATCH: 'user:*',
      COUNT: 50,
    })
  })

  it('returns memcached nextCursor from the last key on full pages', async () => {
    const repository = createMemcachedRepository(['k1', 'k2'])
    const gateway = new DefaultCacheGateway(repository)

    const result = await gateway.searchKeys(memcachedProfile, secret, {
      pattern: 'k*',
      limit: 2,
      cursor: 'k0',
    })

    expect(result.keys).toEqual(['k1', 'k2'])
    expect(result.nextCursor).toBe('k2')
    expect(repository.searchKeys).toHaveBeenCalledWith('mem-1', 'k*', 2, 'k0')
  })

  it('does not return memcached nextCursor when the page is incomplete', async () => {
    const repository = createMemcachedRepository(['k1'])
    const gateway = new DefaultCacheGateway(repository)

    const result = await gateway.searchKeys(memcachedProfile, secret, {
      pattern: 'k*',
      limit: 2,
      cursor: 'k0',
    })

    expect(result.keys).toEqual(['k1'])
    expect(result.nextCursor).toBeUndefined()
  })
})
