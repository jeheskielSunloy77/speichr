import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { v4 as uuidv4 } from 'uuid'

import type {
  AlertEvent,
  AlertListRequest,
  AlertMarkReadRequest,
  AlertRule,
  AlertRuleCreateRequest,
  AlertRuleDeleteRequest,
  AlertRuleUpdateRequest,
  CompareMetricDelta,
  ComparePeriodsRequest,
  ComparePeriodsResult,
  ConnectionCapabilitiesRequest,
  ConnectionCreateRequest,
  ConnectionDeleteRequest,
  ConnectionGetRequest,
  ConnectionProfile,
  ConnectionSecret,
  ConnectionTestRequest,
  ConnectionUpdateRequest,
  FailedOperationDiagnostic,
  FailedOperationDrilldownRequest,
  FailedOperationDrilldownResult,
  GovernanceAssignment,
  GovernanceAssignmentListRequest,
  GovernanceAssignmentRequest,
  GovernancePolicyPack,
  GovernancePolicyPackCreateRequest,
  GovernancePolicyPackDeleteRequest,
  GovernancePolicyPackUpdateRequest,
  HistoryEvent,
  HistoryQueryRequest,
  IncidentBundle,
  IncidentBundleExportRequest,
  IncidentBundleListRequest,
  IncidentBundlePreview,
  IncidentBundlePreviewRequest,
  KeyDeleteRequest,
  KeyGetRequest,
  KeyspaceActivityPattern,
  KeyspaceActivityPoint,
  KeyspaceActivityRequest,
  KeyspaceActivityView,
  KeyListRequest,
  KeyListResult,
  KeySearchRequest,
  KeySetRequest,
  KeyValueRecord,
  MutationResult,
  ObservabilityDashboard,
  ObservabilityDashboardRequest,
  ObservabilitySnapshot,
  ProviderCapabilities,
  RetentionPolicy,
  RetentionPolicyListResult,
  RetentionPolicyUpdateRequest,
  RetentionPurgeRequest,
  RetentionPurgeResult,
  RollbackRestoreRequest,
  SnapshotListRequest,
  SnapshotRecord,
  StorageSummary,
  WorkflowDryRunPreview,
  WorkflowDryRunPreviewItem,
  WorkflowExecuteRequest,
  WorkflowExecutionGetRequest,
  WorkflowExecutionListRequest,
  WorkflowExecutionRecord,
  WorkflowResumeRequest,
  WorkflowRerunRequest,
  WorkflowStepResult,
  WorkflowStepRetryPolicy,
  WorkflowTemplate,
  WorkflowTemplateCreateRequest,
  WorkflowTemplateDeleteRequest,
  WorkflowTemplateDraft,
  WorkflowTemplatePreviewRequest,
  WorkflowTemplateUpdateRequest,
} from '../../shared/contracts/cache'
import { OperationFailure } from '../domain/operation-failure'
import { assertConnectionWritable } from '../policies/read-only-policy'
import type {
  AlertRepository,
  CacheGateway,
  ConnectionRepository,
  EngineEventIngestor,
  EngineTimelineEventInput,
  HistoryRepository,
  IncidentBundleRepository,
  MemcachedKeyIndexRepository,
  NotificationPublisher,
  ObservabilityRepository,
  SecretStore,
  SnapshotRepository,
  WorkflowExecutionRepository,
  WorkflowTemplateRepository,
} from './ports'

const DEFAULT_TIMEOUT_MS = 5000
const DEFAULT_RETRY_MAX_ATTEMPTS = 1
const DEFAULT_RETRY_BACKOFF_MS = 250
const DEFAULT_RETRY_ABORT_ON_ERROR_RATE = 1
const SLOW_OPERATION_THRESHOLD_MS = 750
const DASHBOARD_DEFAULT_LIMIT = 200

type RetryPolicy = {
  maxAttempts: number
  backoffMs: number
  backoffStrategy: 'fixed' | 'exponential'
  abortOnErrorRate: number
}

type OperationStatus = 'success' | 'error' | 'blocked'

type ExecuteWithPolicyArgs<T> = {
  profile: ConnectionProfile
  action: string
  keyOrPattern: string
  run: () => Promise<T>
  retryPolicy?: RetryPolicy
  suppressTelemetry?: boolean
}

type ExecuteWithPolicyResult<T> = {
  result: T
  attempts: number
  durationMs: number
}

type ServiceDependencies = {
  snapshotRepository: SnapshotRepository
  workflowTemplateRepository: WorkflowTemplateRepository
  workflowExecutionRepository: WorkflowExecutionRepository
  historyRepository: HistoryRepository
  observabilityRepository: ObservabilityRepository
  alertRepository: AlertRepository
  incidentBundleRepository: IncidentBundleRepository
  notificationPublisher: NotificationPublisher
  engineEventIngestor: EngineEventIngestor
}

const BUILTIN_WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'builtin-delete-by-pattern',
    name: 'Delete By Pattern',
    kind: 'deleteByPattern',
    parameters: {
      pattern: '*',
      limit: 100,
    },
    requiresApprovalOnProd: true,
    supportsDryRun: true,
    createdAt: '2026-02-17T00:00:00.000Z',
    updatedAt: '2026-02-17T00:00:00.000Z',
  },
  {
    id: 'builtin-ttl-normalize',
    name: 'TTL Normalize',
    kind: 'ttlNormalize',
    parameters: {
      pattern: '*',
      ttlSeconds: 3600,
      limit: 100,
    },
    requiresApprovalOnProd: true,
    supportsDryRun: true,
    createdAt: '2026-02-17T00:00:00.000Z',
    updatedAt: '2026-02-17T00:00:00.000Z',
  },
  {
    id: 'builtin-warmup-set',
    name: 'Warmup Set',
    kind: 'warmupSet',
    parameters: {
      entries: [],
    },
    requiresApprovalOnProd: false,
    supportsDryRun: true,
    createdAt: '2026-02-17T00:00:00.000Z',
    updatedAt: '2026-02-17T00:00:00.000Z',
  },
]

class InMemorySnapshotRepository implements SnapshotRepository {
  private readonly records: SnapshotRecord[] = []

  public async save(record: SnapshotRecord): Promise<void> {
    this.records.unshift(record)
  }

  public async list(args: {
    connectionId: string
    key?: string
    limit: number
  }): Promise<SnapshotRecord[]> {
    return this.records
      .filter(
        (record) =>
          record.connectionId === args.connectionId &&
          (args.key === undefined || args.key === record.key),
      )
      .slice(0, args.limit)
  }

  public async findLatest(args: {
    connectionId: string
    key: string
  }): Promise<SnapshotRecord | null> {
    return (
      this.records.find(
        (record) =>
          record.connectionId === args.connectionId && record.key === args.key,
      ) ?? null
    )
  }

  public async findById(id: string): Promise<SnapshotRecord | null> {
    return this.records.find((record) => record.id === id) ?? null
  }
}

class InMemoryWorkflowTemplateRepository implements WorkflowTemplateRepository {
  private readonly records = new Map<string, WorkflowTemplate>()

  public async save(template: WorkflowTemplate): Promise<void> {
    this.records.set(template.id, template)
  }

  public async list(): Promise<WorkflowTemplate[]> {
    return Array.from(this.records.values())
  }

  public async findById(id: string): Promise<WorkflowTemplate | null> {
    return this.records.get(id) ?? null
  }

  public async delete(id: string): Promise<void> {
    this.records.delete(id)
  }
}

class InMemoryWorkflowExecutionRepository implements WorkflowExecutionRepository {
  private readonly records = new Map<string, WorkflowExecutionRecord>()

  public async save(record: WorkflowExecutionRecord): Promise<void> {
    this.records.set(record.id, record)
  }

  public async list(
    args: WorkflowExecutionListRequest,
  ): Promise<WorkflowExecutionRecord[]> {
    return Array.from(this.records.values())
      .filter(
        (record) =>
          (args.connectionId === undefined ||
            record.connectionId === args.connectionId) &&
          (args.templateId === undefined ||
            record.workflowTemplateId === args.templateId),
      )
      .sort((left, right) =>
        right.startedAt.localeCompare(left.startedAt),
      )
      .slice(0, args.limit)
  }

  public async findById(id: string): Promise<WorkflowExecutionRecord | null> {
    return this.records.get(id) ?? null
  }
}

class InMemoryHistoryRepository implements HistoryRepository {
  private readonly events: HistoryEvent[] = []

  public async append(event: HistoryEvent): Promise<void> {
    this.events.unshift(event)
  }

