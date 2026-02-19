import { createRequire } from 'node:module'

import type { ConnectionSecret } from '../../../shared/contracts/cache'

import type { SecretStore } from '../../application/ports'
import { OperationFailure } from '../../domain/operation-failure'

const SERVICE_NAME = 'cachify-studio'
const nodeRequire = createRequire(__filename)
type KeytarModule = {
  deletePassword: (service: string, account: string) => Promise<boolean>
  getPassword: (service: string, account: string) => Promise<string | null>
  setPassword: (
    service: string,
    account: string,
    password: string,
  ) => Promise<void>
}

const loadKeytar = (): KeytarModule => {
  try {
    const moduleName = 'keytar'
    return nodeRequire(moduleName) as KeytarModule
  } catch (error) {
    throw new OperationFailure(
      'INTERNAL_ERROR',
      'System keychain integration is unavailable on this environment.',
      false,
      {
        cause: error instanceof Error ? error.message : 'unknown',
      },
    )
  }
}

export class KeytarSecretStore implements SecretStore {
  private readonly keytar: KeytarModule

  public constructor() {
    this.keytar = loadKeytar()
  }

  public async saveSecret(
    profileId: string,
    secret: ConnectionSecret,
  ): Promise<void> {
    const payload = JSON.stringify(secret)

    await this.keytar.setPassword(SERVICE_NAME, profileId, payload)
  }

  public async getSecret(profileId: string): Promise<ConnectionSecret> {
    const value = await this.keytar.getPassword(SERVICE_NAME, profileId)

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
    await this.keytar.deletePassword(SERVICE_NAME, profileId)
  }
}
