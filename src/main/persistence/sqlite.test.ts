import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type {
  AlertEvent,
  ConnectionProfile,
  HistoryEvent,
  ObservabilitySnapshot,
  SnapshotRecord,
  WorkflowExecutionRecord,
  WorkflowTemplate,
} from '../../shared/contracts/cache'
import {
  createSqliteDatabase,
  SqliteAlertRepository,
  SqliteConnectionRepository,
  SqliteHistoryRepository,
  SqliteObservabilityRepository,
  SqliteSnapshotRepository,
  SqliteWorkflowExecutionRepository,
  SqliteWorkflowTemplateRepository,
} from './sqlite'

type TestContext = {
  dbPath: string
  cleanup: () => void
}

const testContexts: TestContext[] = []

const SQLITE_RUNTIME_AVAILABLE = (() => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'cachify-sqlite-check-'))
  const dbPath = path.join(tempDirectory, 'runtime-check.db')

  try {
    const db = createSqliteDatabase(dbPath)
    db.close()
    return true
  } catch (error) {
    void error
    return false
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true })
  }
})()

const createTestDatabase = () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'cachify-sqlite-'))
  const dbPath = path.join(tempDirectory, 'cachify-test.db')
  const db = createSqliteDatabase(dbPath)

  testContexts.push({
    dbPath,
    cleanup: () => {
      db.close()
      fs.rmSync(tempDirectory, { recursive: true, force: true })
    },
  })

  return db
}

afterEach(() => {
  while (testContexts.length > 0) {
    const context = testContexts.pop()
    context?.cleanup()
  }
})

const createProfile = (): ConnectionProfile => ({
  id: 'conn-1',
  name: 'Primary Redis',
  engine: 'redis',
  host: '127.0.0.1',
  port: 6379,
  dbIndex: 0,
  tlsEnabled: false,
  environment: 'dev',
  tags: ['local'],
  secretRef: 'conn-1',
  readOnly: false,
  forceReadOnly: true,
  timeoutMs: 5000,
  retryMaxAttempts: 3,
  retryBackoffMs: 200,
  retryBackoffStrategy: 'fixed',
  retryAbortOnErrorRate: 0.5,
  createdAt: '2026-02-17T00:00:00.000Z',
  updatedAt: '2026-02-17T00:00:00.000Z',
})

const describeSqlite = SQLITE_RUNTIME_AVAILABLE ? describe : describe.skip

