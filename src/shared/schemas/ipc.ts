import { z } from 'zod'

export const correlationIdSchema = z.string().min(1)

export const engineSchema = z.enum(['redis', 'memcached'])
export const environmentSchema = z.enum(['dev', 'staging', 'prod'])
export const backoffStrategySchema = z.enum(['fixed', 'exponential'])
export const workflowKindSchema = z.enum([
  'deleteByPattern',
  'ttlNormalize',
  'warmupSet',
])

export const connectionSecretSchema = z
  .object({
    username: z.string().optional(),
    password: z.string().optional(),
    token: z.string().optional(),
  })
  .strict()

export const connectionDraftSchema = z
  .object({
    name: z.string().min(1),
    engine: engineSchema,
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    dbIndex: z.number().int().min(0).optional(),
    tlsEnabled: z.boolean(),
    environment: environmentSchema,
    tags: z.array(z.string()).max(20),
    readOnly: z.boolean(),
    forceReadOnly: z.boolean().optional().default(false),
    timeoutMs: z.number().int().min(100).max(120000),
    retryMaxAttempts: z.number().int().min(1).max(10).optional().default(1),
    retryBackoffMs: z.number().int().min(0).max(120000).optional().default(250),
    retryBackoffStrategy: backoffStrategySchema.optional().default('fixed'),
    retryAbortOnErrorRate: z.number().min(0).max(1).optional().default(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.engine === 'memcached' && typeof value.dbIndex === 'number') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dbIndex'],
        message: 'dbIndex is only supported by redis profiles',
      })
    }
  })

const idSchema = z.string().min(1)

const connectionCreatePayloadSchema = z
  .object({
    profile: connectionDraftSchema,
    secret: connectionSecretSchema,
  })
  .strict()

const connectionUpdatePayloadSchema = z
  .object({
    id: idSchema,
    profile: connectionDraftSchema,
    secret: connectionSecretSchema.optional(),
  })
  .strict()

const connectionDeletePayloadSchema = z
  .object({
    id: idSchema,
  })
  .strict()

const connectionGetPayloadSchema = connectionDeletePayloadSchema

const connectionTestPayloadSchema = z
  .object({
    connectionId: idSchema.optional(),
    profile: connectionDraftSchema,
    secret: connectionSecretSchema,
  })
  .strict()

const capabilityPayloadSchema = z
  .object({
    connectionId: idSchema,
  })
  .strict()

const keyListPayloadSchema = z
  .object({
    connectionId: idSchema,
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(500),
  })
  .strict()

const keySearchPayloadSchema = z
  .object({
    connectionId: idSchema,
    pattern: z.string().min(1),
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(500),
  })
  .strict()

const keyGetPayloadSchema = z
  .object({
    connectionId: idSchema,
    key: z.string().min(1),
  })
  .strict()

const keySetPayloadSchema = z
  .object({
    connectionId: idSchema,
    key: z.string().min(1),
    value: z.string(),
    ttlSeconds: z.number().int().min(1).max(31536000).optional(),
  })
  .strict()

const keyDeletePayloadSchema = z
  .object({
    connectionId: idSchema,
    key: z.string().min(1),
    guardrailConfirmed: z.boolean().optional(),
  })
  .strict()

const snapshotListPayloadSchema = z
  .object({
    connectionId: idSchema,
    key: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(200),
  })
  .strict()

const rollbackRestorePayloadSchema = z
  .object({
    connectionId: idSchema,
    key: z.string().min(1),
    snapshotId: idSchema.optional(),
    guardrailConfirmed: z.boolean().optional(),
  })
  .strict()

const workflowTemplateDraftSchema = z
  .object({
    name: z.string().min(1),
    kind: workflowKindSchema,
    parameters: z.record(z.string(), z.unknown()),
    requiresApprovalOnProd: z.boolean(),
    supportsDryRun: z.boolean(),
  })
  .strict()

const workflowTemplateCreatePayloadSchema = z
  .object({
    template: workflowTemplateDraftSchema,
  })
  .strict()

const workflowTemplateUpdatePayloadSchema = z
  .object({
    id: idSchema,
    template: workflowTemplateDraftSchema,
  })
  .strict()

const workflowTemplateDeletePayloadSchema = z
  .object({
    id: idSchema,
  })
  .strict()

const workflowRetryPolicySchema = z
  .object({
    maxAttempts: z.number().int().min(1).max(10),
    backoffMs: z.number().int().min(0).max(120000),
    backoffStrategy: backoffStrategySchema,
    abortOnErrorRate: z.number().min(0).max(1),
  })
  .strict()

