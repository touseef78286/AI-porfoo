import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { DatabaseSync } from "node:sqlite";

import { openDatabase } from "../../src/db/connection.js";
import {
  applyMigrations,
  defaultMigrationsDirectory,
  loadMigrations,
} from "../../src/db/migration-runner.js";
import { insertProject } from "../../src/db/repositories/project-repository.js";
import { insertRoot } from "../../src/db/repositories/root-repository.js";
import { createServer } from "../../src/server.js";

const TOKEN = "integration-test-token";

let database: DatabaseSync;
let server: FastifyInstance;

const auth = { authorization: `Bearer ${TOKEN}` };

beforeEach(async () => {
  database = openDatabase(":memory:");
  applyMigrations(database, loadMigrations(defaultMigrationsDirectory()));

  insertRoot(database, {
    id: "root-1",
    canonicalPath: "t:\\fixtures\\demo",
    displayPath: "T:\\fixtures\\demo",
  });

  insertProject(database, {
    id: "project-1",
    rootId: "root-1",
    relativePath: "",
    canonicalPath: "t:\\fixtures\\demo",
    displayName: "Demo App",
    kind: "APPLICATION",
    primaryEcosystem: "NODE",
    primaryLanguage: "TypeScript",
    category: null,
    detectionConfidence: 0.95,
    detectionState: "CONFIRMED",
    metadataStatus: "VALID",
  });

  server = await createServer({ database, token: TOKEN });
});

afterEach(async () => {
  await server.close();
  database.close();
});

describe("loopback API", () => {
  it("serves health without a token", async () => {
    const response = await server.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ data: { status: string } }>().data.status).toBe("ok");
  });

  it("rejects a non-loopback Host header", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/health",
      headers: { host: "evil.example" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("requires a bearer token for data endpoints", async () => {
    const response = await server.inject({ method: "GET", url: "/api/projects" });

    expect(response.statusCode).toBe(401);
  });

  it("returns bootstrap flags with a valid token", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/bootstrap",
      headers: auth,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: { featureFlags: Record<string, boolean> } }>();
    expect(body.data.featureFlags.scanning).toBe(true);
  });

  it("lists projects for the private dashboard", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/projects",
      headers: auth,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: { id: string; displayName: string }[] }>();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.displayName).toBe("Demo App");
  });

  it("approves a pending project and records the new state", async () => {
    const response = await server.inject({
      method: "PATCH",
      url: "/api/projects/project-1/publication/transition",
      headers: auth,
      payload: {
        transitionMap: {
          state: "approved",
          approvedFields: ["displayName", "primaryLanguage"],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: { publication: { state: string } } }>();
    expect(body.data.publication.state).toBe("approved");
  });

  it("refuses an invalid publication transition", async () => {
    const response = await server.inject({
      method: "PATCH",
      url: "/api/projects/project-1/publication/transition",
      headers: auth,
      payload: { transitionMap: { state: "published" } },
    });

    expect(response.statusCode).toBe(409);
  });

  it("returns a graph of projects and technologies", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/api/graph",
      headers: auth,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: { nodes: unknown[]; edges: unknown[] } }>();
    expect(body.data.nodes.length).toBeGreaterThan(0);
    expect(Array.isArray(body.data.edges)).toBe(true);
  });
});