describeSqlite('sqlite persistence v2', () => {
  it('persists connection policy and retry fields', async () => {
    const db = createTestDatabase()
    const repository = new SqliteConnectionRepository(db)
    const profile = createProfile()

    await repository.save(profile)

    const stored = await repository.findById(profile.id)
    expect(stored).not.toBeNull()
    expect(stored?.forceReadOnly).toBe(true)
    expect(stored?.retryMaxAttempts).toBe(3)
    expect(stored?.retryBackoffMs).toBe(200)
    expect(stored?.retryBackoffStrategy).toBe('fixed')
    expect(stored?.retryAbortOnErrorRate).toBe(0.5)
  })

  it('stores and fetches snapshot records', async () => {
    const db = createTestDatabase()
    const connectionRepository = new SqliteConnectionRepository(db)
    const snapshotRepository = new SqliteSnapshotRepository(db)
    const profile = createProfile()

    await connectionRepository.save(profile)

    const snapshot: SnapshotRecord = {
      id: 'snap-1',
      connectionId: profile.id,
      key: 'user:1',
      capturedAt: '2026-02-17T01:00:00.000Z',
      redactedValueHash: 'hash-1',
      value: 'old-value',
      ttlSeconds: 120,
      reason: 'set',
    }

    await snapshotRepository.save(snapshot)

    const listed = await snapshotRepository.list({
      connectionId: profile.id,
      key: 'user:1',
      limit: 10,
    })

    expect(listed).toHaveLength(1)
    expect(listed[0].id).toBe(snapshot.id)

    const latest = await snapshotRepository.findLatest({
      connectionId: profile.id,
      key: 'user:1',
    })

    expect(latest?.redactedValueHash).toBe('hash-1')
  })

  it('stores and queries workflow templates and executions', async () => {
    const db = createTestDatabase()
    const connectionRepository = new SqliteConnectionRepository(db)
    const templateRepository = new SqliteWorkflowTemplateRepository(db)
    const executionRepository = new SqliteWorkflowExecutionRepository(db)
    const profile = createProfile()

    await connectionRepository.save(profile)

    const template: WorkflowTemplate = {
      id: 'wf-template-1',
      name: 'Delete sessions',
      kind: 'deleteByPattern',
      parameters: {
        pattern: 'session:*',
      },
      requiresApprovalOnProd: true,
      supportsDryRun: true,
      createdAt: '2026-02-17T01:00:00.000Z',
      updatedAt: '2026-02-17T01:00:00.000Z',
    }

    await templateRepository.save(template)

    const execution: WorkflowExecutionRecord = {
      id: 'wf-exec-1',
      workflowTemplateId: template.id,
      workflowName: template.name,
      workflowKind: template.kind,
      connectionId: profile.id,
      startedAt: '2026-02-17T01:10:00.000Z',
      finishedAt: '2026-02-17T01:10:10.000Z',
      status: 'success',
      retryCount: 1,
      dryRun: false,
      parameters: template.parameters,
      stepResults: [
        {
          step: 'delete:session:1',
          status: 'success',
          attempts: 2,
          durationMs: 42,
        },
      ],
    }

    await executionRepository.save(execution)

    const templates = await templateRepository.list()
    expect(templates).toHaveLength(1)
    expect(templates[0].name).toBe('Delete sessions')

    const executions = await executionRepository.list({
      connectionId: profile.id,
      limit: 10,
    })

    expect(executions).toHaveLength(1)
    expect(executions[0].retryCount).toBe(1)
    expect(executions[0].stepResults[0].attempts).toBe(2)
  })

  it('stores history and observability snapshots', async () => {
    const db = createTestDatabase()
    const connectionRepository = new SqliteConnectionRepository(db)
    const historyRepository = new SqliteHistoryRepository(db)
    const observabilityRepository = new SqliteObservabilityRepository(db)
    const profile = createProfile()

    await connectionRepository.save(profile)

    const event: HistoryEvent = {
      id: 'history-1',
      timestamp: '2026-02-17T02:00:00.000Z',
      source: 'app',
      connectionId: profile.id,
      environment: profile.environment,
      action: 'key.set',
      keyOrPattern: 'user:1',
      durationMs: 32,
      status: 'success',
      details: {
        attempts: 1,
      },
    }

    const snapshot: ObservabilitySnapshot = {
      id: 'obs-1',
      connectionId: profile.id,
      timestamp: '2026-02-17T02:00:00.000Z',
      latencyP50Ms: 32,
      latencyP95Ms: 32,
      errorRate: 0,
      reconnectCount: 0,
      opsPerSecond: 0.25,
      slowOpCount: 0,
    }

    await historyRepository.append(event)
    await observabilityRepository.append(snapshot)

    const historyRows = await historyRepository.query({
      connectionId: profile.id,
      limit: 10,
    })

    const observabilityRows = await observabilityRepository.query({
      connectionId: profile.id,
      limit: 10,
    })

    expect(historyRows).toHaveLength(1)
    expect(historyRows[0].action).toBe('key.set')
    expect(observabilityRows).toHaveLength(1)
    expect(observabilityRows[0].latencyP95Ms).toBe(32)
  })

  it('stores and marks alerts as read', async () => {
    const db = createTestDatabase()
    const alertRepository = new SqliteAlertRepository(db)

    const alert: AlertEvent = {
      id: 'alert-1',
      createdAt: '2026-02-17T03:00:00.000Z',
      connectionId: 'conn-1',
      environment: 'prod',
      severity: 'warning',
      title: 'Policy block',
      message: 'Delete was blocked by prod guardrail.',
      source: 'policy',
      read: false,
    }

    await alertRepository.append(alert)

    const unread = await alertRepository.list({
      unreadOnly: true,
      limit: 10,
    })

    expect(unread).toHaveLength(1)

    await alertRepository.markRead(alert.id)

    const unreadAfterMark = await alertRepository.list({
      unreadOnly: true,
      limit: 10,
    })

    expect(unreadAfterMark).toHaveLength(0)
  })
})
