import fs from 'node:fs'
import path from 'node:path'

import BetterSqlite3 from 'better-sqlite3'

import type {
  AlertEvent,
  AlertListRequest,
  ConnectionProfile,
  HistoryEvent,
  HistoryQueryRequest,
  ObservabilitySnapshot,
  SnapshotRecord,
  WorkflowExecutionListRequest,
  WorkflowExecutionRecord,
  WorkflowStepResult,
  WorkflowTemplate,
} from '../../shared/contracts/cache'
import type {
  AlertRepository,
  ConnectionRepository,
  HistoryRepository,
  MemcachedKeyIndexRepository,
  ObservabilityRepository,
  SnapshotRepository,
  WorkflowExecutionRepository,
  WorkflowTemplateRepository,
} from '../application/ports'

const ensureDirectory = (dbPath: string): void => {
  const directory = path.dirname(dbPath)
  fs.mkdirSync(directory, { recursive: true })
}

const addColumnIfMissing = (
  db: BetterSqlite3.Database,
  tableName: string,
  columnName: string,
  definition: string,
): void => {
  const columns = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>

  if (columns.some((column) => column.name === columnName)) {
    return
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
}

export const createSqliteDatabase = (
  dbPath: string,
): BetterSqlite3.Database => {
  ensureDirectory(dbPath)

  const db = new BetterSqlite3(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)

  return db
}

const runMigrations = (db: BetterSqlite3.Database): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS connection_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      engine TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      db_index INTEGER,
      tls_enabled INTEGER NOT NULL,
      environment TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      secret_ref TEXT NOT NULL,
      read_only INTEGER NOT NULL,
      force_read_only INTEGER NOT NULL DEFAULT 0,
      timeout_ms INTEGER NOT NULL,
      retry_max_attempts INTEGER NOT NULL DEFAULT 1,
      retry_backoff_ms INTEGER NOT NULL DEFAULT 250,
      retry_backoff_strategy TEXT NOT NULL DEFAULT 'fixed',
      retry_abort_on_error_rate REAL NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memcached_key_index (
      connection_id TEXT NOT NULL,
      cache_key TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (connection_id, cache_key),
      FOREIGN KEY (connection_id) REFERENCES connection_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS key_snapshots (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      cache_key TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      redacted_value_hash TEXT NOT NULL,
      value_text TEXT,
      ttl_seconds INTEGER,
      reason TEXT NOT NULL,
      FOREIGN KEY (connection_id) REFERENCES connection_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workflow_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      parameters_json TEXT NOT NULL,
      requires_approval_on_prod INTEGER NOT NULL,
      supports_dry_run INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflow_executions (
      id TEXT PRIMARY KEY,
      workflow_template_id TEXT,
      workflow_name TEXT NOT NULL,
      workflow_kind TEXT NOT NULL,
      connection_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      retry_count INTEGER NOT NULL,
      dry_run INTEGER NOT NULL,
      parameters_json TEXT NOT NULL,
      step_results_json TEXT NOT NULL,
      error_message TEXT,
      FOREIGN KEY (connection_id) REFERENCES connection_profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS history_events (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      source TEXT NOT NULL,
      connection_id TEXT NOT NULL,
      environment TEXT NOT NULL,
      action TEXT NOT NULL,
      key_or_pattern TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      status TEXT NOT NULL,
      redacted_diff TEXT,
      error_code TEXT,
      retryable INTEGER,
      details_json TEXT,
      FOREIGN KEY (connection_id) REFERENCES connection_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS observability_snapshots (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      latency_p50_ms REAL NOT NULL,
      latency_p95_ms REAL NOT NULL,
      error_rate REAL NOT NULL,
      reconnect_count INTEGER NOT NULL,
      ops_per_second REAL NOT NULL,
      slow_op_count INTEGER NOT NULL,
      FOREIGN KEY (connection_id) REFERENCES connection_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS alert_events (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      connection_id TEXT,
      environment TEXT,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      source TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_connection_profiles_engine ON connection_profiles(engine);
    CREATE INDEX IF NOT EXISTS idx_connection_profiles_name ON connection_profiles(name);
    CREATE INDEX IF NOT EXISTS idx_memcached_key_index_connection_id ON memcached_key_index(connection_id);
    CREATE INDEX IF NOT EXISTS idx_key_snapshots_lookup ON key_snapshots(connection_id, cache_key, captured_at DESC);
    CREATE INDEX IF NOT EXISTS idx_workflow_executions_connection ON workflow_executions(connection_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_history_events_connection ON history_events(connection_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_history_events_status ON history_events(status, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_observability_connection ON observability_snapshots(connection_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_alert_events_read ON alert_events(is_read, created_at DESC);
  `)

  addColumnIfMissing(
    db,
    'connection_profiles',
    'force_read_only',
    'INTEGER NOT NULL DEFAULT 0',
  )
  addColumnIfMissing(
    db,
    'connection_profiles',
    'retry_max_attempts',
    'INTEGER NOT NULL DEFAULT 1',
  )
  addColumnIfMissing(
    db,
    'connection_profiles',
    'retry_backoff_ms',
    'INTEGER NOT NULL DEFAULT 250',
  )
  addColumnIfMissing(
    db,
    'connection_profiles',
    'retry_backoff_strategy',
    "TEXT NOT NULL DEFAULT 'fixed'",
  )
  addColumnIfMissing(
    db,
    'connection_profiles',
    'retry_abort_on_error_rate',
    'REAL NOT NULL DEFAULT 1',
  )
}

type ConnectionRow = {
  id: string
  name: string
  engine: 'redis' | 'memcached'
  host: string
  port: number
  db_index: number | null
  tls_enabled: 0 | 1
  environment: 'dev' | 'staging' | 'prod'
  tags_json: string
  secret_ref: string
  read_only: 0 | 1
  force_read_only: 0 | 1
  timeout_ms: number
  retry_max_attempts: number
  retry_backoff_ms: number
  retry_backoff_strategy: 'fixed' | 'exponential'
  retry_abort_on_error_rate: number
  created_at: string
  updated_at: string
}

const parseJson = <T>(raw: string, fallback: T): T => {
  try {
    return JSON.parse(raw) as T
  } catch (error) {
    void error
    return fallback
  }
}

const rowToConnectionProfile = (row: ConnectionRow): ConnectionProfile => ({
  id: row.id,
  name: row.name,
  engine: row.engine,
  host: row.host,
  port: row.port,
  dbIndex: row.db_index ?? undefined,
  tlsEnabled: row.tls_enabled === 1,
  environment: row.environment,
  tags: parseJson<string[]>(row.tags_json, []),
  secretRef: row.secret_ref,
  readOnly: row.read_only === 1,
  forceReadOnly: row.force_read_only === 1,
  timeoutMs: row.timeout_ms,
  retryMaxAttempts: row.retry_max_attempts,
  retryBackoffMs: row.retry_backoff_ms,
  retryBackoffStrategy: row.retry_backoff_strategy,
  retryAbortOnErrorRate: row.retry_abort_on_error_rate,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export class SqliteConnectionRepository implements ConnectionRepository {
  private readonly listStatement: BetterSqlite3.Statement<[], ConnectionRow>

  private readonly findByIdStatement: BetterSqlite3.Statement<
    [string],
    ConnectionRow
  >

  private readonly saveStatement: BetterSqlite3.Statement<[
    string,
    string,
    'redis' | 'memcached',
    string,
    number,
    number | null,
    number,
    'dev' | 'staging' | 'prod',
    string,
    string,
    number,
    number,
    number,
    number,
    number,
    string,
    number,
    string,
    string,
  ]>

  private readonly deleteStatement: BetterSqlite3.Statement<[string]>

  public constructor(private readonly db: BetterSqlite3.Database) {
    this.listStatement = this.db.prepare<[], ConnectionRow>(`
      SELECT
        id,
        name,
        engine,
        host,
        port,
        db_index,
        tls_enabled,
        environment,
        tags_json,
        secret_ref,
        read_only,
        force_read_only,
        timeout_ms,
        retry_max_attempts,
        retry_backoff_ms,
        retry_backoff_strategy,
        retry_abort_on_error_rate,
        created_at,
        updated_at
      FROM connection_profiles
      ORDER BY name COLLATE NOCASE ASC
    `)

    this.findByIdStatement = this.db.prepare<[string], ConnectionRow>(`
      SELECT
        id,
        name,
        engine,
        host,
        port,
        db_index,
        tls_enabled,
        environment,
        tags_json,
        secret_ref,
        read_only,
        force_read_only,
        timeout_ms,
        retry_max_attempts,
        retry_backoff_ms,
        retry_backoff_strategy,
        retry_abort_on_error_rate,
        created_at,
        updated_at
      FROM connection_profiles
      WHERE id = ?
      LIMIT 1
    `)

    this.saveStatement = this.db.prepare(`
      INSERT INTO connection_profiles (
        id,
        name,
        engine,
        host,
        port,
        db_index,
        tls_enabled,
        environment,
        tags_json,
        secret_ref,
        read_only,
        force_read_only,
        timeout_ms,
        retry_max_attempts,
        retry_backoff_ms,
        retry_backoff_strategy,
        retry_abort_on_error_rate,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        engine = excluded.engine,
        host = excluded.host,
        port = excluded.port,
        db_index = excluded.db_index,
        tls_enabled = excluded.tls_enabled,
        environment = excluded.environment,
        tags_json = excluded.tags_json,
        secret_ref = excluded.secret_ref,
        read_only = excluded.read_only,
        force_read_only = excluded.force_read_only,
        timeout_ms = excluded.timeout_ms,
        retry_max_attempts = excluded.retry_max_attempts,
        retry_backoff_ms = excluded.retry_backoff_ms,
        retry_backoff_strategy = excluded.retry_backoff_strategy,
        retry_abort_on_error_rate = excluded.retry_abort_on_error_rate,
        updated_at = excluded.updated_at
    `)

    this.deleteStatement = this.db.prepare('DELETE FROM connection_profiles WHERE id = ?')
  }

  public async list(): Promise<ConnectionProfile[]> {
    const rows = this.listStatement.all()
    return rows.map(rowToConnectionProfile)
  }

  public async findById(id: string): Promise<ConnectionProfile | null> {
    const row = this.findByIdStatement.get(id)
    if (!row) {
      return null
    }

    return rowToConnectionProfile(row)
  }

  public async save(profile: ConnectionProfile): Promise<void> {
    this.saveStatement.run(
      profile.id,
      profile.name,
      profile.engine,
      profile.host,
      profile.port,
      profile.dbIndex ?? null,
      profile.tlsEnabled ? 1 : 0,
      profile.environment,
      JSON.stringify(profile.tags),
      profile.secretRef,
      profile.readOnly ? 1 : 0,
      profile.forceReadOnly ? 1 : 0,
      profile.timeoutMs,
      profile.retryMaxAttempts ?? 1,
      profile.retryBackoffMs ?? 250,
      profile.retryBackoffStrategy ?? 'fixed',
      profile.retryAbortOnErrorRate ?? 1,
      profile.createdAt,
      profile.updatedAt,
    )
  }

  public async delete(id: string): Promise<void> {
    this.deleteStatement.run(id)
  }
}

export class SqliteMemcachedKeyIndexRepository
  implements MemcachedKeyIndexRepository
{
  private readonly listStatement: BetterSqlite3.Statement<
    [string, number],
    { cache_key: string }
  >

  private readonly searchStatement: BetterSqlite3.Statement<
    [string, string, string | null, string | null, number],
    { cache_key: string }
  >

  private readonly upsertStatement: BetterSqlite3.Statement<
    [string, string, string]
  >

  private readonly removeStatement: BetterSqlite3.Statement<[string, string]>

  private readonly removeByConnectionStatement: BetterSqlite3.Statement<
    [string]
  >

  public constructor(private readonly db: BetterSqlite3.Database) {
    this.listStatement = this.db.prepare<[string, number], { cache_key: string }>(`
      SELECT cache_key
      FROM memcached_key_index
      WHERE connection_id = ?
      ORDER BY cache_key COLLATE NOCASE ASC
      LIMIT ?
    `)

    this.searchStatement = this.db.prepare<
      [string, string, string | null, string | null, number],
      { cache_key: string }
    >(`
      SELECT cache_key
      FROM memcached_key_index
      WHERE connection_id = ?
        AND cache_key LIKE ? ESCAPE '\\'
        AND (? IS NULL OR cache_key > ?)
      ORDER BY cache_key COLLATE NOCASE ASC
      LIMIT ?
    `)

    this.upsertStatement = this.db.prepare(`
      INSERT INTO memcached_key_index (connection_id, cache_key, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(connection_id, cache_key) DO UPDATE SET
        updated_at = excluded.updated_at
    `)

    this.removeStatement = this.db.prepare(
      'DELETE FROM memcached_key_index WHERE connection_id = ? AND cache_key = ?',
    )

    this.removeByConnectionStatement = this.db.prepare(
      'DELETE FROM memcached_key_index WHERE connection_id = ?',
    )
  }

  public async listKeys(connectionId: string, limit: number): Promise<string[]> {
    const rows = this.listStatement.all(connectionId, limit)
    return rows.map((row) => row.cache_key)
  }

  public async searchKeys(
    connectionId: string,
    pattern: string,
    limit: number,
    cursor?: string,
  ): Promise<string[]> {
    const sqlPattern = toSqlLikePattern(pattern)
    const cursorValue = cursor ?? null
    const rows = this.searchStatement.all(
      connectionId,
      sqlPattern,
      cursorValue,
      cursorValue,
      limit,
    )
    return rows.map((row) => row.cache_key)
  }

  public async upsertKey(connectionId: string, key: string): Promise<void> {
    this.upsertStatement.run(connectionId, key, new Date().toISOString())
  }

  public async removeKey(connectionId: string, key: string): Promise<void> {
    this.removeStatement.run(connectionId, key)
  }

  public async deleteByConnectionId(connectionId: string): Promise<void> {
    this.removeByConnectionStatement.run(connectionId)
  }
}

type SnapshotRow = {
  id: string
  connection_id: string
  cache_key: string
  captured_at: string
  redacted_value_hash: string
  value_text: string | null
  ttl_seconds: number | null
  reason: 'set' | 'delete' | 'workflow'
}

const rowToSnapshot = (row: SnapshotRow): SnapshotRecord => ({
  id: row.id,
  connectionId: row.connection_id,
  key: row.cache_key,
  capturedAt: row.captured_at,
  redactedValueHash: row.redacted_value_hash,
  value: row.value_text,
  ttlSeconds: row.ttl_seconds ?? undefined,
  reason: row.reason,
})

export class SqliteSnapshotRepository implements SnapshotRepository {
  private readonly saveStatement: BetterSqlite3.Statement<[
    string,
    string,
    string,
    string,
    string,
    string | null,
    number | null,
    string,
  ]>

  private readonly listByConnectionStatement: BetterSqlite3.Statement<
    [string, number],
    SnapshotRow
  >

  private readonly listByKeyStatement: BetterSqlite3.Statement<
    [string, string, number],
    SnapshotRow
  >

  private readonly findLatestStatement: BetterSqlite3.Statement<
    [string, string],
    SnapshotRow
  >

  private readonly findByIdStatement: BetterSqlite3.Statement<[string], SnapshotRow>

  public constructor(private readonly db: BetterSqlite3.Database) {
    this.saveStatement = this.db.prepare(`
      INSERT INTO key_snapshots (
        id,
        connection_id,
        cache_key,
        captured_at,
        redacted_value_hash,
        value_text,
        ttl_seconds,
        reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    this.listByConnectionStatement = this.db.prepare(`
      SELECT
        id,
        connection_id,
        cache_key,
        captured_at,
        redacted_value_hash,
        value_text,
        ttl_seconds,
        reason
      FROM key_snapshots
      WHERE connection_id = ?
      ORDER BY captured_at DESC
      LIMIT ?
    `)

    this.listByKeyStatement = this.db.prepare(`
      SELECT
        id,
        connection_id,
        cache_key,
        captured_at,
        redacted_value_hash,
        value_text,
        ttl_seconds,
        reason
      FROM key_snapshots
      WHERE connection_id = ?
        AND cache_key = ?
      ORDER BY captured_at DESC
      LIMIT ?
    `)

    this.findLatestStatement = this.db.prepare(`
      SELECT
        id,
        connection_id,
        cache_key,
        captured_at,
        redacted_value_hash,
        value_text,
        ttl_seconds,
        reason
      FROM key_snapshots
      WHERE connection_id = ?
        AND cache_key = ?
      ORDER BY captured_at DESC
      LIMIT 1
    `)

    this.findByIdStatement = this.db.prepare(`
      SELECT
        id,
        connection_id,
        cache_key,
        captured_at,
        redacted_value_hash,
        value_text,
        ttl_seconds,
        reason
      FROM key_snapshots
      WHERE id = ?
      LIMIT 1
    `)
  }

  public async save(record: SnapshotRecord): Promise<void> {
    this.saveStatement.run(
      record.id,
      record.connectionId,
      record.key,
      record.capturedAt,
      record.redactedValueHash,
      record.value,
      record.ttlSeconds ?? null,
      record.reason,
    )
  }

  public async list(args: {
    connectionId: string
    key?: string
    limit: number
  }): Promise<SnapshotRecord[]> {
    const rows = args.key
      ? this.listByKeyStatement.all(args.connectionId, args.key, args.limit)
      : this.listByConnectionStatement.all(args.connectionId, args.limit)

    return rows.map(rowToSnapshot)
  }

  public async findLatest(args: {
    connectionId: string
    key: string
  }): Promise<SnapshotRecord | null> {
    const row = this.findLatestStatement.get(args.connectionId, args.key)
    if (!row) {
      return null
    }

    return rowToSnapshot(row)
  }

  public async findById(id: string): Promise<SnapshotRecord | null> {
    const row = this.findByIdStatement.get(id)
    if (!row) {
      return null
    }

    return rowToSnapshot(row)
  }
}

type WorkflowTemplateRow = {
  id: string
  name: string
  kind: 'deleteByPattern' | 'ttlNormalize' | 'warmupSet'
  parameters_json: string
  requires_approval_on_prod: 0 | 1
  supports_dry_run: 0 | 1
  created_at: string
  updated_at: string
}

const rowToWorkflowTemplate = (row: WorkflowTemplateRow): WorkflowTemplate => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  parameters: parseJson(row.parameters_json, {}),
  requiresApprovalOnProd: row.requires_approval_on_prod === 1,
  supportsDryRun: row.supports_dry_run === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export class SqliteWorkflowTemplateRepository
  implements WorkflowTemplateRepository
{
  private readonly saveStatement: BetterSqlite3.Statement<[
    string,
    string,
    string,
    string,
    number,
    number,
    string,
    string,
  ]>

  private readonly listStatement: BetterSqlite3.Statement<[], WorkflowTemplateRow>

  private readonly findByIdStatement: BetterSqlite3.Statement<
    [string],
    WorkflowTemplateRow
  >

  private readonly deleteStatement: BetterSqlite3.Statement<[string]>

  public constructor(private readonly db: BetterSqlite3.Database) {
    this.saveStatement = this.db.prepare(`
      INSERT INTO workflow_templates (
        id,
        name,
        kind,
        parameters_json,
        requires_approval_on_prod,
        supports_dry_run,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        kind = excluded.kind,
        parameters_json = excluded.parameters_json,
        requires_approval_on_prod = excluded.requires_approval_on_prod,
        supports_dry_run = excluded.supports_dry_run,
        updated_at = excluded.updated_at
    `)

    this.listStatement = this.db.prepare(`
      SELECT
        id,
        name,
        kind,
        parameters_json,
        requires_approval_on_prod,
        supports_dry_run,
        created_at,
        updated_at
      FROM workflow_templates
      ORDER BY updated_at DESC
    `)

    this.findByIdStatement = this.db.prepare(`
      SELECT
        id,
        name,
        kind,
        parameters_json,
        requires_approval_on_prod,
        supports_dry_run,
        created_at,
        updated_at
      FROM workflow_templates
      WHERE id = ?
      LIMIT 1
    `)

    this.deleteStatement = this.db.prepare(
      'DELETE FROM workflow_templates WHERE id = ?',
    )
  }

  public async save(template: WorkflowTemplate): Promise<void> {
    this.saveStatement.run(
      template.id,
      template.name,
      template.kind,
      JSON.stringify(template.parameters),
      template.requiresApprovalOnProd ? 1 : 0,
      template.supportsDryRun ? 1 : 0,
      template.createdAt,
      template.updatedAt,
    )
  }

  public async list(): Promise<WorkflowTemplate[]> {
    const rows = this.listStatement.all()
    return rows.map(rowToWorkflowTemplate)
  }

  public async findById(id: string): Promise<WorkflowTemplate | null> {
    const row = this.findByIdStatement.get(id)
    if (!row) {
      return null
    }

    return rowToWorkflowTemplate(row)
  }

  public async delete(id: string): Promise<void> {
    this.deleteStatement.run(id)
  }
}

type WorkflowExecutionRow = {
  id: string
  workflow_template_id: string | null
  workflow_name: string
  workflow_kind: 'deleteByPattern' | 'ttlNormalize' | 'warmupSet'
  connection_id: string
  started_at: string
  finished_at: string | null
  status: 'pending' | 'running' | 'success' | 'error' | 'aborted'
  retry_count: number
  dry_run: 0 | 1
  parameters_json: string
  step_results_json: string
  error_message: string | null
}

const rowToWorkflowExecution = (
  row: WorkflowExecutionRow,
): WorkflowExecutionRecord => ({
  id: row.id,
  workflowTemplateId: row.workflow_template_id ?? undefined,
  workflowName: row.workflow_name,
  workflowKind: row.workflow_kind,
  connectionId: row.connection_id,
  startedAt: row.started_at,
  finishedAt: row.finished_at ?? undefined,
  status: row.status,
  retryCount: row.retry_count,
  dryRun: row.dry_run === 1,
  parameters: parseJson(row.parameters_json, {}),
  stepResults: parseJson<WorkflowStepResult[]>(row.step_results_json, []),
  errorMessage: row.error_message ?? undefined,
})

export class SqliteWorkflowExecutionRepository
  implements WorkflowExecutionRepository
{
  private readonly saveStatement: BetterSqlite3.Statement<[
    string,
    string | null,
    string,
    string,
    string,
    string,
    string | null,
    string,
    number,
    number,
    string,
    string,
    string | null,
  ]>

  private readonly listByAnyStatement: BetterSqlite3.Statement<
    [number],
    WorkflowExecutionRow
  >

  private readonly listByConnectionStatement: BetterSqlite3.Statement<
    [string, number],
    WorkflowExecutionRow
  >

  private readonly listByTemplateStatement: BetterSqlite3.Statement<
    [string, number],
    WorkflowExecutionRow
  >

  private readonly listByConnectionAndTemplateStatement: BetterSqlite3.Statement<
    [string, string, number],
    WorkflowExecutionRow
  >

  private readonly findByIdStatement: BetterSqlite3.Statement<
    [string],
    WorkflowExecutionRow
  >

  public constructor(private readonly db: BetterSqlite3.Database) {
    this.saveStatement = this.db.prepare(`
      INSERT INTO workflow_executions (
        id,
        workflow_template_id,
        workflow_name,
        workflow_kind,
        connection_id,
        started_at,
        finished_at,
        status,
        retry_count,
        dry_run,
        parameters_json,
        step_results_json,
        error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        workflow_template_id = excluded.workflow_template_id,
        workflow_name = excluded.workflow_name,
        workflow_kind = excluded.workflow_kind,
        connection_id = excluded.connection_id,
        started_at = excluded.started_at,
        finished_at = excluded.finished_at,
        status = excluded.status,
        retry_count = excluded.retry_count,
        dry_run = excluded.dry_run,
        parameters_json = excluded.parameters_json,
        step_results_json = excluded.step_results_json,
        error_message = excluded.error_message
    `)

    const baseSelect = `
      SELECT
        id,
        workflow_template_id,
        workflow_name,
        workflow_kind,
        connection_id,
        started_at,
        finished_at,
        status,
        retry_count,
        dry_run,
        parameters_json,
        step_results_json,
        error_message
      FROM workflow_executions
    `

    this.listByAnyStatement = this.db.prepare(`
      ${baseSelect}
      ORDER BY started_at DESC
      LIMIT ?
    `)

    this.listByConnectionStatement = this.db.prepare(`
      ${baseSelect}
      WHERE connection_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `)

    this.listByTemplateStatement = this.db.prepare(`
      ${baseSelect}
      WHERE workflow_template_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `)

    this.listByConnectionAndTemplateStatement = this.db.prepare(`
      ${baseSelect}
      WHERE connection_id = ?
        AND workflow_template_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `)

    this.findByIdStatement = this.db.prepare(`
      ${baseSelect}
      WHERE id = ?
      LIMIT 1
    `)
  }

  public async save(record: WorkflowExecutionRecord): Promise<void> {
    this.saveStatement.run(
      record.id,
      record.workflowTemplateId ?? null,
      record.workflowName,
      record.workflowKind,
      record.connectionId,
      record.startedAt,
      record.finishedAt ?? null,
      record.status,
      record.retryCount,
      record.dryRun ? 1 : 0,
      JSON.stringify(record.parameters),
      JSON.stringify(record.stepResults),
      record.errorMessage ?? null,
    )
  }

  public async list(
    args: WorkflowExecutionListRequest,
  ): Promise<WorkflowExecutionRecord[]> {
    const rows = args.connectionId
      ? args.templateId
        ? this.listByConnectionAndTemplateStatement.all(
            args.connectionId,
            args.templateId,
            args.limit,
          )
        : this.listByConnectionStatement.all(args.connectionId, args.limit)
      : args.templateId
        ? this.listByTemplateStatement.all(args.templateId, args.limit)
        : this.listByAnyStatement.all(args.limit)

    return rows.map(rowToWorkflowExecution)
  }

  public async findById(id: string): Promise<WorkflowExecutionRecord | null> {
    const row = this.findByIdStatement.get(id)
    if (!row) {
      return null
    }

    return rowToWorkflowExecution(row)
  }
}

type HistoryRow = {
  id: string
  timestamp: string
  source: 'app' | 'engine'
  connection_id: string
  environment: 'dev' | 'staging' | 'prod'
  action: string
  key_or_pattern: string
  duration_ms: number
  status: 'success' | 'error' | 'blocked'
  redacted_diff: string | null
  error_code: string | null
  retryable: number | null
  details_json: string | null
}

const rowToHistoryEvent = (row: HistoryRow): HistoryEvent => ({
  id: row.id,
  timestamp: row.timestamp,
  source: row.source,
  connectionId: row.connection_id,
  environment: row.environment,
  action: row.action,
  keyOrPattern: row.key_or_pattern,
  durationMs: row.duration_ms,
  status: row.status,
  redactedDiff: row.redacted_diff ?? undefined,
  errorCode: row.error_code as HistoryEvent['errorCode'],
  retryable:
    row.retryable === null ? undefined : row.retryable === 1,
  details: row.details_json ? parseJson(row.details_json, {}) : undefined,
})

export class SqliteHistoryRepository implements HistoryRepository {
  private readonly insertStatement: BetterSqlite3.Statement<[
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    number,
    string,
    string | null,
    string | null,
    number | null,
    string | null,
  ]>

  private readonly queryStatement: BetterSqlite3.Statement<
    [
      string | null,
      string | null,
      string | null,
      string | null,
      string | null,
      string | null,
      number,
    ],
    HistoryRow
  >

  public constructor(private readonly db: BetterSqlite3.Database) {
    this.insertStatement = this.db.prepare(`
      INSERT INTO history_events (
        id,
        timestamp,
        source,
        connection_id,
        environment,
        action,
        key_or_pattern,
        duration_ms,
        status,
        redacted_diff,
        error_code,
        retryable,
        details_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    this.queryStatement = this.db.prepare(`
      SELECT
        id,
        timestamp,
        source,
        connection_id,
        environment,
        action,
        key_or_pattern,
        duration_ms,
        status,
        redacted_diff,
        error_code,
        retryable,
        details_json
      FROM history_events
      WHERE (? IS NULL OR connection_id = ?)
        AND (? IS NULL OR timestamp >= ?)
        AND (? IS NULL OR timestamp <= ?)
      ORDER BY timestamp DESC
      LIMIT ?
    `)
  }

  public async append(event: HistoryEvent): Promise<void> {
    this.insertStatement.run(
      event.id,
      event.timestamp,
      event.source,
      event.connectionId,
      event.environment,
      event.action,
      event.keyOrPattern,
      event.durationMs,
      event.status,
      event.redactedDiff ?? null,
      event.errorCode ?? null,
      event.retryable === undefined ? null : event.retryable ? 1 : 0,
      event.details ? JSON.stringify(event.details) : null,
    )
  }

  public async query(args: HistoryQueryRequest): Promise<HistoryEvent[]> {
    const rows = this.queryStatement.all(
      args.connectionId ?? null,
      args.connectionId ?? null,
      args.from ?? null,
      args.from ?? null,
      args.to ?? null,
      args.to ?? null,
      args.limit,
    )

    return rows.map(rowToHistoryEvent)
  }
}

type ObservabilityRow = {
  id: string
  connection_id: string
  timestamp: string
  latency_p50_ms: number
  latency_p95_ms: number
  error_rate: number
  reconnect_count: number
  ops_per_second: number
  slow_op_count: number
}

const rowToObservability = (row: ObservabilityRow): ObservabilitySnapshot => ({
  id: row.id,
  connectionId: row.connection_id,
  timestamp: row.timestamp,
  latencyP50Ms: row.latency_p50_ms,
  latencyP95Ms: row.latency_p95_ms,
  errorRate: row.error_rate,
  reconnectCount: row.reconnect_count,
  opsPerSecond: row.ops_per_second,
  slowOpCount: row.slow_op_count,
})

export class SqliteObservabilityRepository implements ObservabilityRepository {
  private readonly insertStatement: BetterSqlite3.Statement<[
    string,
    string,
    string,
    number,
    number,
    number,
    number,
    number,
    number,
  ]>

  private readonly queryStatement: BetterSqlite3.Statement<
    [
      string | null,
      string | null,
      string | null,
      string | null,
      string | null,
      string | null,
      number,
    ],
    ObservabilityRow
  >

  public constructor(private readonly db: BetterSqlite3.Database) {
    this.insertStatement = this.db.prepare(`
      INSERT INTO observability_snapshots (
        id,
        connection_id,
        timestamp,
        latency_p50_ms,
        latency_p95_ms,
        error_rate,
        reconnect_count,
        ops_per_second,
        slow_op_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    this.queryStatement = this.db.prepare(`
      SELECT
        id,
        connection_id,
        timestamp,
        latency_p50_ms,
        latency_p95_ms,
        error_rate,
        reconnect_count,
        ops_per_second,
        slow_op_count
      FROM observability_snapshots
      WHERE (? IS NULL OR connection_id = ?)
        AND (? IS NULL OR timestamp >= ?)
        AND (? IS NULL OR timestamp <= ?)
      ORDER BY timestamp DESC
      LIMIT ?
    `)
  }

  public async append(snapshot: ObservabilitySnapshot): Promise<void> {
    this.insertStatement.run(
      snapshot.id,
      snapshot.connectionId,
      snapshot.timestamp,
      snapshot.latencyP50Ms,
      snapshot.latencyP95Ms,
      snapshot.errorRate,
      snapshot.reconnectCount,
      snapshot.opsPerSecond,
      snapshot.slowOpCount,
    )
  }

  public async query(args: {
    connectionId?: string
    from?: string
    to?: string
    limit: number
  }): Promise<ObservabilitySnapshot[]> {
    const rows = this.queryStatement.all(
      args.connectionId ?? null,
      args.connectionId ?? null,
      args.from ?? null,
      args.from ?? null,
      args.to ?? null,
      args.to ?? null,
      args.limit,
    )

    return rows.map(rowToObservability)
  }
}

type AlertRow = {
  id: string
  created_at: string
  connection_id: string | null
  environment: 'dev' | 'staging' | 'prod' | null
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  source: 'app' | 'policy' | 'workflow' | 'observability'
  is_read: 0 | 1
}

const rowToAlert = (row: AlertRow): AlertEvent => ({
  id: row.id,
  createdAt: row.created_at,
  connectionId: row.connection_id ?? undefined,
  environment: row.environment ?? undefined,
  severity: row.severity,
  title: row.title,
  message: row.message,
  source: row.source,
  read: row.is_read === 1,
})

export class SqliteAlertRepository implements AlertRepository {
  private readonly insertStatement: BetterSqlite3.Statement<[
    string,
    string,
    string | null,
    string | null,
    string,
    string,
    string,
    string,
    number,
  ]>

  private readonly listStatement: BetterSqlite3.Statement<
    [number | null, number | null, number],
    AlertRow
  >

  private readonly markReadStatement: BetterSqlite3.Statement<[string]>

  public constructor(private readonly db: BetterSqlite3.Database) {
    this.insertStatement = this.db.prepare(`
      INSERT INTO alert_events (
        id,
        created_at,
        connection_id,
        environment,
        severity,
        title,
        message,
        source,
        is_read
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    this.listStatement = this.db.prepare(`
      SELECT
        id,
        created_at,
        connection_id,
        environment,
        severity,
        title,
        message,
        source,
        is_read
      FROM alert_events
      WHERE (? IS NULL OR is_read = ?)
      ORDER BY created_at DESC
      LIMIT ?
    `)

    this.markReadStatement = this.db.prepare(
      'UPDATE alert_events SET is_read = 1 WHERE id = ?',
    )
  }

  public async append(event: AlertEvent): Promise<void> {
    this.insertStatement.run(
      event.id,
      event.createdAt,
      event.connectionId ?? null,
      event.environment ?? null,
      event.severity,
      event.title,
      event.message,
      event.source,
      event.read ? 1 : 0,
    )
  }

  public async list(request: AlertListRequest): Promise<AlertEvent[]> {
    const readFilter = request.unreadOnly ? 0 : null
    const rows = this.listStatement.all(readFilter, readFilter, request.limit)

    return rows.map(rowToAlert)
  }

  public async markRead(id: string): Promise<void> {
    this.markReadStatement.run(id)
  }
}

const toSqlLikePattern = (inputPattern: string): string => {
  const escaped = inputPattern
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_')

  return escaped.replaceAll('*', '%')
}