const workflowPreviewPayloadSchema = z
  .object({
    connectionId: idSchema,
    templateId: idSchema.optional(),
    template: workflowTemplateDraftSchema.optional(),
    parameterOverrides: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.templateId && !value.template) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['templateId'],
        message: 'Either templateId or template must be provided',
      })
    }
  })

const workflowExecutePayloadSchema = z
  .object({
    connectionId: idSchema,
    templateId: idSchema.optional(),
    template: workflowTemplateDraftSchema.optional(),
    parameterOverrides: z.record(z.string(), z.unknown()).optional(),
    dryRun: z.boolean().optional(),
    guardrailConfirmed: z.boolean().optional(),
    retryPolicy: workflowRetryPolicySchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.templateId && !value.template) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['templateId'],
        message: 'Either templateId or template must be provided',
      })
    }
  })

const workflowRerunPayloadSchema = z
  .object({
    executionId: idSchema,
    parameterOverrides: z.record(z.string(), z.unknown()).optional(),
    dryRun: z.boolean().optional(),
    guardrailConfirmed: z.boolean().optional(),
  })
  .strict()

const workflowExecutionListPayloadSchema = z
  .object({
    connectionId: idSchema.optional(),
    templateId: idSchema.optional(),
    limit: z.number().int().min(1).max(500),
  })
  .strict()

const workflowExecutionGetPayloadSchema = z
  .object({
    id: idSchema,
  })
  .strict()

const historyListPayloadSchema = z
  .object({
    connectionId: idSchema.optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.number().int().min(1).max(1000),
  })
  .strict()

const observabilityDashboardPayloadSchema = z
  .object({
    connectionId: idSchema.optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    intervalMinutes: z.number().int().min(1).max(1440).optional(),
    limit: z.number().int().min(1).max(2000).optional(),
  })
  .strict()

const alertListPayloadSchema = z
  .object({
    unreadOnly: z.boolean().optional(),
    limit: z.number().int().min(1).max(200),
  })
  .strict()

const alertMarkReadPayloadSchema = z
  .object({
    id: idSchema,
  })
  .strict()

export const commandEnvelopeSchema = z.discriminatedUnion('command', [
  z
    .object({
      command: z.literal('connection.create'),
      payload: connectionCreatePayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      command: z.literal('connection.update'),
      payload: connectionUpdatePayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      command: z.literal('connection.delete'),
      payload: connectionDeletePayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      command: z.literal('connection.test'),
      payload: connectionTestPayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      command: z.literal('key.set'),
      payload: keySetPayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      command: z.literal('key.delete'),
      payload: keyDeletePayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      command: z.literal('rollback.restore'),
      payload: rollbackRestorePayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      command: z.literal('workflow.template.create'),
      payload: workflowTemplateCreatePayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      command: z.literal('workflow.template.update'),
      payload: workflowTemplateUpdatePayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      command: z.literal('workflow.template.delete'),
      payload: workflowTemplateDeletePayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      command: z.literal('workflow.execute'),
      payload: workflowExecutePayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      command: z.literal('workflow.rerun'),
      payload: workflowRerunPayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      command: z.literal('alert.markRead'),
      payload: alertMarkReadPayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
])

export const queryEnvelopeSchema = z.discriminatedUnion('query', [
  z
    .object({
      query: z.literal('connection.list'),
      payload: z.object({}).strict(),
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      query: z.literal('connection.get'),
      payload: connectionGetPayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      query: z.literal('provider.capabilities'),
      payload: capabilityPayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      query: z.literal('key.list'),
      payload: keyListPayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      query: z.literal('key.search'),
      payload: keySearchPayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      query: z.literal('key.get'),
      payload: keyGetPayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      query: z.literal('snapshot.list'),
      payload: snapshotListPayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      query: z.literal('workflow.template.list'),
      payload: z.object({}).strict(),
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      query: z.literal('workflow.preview'),
      payload: workflowPreviewPayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      query: z.literal('workflow.execution.list'),
      payload: workflowExecutionListPayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      query: z.literal('workflow.execution.get'),
      payload: workflowExecutionGetPayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      query: z.literal('history.list'),
      payload: historyListPayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      query: z.literal('observability.dashboard'),
      payload: observabilityDashboardPayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
  z
    .object({
      query: z.literal('alert.list'),
      payload: alertListPayloadSchema,
      correlationId: correlationIdSchema,
    })
    .strict(),
])

export type ParsedCommandEnvelope = z.infer<typeof commandEnvelopeSchema>
export type ParsedQueryEnvelope = z.infer<typeof queryEnvelopeSchema>