  public async query(args: HistoryQueryRequest): Promise<HistoryEvent[]> {
    return this.events
      .filter((event) => {
        if (args.connectionId && event.connectionId !== args.connectionId) {
          return false
        }

        if (args.from && event.timestamp < args.from) {
          return false
        }

        if (args.to && event.timestamp > args.to) {
          return false
        }

        return true
      })
      .slice(0, args.limit)
  }
}

class InMemoryObservabilityRepository implements ObservabilityRepository {
  private readonly snapshots: ObservabilitySnapshot[] = []

  public async append(snapshot: ObservabilitySnapshot): Promise<void> {
    this.snapshots.unshift(snapshot)
  }

  public async query(args: {
    connectionId?: string
    from?: string
    to?: string
    limit: number
  }): Promise<ObservabilitySnapshot[]> {
    return this.snapshots
      .filter((snapshot) => {
        if (args.connectionId && snapshot.connectionId !== args.connectionId) {
          return false
        }

        if (args.from && snapshot.timestamp < args.from) {
          return false
        }

        if (args.to && snapshot.timestamp > args.to) {
          return false
        }

        return true
      })
      .slice(0, args.limit)
  }
}

class InMemoryAlertRepository implements AlertRepository {
  private readonly events = new Map<string, AlertEvent>()

  public async append(event: AlertEvent): Promise<void> {
    this.events.set(event.id, event)
  }

  public async list(request: AlertListRequest): Promise<AlertEvent[]> {
    return Array.from(this.events.values())
      .filter(
        (event) => !request.unreadOnly || (request.unreadOnly && !event.read),
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, request.limit)
  }

  public async markRead(id: string): Promise<void> {
    const event = this.events.get(id)
    if (!event) {
      return
    }

    this.events.set(id, {
      ...event,
      read: true,
    })
  }
}

class InMemoryIncidentBundleRepository implements IncidentBundleRepository {
  private readonly bundles = new Map<string, IncidentBundle>()

  public async save(bundle: IncidentBundle): Promise<void> {
    this.bundles.set(bundle.id, bundle)
  }

  public async list(limit: number): Promise<IncidentBundle[]> {
    return Array.from(this.bundles.values())
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit)
  }
}

class NoopNotificationPublisher implements NotificationPublisher {
  public async notify(
    alert: Pick<AlertEvent, 'title' | 'message'>,
  ): Promise<void> {
    void alert
  }
}

class NoopEngineEventIngestor implements EngineEventIngestor {
  public async start(args: {
    onEvent: (event: EngineTimelineEventInput) => Promise<void>
  }): Promise<void> {
    void args
  }

  public async stop(): Promise<void> {
    return Promise.resolve()
  }
}

export class CachifyService {
  private readonly snapshotRepository: SnapshotRepository

  private readonly workflowTemplateRepository: WorkflowTemplateRepository

  private readonly workflowExecutionRepository: WorkflowExecutionRepository

  private readonly historyRepository: HistoryRepository

  private readonly observabilityRepository: ObservabilityRepository

  private readonly alertRepository: AlertRepository

  private readonly incidentBundleRepository: IncidentBundleRepository

  private readonly notificationPublisher: NotificationPublisher

  private readonly engineEventIngestor: EngineEventIngestor

  private readonly operationSamples = new Map<
    string,
    Array<{ timestamp: number; durationMs: number; status: OperationStatus }>
  >()

  public constructor(
    private readonly connectionRepository: ConnectionRepository,
    private readonly secretStore: SecretStore,
    private readonly memcachedKeyIndexRepository: MemcachedKeyIndexRepository,
    private readonly cacheGateway: CacheGateway,
    dependencies?: Partial<ServiceDependencies>,
  ) {
    this.snapshotRepository =
      dependencies?.snapshotRepository ?? new InMemorySnapshotRepository()
    this.workflowTemplateRepository =
      dependencies?.workflowTemplateRepository ??
      new InMemoryWorkflowTemplateRepository()
    this.workflowExecutionRepository =
      dependencies?.workflowExecutionRepository ??
      new InMemoryWorkflowExecutionRepository()
    this.historyRepository =
      dependencies?.historyRepository ?? new InMemoryHistoryRepository()
    this.observabilityRepository =
      dependencies?.observabilityRepository ??
      new InMemoryObservabilityRepository()
    this.alertRepository =
      dependencies?.alertRepository ?? new InMemoryAlertRepository()
    this.incidentBundleRepository =
      dependencies?.incidentBundleRepository ?? new InMemoryIncidentBundleRepository()
    this.notificationPublisher =
      dependencies?.notificationPublisher ?? new NoopNotificationPublisher()
    this.engineEventIngestor =
      dependencies?.engineEventIngestor ?? new NoopEngineEventIngestor()
  }

  public async startEngineEventIngestion(): Promise<void> {
    await this.engineEventIngestor.start({
      onEvent: async (event) => {
        await this.ingestEngineEvent(event)
      },
    })
  }

  public async stopEngineEventIngestion(): Promise<void> {
    await this.engineEventIngestor.stop()
  }

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
        return await withTimeout(
          this.cacheGateway.testConnection(normalizedProfile, resolvedSecret),
          normalizedProfile.timeoutMs,
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

    const { result } = await this.executeWithPolicy({
      profile,
      action: 'key.list',
      keyOrPattern: payload.cursor ?? '*',
      run: () =>
        this.cacheGateway.listKeys(profile, secret, {
          cursor: payload.cursor,
          limit: payload.limit,
        }),
    })

    return result
  }

  public async searchKeys(payload: KeySearchRequest): Promise<KeyListResult> {
    const { profile, secret } = await this.requireProfileWithSecret(
      payload.connectionId,
    )

    const { result } = await this.executeWithPolicy({
      profile,
      action: 'key.search',
      keyOrPattern: payload.pattern,
      run: () =>
        this.cacheGateway.searchKeys(profile, secret, {
          pattern: payload.pattern,
          cursor: payload.cursor,
          limit: payload.limit,
        }),
    })

    return result
  }

  public async getKey(payload: KeyGetRequest): Promise<KeyValueRecord> {
    const { profile, secret } = await this.requireProfileWithSecret(
      payload.connectionId,
    )

    const { result } = await this.executeWithPolicy({
      profile,
      action: 'key.get',
      keyOrPattern: payload.key,
      run: () => this.cacheGateway.getValue(profile, secret, payload.key),
    })

    return result
  }

  public async setKey(payload: KeySetRequest): Promise<MutationResult> {
    const { profile, secret } = await this.requireProfileWithSecret(
      payload.connectionId,
    )

    await this.enforceWritable(profile, 'key.set', payload.key)
    await this.captureSnapshot(profile, secret, payload.key, 'set')

    await this.executeWithPolicy({
      profile,
      action: 'key.set',
      keyOrPattern: payload.key,
      run: () =>
        this.cacheGateway.setValue(profile, secret, {
          key: payload.key,
          value: payload.value,
          ttlSeconds: payload.ttlSeconds,
        }),
    })

    return {
      success: true,
    }
  }

  public async deleteKey(payload: KeyDeleteRequest): Promise<MutationResult> {
    const { profile, secret } = await this.requireProfileWithSecret(
      payload.connectionId,
    )

    await this.enforceWritable(profile, 'key.delete', payload.key)
    await this.enforceProdGuardrail(
      profile,
      'key.delete',
      payload.key,
      payload.guardrailConfirmed,
    )
    await this.captureSnapshot(profile, secret, payload.key, 'delete')

    await this.executeWithPolicy({
      profile,
      action: 'key.delete',
      keyOrPattern: payload.key,
      run: () => this.cacheGateway.deleteKey(profile, secret, payload.key),
    })

    return {
      success: true,
    }
  }

  public async listSnapshots(
    payload: SnapshotListRequest,
  ): Promise<SnapshotRecord[]> {
    await this.requireConnection(payload.connectionId)

    return this.snapshotRepository.list({
      connectionId: payload.connectionId,
      key: payload.key,
      limit: payload.limit,
    })
  }

  public async restoreSnapshot(
    payload: RollbackRestoreRequest,
  ): Promise<MutationResult> {
    const { profile, secret } = await this.requireProfileWithSecret(
      payload.connectionId,
    )

    await this.enforceWritable(profile, 'rollback.restore', payload.key)
    await this.enforceProdGuardrail(
      profile,
      'rollback.restore',
      payload.key,
      payload.guardrailConfirmed,
    )

    const snapshot = payload.snapshotId
      ? await this.snapshotRepository.findById(payload.snapshotId)
      : await this.snapshotRepository.findLatest({
          connectionId: payload.connectionId,
          key: payload.key,
        })

    if (
      !snapshot ||
      snapshot.connectionId !== payload.connectionId ||
      snapshot.key !== payload.key
    ) {
      throw new OperationFailure(
        'VALIDATION_ERROR',
        'No rollback snapshot was found for this key.',
        false,
        {
          connectionId: payload.connectionId,
          key: payload.key,
          snapshotId: payload.snapshotId,
        },
      )
    }

    await this.executeWithPolicy({
      profile,
      action: 'rollback.restore',
      keyOrPattern: snapshot.key,
      run: async () => {
        if (snapshot.value === null) {
          await this.cacheGateway.deleteKey(profile, secret, snapshot.key)
          return
        }

        await this.cacheGateway.setValue(profile, secret, {
          key: snapshot.key,
          value: snapshot.value,
          ttlSeconds: snapshot.ttlSeconds,
        })
      },
    })

    return {
      success: true,
    }
  }

