import { deleteDatabaseAsync, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite'
import type {
  AuthorityOutboxRecord,
  AuthorityResourceType,
  CanonicalResourceBundle,
} from '@nexvoy/core'
import type {
  MobileAuthorityDatabase,
  MobileAuthorityDatabaseReader,
  MobileAuthorityDatabaseTransaction,
  MobileAuthoritySyncState,
  StoredMobileAuthorityResource,
} from './database'

export const MOBILE_AUTHORITY_DATABASE_NAME = 'onvoy-server-authority.db'
export const MOBILE_AUTHORITY_SCHEMA_VERSION = 1

interface SqlExecutor {
  runAsync(source: string, params: (string | number | null)[]): Promise<unknown>
  getFirstAsync<T>(source: string, params: (string | number | null)[]): Promise<T | null>
  getAllAsync<T>(source: string, params: (string | number | null)[]): Promise<T[]>
}

interface ResourceRow {
  account_id: string
  resource_type: AuthorityResourceType
  resource_id: string
  bundle_json: string
  canonical_bundle_json: string
  local_updated_at: string
}

interface OutboxRow {
  operation_id: string
  account_id: string
  resource_type: AuthorityResourceType
  resource_id: string
  base_revision: number
  command_json: string
  status: AuthorityOutboxRecord['status']
  attempts: number
  next_attempt_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

interface SyncStateRow {
  account_id: string
  resource_type: AuthorityResourceType
  resource_id: string
  last_seen_revision: number
  last_reconciled_revision: number
  last_refreshed_at: string | null
  last_error: string | null
  updated_at: string
}

export async function openMobileAuthorityDatabase(
  databaseName = MOBILE_AUTHORITY_DATABASE_NAME,
): Promise<MobileAuthorityDatabase> {
  const database = await openDatabaseAsync(databaseName)
  try {
    await migrateDatabase(database)
    return new ExpoMobileAuthorityDatabase(database)
  } catch (error) {
    await database.closeAsync()
    throw error
  }
}

export function deleteMobileAuthorityDatabase(
  databaseName = MOBILE_AUTHORITY_DATABASE_NAME,
): Promise<void> {
  return deleteDatabaseAsync(databaseName)
}

class ExpoMobileAuthorityDatabase implements MobileAuthorityDatabase {
  private readonly reader: MobileAuthorityDatabaseReader

  constructor(private readonly database: SQLiteDatabase) {
    this.reader = createDatabaseReader(database)
  }

  getResource(...args: Parameters<MobileAuthorityDatabaseReader['getResource']>) {
    return this.reader.getResource(...args)
  }

  listResources(...args: Parameters<MobileAuthorityDatabaseReader['listResources']>) {
    return this.reader.listResources(...args)
  }

  getOutbox(...args: Parameters<MobileAuthorityDatabaseReader['getOutbox']>) {
    return this.reader.getOutbox(...args)
  }

  listOutbox(...args: Parameters<MobileAuthorityDatabaseReader['listOutbox']>) {
    return this.reader.listOutbox(...args)
  }

  getSyncState(...args: Parameters<MobileAuthorityDatabaseReader['getSyncState']>) {
    return this.reader.getSyncState(...args)
  }

  listSyncStates(...args: Parameters<MobileAuthorityDatabaseReader['listSyncStates']>) {
    return this.reader.listSyncStates(...args)
  }

  async transaction<T>(
    task: (transaction: MobileAuthorityDatabaseTransaction) => Promise<T>,
  ): Promise<T> {
    let result: T | undefined
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      result = await task(createDatabaseTransaction(transaction))
    })
    return result as T
  }

  close(): Promise<void> {
    return this.database.closeAsync()
  }
}

