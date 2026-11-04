import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { openDatabase } from "../../src/db/connection.js";
import {
  applyMigrations,
  defaultMigrationsDirectory,
  loadMigrations,
} from "../../src/db/migration-runner.js";
import {
  addExclusion,
  deleteUserExclusion,
  listExclusions,
  loadExclusionRulesForRoot,
} from "../../src/db/repositories/exclusion-repository.js";
import { insertRoot } from "../../src/db/repositories/root-repository.js";

let database: DatabaseSync;

beforeEach(() => {
  database = openDatabase(":memory:");
  applyMigrations(database, loadMigrations(defaultMigrationsDirectory()));
  insertRoot(database, { id: "root-1", canonicalPath: "t:\\demo", displayPath: "demo" });
  insertRoot(database, { id: "root-2", canonicalPath: "t:\\other", displayPath: "other" });
});

afterEach(() => {
  database.close();
});

describe("exclusion repository", () => {
  it("stores global and root-specific rules", () => {
    addExclusion(database, {
      id: "ex-1",
      pattern: "generated",
      kind: "DIRECTORY",
      reason: "Generated output",
    });
    addExclusion(database, {
      id: "ex-2",
      rootId: "root-1",
      pattern: "legacy",
      kind: "PATH",
      reason: "Old code",
    });

    expect(listExclusions(database)).toHaveLength(2);
    expect(listExclusions(database, "root-1")).toHaveLength(2);
    expect(listExclusions(database, "root-2")).toHaveLength(1);
  });

  it("returns rules in the shape the core matcher expects", () => {
    addExclusion(database, {
      id: "ex-1",
      pattern: "generated",
      kind: "DIRECTORY",
      reason: "Generated output",
    });
    addExclusion(database, {
      id: "ex-2",
      rootId: "root-1",
      pattern: "secret-name",
      kind: "SENSITIVE_NAME",
      reason: "Local rule",
      isSystem: true,
    });

    const rules = loadExclusionRulesForRoot(database, "root-1");

    expect(rules).toEqual([
      { kind: "DIRECTORY", pattern: "generated", isSystem: false },
      { kind: "SENSITIVE_NAME", pattern: "secret-name", isSystem: true },
    ]);
  });

  it("refuses to delete a system rule", () => {
    addExclusion(database, {
      id: "ex-system",
      pattern: "credentials",
      kind: "SENSITIVE_NAME",
      reason: "Built in",
      isSystem: true,
    });

    expect(deleteUserExclusion(database, "ex-system")).toBe(false);
    expect(listExclusions(database)).toHaveLength(1);
  });

  it("deletes a user rule", () => {
    addExclusion(database, {
      id: "ex-user",
      pattern: "generated",
      kind: "DIRECTORY",
      reason: "Mine",
    });

    expect(deleteUserExclusion(database, "ex-user")).toBe(true);
    expect(listExclusions(database)).toHaveLength(0);
  });

  it("rejects an unknown exclusion kind", () => {
    expect(() =>
      addExclusion(database, {
        id: "ex-bad",
        pattern: "x",
        kind: "WILDCARD" as never,
        reason: "bad",
      }),
    ).toThrow();
  });
});
