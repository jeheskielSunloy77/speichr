import type { IpcResponseEnvelope } from '@/shared/ipc/contracts'

export class RendererOperationError extends Error {
  public readonly code?: string

  public readonly retryable?: boolean

  public readonly details?: Record<string, unknown>

  public constructor(
    message: string,
    code?: string,
    retryable?: boolean,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'RendererOperationError'
    this.code = code
    this.retryable = retryable
    this.details = details
  }
}

export const unwrapResponse = <T>(response: IpcResponseEnvelope<T>): T => {
  if (!response.ok) {
    throw new RendererOperationError(
      response.error?.message ?? 'Operation failed.',
      response.error?.code,
      response.error?.retryable,
      response.error?.details,
    )
  }

  if (response.data === undefined) {
    throw new RendererOperationError('Response did not include data.')
  }

  return response.data
}
