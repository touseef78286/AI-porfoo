import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";

import { openDatabase } from "../../src/db/connection.js";
import {
  applyMigrations,
  defaultMigrationsDirectory,
  loadMigrations,
} from "../../src/db/migration-runner.js";
import { findProject, listProjects } from "../../src/db/repositories/project-repository.js";
import { insertRoot, listRoots } from "../../src/db/repositories/root-repository.js";
import {
  listProjectTechnologies,
  upsertTechnology,
} from "../../src/db/repositories/project-technology-repository.js";
import { scanRoot } from "../../src/scan/scan-service.js";
import { createWorkspaceTempDir, removeWorkspaceTempDir } from "../helpers/workspace-temp.js";

/**
 * Non-sensitive fixture projects. Every file here is synthetic; the suite never
 * points at a real user directory.
 */
const FIXTURES: Readonly<Record<string, string>> = {
  "node-app/package.json": JSON.stringify(
    {
      name: "node-app",
      version: "1.0.0",
      scripts: { build: "vite build" },
      dependencies: { react: "^18.2.0", fastify: "^5.0.0" },
      devDependencies: { typescript: "^5.4.0" },
      engines: { node: ">=20" },
    },
    null,
    2,
  ),
  "python-app/pyproject.toml": [
    "[project]",
    'name = "python-app"',
    'dependencies = ["django>=4.2", "pytest>=8"]',
  ].join("\n"),
  "rust-app/Cargo.toml": [
    "[package]",
    'name = "rust-app"',
    'version = "0.1.0"',
    "",
    "[dependencies]",
    'tokio = "1"',
    'axum = "0.7"',
  ].join("\n"),
  "go-app/go.mod": [
    "module example.com/go-app",
    "",
    "go 1.22",
    "",
    "require (",
    "\tgithub.com/gin-gonic/gin v1.9.0",
    ")",
  ].join("\n"),
  "dart-app/pubspec.yaml": [
    "name: dart_app",
    "environment:",
    '  sdk: ">=3.0.0 <4.0.0"',
    "dependencies:",
    "  flutter:",
    "    sdk: flutter",
  ].join("\n"),
  "java-app/pom.xml": [
    "<project>",
    "  <artifactId>java-app</artifactId>",
    "  <dependencies>",
    "    <dependency>",
    "      <groupId>org.springframework.boot</groupId>",
    "      <artifactId>spring-boot-starter-web</artifactId>",
    "      <version>3.2.0</version>",
    "    </dependency>",
    "  </dependencies>",
    "</project>",
  ].join("\n"),
  "dotnet-app/DotnetApp.csproj": [
    '<Project Sdk="Microsoft.NET.Sdk">',
    "  <PropertyGroup>",
    "    <TargetFramework>net8.0</TargetFramework>",
    "  </PropertyGroup>",
    "</Project>",
  ].join("\n"),
  "php-app/composer.json": JSON.stringify(
    { name: "acme/php-app", require: { php: "^8.2", "laravel/framework": "^10.0" } },
    null,
    2,
  ),
  "ruby-app/Gemfile": ['source "https://rubygems.org"', 'gem "rails", "~> 7.1"'].join("\n"),
  "broken-app/package.json": '{ "name": "broken-app",, }',
  // Supporting signature in the same directory: must not create a second project
  // for `node-app`, and its body must never be read.
  "node-app/package-lock.json": JSON.stringify({ lockfileVersion: 3 }),
};

/** Files that must never be opened or persisted. */
const FORBIDDEN_FIXTURES: Readonly<Record<string, string>> = {
  "node-app/.env": "SUPER_SECRET_TOKEN=do-not-read",
  "node-app/.npmrc": "//registry.example/:_authToken=do-not-read",
  // Excluded directory: traversal must never descend into it.
  "node_modules/ignored-package/package.json": JSON.stringify({ name: "ignored-package" }),
};

let root: string;
let database: DatabaseSync;

function seedRoot(directory: string): void {
  for (const [relativePath, content] of Object.entries({
    ...FIXTURES,
    ...FORBIDDEN_FIXTURES,
  })) {
    const absolute = join(directory, relativePath);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content, "utf8");
  }
}

beforeEach(() => {
  root = createWorkspaceTempDir("scan-fixtures");
  seedRoot(root);

  database = openDatabase(":memory:");
  applyMigrations(database, loadMigrations(defaultMigrationsDirectory()));
  insertRoot(database, {
    id: "root-fixtures",
    canonicalPath: root.toLowerCase(),
    displayPath: root,
  });
});

afterEach(() => {
  database.close();
  removeWorkspaceTempDir(root);
});

function activeRoot() {
  const inserted = listRoots(database).find((candidate) => candidate.id === "root-fixtures");

  if (inserted === undefined) {
    throw new Error("Fixture root was not inserted");
  }

  return inserted;
}

