import path from 'node:path'
import fs from 'node:fs'

import BetterSqlite3 from 'better-sqlite3'

import type { ConnectionProfile } from '../../shared/contracts/cache'

import type {
  ConnectionRepository,
  MemcachedKeyIndexRepository,
} from '../application/ports'

const ensureDirectory = (dbPath: string): void => {
  const directory = path.dirname(dbPath)
  fs.mkdirSync(directory, { recursive: true })
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
      timeout_ms INTEGER NOT NULL,
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

    CREATE INDEX IF NOT EXISTS idx_connection_profiles_engine ON connection_profiles(engine);
    CREATE INDEX IF NOT EXISTS idx_connection_profiles_name ON connection_profiles(name);
    CREATE INDEX IF NOT EXISTS idx_memcached_key_index_connection_id ON memcached_key_index(connection_id);
  `)
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
  timeout_ms: number
  created_at: string
  updated_at: string
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
  tags: JSON.parse(row.tags_json) as string[],
  secretRef: row.secret_ref,
  readOnly: row.read_only === 1,
  timeoutMs: row.timeout_ms,
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
        timeout_ms,
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
        timeout_ms,
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
        timeout_ms,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        timeout_ms = excluded.timeout_ms,
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
      profile.timeoutMs,
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

const toSqlLikePattern = (inputPattern: string): string => {
  const escaped = inputPattern
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_')

  return escaped.replaceAll('*', '%')
}