  public async listWorkflowTemplates(): Promise<WorkflowTemplate[]> {
    const templates = await this.workflowTemplateRepository.list()
    const merged = [...BUILTIN_WORKFLOW_TEMPLATES, ...templates]

    return merged.sort((left, right) => left.name.localeCompare(right.name))
  }

  public async createWorkflowTemplate(
    payload: WorkflowTemplateCreateRequest,
  ): Promise<WorkflowTemplate> {
    const now = new Date().toISOString()
    const template: WorkflowTemplate = {
      id: uuidv4(),
      name: payload.template.name.trim(),
      kind: payload.template.kind,
      parameters: payload.template.parameters,
      requiresApprovalOnProd: payload.template.requiresApprovalOnProd,
      supportsDryRun: payload.template.supportsDryRun,
      createdAt: now,
      updatedAt: now,
    }

    await this.workflowTemplateRepository.save(template)

    return template
  }

  public async updateWorkflowTemplate(
    payload: WorkflowTemplateUpdateRequest,
  ): Promise<WorkflowTemplate> {
    if (isBuiltinWorkflowId(payload.id)) {
      throw new OperationFailure(
        'UNAUTHORIZED',
        'Built-in workflow templates cannot be modified.',
        false,
      )
    }

    const existing = await this.workflowTemplateRepository.findById(payload.id)

    if (!existing) {
      throw new OperationFailure(
        'VALIDATION_ERROR',
        'Workflow template was not found.',
        false,
        { id: payload.id },
      )
    }

    const template: WorkflowTemplate = {
      ...existing,
      name: payload.template.name.trim(),
      kind: payload.template.kind,
      parameters: payload.template.parameters,
      requiresApprovalOnProd: payload.template.requiresApprovalOnProd,
      supportsDryRun: payload.template.supportsDryRun,
      updatedAt: new Date().toISOString(),
    }

    await this.workflowTemplateRepository.save(template)

    return template
  }

  public async deleteWorkflowTemplate(
    payload: WorkflowTemplateDeleteRequest,
  ): Promise<MutationResult> {
    if (isBuiltinWorkflowId(payload.id)) {
      throw new OperationFailure(
        'UNAUTHORIZED',
        'Built-in workflow templates cannot be deleted.',
        false,
      )
    }

    await this.workflowTemplateRepository.delete(payload.id)

    return {
      success: true,
    }
  }

  public async previewWorkflow(
    payload: WorkflowTemplatePreviewRequest,
  ): Promise<WorkflowDryRunPreview> {
    const { profile, secret } = await this.requireProfileWithSecret(
      payload.connectionId,
    )

    const { template, parameters } = await this.resolveWorkflowTemplate({
      templateId: payload.templateId,
      template: payload.template,
      parameterOverrides: payload.parameterOverrides,
    })

    return this.buildWorkflowPreview(profile, secret, template.kind, parameters, {
      cursor: payload.cursor,
      limit: payload.limit,
    })
  }

  public async executeWorkflow(
    payload: WorkflowExecuteRequest,
  ): Promise<WorkflowExecutionRecord> {
    const { profile, secret } = await this.requireProfileWithSecret(
      payload.connectionId,
    )

    const { template, parameters } = await this.resolveWorkflowTemplate({
      templateId: payload.templateId,
      template: payload.template,
      parameterOverrides: payload.parameterOverrides,
    })

    if (!payload.dryRun) {
      await this.enforceWritable(profile, 'workflow.execute', template.name)
    }

    if (template.requiresApprovalOnProd) {
      await this.enforceProdGuardrail(
        profile,
        'workflow.execute',
        template.name,
        payload.guardrailConfirmed,
      )
    }

    const execution: WorkflowExecutionRecord = {
      id: uuidv4(),
      workflowTemplateId: payload.templateId,
      workflowName: template.name,
      workflowKind: template.kind,
      connectionId: profile.id,
      startedAt: new Date().toISOString(),
      status: 'running',
      retryCount: 0,
      dryRun: Boolean(payload.dryRun),
      parameters,
      stepResults: [],
    }

    await this.workflowExecutionRepository.save(execution)

    const preview = await this.buildWorkflowPreview(
      profile,
      secret,
      template.kind,
      parameters,
      {
        limit: 500,
      },
    )

    if (payload.dryRun) {
      const now = new Date().toISOString()
      const completed: WorkflowExecutionRecord = {
        ...execution,
        finishedAt: now,
        status: 'success',
        stepResults: [
          {
            step: 'dry-run',
            status: 'success',
            attempts: 1,
            durationMs: 0,
            message: `Previewed ${preview.estimatedCount} item(s).`,
          },
        ],
      }

      await this.workflowExecutionRepository.save(completed)
      return completed
    }

    const retryPolicy = this.resolveRetryPolicy(profile, payload.retryPolicy)

    let errorCount = 0
    const stepResults: WorkflowStepResult[] = []
    let aborted = false

    for (const item of preview.items) {
      const stepStartedAt = Date.now()

      try {
        const run = async (): Promise<void> => {
          if (item.action === 'delete') {
            await this.captureSnapshot(profile, secret, item.key, 'workflow')
            await this.cacheGateway.deleteKey(profile, secret, item.key)
            return
          }

          if (item.action === 'setTtl') {
            const value = await this.cacheGateway.getValue(profile, secret, item.key)
            if (value.value === null) {
              return
            }

            await this.cacheGateway.setValue(profile, secret, {
              key: item.key,
              value: value.value,
              ttlSeconds: item.nextTtlSeconds ?? undefined,
            })
            return
          }

          await this.cacheGateway.setValue(profile, secret, {
            key: item.key,
            value: item.valuePreview ?? '',
            ttlSeconds: item.nextTtlSeconds ?? undefined,
          })
        }

        const telemetryAction =
          item.action === 'delete'
            ? 'workflow.step.delete'
            : item.action === 'setTtl'
              ? 'workflow.step.ttl'
              : 'workflow.step.warmup'

        const outcome = await this.executeWithPolicy({
          profile,
          action: telemetryAction,
          keyOrPattern: item.key,
          run,
          retryPolicy,
        })

        stepResults.push({
          step: `${item.action}:${item.key}`,
          status: 'success',
          attempts: outcome.attempts,
          durationMs: Date.now() - stepStartedAt,
        })
      } catch (error) {
        errorCount += 1

        const failure = this.toOperationFailure(error)
        const attempts =
          typeof failure.details?.attempts === 'number'
            ? Number(failure.details.attempts)
            : retryPolicy.maxAttempts

        stepResults.push({
          step: `${item.action}:${item.key}`,
          status: 'error',
          attempts,
          durationMs: Date.now() - stepStartedAt,
          message: failure.message,
        })

        const completedStepCount = stepResults.length
        if (errorCount / completedStepCount > retryPolicy.abortOnErrorRate) {
          aborted = true
          break
        }
      }
    }

    const now = new Date().toISOString()
    const retryCount = stepResults.reduce(
      (accumulator, step) => accumulator + Math.max(0, step.attempts - 1),
      0,
    )

    const status =
      errorCount === 0 ? 'success' : aborted ? 'aborted' : 'error'

    const result: WorkflowExecutionRecord = {
      ...execution,
      finishedAt: now,
      status,
      retryCount,
      stepResults,
      errorMessage:
        status === 'success'
          ? undefined
          : status === 'aborted'
            ? 'Workflow aborted by error-rate policy.'
            : 'One or more workflow steps failed.',
    }

    await this.workflowExecutionRepository.save(result)

    if (status !== 'success') {
      await this.emitAlert({
        connectionId: profile.id,
        environment: profile.environment,
        severity: status === 'aborted' ? 'critical' : 'warning',
        title: `Workflow ${status}`,
        message: `${template.name} completed with status: ${status}.`,
        source: 'workflow',
      })
    }

    return result
  }