async function migrateDatabase(database: SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `)
  const versionRow = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  )
  const currentVersion = versionRow?.user_version ?? 0
  if (currentVersion > MOBILE_AUTHORITY_SCHEMA_VERSION) {
    throw new Error(`Unsupported mobile authority schema version: ${currentVersion}`)
  }
  if (currentVersion === MOBILE_AUTHORITY_SCHEMA_VERSION) return

  await database.withExclusiveTransactionAsync(async (transaction) => {
    if (currentVersion < 1) {
      await transaction.execAsync(`
        CREATE TABLE IF NOT EXISTS authority_resources (
          account_id TEXT NOT NULL,
          resource_type TEXT NOT NULL CHECK (resource_type IN ('trip', 'template')),
          resource_id TEXT NOT NULL,
          bundle_json TEXT NOT NULL,
          canonical_bundle_json TEXT NOT NULL,
          revision INTEGER NOT NULL,
          server_updated_at TEXT NOT NULL,
          local_updated_at TEXT NOT NULL,
          PRIMARY KEY (account_id, resource_type, resource_id)
        );

        CREATE INDEX IF NOT EXISTS authority_resources_account_updated_idx
          ON authority_resources (account_id, resource_type, server_updated_at DESC);

        CREATE TABLE IF NOT EXISTS authority_outbox (
          operation_id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          resource_type TEXT NOT NULL CHECK (resource_type IN ('trip', 'template')),
          resource_id TEXT NOT NULL,
          base_revision INTEGER NOT NULL,
          command_json TEXT NOT NULL,
          status TEXT NOT NULL CHECK (
            status IN ('pending', 'sending', 'acked', 'retryable', 'rejected', 'conflict')
          ),
          attempts INTEGER NOT NULL DEFAULT 0,
          next_attempt_at TEXT,
          last_error TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (account_id, resource_type, resource_id)
            REFERENCES authority_resources (account_id, resource_type, resource_id)
            ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS authority_outbox_ready_idx
          ON authority_outbox (account_id, status, next_attempt_at, created_at);
        CREATE INDEX IF NOT EXISTS authority_outbox_resource_idx
          ON authority_outbox (account_id, resource_type, resource_id, created_at);

        CREATE TABLE IF NOT EXISTS authority_sync_state (
          account_id TEXT NOT NULL,
          resource_type TEXT NOT NULL CHECK (resource_type IN ('trip', 'template')),
          resource_id TEXT NOT NULL,
          last_seen_revision INTEGER NOT NULL DEFAULT 0,
          last_reconciled_revision INTEGER NOT NULL DEFAULT 0,
          last_refreshed_at TEXT,
          last_error TEXT,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (account_id, resource_type, resource_id),
          FOREIGN KEY (account_id, resource_type, resource_id)
            REFERENCES authority_resources (account_id, resource_type, resource_id)
            ON DELETE CASCADE
        );

        PRAGMA user_version = 1;
      `)
    }
  })
}

function createDatabaseReader(executor: SqlExecutor): MobileAuthorityDatabaseReader {
  return {
    async getResource(accountId, resourceType, resourceId) {
      const row = await executor.getFirstAsync<ResourceRow>(
        `SELECT account_id, resource_type, resource_id, bundle_json,
                canonical_bundle_json, local_updated_at
           FROM authority_resources
          WHERE account_id = ? AND resource_type = ? AND resource_id = ?`,
        [accountId, resourceType, resourceId],
      )
      return row ? parseResourceRow(row) : null
    },

    async listResources(accountId, resourceType) {
      const rows = resourceType
        ? await executor.getAllAsync<ResourceRow>(
            `SELECT account_id, resource_type, resource_id, bundle_json,
                    canonical_bundle_json, local_updated_at
               FROM authority_resources
              WHERE account_id = ? AND resource_type = ?
              ORDER BY server_updated_at DESC`,
            [accountId, resourceType],
          )
        : await executor.getAllAsync<ResourceRow>(
            `SELECT account_id, resource_type, resource_id, bundle_json,
                    canonical_bundle_json, local_updated_at
               FROM authority_resources
              WHERE account_id = ?
              ORDER BY server_updated_at DESC`,
            [accountId],
          )
      return rows.map(parseResourceRow)
    },

    async getOutbox(operationId) {
      const row = await executor.getFirstAsync<OutboxRow>(
        'SELECT * FROM authority_outbox WHERE operation_id = ?',
        [operationId],
      )
      return row ? parseOutboxRow(row) : null
    },

    async listOutbox(accountId, resourceType, resourceId) {
      let sql = 'SELECT * FROM authority_outbox WHERE account_id = ?'
      const params: (string | number | null)[] = [accountId]
      if (resourceType) {
        sql += ' AND resource_type = ?'
        params.push(resourceType)
      }
      if (resourceId) {
        sql += ' AND resource_id = ?'
        params.push(resourceId)
      }
      sql += ' ORDER BY created_at, operation_id'
      const rows = await executor.getAllAsync<OutboxRow>(sql, params)
      return rows.map(parseOutboxRow)
    },

    async getSyncState(accountId, resourceType, resourceId) {
      const row = await executor.getFirstAsync<SyncStateRow>(
        `SELECT * FROM authority_sync_state
          WHERE account_id = ? AND resource_type = ? AND resource_id = ?`,
        [accountId, resourceType, resourceId],
      )
      return row ? parseSyncStateRow(row) : null
    },

    async listSyncStates(accountId) {
      const rows = await executor.getAllAsync<SyncStateRow>(
        'SELECT * FROM authority_sync_state WHERE account_id = ?',
        [accountId],
      )
      return rows.map(parseSyncStateRow)
    },
  }
}

function createDatabaseTransaction(executor: SqlExecutor): MobileAuthorityDatabaseTransaction {
  return {
    ...createDatabaseReader(executor),

    async putResource(resource) {
      await executor.runAsync(
        `INSERT INTO authority_resources (
           account_id, resource_type, resource_id, bundle_json, canonical_bundle_json,
           revision, server_updated_at, local_updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (account_id, resource_type, resource_id) DO UPDATE SET
           bundle_json = excluded.bundle_json,
           canonical_bundle_json = excluded.canonical_bundle_json,
           revision = excluded.revision,
           server_updated_at = excluded.server_updated_at,
           local_updated_at = excluded.local_updated_at`,
        [
          resource.accountId,
          resource.resourceType,
          resource.resourceId,
          JSON.stringify(resource.bundle),
          JSON.stringify(resource.canonicalBundle),
          resource.bundle.revision,
          resource.bundle.serverUpdatedAt,
          resource.updatedAt,
        ],
      )
    },

    async deleteResource(accountId, resourceType, resourceId) {
      await executor.runAsync(
        `DELETE FROM authority_resources
          WHERE account_id = ? AND resource_type = ? AND resource_id = ?`,
        [accountId, resourceType, resourceId],
      )
    },

    async putOutbox(record) {
      await executor.runAsync(
        `INSERT INTO authority_outbox (
           operation_id, account_id, resource_type, resource_id, base_revision,
           command_json, status, attempts, next_attempt_at, last_error, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (operation_id) DO UPDATE SET
           account_id = excluded.account_id,
           resource_type = excluded.resource_type,
           resource_id = excluded.resource_id,
           base_revision = excluded.base_revision,
           command_json = excluded.command_json,
           status = excluded.status,
           attempts = excluded.attempts,
           next_attempt_at = excluded.next_attempt_at,
           last_error = excluded.last_error,
           created_at = excluded.created_at,
           updated_at = excluded.updated_at`,
        [
          record.operationId,
          record.accountId,
          record.resourceType,
          record.resourceId,
          record.baseRevision,
          JSON.stringify(record.command),
          record.status,
          record.attempts,
          record.nextAttemptAt,
          record.lastError,
          record.createdAt,
          record.updatedAt,
        ],
      )
    },

    async deleteOutbox(operationId) {
      await executor.runAsync(
        'DELETE FROM authority_outbox WHERE operation_id = ?',
        [operationId],
      )
    },

    async putSyncState(state) {
      await executor.runAsync(
        `INSERT INTO authority_sync_state (
           account_id, resource_type, resource_id, last_seen_revision,
           last_reconciled_revision, last_refreshed_at, last_error, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (account_id, resource_type, resource_id) DO UPDATE SET
           last_seen_revision = excluded.last_seen_revision,
           last_reconciled_revision = excluded.last_reconciled_revision,
           last_refreshed_at = excluded.last_refreshed_at,
           last_error = excluded.last_error,
           updated_at = excluded.updated_at`,
        [
          state.accountId,
          state.resourceType,
          state.resourceId,
          state.lastSeenRevision,
          state.lastReconciledRevision,
          state.lastRefreshedAt,
          state.lastError,
          state.updatedAt,
        ],
      )
    },

    async deleteAccount(accountId) {
      await executor.runAsync('DELETE FROM authority_outbox WHERE account_id = ?', [accountId])
      await executor.runAsync('DELETE FROM authority_sync_state WHERE account_id = ?', [accountId])
      await executor.runAsync('DELETE FROM authority_resources WHERE account_id = ?', [accountId])
    },

    async purgeResource(accountId, resourceType, resourceId) {
      await executor.runAsync(
        `DELETE FROM authority_outbox
          WHERE account_id = ? AND resource_type = ? AND resource_id = ?`,
        [accountId, resourceType, resourceId],
      )
      await executor.runAsync(
        `DELETE FROM authority_sync_state
          WHERE account_id = ? AND resource_type = ? AND resource_id = ?`,
        [accountId, resourceType, resourceId],
      )
      await executor.runAsync(
        `DELETE FROM authority_resources
          WHERE account_id = ? AND resource_type = ? AND resource_id = ?`,
        [accountId, resourceType, resourceId],
      )
    },
  }
}

function parseResourceRow(row: ResourceRow): StoredMobileAuthorityResource {
  return {
    accountId: row.account_id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    bundle: parseJson<CanonicalResourceBundle>(row.bundle_json),
    canonicalBundle: parseJson<CanonicalResourceBundle>(row.canonical_bundle_json),
    updatedAt: row.local_updated_at,
  }
}

function parseOutboxRow(row: OutboxRow): AuthorityOutboxRecord {
  return {
    operationId: row.operation_id,
    accountId: row.account_id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    baseRevision: row.base_revision,
    command: parseJson<AuthorityOutboxRecord['command']>(row.command_json),
    status: row.status,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function parseSyncStateRow(row: SyncStateRow): MobileAuthoritySyncState {
  return {
    accountId: row.account_id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    lastSeenRevision: row.last_seen_revision,
    lastReconciledRevision: row.last_reconciled_revision,
    lastRefreshedAt: row.last_refreshed_at,
    lastError: row.last_error,
    updatedAt: row.updated_at,
  }
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T
}
