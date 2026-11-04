import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const IN_MEMORY_DATABASE = ":memory:";

export interface OpenDatabaseOptions {
  /**
   * Create the parent directory of a file database. Defaults to true.
   * Set to false when the caller already manages the directory.
   */
  readonly createParentDirectory?: boolean;
}

/**
 * Opens a SQLite database with the approved connection settings from
 * docs/DATABASE.md section 2.
 *
 * All database access in the agent must go through this adapter so the
 * experimental `node:sqlite` API can be replaced without touching callers.
 */
export function openDatabase(
  databasePath: string,
  options: OpenDatabaseOptions = {},
): DatabaseSync {
  if (databasePath !== IN_MEMORY_DATABASE && options.createParentDirectory !== false) {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);

  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA busy_timeout = 5000");
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA synchronous = NORMAL");

  return database;
}

/**
 * Runs a synchronous unit of work inside an immediate transaction.
 *
 * Nested transactions are not supported; callers must keep transactions short.
 * If the operation throws, the transaction is rolled back and the error is
 * re-thrown unchanged.
 */
export function withTransaction<T>(database: DatabaseSync, operation: () => T): T {
  database.exec("BEGIN IMMEDIATE");

  try {
    const result = operation();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // SQLite may have already rolled back; preserve the original error.
    }
    throw error;
  }
}

/** Reads a single scalar integer from a prepared statement. */
export function readScalarInt(database: DatabaseSync, sql: string): number {
  const row = database.prepare(sql).get();

  if (row === undefined) {
    return 0;
  }

  const value = Object.values(row)[0];

  return typeof value === "number" ? value : Number(value ?? 0);
}