  public async rerunWorkflow(
    payload: WorkflowRerunRequest,
  ): Promise<WorkflowExecutionRecord> {
    const execution = await this.workflowExecutionRepository.findById(
      payload.executionId,
    )

    if (!execution) {
      throw new OperationFailure(
        'VALIDATION_ERROR',
        'Workflow execution record was not found.',
        false,
        { id: payload.executionId },
      )
    }

    const fallbackTemplate: WorkflowTemplateDraft = {
      name: execution.workflowName,
      kind: execution.workflowKind,
      parameters: execution.parameters,
      requiresApprovalOnProd: true,
      supportsDryRun: true,
    }

    return this.executeWorkflow({
      connectionId: execution.connectionId,
      templateId: execution.workflowTemplateId,
      template: execution.workflowTemplateId ? undefined : fallbackTemplate,
      parameterOverrides: payload.parameterOverrides,
      dryRun: payload.dryRun,
      guardrailConfirmed: payload.guardrailConfirmed,
    })
  }

  public async listWorkflowExecutions(
    payload: WorkflowExecutionListRequest,
  ): Promise<WorkflowExecutionRecord[]> {
    return this.workflowExecutionRepository.list(payload)
  }

  public async getWorkflowExecution(
    payload: WorkflowExecutionGetRequest,
  ): Promise<WorkflowExecutionRecord> {
    const execution = await this.workflowExecutionRepository.findById(payload.id)

    if (!execution) {
      throw new OperationFailure(
        'VALIDATION_ERROR',
        'Workflow execution was not found.',
        false,
        { id: payload.id },
      )
    }

    return execution
  }

  public async listHistory(payload: HistoryQueryRequest): Promise<HistoryEvent[]> {
    return this.historyRepository.query(payload)
  }

  public async ingestEngineEvent(payload: EngineTimelineEventInput): Promise<void> {
    const profile = await this.connectionRepository.findById(payload.connectionId)
    if (!profile) {
      return
    }

    const event: HistoryEvent = {
      id: uuidv4(),
      timestamp: payload.timestamp ?? new Date().toISOString(),
      source: 'engine',
      connectionId: payload.connectionId,
      environment: payload.environment ?? profile.environment,
      action: payload.action,
      keyOrPattern: payload.keyOrPattern,
      durationMs: Math.max(0, Math.round(payload.durationMs ?? 0)),
      status: payload.status,
      errorCode: payload.errorCode,
      retryable: payload.retryable,
      details: payload.details,
    }

    await this.historyRepository.append(event)

    if (event.status === 'error') {
      await this.emitAlert({
        connectionId: event.connectionId,
        environment: event.environment,
        severity: 'warning',
        title: 'Engine event error',
        message: `${event.action} failed on ${event.keyOrPattern}.`,
        source: 'observability',
      })
    } else if (event.durationMs >= SLOW_OPERATION_THRESHOLD_MS) {
      await this.emitAlert({
        connectionId: event.connectionId,
        environment: event.environment,
        severity: 'info',
        title: 'Slow engine event detected',
        message: `${event.action} took ${event.durationMs}ms.`,
        source: 'observability',
      })
    }
  }

  public async getObservabilityDashboard(
    payload: ObservabilityDashboardRequest,
  ): Promise<ObservabilityDashboard> {
    const now = new Date().toISOString()
    const limit = payload.limit ?? DASHBOARD_DEFAULT_LIMIT

    const [connections, timeline, snapshots] = await Promise.all([
      this.connectionRepository.list(),
      this.historyRepository.query({
        connectionId: payload.connectionId,
        from: payload.from,
        to: payload.to,
        limit,
      }),
      this.observabilityRepository.query({
        connectionId: payload.connectionId,
        from: payload.from,
        to: payload.to,
        limit,
      }),
    ])

    const latestByConnection = new Map<string, ObservabilitySnapshot>()
    for (const snapshot of snapshots) {
      if (!latestByConnection.has(snapshot.connectionId)) {
        latestByConnection.set(snapshot.connectionId, snapshot)
      }
    }

    const health = connections.map((connection) => {
      const snapshot = latestByConnection.get(connection.id)
      if (!snapshot) {
        return {
          connectionId: connection.id,
          connectionName: connection.name,
          environment: connection.environment,
          status: 'offline' as const,
          latencyP95Ms: 0,
          errorRate: 0,
          opsPerSecond: 0,
          slowOpCount: 0,
        }
      }

      const degraded =
        snapshot.errorRate >= 0.35 ||
        snapshot.latencyP95Ms >= SLOW_OPERATION_THRESHOLD_MS

      return {
        connectionId: connection.id,
        connectionName: connection.name,
        environment: connection.environment,
        status: degraded ? ('degraded' as const) : ('healthy' as const),
        latencyP95Ms: snapshot.latencyP95Ms,
        errorRate: snapshot.errorRate,
        opsPerSecond: snapshot.opsPerSecond,
        slowOpCount: snapshot.slowOpCount,
      }
    })

    const intervalMinutes = payload.intervalMinutes ?? 5
    const trendMap = new Map<
      string,
      { operationCount: number; errorCount: number; totalDurationMs: number }
    >()

    for (const event of timeline) {
      const bucket = toTimeBucket(event.timestamp, intervalMinutes)
      const current = trendMap.get(bucket) ?? {
        operationCount: 0,
        errorCount: 0,
        totalDurationMs: 0,
      }

      current.operationCount += 1
      current.totalDurationMs += event.durationMs
      if (event.status === 'error') {
        current.errorCount += 1
      }

      trendMap.set(bucket, current)
    }

    const trends = Array.from(trendMap.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([bucket, value]) => ({
        bucket,
        operationCount: value.operationCount,
        errorCount: value.errorCount,
        avgDurationMs:
          value.operationCount === 0
            ? 0
            : Math.round(value.totalDurationMs / value.operationCount),
      }))

    const heatmapMap = new Map<string, { connectionId: string; environment: ConnectionProfile['environment']; errorCount: number }>()
    for (const event of timeline) {
      if (event.status !== 'error') {
        continue
      }

      const key = `${event.connectionId}:${event.environment}`
      const current = heatmapMap.get(key) ?? {
        connectionId: event.connectionId,
        environment: event.environment,
        errorCount: 0,
      }
      current.errorCount += 1
      heatmapMap.set(key, current)
    }

    const heatmap = Array.from(heatmapMap.values()).sort(
      (left, right) => right.errorCount - left.errorCount,
    )

    const slowOperations = timeline.filter(
      (event) => event.durationMs >= SLOW_OPERATION_THRESHOLD_MS,
    )

    return {
      generatedAt: now,
      health,
      trends,
      heatmap,
      timeline,
      slowOperations,
    }
  }

  public async listAlerts(payload: AlertListRequest): Promise<AlertEvent[]> {
    return this.alertRepository.list(payload)
  }

  public async markAlertRead(
    payload: AlertMarkReadRequest,
  ): Promise<MutationResult> {
    await this.alertRepository.markRead(payload.id)

    return {
      success: true,
    }
  }

  public async resumeWorkflow(
    payload: WorkflowResumeRequest,
  ): Promise<WorkflowExecutionRecord> {
    const execution = await this.workflowExecutionRepository.findById(
      payload.executionId,
    )

    if (!execution) {
      throw new OperationFailure(
        'VALIDATION_ERROR',
        'Workflow execution record was not found.',
        false,
        { id: payload.executionId },
      )
    }

    return this.rerunWorkflow({
      executionId: payload.executionId,
      guardrailConfirmed: payload.guardrailConfirmed,
    })
  }

  public async getKeyspaceActivity(
    payload: KeyspaceActivityRequest,
  ): Promise<KeyspaceActivityView> {
    const events = await this.historyRepository.query({
      connectionId: payload.connectionId,
      from: payload.from,
      to: payload.to,
      limit: clampInteger(payload.limit, 1, 5000, 1000),
    })

    const patternMap = new Map<
      string,
      { touchCount: number; errorCount: number; lastTouchedAt?: string }
    >()
    for (const event of events) {
      const pattern = toKeyspacePattern(event.keyOrPattern)
      const current = patternMap.get(pattern) ?? {
        touchCount: 0,
        errorCount: 0,
      }
      current.touchCount += 1
      if (event.status === 'error') {
        current.errorCount += 1
      }
      if (!current.lastTouchedAt || event.timestamp > current.lastTouchedAt) {
        current.lastTouchedAt = event.timestamp
      }
      patternMap.set(pattern, current)
    }

    const topPatterns: KeyspaceActivityPattern[] = Array.from(
      patternMap.entries(),
    )
      .map(([pattern, aggregate]) => ({
        pattern,
        touchCount: aggregate.touchCount,
        errorCount: aggregate.errorCount,
        lastTouchedAt: aggregate.lastTouchedAt,
      }))
      .sort((left, right) => {
        if (right.touchCount !== left.touchCount) {
          return right.touchCount - left.touchCount
        }
        if (right.errorCount !== left.errorCount) {
          return right.errorCount - left.errorCount
        }
        return left.pattern.localeCompare(right.pattern)
      })
      .slice(0, clampInteger(payload.limit, 1, 500, 50))

    const bucketMap = new Map<string, { touches: number; errors: number }>()
    const intervalMinutes = clampInteger(payload.intervalMinutes, 1, 1440, 5)
    for (const event of events) {
      const bucket = toTimeBucket(event.timestamp, intervalMinutes)
      const current = bucketMap.get(bucket) ?? {
        touches: 0,
        errors: 0,
      }

      current.touches += 1
      if (event.status === 'error') {
        current.errors += 1
      }

      bucketMap.set(bucket, current)
    }

    const distribution: KeyspaceActivityPoint[] = Array.from(bucketMap.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([bucket, aggregate]) => ({
        bucket,
        touches: aggregate.touches,
        errors: aggregate.errors,
      }))

    return {
      generatedAt: new Date().toISOString(),
      from: payload.from,
      to: payload.to,
      topPatterns,
      distribution,
    }
  }

