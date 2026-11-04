import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { readScalarInt } from "./connection.js";

export interface DatabaseInspection {
  readonly integrity: string;
  readonly schemaVersion: number;
  readonly tableCount: number;
}

/**
 * Creates a consistent snapshot of the live database with `VACUUM INTO`.
 *
 * The target must not exist; SQLite refuses to overwrite a backup, and this
 * adapter fails early with a clearer message.
 */
export function backupDatabase(database: DatabaseSync, targetPath: string): void {
  if (existsSync(targetPath)) {
    throw new Error(`Backup target already exists: ${targetPath}`);
  }

  mkdirSync(dirname(targetPath), { recursive: true });

  database.prepare("VACUUM INTO ?").run(targetPath);
}

/** Opens a database read-only for inspection and closes it again. */
export function inspectDatabase(databasePath: string): DatabaseInspection {
  if (!existsSync(databasePath)) {
    throw new Error(`Database file not found: ${databasePath}`);
  }

  const database = new DatabaseSync(databasePath);

  try {
    const integrityRow = database.prepare("PRAGMA integrity_check").get();
    const integrityValue = integrityRow === undefined ? undefined : Object.values(integrityRow)[0];

    let schemaVersion = 0;

    try {
      schemaVersion = readScalarInt(database, "SELECT COALESCE(MAX(version), 0) FROM schema_migrations");
    } catch {
      // A database without migrations has no schema version yet.
      schemaVersion = 0;
    }

    const tableCount = readScalarInt(
      database,
      "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    );

    return {
      integrity: typeof integrityValue === "string" ? integrityValue : "unknown",
      schemaVersion,
      tableCount,
    };
  } finally {
    database.close();
  }
}

/**
 * Restores a backup into a new file and verifies it.
 *
 * Refuses to overwrite an existing database so runtime data is never
 * destroyed by an accidental restore.
 */
export function restoreDatabase(backupPath: string, targetPath: string): DatabaseInspection {
  if (!existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  if (existsSync(targetPath)) {
    throw new Error(`Restore target already exists: ${targetPath}`);
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  copyFileSync(backupPath, targetPath);

  return inspectDatabase(targetPath);
}
