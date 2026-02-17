import { z } from 'zod'

export const correlationIdSchema = z.string().min(1)

export const engineSchema = z.enum(['redis', 'memcached'])
export const environmentSchema = z.enum(['dev', 'staging', 'prod'])

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
    timeoutMs: z.number().int().min(100).max(120000),
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
])

export type ParsedCommandEnvelope = z.infer<typeof commandEnvelopeSchema>
export type ParsedQueryEnvelope = z.infer<typeof queryEnvelopeSchema>
