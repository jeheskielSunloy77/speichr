import type { OperationErrorCode } from '../../shared/contracts/cache'

export class OperationFailure extends Error {
  public readonly code: OperationErrorCode

  public readonly retryable: boolean

  public readonly details?: Record<string, unknown>

  public constructor(
    code: OperationErrorCode,
    message: string,
    retryable = false,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'OperationFailure'
    this.code = code
    this.retryable = retryable
    this.details = details
  }
}
