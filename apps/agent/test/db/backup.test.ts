import { existsSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

import { backupDatabase, inspectDatabase, restoreDatabase } from "../../src/db/backup.js";
import { openDatabase, readScalarInt } from "../../src/db/connection.js";
import {
  applyMigrations,
  defaultMigrationsDirectory,
  loadMigrations,
} from "../../src/db/migration-runner.js";
import { createWorkspaceTempDir, databasePathIn, removeWorkspaceTempDir } from "../helpers/workspace-temp.js";

const openDatabases: DatabaseSync[] = [];
const tempDirectories: string[] = [];

const NOW = "2026-11-04T00:00:00.000Z";

function track(database: DatabaseSync): DatabaseSync {
  openDatabases.push(database);
  return database;
}

function createMigratedDatabase(): { directory: string; database: DatabaseSync } {
  const directory = createWorkspaceTempDir("backup");
  tempDirectories.push(directory);

  const database = track(openDatabase(databasePathIn(directory)));
  applyMigrations(database, loadMigrations(defaultMigrationsDirectory()));

  database
    .prepare(
      `INSERT INTO project_roots (id, canonical_path, display_path, status, watch_enabled, created_at, updated_at)
       VALUES (?, ?, ?, 'ACTIVE', 1, ?, ?)`,
    )
    .run("root-1", "T:\\fixtures\\demo", "demo", NOW, NOW);

  return { directory, database };
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

describe("backupDatabase", () => {
  it("writes a consistent snapshot with VACUUM INTO", () => {
    const { directory, database } = createMigratedDatabase();
    const backupPath = join(directory, "backups", "snapshot.db");

    backupDatabase(database, backupPath);

    expect(existsSync(backupPath)).toBe(true);

    const inspection = inspectDatabase(backupPath);

    expect(inspection.integrity).toBe("ok");
    expect(inspection.schemaVersion).toBe(2);
    expect(inspection.tableCount).toBeGreaterThanOrEqual(13);
  });

  it("refuses to overwrite an existing backup target", () => {
    const { directory, database } = createMigratedDatabase();
    const backupPath = join(directory, "snapshot.db");

    backupDatabase(database, backupPath);

    expect(() => backupDatabase(database, backupPath)).toThrow(/already exists/i);
  });
});

describe("restoreDatabase", () => {
  it("restores a verified copy including rows written before the backup", () => {
    const { directory, database } = createMigratedDatabase();
    const backupPath = join(directory, "snapshot.db");
    const restoredPath = join(directory, "restored", "intelligence.db");

    backupDatabase(database, backupPath);

    // Mutate the live database after the snapshot; the backup must not change.
    database
      .prepare(
        `INSERT INTO project_roots (id, canonical_path, display_path, status, watch_enabled, created_at, updated_at)
         VALUES (?, ?, ?, 'ACTIVE', 0, ?, ?)`,
      )
      .run("root-2", "T:\\fixtures\\other", "other", NOW, NOW);

    const inspection = restoreDatabase(backupPath, restoredPath);

    expect(inspection.integrity).toBe("ok");
    expect(inspection.schemaVersion).toBe(2);

    const restored = track(openDatabase(restoredPath));

    expect(readScalarInt(restored, "SELECT COUNT(*) FROM project_roots")).toBe(1);
    expect(readScalarInt(database, "SELECT COUNT(*) FROM project_roots")).toBe(2);
  });

  it("refuses to overwrite an existing database", () => {
    const { directory, database } = createMigratedDatabase();
    const backupPath = join(directory, "snapshot.db");

    backupDatabase(database, backupPath);

    const existingTarget = join(directory, "existing.db");
    track(openDatabase(existingTarget)).close();

    expect(() => restoreDatabase(backupPath, existingTarget)).toThrow(/already exists/i);
  });

  it("rejects a missing backup file", () => {
    const { directory } = createMigratedDatabase();

    expect(() =>
      restoreDatabase(join(directory, "absent.db"), join(directory, "restored.db")),
    ).toThrow(/not found/i);
  });
});
