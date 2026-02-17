import path from 'node:path'

import { app, BrowserWindow } from 'electron'
import started from 'electron-squirrel-startup'
import type BetterSqlite3 from 'better-sqlite3'

import { CachifyService } from './application/cachify-service'
import { DesktopNotificationPublisher } from './infrastructure/notifications/desktop-notification-publisher'
import { DefaultCacheGateway } from './infrastructure/providers/cache-gateway'
import { ProviderEngineEventIngestor } from './infrastructure/providers/provider-engine-event-ingestor'
import { InMemorySecretStore } from './infrastructure/secrets/in-memory-secret-store'
import { KeytarSecretStore } from './infrastructure/secrets/keytar-secret-store'
import { registerIpcHandlers } from './interface-adapters/ipc'
import {
  SqliteAlertRepository,
  createSqliteDatabase,
  SqliteConnectionRepository,
  SqliteHistoryRepository,
  SqliteMemcachedKeyIndexRepository,
  SqliteObservabilityRepository,
  SqliteSnapshotRepository,
  SqliteWorkflowExecutionRepository,
  SqliteWorkflowTemplateRepository,
} from './persistence/sqlite'

if (started) {
  app.quit()
}

type RuntimeContext = {
  db: BetterSqlite3.Database
  service: CachifyService
}

let runtime: RuntimeContext | null = null

const initializeRuntime = (): RuntimeContext => {
  if (runtime) {
    return runtime
  }

  const databasePath = path.join(app.getPath('userData'), 'cachify-studio.db')
  const db = createSqliteDatabase(databasePath)

  const connectionRepository = new SqliteConnectionRepository(db)
  const memcachedKeyIndexRepository = new SqliteMemcachedKeyIndexRepository(db)
  const snapshotRepository = new SqliteSnapshotRepository(db)
  const workflowTemplateRepository = new SqliteWorkflowTemplateRepository(db)
  const workflowExecutionRepository = new SqliteWorkflowExecutionRepository(db)
  const historyRepository = new SqliteHistoryRepository(db)
  const observabilityRepository = new SqliteObservabilityRepository(db)
  const alertRepository = new SqliteAlertRepository(db)

  const secretStore =
    process.env.CACHIFY_SECRET_STORE === 'memory'
      ? new InMemorySecretStore()
      : new KeytarSecretStore()

  const cacheGateway = new DefaultCacheGateway(memcachedKeyIndexRepository)
  const engineEventIngestor = new ProviderEngineEventIngestor(
    connectionRepository,
    cacheGateway,
  )
  const notificationPublisher = new DesktopNotificationPublisher()

  const service = new CachifyService(
    connectionRepository,
    secretStore,
    memcachedKeyIndexRepository,
    cacheGateway,
    {
      snapshotRepository,
      workflowTemplateRepository,
      workflowExecutionRepository,
      historyRepository,
      observabilityRepository,
      alertRepository,
      notificationPublisher,
      engineEventIngestor,
    },
  )

  registerIpcHandlers(service)

  runtime = {
    db,
    service,
  }

  return runtime
}

const createMainWindow = (): BrowserWindow => {
  const mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1120,
    minHeight: 700,
    title: 'Cachify Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    )
  }

  return mainWindow
}

app.whenReady().then(async () => {
  const context = initializeRuntime()
  await context.service.startEngineEventIngestion().catch((error: unknown): void => {
    void error
  })
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  void runtime?.service.stopEngineEventIngestion().catch((error: unknown): void => {
    void error
  })
  runtime?.db.close()
  runtime = null
})
