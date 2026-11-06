import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";

import { openDatabase } from "../../src/db/connection.js";
import {
  applyMigrations,
  defaultMigrationsDirectory,
  loadMigrations,
} from "../../src/db/migration-runner.js";
import { insertProject } from "../../src/db/repositories/project-repository.js";
import {
  addProjectTechnology,
  getMostCommonTechnologies,
  listProjectTechnologies,
  upsertTechnology,
} from "../../src/db/repositories/project-technology-repository.js";
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

  for (const id of ["proj-a", "proj-b"]) {
    insertProject(database, {
      id,
      rootId: "root-1",
      relativePath: id,
      canonicalPath: `t:\\fixtures\\demo\\${id}`,
      displayName: id,
      kind: "APPLICATION",
      primaryEcosystem: "NODE",
      primaryLanguage: "TypeScript",
      detectionConfidence: 0.9,
      detectionState: "CONFIRMED",
      metadataStatus: "VALID",
    });
  }

  upsertTechnology(database, { key: "typescript", name: "TypeScript", kind: "LANGUAGE" });
  upsertTechnology(database, { key: "react", name: "React", kind: "FRAMEWORK" });

  addProjectTechnology(database, {
    projectId: "proj-a",
    technologyKey: "typescript",
    status: "DECLARED",
    confidence: 0.95,
  });
  addProjectTechnology(database, {
    projectId: "proj-a",
    technologyKey: "react",
    status: "DECLARED",
    confidence: 0.9,
  });
  addProjectTechnology(database, {
    projectId: "proj-b",
    technologyKey: "typescript",
    status: "DECLARED",
    confidence: 0.9,
  });
});

afterEach(() => {
  database.close();
});

describe("technology repository", () => {
  it("joins project technologies with technology metadata", () => {
    const technologies = listProjectTechnologies(database, "proj-a");

    expect(technologies).toHaveLength(2);
    expect(technologies.map((technology) => technology.name).sort()).toEqual([
      "React",
      "TypeScript",
    ]);
  });

  it("upserts a technology without duplicating it", () => {
    upsertTechnology(database, { key: "react", name: "React", kind: "FRAMEWORK" });

    const rows = database
      .prepare('SELECT COUNT(*) AS count FROM technologies WHERE "key" = ?')
      .get("react") as unknown as { count: number };

    expect(rows.count).toBe(1);
  });

  it("aggregates the most common technologies", () => {
    const common = getMostCommonTechnologies(database, 10);

    expect(common[0]?.technologyKey).toBe("typescript");
    expect(common[0]?.projectCount).toBe(2);
    expect(common[1]?.technologyKey).toBe("react");
    expect(common[1]?.projectCount).toBe(1);
  });
});
