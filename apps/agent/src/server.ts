/// <reference types="node" />
/**
 * Loopback-only HTTP server for Local Project Intelligence.
 *
 * Serves the private dashboard and a JSON API from the same origin so browser
 * clients never need wildcard CORS. Every data-bearing API request requires a
 * Bearer token, and Host/Origin headers must be loopback.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { DatabaseSync } from "node:sqlite";

import Fastify from "fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { wsEventEmitter } from "./ws-events.js";
import { authenticateRequest, apiMeta, validateHost, validateOrigin } from "./api/auth.js";
import { openDatabase } from "./db/connection.js";
import {
  applyMigrations,
  defaultMigrationsDirectory,
  loadMigrations,
} from "./db/migration-runner.js";
import {
  findProject,
  listProjects,
  setPublicationState,
  canTransitionPublication,
  countByStatus,
} from "./db/repositories/project-repository.js";
import RelationshipRepository from "./db/repositories/relationship-repository.js";
import type { Project, PublicationState } from "./db/repositories/project-repository.js";
import {
  getMostCommonTechnologies,
  listProjectTechnologies,
} from "./db/repositories/project-technology-repository.js";
import { listRoots, insertRoot, findRootByCanonicalPath } from "./db/repositories/root-repository.js";
import type { ProjectRoot } from "./db/repositories/root-repository.js";
import { listStatusHistory } from "./db/repositories/project-status-history-repository.js";
import { validateRootPath } from "./roots/validate-root.js";
import { scanRoot } from "./scan/scan-service.js";
import WatcherService from "./watcher.ts";

/** Local development token. Override with LPI_API_TOKEN for other environments. */
export const DEV_API_TOKEN = "lpi-local-dev-token";

export const DEFAULT_PORT = 3001;
export const DEFAULT_HOST = "127.0.0.1";

const PUBLICATION_STATES: readonly PublicationState[] = [
  "pending",
  "approved",
  "rejected",
  "snapshot",
  "published",
];

interface ApiProject {
  readonly id: string;
  readonly displayName: string;
  readonly status: string;
  readonly kind: string;
  readonly ecosystem: string | null;
  readonly primaryLanguage: string | null;
  readonly classification: string | null;
  readonly detectionState: string;
  readonly detectionConfidence: number;
  readonly metadataStatus: string;
  readonly relativePath: string;
  readonly gitBranch: string | null;
  readonly lastSeenAt: string;
  readonly publication: {
    readonly state: PublicationState;
    readonly approvedFields: readonly string[];
    readonly rejectionReason: string | null;
  };
  readonly technologies: {
    readonly key: string;
    readonly name: string;
    readonly kind: string;
    readonly status: string;
    readonly confidence: number;
  }[];
}

function toApiProject(database: DatabaseSync, project: Project): ApiProject {
  const technologies = listProjectTechnologies(database, project.id).map((technology) => ({
    key: technology.technologyKey,
    name: technology.name,
    kind: technology.kind,
    status: technology.status,
    confidence: technology.confidence,
  }));

  return {
    id: project.id,
    displayName: project.displayName,
    status: project.status,
    kind: project.kind,
    ecosystem: project.primaryEcosystem,
    primaryLanguage: project.primaryLanguage,
    classification: project.category,
    detectionState: project.detectionState,
    detectionConfidence: project.detectionConfidence,
    metadataStatus: project.metadataStatus,
    relativePath: project.relativePath,
    gitBranch: project.gitBranch,
    lastSeenAt: project.lastSeenAt,
    publication: project.publication,
    technologies,
  };
}

interface WindowCounter {
  start: number;
  count: number;
}

function createLimiter(limit: number, windowMs: number) {
  const counters = new Map<string, WindowCounter>();

  return function allow(key: string): boolean {
    const now = Date.now();
    const current = counters.get(key);

    if (current === undefined || now - current.start > windowMs) {
      counters.set(key, { start: now, count: 1 });
      return true;
    }

    current.count += 1;
    return current.count <= limit;
  };
}

export interface ServerOptions {
  readonly database: DatabaseSync;
  readonly token?: string;
  readonly dashboardPath?: string;
}

function dashboardFilePath(): string {
  return fileURLToPath(new URL("../../dashboard/src/index.html", import.meta.url));
}

