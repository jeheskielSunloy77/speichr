import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import BetterSqlite3 from 'better-sqlite3'

import { createSqliteDatabase } from '../../src/main/persistence/sqlite'

const REQUIRED_TABLES = [
	'connection_profiles',
	'memcached_key_index',
	'key_snapshots',
	'workflow_templates',
	'workflow_executions',
	'history_events',
	'observability_snapshots',
	'alert_events',
	'alert_rules',
	'governance_policy_packs',
	'governance_assignments',
	'incident_bundles',
	'retention_policies',
]

const REQUIRED_CONNECTION_COLUMNS = [
	'force_read_only',
	'retry_max_attempts',
	'retry_backoff_ms',
	'retry_backoff_strategy',
	'retry_abort_on_error_rate',
]

const REQUIRED_WORKFLOW_EXECUTION_COLUMNS = [
	'checkpoint_token',
	'policy_pack_id',
	'schedule_window_id',
	'resumed_from_execution_id',
]

const assert = (condition: unknown, message: string): void => {
	if (!condition) {
		throw new Error(message)
	}
}

const isAbiMismatch = (error: unknown): boolean => {
	if (!(error instanceof Error)) {
		return false
	}

	return error.message.includes('NODE_MODULE_VERSION')
}

const tableExists = (
	db: BetterSqlite3.Database,
	tableName: string,
): boolean => {
	const row = db
		.prepare(
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`,
		)
		.get(tableName) as { name: string } | undefined

	return Boolean(row?.name)
}

const getColumnNames = (
	db: BetterSqlite3.Database,
	tableName: string,
): Set<string> => {
	const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
		name: string
	}>

	return new Set(rows.map((row) => row.name))
}

const createLegacySchema = (dbPath: string): void => {
	const db = new BetterSqlite3(dbPath)
	db.exec(`
    CREATE TABLE connection_profiles (
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

    CREATE TABLE memcached_key_index (
      connection_id TEXT NOT NULL,
      cache_key TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (connection_id, cache_key)
    );
  `)
	db.close()
}

const tempDirectory = fs.mkdtempSync(
	path.join(os.tmpdir(), 'speichr-migration-check-'),
)

try {
	try {
		const freshPath = path.join(tempDirectory, 'fresh.db')
		const freshDb = createSqliteDatabase(freshPath)

		for (const tableName of REQUIRED_TABLES) {
			assert(
				tableExists(freshDb, tableName),
				`Missing required table after fresh migration: ${tableName}`,
			)
		}

		const freshColumns = getColumnNames(freshDb, 'connection_profiles')
		for (const columnName of REQUIRED_CONNECTION_COLUMNS) {
			assert(
				freshColumns.has(columnName),
				`Missing required connection_profiles column in fresh schema: ${columnName}`,
			)
		}
		const workflowColumns = getColumnNames(freshDb, 'workflow_executions')
		for (const columnName of REQUIRED_WORKFLOW_EXECUTION_COLUMNS) {
			assert(
				workflowColumns.has(columnName),
				`Missing required workflow_executions column in fresh schema: ${columnName}`,
			)
		}
		freshDb.close()

		const legacyPath = path.join(tempDirectory, 'legacy.db')
		createLegacySchema(legacyPath)

		const upgradedDb = createSqliteDatabase(legacyPath)
		const upgradedColumns = getColumnNames(upgradedDb, 'connection_profiles')
		for (const columnName of REQUIRED_CONNECTION_COLUMNS) {
			assert(
				upgradedColumns.has(columnName),
				`Legacy upgrade did not add column: ${columnName}`,
			)
		}
		const upgradedWorkflowColumns = getColumnNames(
			upgradedDb,
			'workflow_executions',
		)
		for (const columnName of REQUIRED_WORKFLOW_EXECUTION_COLUMNS) {
			assert(
				upgradedWorkflowColumns.has(columnName),
				`Legacy upgrade did not add workflow_executions column: ${columnName}`,
			)
		}
		upgradedDb.close()

		console.log('Migration integrity checks passed.')
	} catch (error) {
		if (isAbiMismatch(error)) {
			console.warn(
				'Migration integrity check skipped: better-sqlite3 native module ABI mismatch.',
			)
		} else {
			throw error
		}
	}
} finally {
	fs.rmSync(tempDirectory, { recursive: true, force: true })
}
