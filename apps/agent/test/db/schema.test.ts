import type { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

import { openDatabase, readScalarInt } from "../../src/db/connection.js";
import {
  applyMigrations,
  defaultMigrationsDirectory,
  loadMigrations,
} from "../../src/db/migration-runner.js";

const NOW = "2026-11-04T00:00:00.000Z";

const PHASE_1_TABLES = [
  "dependencies",
  "detection_evidence",
  "exclusions",
  "project_identities",
  "project_overrides",
  "project_roots",
  "project_status_history",
  "project_technologies",
  "projects",
  "scan_errors",
  "scan_runs",
  "schema_migrations",
  "technologies",
];

const FORBIDDEN_COLUMN_PATTERN =
  /(secret|token|password|passwd|credential|api[_-]?key|private[_-]?key|content|source_code)/i;

const openDatabases: DatabaseSync[] = [];

function createMigratedDatabase(): DatabaseSync {
  const database = openDatabase(":memory:");
  openDatabases.push(database);
  applyMigrations(database, loadMigrations(defaultMigrationsDirectory()));
  return database;
}

function insertRoot(database: DatabaseSync, id: string, canonicalPath: string): void {
  database
    .prepare(
      `INSERT INTO project_roots (id, canonical_path, display_path, status, watch_enabled, created_at, updated_at)
       VALUES (?, ?, ?, 'ACTIVE', 1, ?, ?)`,
    )
    .run(id, canonicalPath, canonicalPath, NOW, NOW);
}

function listColumns(database: DatabaseSync, table: string): string[] {
  const escaped = table.replace(/"/g, '""');
  const rows = database.prepare(`PRAGMA table_info("${escaped}")`).all() as unknown as {
    name: string;
  }[];

  return rows.map((row) => row.name);
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
});

describe("migration 0001 schema", () => {
  it("creates every Phase 1 table", () => {
    const database = createMigratedDatabase();

    const rows = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as unknown as { name: string }[];

    const names = rows.map((row) => row.name);

    for (const table of PHASE_1_TABLES) {
      expect(names).toContain(table);
    }

    expect(names).toHaveLength(PHASE_1_TABLES.length);
  });

  it("keeps foreign keys consistent", () => {
    const database = createMigratedDatabase();

    const violations = database.prepare("PRAGMA foreign_key_check").all();

    expect(violations).toHaveLength(0);
  });

  it("has no column that could store secrets or raw source content", () => {
    const database = createMigratedDatabase();
    const offenders: string[] = [];

    for (const table of PHASE_1_TABLES) {
      for (const column of listColumns(database, table)) {
        if (FORBIDDEN_COLUMN_PATTERN.test(column)) {
          offenders.push(`${table}.${column}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("rejects an invalid root status", () => {
    const database = createMigratedDatabase();

    expect(() =>
      database
        .prepare(
          `INSERT INTO project_roots (id, canonical_path, display_path, status, watch_enabled, created_at, updated_at)
           VALUES (?, ?, ?, 'BROKEN', 1, ?, ?)`,
        )
        .run("root-bad", "T:\\fixtures\\bad", "bad", NOW, NOW),
    ).toThrow();
  });

  it("rejects duplicate project paths", () => {
    const database = createMigratedDatabase();
    insertRoot(database, "root-1", "T:\\fixtures\\demo");

    const insertProject = (id: string) =>
      database
        .prepare(
          `INSERT INTO projects (
             id, root_id, relative_path, canonical_path, display_name, kind, status,
             detection_confidence, detection_state, metadata_status,
             first_seen_at, last_seen_at, created_at, updated_at
           ) VALUES (?, 'root-1', 'demo', 'T:\\fixtures\\demo', 'demo', 'APPLICATION', 'ACTIVE',
             0.9, 'CONFIRMED', 'VALID', ?, ?, ?, ?)`,
        )
        .run(id, NOW, NOW, NOW, NOW);

    insertProject("project-1");

    expect(() => insertProject("project-2")).toThrow();
  });

  it("enforces the project-to-root foreign key", () => {
    const database = createMigratedDatabase();

    expect(() =>
      database
        .prepare(
          `INSERT INTO projects (
             id, root_id, relative_path, canonical_path, display_name, kind, status,
             detection_confidence, detection_state, metadata_status,
             first_seen_at, last_seen_at, created_at, updated_at
           ) VALUES ('p1', 'missing-root', 'p', 'T:\\fixtures\\p', 'p', 'LIBRARY', 'ACTIVE',
             0.5, 'CANDIDATE', 'UNKNOWN', ?, ?, ?, ?)`,
        )
        .run(NOW, NOW, NOW, NOW),
    ).toThrow();
  });

  it("defaults scan run counters to zero", () => {
    const database = createMigratedDatabase();

    database
      .prepare(
        `INSERT INTO scan_runs (id, root_id, trigger, status, started_at)
         VALUES ('scan-1', NULL, 'MANUAL', 'RUNNING', ?)`,
      )
      .run(NOW);

    expect(
      readScalarInt(
        database,
        "SELECT projects_seen + files_inspected + directories_visited + errors_count FROM scan_runs WHERE id = 'scan-1'",
      ),
    ).toBe(0);
  });
});