export async function createServer(options: ServerOptions): Promise<FastifyInstance> {
  const { database } = options;
  const token = options.token ?? process.env.LPI_API_TOKEN ?? DEV_API_TOKEN;
  const dashboardPath = options.dashboardPath ?? dashboardFilePath();

  let dashboardHtml: string;

  try {
    dashboardHtml = readFileSync(dashboardPath, "utf8");
  } catch {
    dashboardHtml =
      "<!doctype html><meta charset=\"utf-8\"><title>Local Project Intelligence</title>" +
      "<p>Dashboard file not found. Run the agent from the repository root.</p>";
  }

  const server = Fastify({ logger: false, bodyLimit: 256 * 1024 });
  const allowTransition = createLimiter(60, 60_000);
  const allowScan = createLimiter(6, 60_000);

  // Initialize watcher service for live monitoring
  const watcher = new WatcherService(database, database, {
    maxConcurrentScans: 4,
    debounceMs: 250,
    autoScanNewRoots: false,
  });

  // Initialize relationship repository
  const relationshipRepo = new RelationshipRepository(database);

  server.addHook("onRequest", async (request, reply) => {
    const hostOk = validateHost(request, reply);
    if (!hostOk) return reply;

    const originOk = validateOrigin(request, reply, [
      `http://${DEFAULT_HOST}:${DEFAULT_PORT}`,
      `http://localhost:${DEFAULT_PORT}`,
      `http://${DEFAULT_HOST}:5173`,
      `http://localhost:5173`,
    ]);

    if (!originOk) return reply;

    return undefined;
  });

  server.addHook("preHandler", async (request, reply) => {
    const path = request.url.split("?")[0] ?? "/";

    if (!path.startsWith("/api/") || path === "/api/health") {
      return undefined;
    }

    const authed = authenticateRequest(request, reply, token);
    if (!authed) return reply;

    return undefined;
  });

  server.setErrorHandler((error, request, reply) => {
    const failure = error as { statusCode?: number; message?: string };
    const statusCode =
      failure.statusCode !== undefined && failure.statusCode >= 400
        ? failure.statusCode
        : 500;

    reply.code(statusCode).send({
      error: {
        code: statusCode === 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
        message: statusCode === 500 ? "Unexpected server error" : (failure.message ?? "Request failed"),
        requestId: request.id,
      },
    });
  });

  // ---- static dashboard -------------------------------------------------

  server.get("/", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(dashboardHtml);
  });

  server.get("/favicon.ico", async (_request, reply) => reply.code(204).send());

  // ---- health and bootstrap --------------------------------------------

  server.get("/api/health", async (request, reply) => {
    return reply.send({
      data: { status: "ok", version: "0.1.0", apiVersion: "v1" },
      meta: apiMeta(request),
    });
  });

  server.get("/api/bootstrap", async (request, reply) => {
    const roots = listRoots(database).filter((root) => root.status === "ACTIVE");
    const counts = countByStatus(database);
    const watcherStatus = watcher.getStatus();

    return reply.send({
      data: {
        version: "0.1.0",
        apiVersion: "v1",
        featureFlags: {
          publication: true,
          graph: true,
          roots: true,
          exclusions: true,
          scanning: true,
        },
        scannerState: {
          isScanning: false,
          progress: 0,
          activeRoots: roots.length,
        },
        watcherStatus: {
          state: watcherStatus.state,
          watchedRoots: watcherStatus.watchedRoots.length,
          activeScans: watcherStatus.activeScans,
          lastReconciliation: watcherStatus.lastReconciliation,
        },
        counts,
      },
      meta: apiMeta(request),
    });
  });

  // ---- projects ---------------------------------------------------------

  server.get("/api/projects", async (request, reply) => {
    const projects = listProjects(database).map((project) =>
      toApiProject(database, project),
    );

    return reply.send({ data: projects, meta: apiMeta(request) });
  });

  server.get<{ Params: { id: string } }>("/api/projects/:id", async (request, reply) => {
    const project = findProject(database, request.params.id);

    if (project === undefined) {
      return reply.code(404).send({
        error: { code: "PROJECT_NOT_FOUND", message: "Project not found", requestId: request.id },
      });
    }

    const technologies = listProjectTechnologies(database, project.id);
    const history = listStatusHistory(database, project.id);

    return reply.send({
      data: {
        ...toApiProject(database, project),
        technologies,
        statusHistory: history,
      },
      meta: apiMeta(request),
    });
  });

  // ---- publication ------------------------------------------------------

  server.get("/api/publication/candidates", async (request, reply) => {
    const projects = listProjects(database)
      .filter((project) => project.status !== "ARCHIVED")
      .map((project) => toApiProject(database, project));

    return reply.send({ data: projects, meta: apiMeta(request) });
  });

  server.get("/api/publication/snapshots", async (request, reply) => {
    const rows = database
      .prepare(
        `SELECT id, status, project_count, generated_at, generated_by
           FROM publication_snapshots
          ORDER BY generated_at DESC
          LIMIT 100`,
      )
      .all() as unknown as {
      id: string;
      status: string;
      project_count: number;
      generated_at: string;
      generated_by: string;
    }[];

    return reply.send({
      data: rows.map((row) => ({
        id: row.id,
        status: row.status,
        projectCount: row.project_count,
        generatedAt: row.generated_at,
        generatedBy: row.generated_by,
      })),
      meta: apiMeta(request),
    });
  });

  server.get<{ Params: { id: string } }>(
    "/api/publication/snapshots/:id",
    async (request, reply) => {
      const row = database
        .prepare("SELECT * FROM publication_snapshots WHERE id = ?")
        .get(request.params.id) as unknown as
        | { id: string; status: string; project_count: number; payload_json: string; generated_at: string }
        | undefined;

      if (row === undefined) {
        return reply.code(404).send({
          error: { code: "SNAPSHOT_NOT_FOUND", message: "Snapshot not found", requestId: request.id },
        });
      }

      let payload: unknown = null;

      try {
        payload = JSON.parse(row.payload_json);
      } catch {
        payload = null;
      }

      return reply.send({
        data: {
          id: row.id,
          status: row.status,
          projectCount: row.project_count,
          generatedAt: row.generated_at,
          projects: payload,
        },
        meta: apiMeta(request),
      });
    },
  );

  server.post<{ Body: { projectIds: string[] } }>(
    "/api/publication/snapshots",
    {
      schema: {
        body: {
          type: "object",
          required: ["projectIds"],
          additionalProperties: false,
          properties: {
            projectIds: {
              type: "array",
              minItems: 1,
              maxItems: 50,
              items: { type: "string", minLength: 1, maxLength: 128 },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const approved: Project[] = [];

      for (const id of request.body.projectIds) {
        const project = findProject(database, id);

        if (
          project !== undefined &&
          (project.publication.state === "approved" || project.publication.state === "snapshot")
        ) {
          approved.push(project);
        }
      }

      if (approved.length === 0) {
        return reply.code(400).send({
          error: {
            code: "NO_APPROVED_PROJECTS",
            message: "Snapshots may only include approved projects",
            requestId: request.id,
          },
        });
      }

      const sanitized = approved.map((project) => ({
        id: project.id,
        displayName: project.displayName,
        ecosystem: project.primaryEcosystem,
        primaryLanguage: project.primaryLanguage,
        approvedFields: project.publication.approvedFields,
        technologies: listProjectTechnologies(database, project.id).map(
          (technology) => technology.name,
        ),
      }));

      const snapshotId = `snap_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
      const generatedAt = new Date().toISOString();

      database
        .prepare(
          `INSERT INTO publication_snapshots
             (id, status, project_count, payload_json, generated_at, generated_by)
           VALUES (?, 'GENERATED', ?, ?, ?, 'local-reviewer')`,
        )
        .run(snapshotId, sanitized.length, JSON.stringify(sanitized), generatedAt);

      for (const project of approved) {
        if (canTransitionPublication(project.publication.state, "snapshot")) {
          setPublicationState(database, project.id, "snapshot", {
            approvedFields: project.publication.approvedFields,
          });
        }
      }

      return reply.code(201).send({
        data: {
          id: snapshotId,
          status: "GENERATED",
          projectCount: sanitized.length,
          generatedAt,
        },
        meta: apiMeta(request),
      });
    },
  );

  server.patch<{
    Params: { id: string };
    Body: {
      transitionMap: {
        state: string;
        approvedFields?: string[];
        rejectionReason?: string;
      };
    };
  }>(
    "/api/projects/:id/publication/transition",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 1, maxLength: 128 } },
        },
        body: {
          type: "object",
          required: ["transitionMap"],
          properties: {
            transitionMap: {
              type: "object",
              required: ["state"],
              additionalProperties: false,
              properties: {
                state: { type: "string", enum: PUBLICATION_STATES as unknown as string[] },
                approvedFields: {
                  type: "array",
                  maxItems: 20,
                  items: { type: "string", minLength: 1, maxLength: 64 },
                },
                rejectionReason: { type: "string", maxLength: 500 },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (!allowTransition("publication-transition")) {
        return reply.code(429).send({
          error: { code: "RATE_LIMITED", message: "Too many transitions", requestId: request.id },
        });
      }

      const project = findProject(database, request.params.id);

      if (project === undefined) {
        return reply.code(404).send({
          error: { code: "PROJECT_NOT_FOUND", message: "Project not found", requestId: request.id },
        });
      }

      const nextState = request.body.transitionMap.state as PublicationState;

      if (!PUBLICATION_STATES.includes(nextState)) {
        return reply.code(400).send({
          error: { code: "INVALID_STATE", message: "Unknown publication state", requestId: request.id },
        });
      }

      if (!canTransitionPublication(project.publication.state, nextState)) {
        return reply.code(409).send({
          error: {
            code: "INVALID_TRANSITION",
            message: `Cannot transition from ${project.publication.state} to ${nextState}`,
            requestId: request.id,
          },
        });
      }

      setPublicationState(database, project.id, nextState, {
        approvedFields: request.body.transitionMap.approvedFields ?? [],
        rejectionReason: request.body.transitionMap.rejectionReason ?? null,
      });

      const updated = findProject(database, project.id);

      return reply.send({
        data: updated === undefined ? null : toApiProject(database, updated),
        meta: apiMeta(request),
      });
    },
  );

  // ---- roots and scans --------------------------------------------------

  server.get("/api/roots", async (request, reply) => {
    return reply.send({
      data: listRoots(database).map((root) => ({
        id: root.id,
        canonicalPath: root.canonicalPath,
        displayPath: root.displayPath,
        status: root.status,
        watchEnabled: root.watchEnabled,
        lastScanAt: root.lastScanAt,
        lastError: root.lastError,
      })),
      meta: apiMeta(request),
    });
  });

  server.post<{ Body: { path: string } }>(
    "/api/roots",
    {
      schema: {
        body: {
          type: "object",
          required: ["path"],
          additionalProperties: false,
          properties: { path: { type: "string", minLength: 1, maxLength: 1024 } },
        },
      },
    },
    async (request, reply) => {
      const validation = validateRootPath(request.body.path);

      if (!validation.ok) {
        return reply.code(400).send({
          error: {
            code: validation.code,
            message: validation.message,
            requestId: request.id,
          },
        });
      }

      const existing = findRootByCanonicalPath(database, validation.canonicalPath);

      if (existing !== undefined) {
        return reply.send({
          data: { id: existing.id, canonicalPath: existing.canonicalPath },
          meta: apiMeta(request),
        });
      }

      const id = `root_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

      insertRoot(database, {
        id,
        canonicalPath: validation.canonicalPath,
        displayPath: validation.displayPath,
      });

      return reply.code(201).send({
        data: { id, canonicalPath: validation.canonicalPath },
        meta: apiMeta(request),
      });
    },
  );

  server.post<{ Params: { id: string } }>(
    "/api/roots/:id/scan",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 1, maxLength: 128 } },
        },
      },
    },
    async (request, reply) => {
      if (!allowScan("scan")) {
        return reply.code(429).send({
          error: { code: "RATE_LIMITED", message: "Too many scans", requestId: request.id },
        });
      }

      const root = listRoots(database).find((candidate) => candidate.id === request.params.id);

      if (root === undefined) {
        return reply.code(404).send({
          error: { code: "ROOT_NOT_FOUND", message: "Root not found", requestId: request.id },
        });
      }

      if (root.status !== "ACTIVE") {
        return reply.code(409).send({
          error: { code: "ROOT_INACTIVE", message: "Root is not active", requestId: request.id },
        });
      }

      const summary = await scanRoot({ database, root });

      return reply.send({ data: summary, meta: apiMeta(request) });
    },
  );

  server.get("/api/scans", async (request, reply) => {
    const rows = database
      .prepare(
        `SELECT id, root_id, trigger, status, started_at, finished_at, duration_ms,
                directories_visited, files_inspected, projects_seen,
                projects_created, projects_updated, projects_missing, errors_count
           FROM scan_runs
          ORDER BY started_at DESC
          LIMIT 50`,
      )
      .all() as unknown as Record<string, unknown>[];

    return reply.send({
      data: rows.map((row) => ({
        id: row.id,
        rootId: row.root_id,
        trigger: row.trigger,
        status: row.status,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        durationMs: row.duration_ms,
        directoriesVisited: row.directories_visited,
        filesInspected: row.files_inspected,
        projectsSeen: row.projects_seen,
        projectsCreated: row.projects_created,
        projectsUpdated: row.projects_updated,
        projectsMissing: row.projects_missing,
        errorsCount: row.errors_count,
      })),
      meta: apiMeta(request),
    });
  });

  // ---- stats and graph --------------------------------------------------

  server.get("/api/stats", async (request, reply) => {
    const projects = listProjects(database);
    const statusCounts = countByStatus(database);
    const technologies = getMostCommonTechnologies(database, 10);

    return reply.send({
      data: {
        totalProjects: projects.length,
        statusCounts,
        technologies,
      },
      meta: apiMeta(request),
    });
  });

  server.get("/api/graph", async (request, reply) => {
    const projects = listProjects(database);

    // Build nodes and edges from projects
    const nodes: { id: string; label: string; type: string }[] = [];
    const edges: { from: string; to: string; kind: string }[] = [];

    for (const project of projects) {
      // Add project node
      nodes.push({ id: project.id, label: project.displayName, type: "project" });

      // Add technologies as nodes and DECLARED edges
      const technologies = listProjectTechnologies(database, project.id);
      for (const technology of technologies) {
        const technologyNodeId = `tech:${technology.technologyKey}`;
        nodes.push({
          id: technologyNodeId,
          label: technology.name,
          type: "technology",
        });
        edges.push({ from: project.id, to: technologyNodeId, kind: "DECLARED" });

        // Persist the DECLARED relationship
        relationshipRepo.create({
          from: project.id,
          to: technologyNodeId,
          kind: "DECLARED",
          weight: 1.0,
        });
      }

      // Add ecosystem relationship if present
      if (project.primaryEcosystem) {
        const ecosystemNodeId = `eco:${project.primaryEcosystem}`;
        nodes.push({
          id: ecosystemNodeId,
          label: project.primaryEcosystem,
          type: "ecosystem",
        });
        edges.push({ from: project.id, to: ecosystemNodeId, kind: "ECOSYSTEM_OF" });

        // Persist the ECOSYSTEM_OF relationship
        relationshipRepo.create({
          from: project.id,
          to: ecosystemNodeId,
          kind: "ECOSYSTEM_OF",
          weight: 1.0,
        });
      }

      // Add language relationship if present
      if (project.primaryLanguage) {
        const languageNodeId = `lang:${project.primaryLanguage}`;
        nodes.push({
          id: languageNodeId,
          label: project.primaryLanguage,
          type: "language",
        });
        edges.push({ from: project.id, to: languageNodeId, kind: "LANGUAGE_OF" });

        // Persist the LANGUAGE_OF relationship
        relationshipRepo.create({
          from: project.id,
          to: languageNodeId,
          kind: "LANGUAGE_OF",
          weight: 1.0,
        });
      }
    }

    // Emit WebSocket event for relationship changes
    wsEventEmitter.emitEvent({
      type: "relationship.changed" as const,
      data: {
        event: "graph-updated",
        projectCount: projects.length,
        relationshipCount: edges.length,
        timestamp: new Date().toISOString(),
      },
    });

    // Deduplicate nodes by ID
    const uniqueNodes = [...new Map(nodes.map((node) => [node.id, node])).values()];

    return reply.send({
      data: { nodes: uniqueNodes, edges },
      meta: apiMeta(request),
    });
  });

  return server;
}

export function openDevDatabase(databasePath?: string): DatabaseSync {
  const path =
    databasePath ??
    process.env.LPI_DB_PATH ??
    fileURLToPath(new URL("../../../data/lpi.db", import.meta.url));

  const database = openDatabase(path);
  applyMigrations(database, loadMigrations(defaultMigrationsDirectory()));

  return database;
}

export interface StartedServer {
  readonly server: FastifyInstance;
  readonly url: string;
  readonly database: DatabaseSync;
}

export interface StartServerOptions {
  readonly port?: number;
  readonly databasePath?: string;
  readonly token?: string;
}

export async function startServer(options: StartServerOptions = {}): Promise<StartedServer> {
  const port = options.port ?? Number(process.env.LPI_PORT ?? DEFAULT_PORT);
  const database = openDevDatabase(options.databasePath);
  const server = await createServer(
    options.token === undefined
      ? { database }
      : { database, token: options.token },
  );

  await server.listen({ port, host: DEFAULT_HOST });

  return { server, url: `http://${DEFAULT_HOST}:${port}/`, database };
}

export type { ProjectRoot };
