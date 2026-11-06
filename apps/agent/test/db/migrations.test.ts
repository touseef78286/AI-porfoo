import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

import { openDatabase, readScalarInt } from "../../src/db/connection.js";
import {
  applyMigrations,
  defaultMigrationsDirectory,
  loadMigrations,
  MigrationError,
  readCurrentVersion,
} from "../../src/db/migration-runner.js";
import { createWorkspaceTempDir, removeWorkspaceTempDir } from "../helpers/workspace-temp.js";

const openDatabases: DatabaseSync[] = [];
const tempDirectories: string[] = [];

function track(database: DatabaseSync): DatabaseSync {
  openDatabases.push(database);
  return database;
}

function writeMigration(directory: string, fileName: string, sql: string): void {
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, fileName), sql, "utf8");
}

afterEach(() => {
  for (const database of openDatabases) {
    try {
      database.close();
    } catch {
      // Already closed.
    }
  }

  openDatabases.length = 0;

  for (const directory of tempDirectories) {
    removeWorkspaceTempDir(directory);
  }

  tempDirectories.length = 0;
});

describe("loadMigrations", () => {
  it("loads the committed migrations with SHA-256 checksums", () => {
    const migrations = loadMigrations(defaultMigrationsDirectory());

    expect(migrations).toHaveLength(2);

    const first = migrations[0];

    expect(first?.version).toBe(1);
    expect(first?.name).toBe("0001_discovery_schema.sql");
    expect(first?.checksum).toMatch(/^[0-9a-f]{64}$/);

    const second = migrations[1];

    expect(second?.version).toBe(2);
    expect(second?.name).toBe("0002_publication.sql");
    expect(second?.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects non-contiguous versions", () => {
    const directory = createWorkspaceTempDir("migrations-gap");
    tempDirectories.push(directory);

    writeMigration(directory, "0001_first.sql", "CREATE TABLE a (id TEXT PRIMARY KEY);");
    writeMigration(directory, "0003_third.sql", "CREATE TABLE c (id TEXT PRIMARY KEY);");

    expect(() => loadMigrations(directory)).toThrow(MigrationError);
  });
});

describe("applyMigrations", () => {
  it("applies the schema to an empty database", () => {
    const database = track(openDatabase(":memory:"));
    const migrations = loadMigrations(defaultMigrationsDirectory());

    const result = applyMigrations(database, migrations);

    expect(result.appliedVersions).toEqual([1, 2]);
    expect(result.currentVersion).toBe(2);
    expect(readScalarInt(database, "SELECT COUNT(*) FROM schema_migrations")).toBe(2);
    expect(
      readScalarInt(
        database,
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'projects'",
      ),
    ).toBe(1);
  });

  it("is idempotent on a second run", () => {
    const database = track(openDatabase(":memory:"));
    const migrations = loadMigrations(defaultMigrationsDirectory());

    applyMigrations(database, migrations);
    const second = applyMigrations(database, migrations);

    expect(second.appliedVersions).toEqual([]);
    expect(second.currentVersion).toBe(2);
    expect(readScalarInt(database, "SELECT COUNT(*) FROM schema_migrations")).toBe(2);
  });

  it("rejects an applied migration whose checksum changed", () => {
    const database = track(openDatabase(":memory:"));
    const migrations = loadMigrations(defaultMigrationsDirectory());
    applyMigrations(database, migrations);

    const tampered = migrations.map((migration) => ({ ...migration, checksum: "0".repeat(64) }));

    expect(() => applyMigrations(database, tampered)).toThrow(MigrationError);
  });

  it("rejects a database that has a migration missing from disk", () => {
    const database = track(openDatabase(":memory:"));
    applyMigrations(database, loadMigrations(defaultMigrationsDirectory()));

    expect(() => applyMigrations(database, [])).toThrow(MigrationError);
  });

  it("rolls back a failing migration and records nothing", () => {
    const directory = createWorkspaceTempDir("migrations-fail");
    tempDirectories.push(directory);

    writeMigration(
      directory,
      "0001_broken.sql",
      "CREATE TABLE sentinel (id TEXT PRIMARY KEY); INSERT INTO missing_table VALUES (1);",
    );

    const database = track(openDatabase(":memory:"));

    expect(() => applyMigrations(database, loadMigrations(directory))).toThrow();

    expect(readCurrentVersion(database)).toBe(0);
    expect(
      readScalarInt(
        database,
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'sentinel'",
      ),
    ).toBe(0);
  });
});
