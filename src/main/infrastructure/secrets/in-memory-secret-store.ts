import type { ConnectionSecret } from '../../../shared/contracts/cache'

import type { SecretStore } from '../../application/ports'
import { OperationFailure } from '../../domain/operation-failure'

export class InMemorySecretStore implements SecretStore {
  private readonly map = new Map<string, ConnectionSecret>()

  public async saveSecret(
    profileId: string,
    secret: ConnectionSecret,
  ): Promise<void> {
    this.map.set(profileId, secret)
  }

  public async getSecret(profileId: string): Promise<ConnectionSecret> {
    const secret = this.map.get(profileId)
    if (!secret) {
      throw new OperationFailure(
        'VALIDATION_ERROR',
        'No secret is stored for this connection profile.',
        false,
        { profileId },
      )
    }

    return secret
  }

  public async deleteSecret(profileId: string): Promise<void> {
    this.map.delete(profileId)
  }
}