  public async getFailedOperationDrilldown(
    payload: FailedOperationDrilldownRequest,
  ): Promise<FailedOperationDrilldownResult> {
    const timeline = await this.historyRepository.query({
      connectionId: payload.connectionId,
      from: payload.from,
      to: payload.to,
      limit: clampInteger(payload.limit, 1, 5000, 1000),
    })

    const errorEvents = timeline.filter((event) => event.status === 'error')
    const selectedEvents = payload.eventId
      ? errorEvents.filter((event) => event.id === payload.eventId)
      : errorEvents.slice(0, payload.limit)

    const diagnostics = await Promise.all(
      selectedEvents.map(async (event): Promise<FailedOperationDiagnostic> => {
        const eventTime = new Date(event.timestamp).getTime()
        const relatedEvents = timeline
          .filter((candidate) => {
            if (candidate.connectionId !== event.connectionId) {
              return false
            }

            if (candidate.keyOrPattern !== event.keyOrPattern) {
              return false
            }

            const candidateTime = new Date(candidate.timestamp).getTime()
            if (Number.isNaN(eventTime) || Number.isNaN(candidateTime)) {
              return false
            }

            return Math.abs(candidateTime - eventTime) <= 5 * 60 * 1000
          })
          .slice(0, 10)

        const snapshots = await this.observabilityRepository.query({
          connectionId: event.connectionId,
          to: event.timestamp,
          limit: 1,
        })

        return {
          event,
          retryAttempts:
            typeof event.details?.attempts === 'number'
              ? Math.max(1, Math.trunc(event.details.attempts))
              : 1,
          relatedEvents,
          latestSnapshot: snapshots[0],
        }
      }),
    )

    return {
      generatedAt: new Date().toISOString(),
      diagnostics,
    }
  }

  public async comparePeriods(
    payload: ComparePeriodsRequest,
  ): Promise<ComparePeriodsResult> {
    const baseline = await this.aggregatePeriodMetrics({
      connectionId: payload.connectionId,
      from: payload.baselineFrom,
      to: payload.baselineTo,
    })
    const compare = await this.aggregatePeriodMetrics({
      connectionId: payload.connectionId,
      from: payload.compareFrom,
      to: payload.compareTo,
    })

    const metrics: CompareMetricDelta[] = [
      buildCompareMetric({
        metric: 'operationCount',
        baseline: baseline.operationCount,
        compare: compare.operationCount,
        lowerIsBetter: false,
      }),
      buildCompareMetric({
        metric: 'errorRate',
        baseline: baseline.errorRate,
        compare: compare.errorRate,
        lowerIsBetter: true,
      }),
      buildCompareMetric({
        metric: 'latencyP95Ms',
        baseline: baseline.latencyP95Ms,
        compare: compare.latencyP95Ms,
        lowerIsBetter: true,
      }),
      buildCompareMetric({
        metric: 'slowOpCount',
        baseline: baseline.slowOpCount,
        compare: compare.slowOpCount,
        lowerIsBetter: true,
      }),
    ]

    return {
      generatedAt: new Date().toISOString(),
      baselineLabel: `${payload.baselineFrom} -> ${payload.baselineTo}`,
      compareLabel: `${payload.compareFrom} -> ${payload.compareTo}`,
      metrics,
    }
  }

  public async previewIncidentBundle(
    payload: IncidentBundlePreviewRequest,
  ): Promise<IncidentBundlePreview> {
    const data = await this.collectIncidentBundleData(payload)
    const timelineCount = data.timeline.length
    const logCount = data.logs.length
    const diagnosticCount = data.diagnostics.length
    const metricCount = data.metrics.length
    const estimatedSizeBytes =
      timelineCount * 520 +
      logCount * 340 +
      diagnosticCount * 780 +
      metricCount * 220

    const checksumPreview = createHash('sha256')
      .update(
        JSON.stringify({
          from: payload.from,
          to: payload.to,
          connectionIds: data.connectionIds,
          includes: payload.includes,
          redactionProfile: payload.redactionProfile,
          timelineCount,
          logCount,
          diagnosticCount,
          metricCount,
        }),
      )
      .digest('hex')

    return {
      from: payload.from,
      to: payload.to,
      connectionIds: data.connectionIds,
      includes: payload.includes,
      redactionProfile: payload.redactionProfile,
      timelineCount,
      logCount,
      diagnosticCount,
      metricCount,
      estimatedSizeBytes,
      checksumPreview,
    }
  }

  public async listIncidentBundles(
    payload: IncidentBundleListRequest,
  ): Promise<IncidentBundle[]> {
    return this.incidentBundleRepository.list(payload.limit)
  }

  public async exportIncidentBundle(
    payload: IncidentBundleExportRequest,
  ): Promise<IncidentBundle> {
    const preview = await this.previewIncidentBundle(payload)
    const data = await this.collectIncidentBundleData(payload)
    const id = uuidv4()
    const createdAt = new Date().toISOString()
    const checksum = createHash('sha256')
      .update(
        JSON.stringify({
          id,
          createdAt,
          preview,
          timeline: data.timeline.map((event) => event.id),
          logs: data.logs.map((event) => event.id),
          diagnostics: data.diagnostics.map((item) => item.event.id),
          metrics: data.metrics.map((snapshot) => snapshot.id),
        }),
      )
      .digest('hex')

    const artifactPath =
      payload.destinationPath?.trim() ||
      path.join(os.tmpdir(), `cachify-incident-${id}.json`)

    const artifactPayload = {
      metadata: {
        id,
        createdAt,
        from: payload.from,
        to: payload.to,
        connectionIds: data.connectionIds,
        includes: payload.includes,
        redactionProfile: payload.redactionProfile,
        checksum,
      },
      timeline:
        payload.redactionProfile === 'strict'
          ? data.timeline.map((event): HistoryEvent => ({
              ...event,
              details: undefined,
              redactedDiff: undefined,
            }))
          : data.timeline,
      logs:
        payload.redactionProfile === 'strict'
          ? data.logs.map((event) => ({
              ...event,
              message: redactMessage(event.message),
            }))
          : data.logs,
      diagnostics:
        payload.redactionProfile === 'strict'
          ? data.diagnostics.map((entry): FailedOperationDiagnostic => ({
              ...entry,
              event: {
                ...entry.event,
                details: undefined,
                redactedDiff: undefined,
              },
              relatedEvents: entry.relatedEvents.map((related): HistoryEvent => ({
                ...related,
                details: undefined,
                redactedDiff: undefined,
              })),
            }))
          : data.diagnostics,
      metrics: data.metrics,
    }

    try {
      fs.mkdirSync(path.dirname(artifactPath), { recursive: true })
      fs.writeFileSync(
        artifactPath,
        JSON.stringify(artifactPayload, null, 2),
        'utf8',
      )
    } catch (error) {
      throw new OperationFailure(
        'INTERNAL_ERROR',
        'Incident bundle could not be written to disk.',
        false,
        {
          artifactPath,
          cause: error instanceof Error ? error.message : 'unknown',
        },
      )
    }

    const bundle: IncidentBundle = {
      id,
      createdAt,
      from: payload.from,
      to: payload.to,
      connectionIds: data.connectionIds,
      includes: payload.includes,
      redactionProfile: payload.redactionProfile,
      checksum,
      artifactPath,
      timelineCount: preview.timelineCount,
      logCount: preview.logCount,
      diagnosticCount: preview.diagnosticCount,
      metricCount: preview.metricCount,
    }

    await this.incidentBundleRepository.save(bundle)

    return bundle
  }

  public async listAlertRules(): Promise<AlertRule[]> {
    return []
  }

  public async createAlertRule(
    payload: AlertRuleCreateRequest,
  ): Promise<AlertRule> {
    void payload
    this.unsupportedV3('alert rule create')
  }

