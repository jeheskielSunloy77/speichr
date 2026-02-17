import { describe, expect, it } from 'vitest'

import type { ConnectionProfile } from '../../shared/contracts/cache'

import { OperationFailure } from '../domain/operation-failure'
import { assertConnectionWritable } from './read-only-policy'

const createProfile = (
  readOnly: boolean,
  forceReadOnly = false,
): ConnectionProfile => ({
  id: 'profile-1',
  name: 'Primary Redis',
  engine: 'redis',
  host: '127.0.0.1',
  port: 6379,
  dbIndex: 0,
  tlsEnabled: false,
  environment: 'dev',
  tags: ['local'],
  secretRef: 'profile-1',
  readOnly,
  forceReadOnly,
  timeoutMs: 5000,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

describe('assertConnectionWritable', () => {
  it('throws an operation failure for read-only profiles', () => {
    expect(() => assertConnectionWritable(createProfile(true))).toThrowError(
      OperationFailure,
    )
  })

  it('does not throw for writable profiles', () => {
    expect(() => assertConnectionWritable(createProfile(false))).not.toThrow()
  })

  it('throws for force read-only policy profiles', () => {
    expect(() => assertConnectionWritable(createProfile(false, true))).toThrowError(
      OperationFailure,
    )
  })
})
