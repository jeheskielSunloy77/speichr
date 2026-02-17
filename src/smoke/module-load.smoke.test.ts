import { describe, expect, it } from 'vitest'

describe('module load smoke', () => {
  it('loads critical runtime modules', async () => {
    const [serviceModule, sqliteModule, ipcSchemaModule] = await Promise.all([
      import('../main/application/cachify-service'),
      import('../main/persistence/sqlite'),
      import('../shared/schemas/ipc'),
    ])

    expect(typeof serviceModule.CachifyService).toBe('function')
    expect(typeof sqliteModule.createSqliteDatabase).toBe('function')
    expect(ipcSchemaModule.commandEnvelopeSchema).toBeDefined()
  })
})