  public async updateAlertRule(
    payload: AlertRuleUpdateRequest,
  ): Promise<AlertRule> {
    void payload
    this.unsupportedV3('alert rule update')
  }

  public async deleteAlertRule(
    payload: AlertRuleDeleteRequest,
  ): Promise<MutationResult> {
    void payload
    this.unsupportedV3('alert rule delete')
  }

  public async listGovernancePolicyPacks(): Promise<GovernancePolicyPack[]> {
    return []
  }

  public async createGovernancePolicyPack(
    payload: GovernancePolicyPackCreateRequest,
  ): Promise<GovernancePolicyPack> {
    void payload
    this.unsupportedV3('governance policy pack create')
  }

  public async updateGovernancePolicyPack(
    payload: GovernancePolicyPackUpdateRequest,
  ): Promise<GovernancePolicyPack> {
    void payload
    this.unsupportedV3('governance policy pack update')
  }

  public async deleteGovernancePolicyPack(
    payload: GovernancePolicyPackDeleteRequest,
  ): Promise<MutationResult> {
    void payload
    this.unsupportedV3('governance policy pack delete')
  }

  public async assignGovernancePolicyPack(
    payload: GovernanceAssignmentRequest,
  ): Promise<MutationResult> {
    void payload
    this.unsupportedV3('governance policy pack assignment')
  }

  public async listGovernanceAssignments(
    payload: GovernanceAssignmentListRequest,
  ): Promise<GovernanceAssignment[]> {
    void payload
    return []
  }

  public async listRetentionPolicies(): Promise<RetentionPolicyListResult> {
    return {
      policies: [
        {
          dataset: 'timelineEvents',
          retentionDays: 30,
          storageBudgetMb: 512,
          autoPurgeOldest: true,
        },
        {
          dataset: 'observabilitySnapshots',
          retentionDays: 30,
          storageBudgetMb: 512,
          autoPurgeOldest: true,
        },
        {
          dataset: 'workflowHistory',
          retentionDays: 30,
          storageBudgetMb: 512,
          autoPurgeOldest: true,
        },
        {
          dataset: 'incidentArtifacts',
          retentionDays: 30,
          storageBudgetMb: 512,
          autoPurgeOldest: true,
        },
      ],
    }
  }

  public async updateRetentionPolicy(
    payload: RetentionPolicyUpdateRequest,
  ): Promise<RetentionPolicy> {
    return payload.policy
  }

  public async purgeRetentionData(
    payload: RetentionPurgeRequest,
  ): Promise<RetentionPurgeResult> {
    return {
      dataset: payload.dataset,
      cutoff: payload.olderThan ?? new Date().toISOString(),
      dryRun: Boolean(payload.dryRun),
      deletedRows: 0,
      freedBytes: 0,
    }
  }

  public async getStorageSummary(): Promise<StorageSummary> {
    return {
      generatedAt: new Date().toISOString(),
      datasets: [],
      totalBytes: 0,
    }
  }

  private async aggregatePeriodMetrics(args: {
    connectionId?: string
    from: string
    to: string
  }): Promise<{
    operationCount: number
    errorRate: number
    latencyP95Ms: number
    slowOpCount: number
  }> {
    const events = await this.historyRepository.query({
      connectionId: args.connectionId,
      from: args.from,
      to: args.to,
      limit: 5000,
    })
    const operationCount = events.length
    const errorCount = events.filter((event) => event.status === 'error').length
    const slowOpCount = events.filter(
      (event) => event.durationMs >= SLOW_OPERATION_THRESHOLD_MS,
    ).length
    const sortedDurations = events
      .map((event) => event.durationMs)
      .sort((left, right) => left - right)

    return {
      operationCount,
      errorRate:
        operationCount === 0
          ? 0
          : Number((errorCount / operationCount).toFixed(3)),
      latencyP95Ms: percentile(sortedDurations, 0.95),
      slowOpCount,
    }
  }

  private async collectIncidentBundleData(args: {
    from: string
    to: string
    connectionIds?: string[]
    includes: IncidentBundle['includes']
  }): Promise<{
    connectionIds: string[]
    timeline: HistoryEvent[]
    logs: AlertEvent[]
    diagnostics: FailedOperationDiagnostic[]
    metrics: ObservabilitySnapshot[]
  }> {
    const include = new Set(args.includes)
    const connectionFilter =
      args.connectionIds && args.connectionIds.length > 0
        ? new Set(args.connectionIds)
        : null
    const limit = 5000

    const shouldFilterConnection = (
      connectionId?: string,
    ): connectionId is string => {
      if (!connectionFilter) {
        return true
      }

      if (!connectionId) {
        return false
      }

      return connectionFilter.has(connectionId)
    }

    const baseTimeline = await this.historyRepository.query({
      from: args.from,
      to: args.to,
      limit,
    })
    const scopedTimeline = baseTimeline.filter((event) =>
      shouldFilterConnection(event.connectionId),
    )

    const alerts = await this.alertRepository.list({
      unreadOnly: false,
      limit,
    })
    const scopedLogs = alerts.filter((event) => {
      if (event.createdAt < args.from || event.createdAt > args.to) {
        return false
      }

      return shouldFilterConnection(event.connectionId)
    })

    const snapshots = await this.observabilityRepository.query({
      from: args.from,
      to: args.to,
      limit,
    })
    const scopedSnapshots = snapshots.filter((snapshot) =>
      shouldFilterConnection(snapshot.connectionId),
    )

    const snapshotsByConnection = new Map<string, ObservabilitySnapshot[]>()
    for (const snapshot of scopedSnapshots) {
      const list = snapshotsByConnection.get(snapshot.connectionId) ?? []
      list.push(snapshot)
      snapshotsByConnection.set(snapshot.connectionId, list)
    }

    const diagnostics: FailedOperationDiagnostic[] = scopedTimeline
      .filter((event) => event.status === 'error')
      .map((event) => {
        const eventTime = new Date(event.timestamp).getTime()
        const relatedEvents = scopedTimeline
          .filter((candidate) => {
            if (candidate.connectionId !== event.connectionId) {
              return false
            }

            if (candidate.keyOrPattern !== event.keyOrPattern) {
              return false
            }

            const candidateTime = new Date(candidate.timestamp).getTime()
            if (Number.isNaN(eventTime) || Number.isNaN(candidateTime)) {
              return false
            }

            return Math.abs(candidateTime - eventTime) <= 5 * 60 * 1000
          })
          .slice(0, 10)

        const latestSnapshot = (snapshotsByConnection.get(event.connectionId) ?? [])
          .filter((snapshot) => snapshot.timestamp <= event.timestamp)
          .sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0]

        return {
          event,
          retryAttempts:
            typeof event.details?.attempts === 'number'
              ? Math.max(1, Math.trunc(event.details.attempts))
              : 1,
          relatedEvents,
          latestSnapshot,
        }
      })

    const resolvedConnectionIds = connectionFilter
      ? Array.from(connectionFilter)
      : Array.from(
          new Set([
            ...scopedTimeline.map((event) => event.connectionId),
            ...scopedLogs
              .map((event) => event.connectionId)
              .filter((value): value is string => Boolean(value)),
            ...scopedSnapshots.map((snapshot) => snapshot.connectionId),
          ]),
        )

