import { ipcMain } from 'electron'
import { ZodError } from 'zod'

import type {
  AnyCommandEnvelope,
  AnyQueryEnvelope,
  IpcResponseEnvelope,
  OperationError,
} from '../../shared/ipc/contracts'
import {
  IPC_COMMAND_CHANNEL,
  IPC_QUERY_CHANNEL,
} from '../../shared/ipc/contracts'
import {
  commandEnvelopeSchema,
  queryEnvelopeSchema,
} from '../../shared/schemas/ipc'

import type { CachifyService } from '../application/cachify-service'
import { OperationFailure } from '../domain/operation-failure'

export const registerIpcHandlers = (service: CachifyService): void => {
  ipcMain.removeHandler(IPC_COMMAND_CHANNEL)
  ipcMain.removeHandler(IPC_QUERY_CHANNEL)

  ipcMain.handle(
    IPC_COMMAND_CHANNEL,
    async (_event, rawEnvelope): Promise<IpcResponseEnvelope<unknown>> => {
      try {
        const envelope = commandEnvelopeSchema.parse(rawEnvelope)
        const data = await handleCommand(service, envelope)

        return {
          ok: true,
          correlationId: envelope.correlationId,
          data,
        }
      } catch (error) {
        return toErrorResponse(error, rawEnvelope)
      }
    },
  )

  ipcMain.handle(
    IPC_QUERY_CHANNEL,
    async (_event, rawEnvelope): Promise<IpcResponseEnvelope<unknown>> => {
      try {
        const envelope = queryEnvelopeSchema.parse(rawEnvelope)
        const data = await handleQuery(service, envelope)

        return {
          ok: true,
          correlationId: envelope.correlationId,
          data,
        }
      } catch (error) {
        return toErrorResponse(error, rawEnvelope)
      }
    },
  )
}

const handleCommand = async (
  service: CachifyService,
  envelope: AnyCommandEnvelope,
): Promise<unknown> => {
  switch (envelope.command) {
    case 'connection.create':
      return service.createConnection(envelope.payload)
    case 'connection.update':
      return service.updateConnection(envelope.payload)
    case 'connection.delete':
      return service.deleteConnection(envelope.payload)
    case 'connection.test':
      return service.testConnection(envelope.payload)
    case 'key.set':
      return service.setKey(envelope.payload)
    case 'key.delete':
      return service.deleteKey(envelope.payload)
    case 'rollback.restore':
    case 'workflow.template.create':
    case 'workflow.template.update':
    case 'workflow.template.delete':
    case 'workflow.execute':
    case 'workflow.rerun':
    case 'alert.markRead':
      throw new OperationFailure(
        'NOT_SUPPORTED',
        `Command "${envelope.command}" is not available yet.`,
        false,
      )
    default:
      return assertNever(envelope)
  }
}

const handleQuery = async (
  service: CachifyService,
  envelope: AnyQueryEnvelope,
): Promise<unknown> => {
  switch (envelope.query) {
    case 'connection.list':
      return service.listConnections()
    case 'connection.get':
      return service.getConnection(envelope.payload)
    case 'provider.capabilities':
      return service.getCapabilities(envelope.payload)
    case 'key.list':
      return service.listKeys(envelope.payload)
    case 'key.search':
      return service.searchKeys(envelope.payload)
    case 'key.get':
      return service.getKey(envelope.payload)
    case 'snapshot.list':
    case 'workflow.template.list':
    case 'workflow.preview':
    case 'workflow.execution.list':
    case 'workflow.execution.get':
    case 'history.list':
    case 'observability.dashboard':
    case 'alert.list':
      throw new OperationFailure(
        'NOT_SUPPORTED',
        `Query "${envelope.query}" is not available yet.`,
        false,
      )
    default:
      return assertNever(envelope)
  }
}

const toErrorResponse = (
  error: unknown,
  rawEnvelope: unknown,
): IpcResponseEnvelope<unknown> => {
  const correlationId = getCorrelationId(rawEnvelope)
  const operationError = toOperationError(error)

  return {
    ok: false,
    correlationId,
    error: operationError,
  }
}

const getCorrelationId = (rawEnvelope: unknown): string => {
  if (
    typeof rawEnvelope === 'object' &&
    rawEnvelope !== null &&
    'correlationId' in rawEnvelope &&
    typeof rawEnvelope.correlationId === 'string'
  ) {
    return rawEnvelope.correlationId
  }

  return `invalid-${Date.now()}`
}

const toOperationError = (error: unknown): OperationError => {
  if (error instanceof OperationFailure) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      details: error.details,
    }
  }

  if (error instanceof ZodError) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request payload.',
      retryable: false,
      details: {
        issues: error.issues,
      },
    }
  }

  return {
    code: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : 'Unexpected internal error.',
    retryable: false,
  }
}

const assertNever = (value: never): never => {
  throw new OperationFailure(
    'INTERNAL_ERROR',
    `Unsupported IPC route: ${JSON.stringify(value)}`,
    false,
  )
}
