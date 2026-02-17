import { deletePassword, getPassword, setPassword } from 'keytar'

import type { ConnectionSecret } from '../../../shared/contracts/cache'

import type { SecretStore } from '../../application/ports'
import { OperationFailure } from '../../domain/operation-failure'

const SERVICE_NAME = 'cachify-studio'

export class KeytarSecretStore implements SecretStore {
  public async saveSecret(
    profileId: string,
    secret: ConnectionSecret,
  ): Promise<void> {
    const payload = JSON.stringify(secret)

    await setPassword(SERVICE_NAME, profileId, payload)
  }

  public async getSecret(profileId: string): Promise<ConnectionSecret> {
    const value = await getPassword(SERVICE_NAME, profileId)

    if (!value) {
      throw new OperationFailure(
        'VALIDATION_ERROR',
        'No secret is stored for this connection profile.',
        false,
        { profileId },
      )
    }

    try {
      return JSON.parse(value) as ConnectionSecret
    } catch (error) {
      throw new OperationFailure(
        'INTERNAL_ERROR',
        'Stored connection secret could not be parsed.',
        false,
        {
          profileId,
          cause: error instanceof Error ? error.message : 'unknown',
        },
      )
    }
  }

  public async deleteSecret(profileId: string): Promise<void> {
    await deletePassword(SERVICE_NAME, profileId)
  }
}