    return {
      connectionIds: resolvedConnectionIds,
      timeline: include.has('timeline') ? scopedTimeline : [],
      logs: include.has('logs') ? scopedLogs : [],
      diagnostics: include.has('diagnostics') ? diagnostics : [],
      metrics: include.has('metrics') ? scopedSnapshots : [],
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

  private async enforceWritable(
    profile: ConnectionProfile,
    action: string,
    keyOrPattern: string,
  ): Promise<void> {
    try {
      assertConnectionWritable(profile)
    } catch (error) {
      const failure = this.toOperationFailure(error)
      await this.recordOperation({
        profile,
        action,
        keyOrPattern,
        durationMs: 0,
        status: 'blocked',
        error: failure,
        attempts: 1,
      })
      throw failure
    }
  }

  private async enforceProdGuardrail(
    profile: ConnectionProfile,
    action: string,
    keyOrPattern: string,
    guardrailConfirmed?: boolean,
  ): Promise<void> {
    if (profile.environment !== 'prod' || guardrailConfirmed) {
      return
    }

    const failure = new OperationFailure(
      'UNAUTHORIZED',
      'This action targets a prod-tagged connection and requires explicit confirmation.',
      false,
      {
        connectionId: profile.id,
        policy: 'prodGuardrail',
        action,
      },
    )

    await this.recordOperation({
      profile,
      action,
      keyOrPattern,
      durationMs: 0,
      status: 'blocked',
      error: failure,
      attempts: 1,
    })

    throw failure
  }

  private async captureSnapshot(
    profile: ConnectionProfile,
    secret: ConnectionSecret,
    key: string,
    reason: SnapshotRecord['reason'],
  ): Promise<void> {
    try {
      const valueRecord = await this.cacheGateway.getValue(profile, secret, key)

      if (valueRecord.value === null && valueRecord.ttlSeconds === null) {
        return
      }

      await this.snapshotRepository.save({
        id: uuidv4(),
        connectionId: profile.id,
        key,
        capturedAt: new Date().toISOString(),
        redactedValueHash: createHash('sha256')
          .update(valueRecord.value ?? '')
          .digest('hex'),
        value: valueRecord.value,
        ttlSeconds: valueRecord.ttlSeconds ?? undefined,
        reason,
      })
    } catch (error) {
      void error
    }
  }

  private async executeWithPolicy<T>(
    args: ExecuteWithPolicyArgs<T>,
  ): Promise<ExecuteWithPolicyResult<T>> {
    const startedAt = Date.now()
    const timeoutMs = Math.max(
      100,
      args.profile.timeoutMs || DEFAULT_TIMEOUT_MS,
    )
    const retryPolicy = args.retryPolicy ?? this.resolveRetryPolicy(args.profile)

    let attempts = 0
    let errorCount = 0
    let lastFailure: OperationFailure | null = null

    while (attempts < retryPolicy.maxAttempts) {
      attempts += 1

      try {
        const result = await withTimeout(args.run(), timeoutMs)
        const durationMs = Date.now() - startedAt

        if (!args.suppressTelemetry) {
          await this.recordOperation({
            profile: args.profile,
            action: args.action,
            keyOrPattern: args.keyOrPattern,
            durationMs,
            status: 'success',
            attempts,
          })
        }

        return {
          result,
          attempts,
          durationMs,
        }
      } catch (error) {
        const failure = this.toOperationFailure(error)
        errorCount += 1
        lastFailure = this.attachAttemptDetails(failure, attempts)

        const shouldRetry =
          attempts < retryPolicy.maxAttempts && lastFailure.retryable

        if (!shouldRetry) {
          break
        }

        const errorRate = errorCount / attempts
        if (errorRate > retryPolicy.abortOnErrorRate) {
          lastFailure = this.attachAttemptDetails(
            new OperationFailure(
              'CONNECTION_FAILED',
              `Operation "${args.action}" aborted by retry policy.`,
              false,
              {
                abortOnErrorRate: retryPolicy.abortOnErrorRate,
                observedErrorRate: Number(errorRate.toFixed(3)),
              },
            ),
            attempts,
          )
          break
        }

        await delay(getBackoffMs(retryPolicy, attempts))
      }
    }

    const durationMs = Date.now() - startedAt
    const failure = lastFailure ??
      this.attachAttemptDetails(
        new OperationFailure(
          'INTERNAL_ERROR',
          `Operation "${args.action}" failed unexpectedly.`,
          false,
        ),
        attempts,
      )

    if (!args.suppressTelemetry) {
      await this.recordOperation({
        profile: args.profile,
        action: args.action,
        keyOrPattern: args.keyOrPattern,
        durationMs,
        status: 'error',
        error: failure,
        attempts,
      })
    }

    throw failure
  }

  private resolveRetryPolicy(
    profile: ConnectionProfile,
    override?: WorkflowStepRetryPolicy,
  ): RetryPolicy {
    if (override) {
      return {
        maxAttempts: clampInteger(override.maxAttempts, 1, 10, 1),
        backoffMs: clampInteger(override.backoffMs, 0, 120000, 0),
        backoffStrategy: override.backoffStrategy,
        abortOnErrorRate: clampNumber(override.abortOnErrorRate, 0, 1, 1),
      }
    }

    return {
      maxAttempts: clampInteger(
        profile.retryMaxAttempts,
        1,
        10,
        DEFAULT_RETRY_MAX_ATTEMPTS,
      ),
      backoffMs: clampInteger(
        profile.retryBackoffMs,
        0,
        120000,
        DEFAULT_RETRY_BACKOFF_MS,
      ),
      backoffStrategy: profile.retryBackoffStrategy ?? 'fixed',
      abortOnErrorRate: clampNumber(
        profile.retryAbortOnErrorRate,
        0,
        1,
        DEFAULT_RETRY_ABORT_ON_ERROR_RATE,
      ),
    }
  }

  private attachAttemptDetails(
    failure: OperationFailure,
    attempts: number,
  ): OperationFailure {
    return new OperationFailure(
      failure.code,
      failure.message,
      failure.retryable,
      {
        ...failure.details,
        attempts,
      },
    )
  }

  private toOperationFailure(error: unknown): OperationFailure {
    if (error instanceof OperationFailure) {
      return error
    }

    if (
      error instanceof Error &&
      error.message.toLowerCase().includes('timed out')
    ) {
      return new OperationFailure('TIMEOUT', error.message, true)
    }

    if (error instanceof Error) {
      return new OperationFailure('CONNECTION_FAILED', error.message, true)
    }

    return new OperationFailure(
      'INTERNAL_ERROR',
      'Unexpected operation failure.',
      false,
    )
  }

  private async recordOperation(args: {
    profile: ConnectionProfile
    action: string
    keyOrPattern: string
    durationMs: number
    status: OperationStatus
    attempts: number
    error?: OperationFailure
  }): Promise<void> {
    const event: HistoryEvent = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      source: 'app',
      connectionId: args.profile.id,
      environment: args.profile.environment,
      action: args.action,
      keyOrPattern: args.keyOrPattern,
      durationMs: Math.max(0, Math.round(args.durationMs)),
      status: args.status,
      errorCode: args.error?.code,
      retryable: args.error?.retryable,
      details: {
        ...(args.error?.details ?? {}),
        attempts: args.attempts,
      },
    }

    await this.historyRepository.append(event)

    const sample = {
      timestamp: Date.now(),
      durationMs: event.durationMs,
      status: event.status,
    }

    const samples = this.operationSamples.get(args.profile.id) ?? []
    samples.push(sample)

    if (samples.length > 500) {
      samples.shift()
    }

    this.operationSamples.set(args.profile.id, samples)

    const recentSamples = samples.filter(
      (candidate) => Date.now() - candidate.timestamp <= 60_000,
    )

    const durations = recentSamples
      .map((candidate) => candidate.durationMs)
      .sort((left, right) => left - right)

    const errorCount = recentSamples.filter(
      (candidate) => candidate.status === 'error',
    ).length
    const slowCount = recentSamples.filter(
      (candidate) => candidate.durationMs >= SLOW_OPERATION_THRESHOLD_MS,
    ).length

    const snapshot: ObservabilitySnapshot = {
      id: uuidv4(),
      connectionId: args.profile.id,
      timestamp: event.timestamp,
      latencyP50Ms: percentile(durations, 0.5),
      latencyP95Ms: percentile(durations, 0.95),
      errorRate:
        recentSamples.length === 0
          ? 0
          : Number((errorCount / recentSamples.length).toFixed(3)),
      reconnectCount: 0,
      opsPerSecond: Number((recentSamples.length / 60).toFixed(3)),
      slowOpCount: slowCount,
    }

    await this.observabilityRepository.append(snapshot)

    if (event.status === 'error') {
      await this.emitAlert({
        connectionId: args.profile.id,
        environment: args.profile.environment,
        severity: 'warning',
        title: 'Operation failed',
        message: `${args.action} failed on ${args.keyOrPattern}.`,
        source: 'observability',
      })
    } else if (event.status === 'blocked') {
      await this.emitAlert({
        connectionId: args.profile.id,
        environment: args.profile.environment,
        severity: 'warning',
        title: 'Operation blocked by policy',
        message: `${args.action} was blocked by connection policy.`,
        source: 'policy',
      })
    } else if (event.durationMs >= SLOW_OPERATION_THRESHOLD_MS) {
      await this.emitAlert({
        connectionId: args.profile.id,
        environment: args.profile.environment,
        severity: 'info',
        title: 'Slow operation detected',
        message: `${args.action} took ${event.durationMs}ms.`,
        source: 'observability',
      })
    }
  }

  private async emitAlert(args: {
    connectionId?: string
    environment?: ConnectionProfile['environment']
    severity: AlertEvent['severity']
    title: string
    message: string
    source: AlertEvent['source']
  }): Promise<void> {
    const event: AlertEvent = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      connectionId: args.connectionId,
      environment: args.environment,
      severity: args.severity,
      title: args.title,
      message: args.message,
      source: args.source,
      read: false,
    }

