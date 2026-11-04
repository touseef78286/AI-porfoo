import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { openDatabase } from "../../src/db/connection.js";
import {
  applyMigrations,
  defaultMigrationsDirectory,
  loadMigrations,
} from "../../src/db/migration-runner.js";
import {
  findRootByCanonicalPath,
  insertRoot,
  listRoots,
  updateRootStatus,
} from "../../src/db/repositories/root-repository.js";

let database: DatabaseSync;

beforeEach(() => {
  database = openDatabase(":memory:");
  applyMigrations(database, loadMigrations(defaultMigrationsDirectory()));
});

afterEach(() => {
  database.close();
});

describe("root repository", () => {
  it("inserts and finds a root by canonical path", () => {
    insertRoot(database, {
      id: "root-1",
      canonicalPath: "t:\\fixtures\\demo",
      displayPath: "T:\\Fixtures\\Demo",
    });

    const found = findRootByCanonicalPath(database, "t:\\fixtures\\demo");

    expect(found).toMatchObject({
      id: "root-1",
      canonicalPath: "t:\\fixtures\\demo",
      displayPath: "T:\\Fixtures\\Demo",
      status: "ACTIVE",
      watchEnabled: true,
      lastScanAt: null,
      lastError: null,
    });
  });

  it("rejects a duplicate canonical path", () => {
    insertRoot(database, {
      id: "root-1",
      canonicalPath: "t:\\fixtures\\demo",
      displayPath: "demo",
    });

    expect(() =>
      insertRoot(database, {
        id: "root-2",
        canonicalPath: "t:\\fixtures\\demo",
        displayPath: "demo again",
      }),
    ).toThrow();
  });

  it("returns undefined for an unknown root", () => {
    expect(findRootByCanonicalPath(database, "t:\\nowhere")).toBeUndefined();
  });

  it("lists roots in canonical order", () => {
    insertRoot(database, { id: "b", canonicalPath: "t:\\b", displayPath: "B" });
    insertRoot(database, { id: "a", canonicalPath: "t:\\a", displayPath: "A" });

    expect(listRoots(database).map((root) => root.id)).toEqual(["a", "b"]);
  });

  it("updates status and last error", () => {
    insertRoot(database, { id: "root-1", canonicalPath: "t:\\demo", displayPath: "demo" });

    const updated = updateRootStatus(database, "root-1", "UNAVAILABLE", "drive missing");

    expect(updated).toBe(true);
    expect(findRootByCanonicalPath(database, "t:\\demo")).toMatchObject({
      status: "UNAVAILABLE",
      lastError: "drive missing",
    });
  });

  it("reports no update for an unknown root", () => {
    expect(updateRootStatus(database, "missing", "PAUSED")).toBe(false);
  });

  it("honours watchEnabled false", () => {
    insertRoot(database, {
      id: "root-1",
      canonicalPath: "t:\\demo",
      displayPath: "demo",
      watchEnabled: false,
    });

    expect(findRootByCanonicalPath(database, "t:\\demo")?.watchEnabled).toBe(false);
  });
});
