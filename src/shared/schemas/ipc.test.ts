import { describe, expect, it } from 'vitest'

import { commandEnvelopeSchema, queryEnvelopeSchema } from './ipc'

describe('commandEnvelopeSchema', () => {
  it('accepts a valid connection create payload', () => {
    const parsed = commandEnvelopeSchema.parse({
      command: 'connection.create',
      correlationId: 'abc-123',
      payload: {
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
          timeoutMs: 5000,
        },
        secret: {
          password: 'secret',
        },
      },
    })

    expect(parsed.command).toBe('connection.create')
  })

  it('rejects memcached payloads with dbIndex', () => {
    expect(() =>
      commandEnvelopeSchema.parse({
        command: 'connection.create',
        correlationId: 'abc-123',
        payload: {
          profile: {
            name: 'local memcached',
            engine: 'memcached',
            host: '127.0.0.1',
            port: 11211,
            dbIndex: 1,
            tlsEnabled: false,
            environment: 'dev',
            tags: ['local'],
            readOnly: false,
            timeoutMs: 5000,
          },
          secret: {},
        },
      }),
    ).toThrowError()
  })

  it('accepts connection tests with optional connectionId', () => {
    const parsed = commandEnvelopeSchema.parse({
      command: 'connection.test',
      correlationId: 'abc-123',
      payload: {
        connectionId: 'conn-1',
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
          timeoutMs: 5000,
        },
        secret: {},
      },
    })

    expect(parsed.command).toBe('connection.test')
    expect((parsed.payload as { connectionId?: string }).connectionId).toBe(
      'conn-1',
    )
  })
})

describe('queryEnvelopeSchema', () => {
  it('accepts a valid key lookup query', () => {
    const parsed = queryEnvelopeSchema.parse({
      query: 'key.get',
      correlationId: 'xyz-1',
      payload: {
        connectionId: 'conn-1',
        key: 'user:1',
      },
    })

    expect(parsed.query).toBe('key.get')
  })

  it('accepts key search with optional cursor', () => {
    const parsed = queryEnvelopeSchema.parse({
      query: 'key.search',
      correlationId: 'xyz-2',
      payload: {
        connectionId: 'conn-1',
        pattern: 'user:*',
        cursor: '42',
        limit: 100,
      },
    })

    expect(parsed.query).toBe('key.search')
    expect((parsed.payload as { cursor?: string }).cursor).toBe('42')
  })
})
