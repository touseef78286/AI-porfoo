import type { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

import {
  IN_MEMORY_DATABASE,
  openDatabase,
  readScalarInt,
  withTransaction,
} from "../../src/db/connection.js";
import { createWorkspaceTempDir, databasePathIn, removeWorkspaceTempDir } from "../helpers/workspace-temp.js";

const openDatabases: DatabaseSync[] = [];
const tempDirectories: string[] = [];

function track(database: DatabaseSync): DatabaseSync {
  openDatabases.push(database);
  return database;
}

afterEach(() => {
  for (const database of openDatabases) {
    try {
      database.close();
    } catch {
      // Already closed by the test.
    }
  }

  openDatabases.length = 0;

  for (const directory of tempDirectories) {
    removeWorkspaceTempDir(directory);
  }

  tempDirectories.length = 0;
});

describe("openDatabase", () => {
  it("enables foreign keys and a busy timeout", () => {
    const database = track(openDatabase(IN_MEMORY_DATABASE));

    const foreignKeys = database.prepare("PRAGMA foreign_keys").get() as unknown as {
      foreign_keys: number;
    };
    const busyTimeout = database.prepare("PRAGMA busy_timeout").get() as unknown as {
      timeout: number;
    };

    expect(foreignKeys.foreign_keys).toBe(1);
    expect(busyTimeout.timeout).toBe(5000);
  });

  it("uses WAL journal mode for file databases", () => {
    const directory = createWorkspaceTempDir("connection");
    tempDirectories.push(directory);

    const database = track(openDatabase(databasePathIn(directory)));

    const journalMode = database.prepare("PRAGMA journal_mode").get() as unknown as {
      journal_mode: string;
    };

    expect(journalMode.journal_mode).toBe("wal");
  });

  it("creates the parent directory of a file database", () => {
    const directory = createWorkspaceTempDir("nested");
    tempDirectories.push(directory);

    const nestedPath = databasePathIn(directory, "deep/chain/intelligence.db");
    const database = track(openDatabase(nestedPath));

    expect(readScalarInt(database, "SELECT 1")).toBe(1);
  });

  it("enforces foreign key constraints", () => {
    const database = track(openDatabase(IN_MEMORY_DATABASE));

    database.exec(`
      CREATE TABLE parent (id TEXT PRIMARY KEY);
      CREATE TABLE child (
        id TEXT PRIMARY KEY,
        parent_id TEXT NOT NULL REFERENCES parent (id)
      );
    `);

    expect(() =>
      database.prepare("INSERT INTO child (id, parent_id) VALUES (?, ?)").run("c1", "missing"),
    ).toThrow();
  });
});

describe("withTransaction", () => {
  it("commits a successful unit of work", () => {
    const database = track(openDatabase(IN_MEMORY_DATABASE));
    database.exec("CREATE TABLE items (id TEXT PRIMARY KEY)");

    withTransaction(database, () => {
      database.prepare("INSERT INTO items (id) VALUES (?)").run("a");
    });

    expect(readScalarInt(database, "SELECT COUNT(*) FROM items")).toBe(1);
  });

  it("rolls back when the operation throws", () => {
    const database = track(openDatabase(IN_MEMORY_DATABASE));
    database.exec("CREATE TABLE items (id TEXT PRIMARY KEY)");

    expect(() =>
      withTransaction(database, () => {
        database.prepare("INSERT INTO items (id) VALUES (?)").run("a");
        throw new Error("boom");
      }),
    ).toThrow("boom");

    expect(readScalarInt(database, "SELECT COUNT(*) FROM items")).toBe(0);
  });
});