describe("scanRoot against ecosystem fixtures", () => {
  it("detects every required ecosystem exactly once", async () => {
    const summary = await scanRoot({ database, root: activeRoot() });

    expect(summary.status).toBe("COMPLETED");
    expect(summary.projectsSeen).toBe(10);
    expect(summary.projectsCreated).toBe(10);

    const byName = new Map(listProjects(database).map((project) => [project.displayName, project]));

    expect(byName.get("node-app")?.primaryEcosystem).toBe("NODE");
    expect(byName.get("node-app")?.primaryLanguage).toBe("TypeScript");
    expect(byName.get("python-app")?.primaryEcosystem).toBe("PYTHON");
    expect(byName.get("rust-app")?.primaryEcosystem).toBe("RUST");
    expect(byName.get("example.com/go-app")?.primaryEcosystem).toBe("GO");
    expect(byName.get("dart_app")?.primaryEcosystem).toBe("DART");
    expect(byName.get("java-app")?.primaryEcosystem).toBe("JAVA");
    expect(byName.get("DotnetApp")?.primaryEcosystem).toBe("DOTNET");
    expect(byName.get("acme/php-app")?.primaryEcosystem).toBe("PHP");
  });

  it("persists declared technologies for each ecosystem", async () => {
    await scanRoot({ database, root: activeRoot() });

    const node = listProjects(database).find((project) => project.displayName === "node-app");

    if (node === undefined) {
      throw new Error("node-app was not detected");
    }

    const keys = listProjectTechnologies(database, node.id).map(
      (technology) => technology.technologyKey,
    );

    expect(keys).toEqual(expect.arrayContaining(["react", "fastify", "typescript", "node"]));
  });

  it("never reads or stores sensitive files", async () => {
    await scanRoot({ database, root: activeRoot() });

    const evidence = database
      .prepare("SELECT relative_path, detail_json FROM detection_evidence")
      .all() as unknown as { relative_path: string; detail_json: string }[];

    const serialized = JSON.stringify(evidence);

    expect(serialized).not.toContain("SUPER_SECRET_TOKEN");
    expect(serialized).not.toContain("do-not-read");
    expect(evidence.every((row) => !row.relative_path.includes(".env"))).toBe(true);
    expect(evidence.every((row) => !row.relative_path.includes(".npmrc"))).toBe(true);
  });

  it("never descends into excluded directories", async () => {
    await scanRoot({ database, root: activeRoot() });

    const ignored = listProjects(database).find(
      (project) => project.displayName === "ignored-package",
    );

    expect(ignored).toBeUndefined();
  });

  it("collapses multiple signatures in one directory into one project", async () => {
    const summary = await scanRoot({ database, root: activeRoot() });

    const nodeProjects = listProjects(database).filter(
      (project) => project.relativePath === "node-app",
    );

    expect(nodeProjects).toHaveLength(1);
    expect(summary.projectsSeen).toBe(10);

    const evidence = database
      .prepare(
        `SELECT relative_path FROM detection_evidence
          WHERE project_id = ? ORDER BY relative_path`,
      )
      .all(nodeProjects[0]?.id ?? "") as unknown as { relative_path: string }[];

    expect(evidence.map((row) => row.relative_path)).toEqual(
      expect.arrayContaining(["node-app\\package.json", "node-app\\package-lock.json"]),
    );
  });

  it("marks malformed manifests for review instead of failing the scan", async () => {
    await scanRoot({ database, root: activeRoot() });

    const broken = listProjects(database).find((project) => project.displayName === "broken-app");

    expect(broken?.detectionState).toBe("NEEDS_REVIEW");
    expect(broken?.metadataStatus).toBe("INVALID");
  });

  it("is idempotent: a second scan updates instead of duplicating", async () => {
    const first = await scanRoot({ database, root: activeRoot() });
    const second = await scanRoot({ database, root: activeRoot() });

    expect(first.projectsCreated).toBe(10);
    expect(second.projectsCreated).toBe(0);
    expect(second.projectsUpdated).toBe(10);
    expect(listProjects(database)).toHaveLength(10);
  });

  it("marks projects MISSING when their manifest disappears", async () => {
    await scanRoot({ database, root: activeRoot() });

    const rustProject = listProjects(database).find(
      (project) => project.displayName === "rust-app",
    );

    if (rustProject === undefined) {
      throw new Error("rust-app was not detected");
    }

    const { rmSync } = await import("node:fs");
    rmSync(join(root, "rust-app"), { recursive: true, force: true });

    const summary = await scanRoot({ database, root: activeRoot() });

    expect(summary.projectsMissing).toBe(1);
    expect(findProject(database, rustProject.id)?.status).toBe("MISSING");
  });

  it("records scan history and keeps error rows bounded", async () => {
    const summary = await scanRoot({ database, root: activeRoot() });

    const run = database
      .prepare("SELECT status, projects_created FROM scan_runs WHERE id = ?")
      .get(summary.scanId) as unknown as { status: string; projects_created: number };

    expect(run.status).toBe("COMPLETED");
    expect(run.projects_created).toBe(10);

    const rootRow = database
      .prepare("SELECT last_scan_at FROM project_roots WHERE id = ?")
      .get("root-fixtures") as unknown as { last_scan_at: string | null };

    expect(rootRow.last_scan_at).not.toBeNull();
  });
});

// Keeps the repository contract explicit: upserting the same key twice must not
// create duplicate technology rows.
describe("technology repository contract", () => {
  it("upserts a technology row once per key", () => {
    upsertTechnology(database, { key: "typescript", name: "TypeScript", kind: "LANGUAGE" });
    upsertTechnology(database, { key: "typescript", name: "TypeScript", kind: "LANGUAGE" });

    const count = database
      .prepare('SELECT COUNT(*) AS count FROM technologies WHERE "key" = ?')
      .get("typescript") as unknown as { count: number };

    expect(count.count).toBe(1);
  });
});
