import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";

import { openDatabase } from "../../src/db/connection.js";
import {
  applyMigrations,
  defaultMigrationsDirectory,
  loadMigrations,
} from "../../src/db/migration-runner.js";
import {
  countByStatus,
  findProject,
  insertProject,
  listProjects,
  markMissingProjects,
  setPublicationState,
} from "../../src/db/repositories/project-repository.js";
import { listStatusHistory } from "../../src/db/repositories/project-status-history-repository.js";
import { insertRoot } from "../../src/db/repositories/root-repository.js";

let database: DatabaseSync;

beforeEach(() => {
  database = openDatabase(":memory:");
  applyMigrations(database, loadMigrations(defaultMigrationsDirectory()));

  insertRoot(database, {
    id: "root-1",
    canonicalPath: "t:\\fixtures\\demo",
    displayPath: "T:\\fixtures\\demo",
  });

  insertProject(database, {
    id: "proj-a",
    rootId: "root-1",
    relativePath: "alpha",
    canonicalPath: "t:\\fixtures\\demo\\alpha",
    displayName: "Alpha",
    kind: "APPLICATION",
    primaryEcosystem: "NODE",
    primaryLanguage: "TypeScript",
    detectionConfidence: 0.95,
    detectionState: "CONFIRMED",
    metadataStatus: "VALID",
  });

  insertProject(database, {
    id: "proj-b",
    rootId: "root-1",
    relativePath: "beta",
    canonicalPath: "t:\\fixtures\\demo\\beta",
    displayName: "Beta",
    kind: "LIBRARY",
    primaryEcosystem: "PYTHON",
    primaryLanguage: "Python",
    detectionConfidence: 0.8,
    detectionState: "PROBABLE",
    metadataStatus: "PARTIAL",
  });
});

afterEach(() => {
  database.close();
});

describe("project repository", () => {
  it("reads projects back with publication defaults", () => {
    const project = findProject(database, "proj-a");

    expect(project).toBeDefined();
    expect(project?.displayName).toBe("Alpha");
    expect(project?.publication.state).toBe("pending");
    expect(project?.publication.approvedFields).toEqual([]);
  });

  it("lists projects ordered by display name", () => {
    expect(listProjects(database).map((project) => project.displayName)).toEqual([
      "Alpha",
      "Beta",
    ]);
  });

  it("records discovery in status history", () => {
    const history = listStatusHistory(database, "proj-a");

    expect(history).toHaveLength(1);
    expect(history[0]?.toStatus).toBe("ACTIVE");
    expect(history[0]?.reason).toBe("Project discovered");
  });

  it("counts projects by status", () => {
    expect(countByStatus(database)).toEqual({ ACTIVE: 2 });
  });

  it("marks unseen projects as MISSING while keeping seen ones ACTIVE", () => {
    const missing = markMissingProjects(database, "root-1", ["proj-a"]);

    expect(missing).toEqual(["proj-b"]);
    expect(findProject(database, "proj-a")?.status).toBe("ACTIVE");
    expect(findProject(database, "proj-b")?.status).toBe("MISSING");
  });

  it("persists publication decisions", () => {
    setPublicationState(database, "proj-a", "approved", {
      approvedFields: ["displayName", "primaryLanguage"],
    });

    const project = findProject(database, "proj-a");
    expect(project?.publication.state).toBe("approved");
    expect(project?.publication.approvedFields).toEqual(["displayName", "primaryLanguage"]);
  });
});
