import type { ConnectionProfile } from '../../shared/contracts/cache'

import { OperationFailure } from '../domain/operation-failure'

export const assertConnectionWritable = (profile: ConnectionProfile): void => {
  if (profile.readOnly) {
    throw new OperationFailure(
      'UNAUTHORIZED',
      `Connection "${profile.name}" is in read-only mode.`,
      false,
      {
        connectionId: profile.id,
        policy: 'readOnly',
      },
    )
  }
}
