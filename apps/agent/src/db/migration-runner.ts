import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabaseSync } from "node:sqlite";

import { withTransaction } from "./connection.js";

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
  readonly checksum: string;
}

export interface ApplyMigrationsResult {
  readonly appliedVersions: readonly number[];
  readonly currentVersion: number;
}

export class MigrationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "MigrationError";
  }
}

const MIGRATION_FILE_PATTERN = /^(\d{4})_([a-z0-9_]+)\.sql$/;

const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )
`;

/** Directory containing the committed SQL migrations. */
export function defaultMigrationsDirectory(): string {
  return fileURLToPath(new URL("./migrations/", import.meta.url));
}

function checksumOf(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Loads and validates migration files from a directory.
 *
 * Versions must start at 1 and be contiguous; a gap would make the applied
 * history ambiguous.
 */
export function loadMigrations(directory: string): Migration[] {
  const fileNames = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && MIGRATION_FILE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const migrations: Migration[] = [];

  for (const fileName of fileNames) {
    const match = MIGRATION_FILE_PATTERN.exec(fileName);

    if (match === null || match[1] === undefined) {
      throw new MigrationError(`Unrecognized migration file name: ${fileName}`);
    }

    const sql = readFileSync(join(directory, fileName), "utf8");
    const version = Number.parseInt(match[1], 10);

    migrations.push({
      version,
      name: fileName,
      sql,
      checksum: checksumOf(sql),
    });
  }

  migrations.forEach((migration, index) => {
    const expectedVersion = index + 1;

    if (migration.version !== expectedVersion) {
      throw new MigrationError(
        `Migration versions must be contiguous starting at 1; expected ${expectedVersion}, found ${migration.version} (${migration.name})`,
      );
    }
  });

  return migrations;
}

interface AppliedMigrationRow {
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
}

/**
 * Applies pending migrations in order and records their checksums.
 *
 * Applied migrations whose content changed are rejected. A partially applied
 * migration is rolled back, leaving `schema_migrations` unchanged.
 */
export function applyMigrations(
  database: DatabaseSync,
  migrations: readonly Migration[],
): ApplyMigrationsResult {
  database.exec(CREATE_MIGRATIONS_TABLE);

  const appliedRows = database
    .prepare("SELECT version, name, checksum FROM schema_migrations ORDER BY version")
    .all() as unknown as AppliedMigrationRow[];

  const appliedVersions = new Set(appliedRows.map((row) => row.version));
  const highestApplied = appliedRows.reduce((max, row) => Math.max(max, row.version), 0);
  const appliedVersionsList: number[] = [];

  for (const migration of migrations) {
    const appliedRow = appliedRows.find((row) => row.version === migration.version);

    if (appliedRow !== undefined) {
      if (appliedRow.checksum !== migration.checksum) {
        throw new MigrationError(
          `Migration ${migration.name} was modified after being applied; checksum mismatch`,
        );
      }

      continue;
    }

    if (migration.version < highestApplied) {
      throw new MigrationError(
        `Missing migration ${migration.version} while the database is already at version ${highestApplied}`,
      );
    }
  }

  for (const row of appliedRows) {
    if (!migrations.some((migration) => migration.version === row.version)) {
      throw new MigrationError(
        `Database reports applied migration ${row.version} (${row.name}) that is not present on disk`,
      );
    }
  }

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    withTransaction(database, () => {
      database.exec(migration.sql);
      database
        .prepare(
          "INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)",
        )
        .run(migration.version, migration.name, migration.checksum, new Date().toISOString());
    });

    appliedVersionsList.push(migration.version);
  }

  const currentVersion = readCurrentVersion(database);

  return { appliedVersions: appliedVersionsList, currentVersion };
}

/** Highest applied migration version, or 0 for an empty database. */
export function readCurrentVersion(database: DatabaseSync): number {
  const row = database
    .prepare(
      "SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations",
    )
    .get() as unknown as { version: number } | undefined;

  return row?.version ?? 0;
}