    await this.alertRepository.append(event)
    await this.notificationPublisher.notify({
      title: event.title,
      message: event.message,
    })
  }

  private unsupportedV3(feature: string): never {
    throw new OperationFailure(
      'NOT_SUPPORTED',
      `V3 capability not implemented yet: ${feature}.`,
      false,
    )
  }

  private async resolveWorkflowTemplate(args: {
    templateId?: string
    template?: WorkflowTemplateDraft
    parameterOverrides?: Record<string, unknown>
  }): Promise<{ template: WorkflowTemplate; parameters: Record<string, unknown> }> {
    const template = await this.resolveWorkflowTemplateEntity(
      args.templateId,
      args.template,
    )

    return {
      template,
      parameters: {
        ...template.parameters,
        ...(args.parameterOverrides ?? {}),
      },
    }
  }

  private async resolveWorkflowTemplateEntity(
    templateId?: string,
    inlineTemplate?: WorkflowTemplateDraft,
  ): Promise<WorkflowTemplate> {
    if (templateId) {
      const builtin = BUILTIN_WORKFLOW_TEMPLATES.find(
        (template) => template.id === templateId,
      )

      if (builtin) {
        return builtin
      }

      const template = await this.workflowTemplateRepository.findById(templateId)
      if (!template) {
        throw new OperationFailure(
          'VALIDATION_ERROR',
          'Workflow template was not found.',
          false,
          { id: templateId },
        )
      }

      return template
    }

    if (!inlineTemplate) {
      throw new OperationFailure(
        'VALIDATION_ERROR',
        'Either templateId or template must be provided.',
        false,
      )
    }

    return {
      id: `inline-${uuidv4()}`,
      name: inlineTemplate.name,
      kind: inlineTemplate.kind,
      parameters: inlineTemplate.parameters,
      requiresApprovalOnProd: inlineTemplate.requiresApprovalOnProd,
      supportsDryRun: inlineTemplate.supportsDryRun,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  private async buildWorkflowPreview(
    profile: ConnectionProfile,
    secret: ConnectionSecret,
    kind: WorkflowTemplate['kind'],
    parameters: Record<string, unknown>,
    options?: {
      cursor?: string
      limit?: number
    },
  ): Promise<WorkflowDryRunPreview> {
    const previewLimit = clampInteger(options?.limit, 1, 500, 100)

    if (kind === 'warmupSet') {
      const entries = parseWarmupEntries(parameters)
      const startIndex = clampInteger(options?.cursor ? Number(options.cursor) : 0, 0, entries.length, 0)
      const pageEntries = entries.slice(startIndex, startIndex + previewLimit)
      const nextCursor =
        startIndex + previewLimit < entries.length
          ? String(startIndex + previewLimit)
          : undefined

      return {
        kind,
        estimatedCount: entries.length,
        truncated: Boolean(nextCursor),
        nextCursor,
        items: pageEntries.map((entry) => ({
          key: entry.key,
          action: 'setValue',
          valuePreview: entry.value,
          nextTtlSeconds: entry.ttlSeconds,
        })),
      }
    }

    const pattern = getString(parameters.pattern, '*')
    const templateLimit = clampInteger(parameters.limit, 1, 500, 100)
    const searchLimit = clampInteger(options?.limit, 1, 500, templateLimit)

    const searchResult = await this.cacheGateway.searchKeys(profile, secret, {
      pattern,
      cursor: options?.cursor,
      limit: searchLimit,
    })

    const items: WorkflowDryRunPreviewItem[] = []

    if (kind === 'deleteByPattern') {
      for (const key of searchResult.keys) {
        items.push({
          key,
          action: 'delete',
        })
      }
    } else {
      const ttlSeconds = clampInteger(parameters.ttlSeconds, 1, 31536000, 3600)

      for (const key of searchResult.keys) {
        const valueRecord = await this.cacheGateway.getValue(profile, secret, key)
        items.push({
          key,
          action: 'setTtl',
          currentTtlSeconds: valueRecord.ttlSeconds,
          nextTtlSeconds: ttlSeconds,
        })
      }
    }

    return {
      kind,
      estimatedCount: items.length,
      truncated: Boolean(searchResult.nextCursor),
      nextCursor: searchResult.nextCursor,
      items,
    }
  }
}

const buildCompareMetric = (args: {
  metric: CompareMetricDelta['metric']
  baseline: number
  compare: number
  lowerIsBetter: boolean
}): CompareMetricDelta => {
  const delta = Number((args.compare - args.baseline).toFixed(3))
  const deltaPercent =
    args.baseline === 0
      ? args.compare === 0
        ? 0
        : null
      : Number(((args.compare - args.baseline) / args.baseline).toFixed(3))

  let direction: CompareMetricDelta['direction'] = 'unchanged'
  if (delta !== 0) {
    const improved = args.lowerIsBetter ? delta < 0 : delta > 0
    direction = improved ? 'improved' : 'regressed'
  }

  return {
    metric: args.metric,
    baseline: Number(args.baseline.toFixed(3)),
    compare: Number(args.compare.toFixed(3)),
    delta,
    deltaPercent,
    direction,
  }
}

const toKeyspacePattern = (keyOrPattern: string): string => {
  if (keyOrPattern.includes('*')) {
    return keyOrPattern
  }

  const segments = keyOrPattern.split(':').filter((segment) => segment.length > 0)
  if (segments.length <= 1) {
    return keyOrPattern
  }

  return `${segments[0]}:*`
}

const redactMessage = (message: string): string => {
  if (message.length <= 24) {
    return '[redacted]'
  }

  return `${message.slice(0, 8)}...[redacted]...${message.slice(-8)}`
}

const isBuiltinWorkflowId = (id: string): boolean =>
  id.startsWith('builtin-')

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
  forceReadOnly: Boolean(draft.forceReadOnly),
  timeoutMs: clampInteger(draft.timeoutMs, 100, 120000, DEFAULT_TIMEOUT_MS),
  retryMaxAttempts: clampInteger(
    draft.retryMaxAttempts,
    1,
    10,
    DEFAULT_RETRY_MAX_ATTEMPTS,
  ),
  retryBackoffMs: clampInteger(
    draft.retryBackoffMs,
    0,
    120000,
    DEFAULT_RETRY_BACKOFF_MS,
  ),
  retryBackoffStrategy: draft.retryBackoffStrategy ?? 'fixed',
  retryAbortOnErrorRate: clampNumber(
    draft.retryAbortOnErrorRate,
    0,
    1,
    DEFAULT_RETRY_ABORT_ON_ERROR_RATE,
  ),
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
  token:
    secretOverlay.token === undefined ? baseSecret.token : secretOverlay.token,
})

const delay = async (ms: number): Promise<void> => {
  if (ms <= 0) {
    return
  }

  await new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms)
  })
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutHandle: NodeJS.Timeout | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(
            new OperationFailure(
              'TIMEOUT',
              `Operation timed out after ${timeoutMs}ms.`,
              true,
            ),
          )
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }
}

const getBackoffMs = (policy: RetryPolicy, attempt: number): number => {
  if (policy.backoffStrategy === 'fixed') {
    return policy.backoffMs
  }

  return policy.backoffMs * Math.max(1, 2 ** Math.max(0, attempt - 1))
}

const clampInteger = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, Math.trunc(value)))
}

const clampNumber = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, value))
}

const getString = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : fallback
}

const parseWarmupEntries = (
  parameters: Record<string, unknown>,
): Array<{ key: string; value: string; ttlSeconds?: number }> => {
  const rawEntries = parameters.entries
  if (!Array.isArray(rawEntries)) {
    return []
  }

  const entries: Array<{ key: string; value: string; ttlSeconds?: number }> = []

  for (const rawEntry of rawEntries) {
    if (typeof rawEntry !== 'object' || rawEntry === null) {
      continue
    }

    const candidate = rawEntry as Record<string, unknown>
    if (typeof candidate.key !== 'string') {
      continue
    }

    entries.push({
      key: candidate.key,
      value: typeof candidate.value === 'string' ? candidate.value : '',
      ttlSeconds:
        typeof candidate.ttlSeconds === 'number' && candidate.ttlSeconds > 0
          ? Math.trunc(candidate.ttlSeconds)
          : undefined,
    })
  }

  return entries
}

const toTimeBucket = (timestamp: string, intervalMinutes: number): string => {
  const date = new Date(timestamp)

  if (Number.isNaN(date.getTime())) {
    return timestamp
  }

  const intervalMs = Math.max(1, intervalMinutes) * 60_000
  const bucket = Math.floor(date.getTime() / intervalMs) * intervalMs

  return new Date(bucket).toISOString()
}

const percentile = (samples: number[], point: number): number => {
  if (samples.length === 0) {
    return 0
  }

  const index = Math.min(
    samples.length - 1,
    Math.max(0, Math.floor(point * (samples.length - 1))),
  )

  return samples[index]
}
