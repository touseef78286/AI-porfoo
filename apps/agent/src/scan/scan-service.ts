import { createHash } from "node:crypto";
import { closeSync, openSync, readSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { MANIFEST_MAX_BYTES, parseManifest } from "@lpi/core";
import type {
  DetectorResult,
  ManifestObservation,
  TraversalResult,
} from "@lpi/core";

import type { DatabaseSync } from "node:sqlite";

import { withTransaction } from "../db/connection.js";
import {
  insertProject,
  markMissingProjects,
  updateProject,
  findProjectByCanonicalPath,
} from "../db/repositories/project-repository.js";
import type {
  DetectionState,
  MetadataStatus,
  ProjectKind,
  ProjectUpdate,
} from "../db/repositories/project-repository.js";
import {
  addProjectTechnology,
  clearProjectTechnologies,
  upsertTechnology,
} from "../db/repositories/project-technology-repository.js";
import type { TechnologyKind } from "../db/repositories/project-technology-repository.js";
import type { ProjectRoot } from "../db/repositories/root-repository.js";
import { traverseRoot } from "../discovery/traverse-root.js";
import { loadExclusionRulesForRoot } from "../db/repositories/exclusion-repository.js";

export interface ScanRequest {
  readonly database: DatabaseSync;
  readonly root: ProjectRoot;
  readonly trigger?: "MANUAL" | "STARTUP" | "WATCH" | "RECONCILIATION";
  readonly maxErrorsPersisted?: number;
}

export interface ScanSummary {
  readonly scanId: string;
  readonly rootId: string;
  readonly status: TraversalResult["status"];
  readonly durationMs: number;
  readonly directoriesVisited: number;
  readonly filesInspected: number;
  readonly manifestsSeen: number;
  readonly projectsSeen: number;
  readonly projectsCreated: number;
  readonly projectsUpdated: number;
  readonly projectsMissing: number;
  readonly errorsCount: number;
}

interface EcosystemMeta {
  readonly label: string;
  readonly language: string;
  readonly technology: { readonly key: string; readonly name: string; readonly kind: TechnologyKind };
}

const ECOSYSTEM_META: Record<string, EcosystemMeta> = {
  NODE: {
    label: "Node.js",
    language: "JavaScript",
    technology: { key: "node", name: "Node.js", kind: "RUNTIME" },
  },
  PYTHON: {
    label: "Python",
    language: "Python",
    technology: { key: "python", name: "Python", kind: "RUNTIME" },
  },
  RUST: {
    label: "Rust",
    language: "Rust",
    technology: { key: "rust", name: "Rust", kind: "LANGUAGE" },
  },
  GO: {
    label: "Go",
    language: "Go",
    technology: { key: "go", name: "Go", kind: "LANGUAGE" },
  },
  DART: {
    label: "Dart",
    language: "Dart",
    technology: { key: "dart", name: "Dart", kind: "LANGUAGE" },
  },
  JAVA: {
    label: "Java",
    language: "Java",
    technology: { key: "java", name: "Java", kind: "LANGUAGE" },
  },
  DOTNET: {
    label: ".NET",
    language: "C#",
    technology: { key: "dotnet", name: ".NET", kind: "RUNTIME" },
  },
  PHP: {
    label: "PHP",
    language: "PHP",
    technology: { key: "php", name: "PHP", kind: "LANGUAGE" },
  },
  RUBY: {
    label: "Ruby",
    language: "Ruby",
    technology: { key: "ruby", name: "Ruby", kind: "LANGUAGE" },
  },
};

const ECOSYSTEM_ORDER = [
  "NODE",
  "PYTHON",
  "RUST",
  "GO",
  "DART",
  "JAVA",
  "DOTNET",
  "PHP",
  "RUBY",
] as const;

interface ProjectCandidate {
  readonly relativeDir: string;
  readonly canonicalPath: string;
  readonly observations: readonly ManifestObservation[];
  readonly primary: ManifestObservation;
  readonly detector: DetectorResult | null;
  readonly manifestText: string | null;
  readonly hasTypeScriptConfig: boolean;
  readonly contentType: "package.json" | "other";
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\//g, "\\");
}

function directoryOf(relativePath: string): string {
  const normalized = normalizeRelativePath(relativePath);
  const index = normalized.lastIndexOf("\\");

  return index === -1 ? "" : normalized.slice(0, index);
}

function baseNameOf(relativePath: string): string {
  const normalized = normalizeRelativePath(relativePath);
  const index = normalized.lastIndexOf("\\");

  return index === -1 ? normalized : normalized.slice(index + 1);
}

function stableProjectId(canonicalPath: string): string {
  return `proj_${createHash("sha256").update(canonicalPath.toLowerCase()).digest("hex").slice(0, 16)}`;
}

function stableScanId(): string {
  return `scan_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function readBoundedText(absolutePath: string, maxBytes: number): string | null {
  try {
    const stats = statSync(absolutePath);

    if (!stats.isFile() || stats.size > maxBytes) {
      return null;
    }

    const descriptor = openSync(absolutePath, "r");

    try {
      const buffer = Buffer.alloc(stats.size);
      const bytesRead = readSync(descriptor, buffer, 0, buffer.length, 0);

      return buffer.subarray(0, bytesRead).toString("utf8");
    } finally {
      closeSync(descriptor);
    }
  } catch {
    return null;
  }
}

function parseJsonObject(raw: string | null): Record<string, unknown> | null {
  if (raw === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function extractManifestName(raw: string | null, fileName: string): string | null {
  if (raw === null) {
    return null;
  }

  const lower = fileName.toLowerCase();

  if (lower === "package.json" || lower === "composer.json") {
    const parsed = parseJsonObject(raw);
    const name = parsed?.name;

    return typeof name === "string" && name.trim().length > 0 ? name.trim() : null;
  }

  const patterns: Record<string, RegExp> = {
    "pyproject.toml": /^\s*name\s*=\s*"([^"]+)"/m,
    "cargo.toml": /^\s*name\s*=\s*"([^"]+)"/m,
    "go.mod": /^\s*module\s+(\S+)/m,
    "pubspec.yaml": /^\s*name\s*:\s*(\S+)/m,
  };

  const pattern = patterns[lower];

  if (pattern === undefined) {
    return null;
  }

  const match = pattern.exec(raw);

  return match?.[1]?.trim() ?? null;
}

function detectionStateFor(
  primary: ManifestObservation,
  detector: DetectorResult | null,
): { readonly state: DetectionState; readonly metadata: MetadataStatus; readonly confidence: number } {
  if (primary.signature.strength !== "STRONG") {
    return { state: "PROBABLE", metadata: "PARTIAL", confidence: 0.45 };
  }

  if (primary.parserState !== "OK") {
    return { state: "NEEDS_REVIEW", metadata: "PARTIAL", confidence: 0.5 };
  }

  if (!primary.contentRead) {
    return { state: "PROBABLE", metadata: "PARTIAL", confidence: 0.6 };
  }

  if (detector === null) {
    return { state: "NEEDS_REVIEW", metadata: "PARTIAL", confidence: 0.55 };
  }

  if (detector.detectionState === "INVALID") {
    return { state: "NEEDS_REVIEW", metadata: "INVALID", confidence: 0.3 };
  }

  if (detector.detectionState === "NEEDS_REVIEW") {
    return { state: "NEEDS_REVIEW", metadata: "PARTIAL", confidence: detector.confidence };
  }

  return {
    state: detector.detectionState,
    metadata: "VALID",
    confidence: detector.confidence,
  };
}

function primaryEcosystemOf(observations: readonly ManifestObservation[]): ManifestObservation {
  const ordered = [...observations].sort((left, right) => {
    const leftStrong = left.signature.strength === "STRONG" ? 0 : 1;
    const rightStrong = right.signature.strength === "STRONG" ? 0 : 1;

    if (leftStrong !== rightStrong) {
      return leftStrong - rightStrong;
    }

    const leftIndex = ECOSYSTEM_ORDER.indexOf(left.signature.ecosystem as (typeof ECOSYSTEM_ORDER)[number]);
    const rightIndex = ECOSYSTEM_ORDER.indexOf(right.signature.ecosystem as (typeof ECOSYSTEM_ORDER)[number]);

    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
  });

  const primary = ordered[0];

  if (primary === undefined) {
    throw new Error("A project candidate must have at least one manifest");
  }

  return primary;
}

function buildCandidates(
  traversal: TraversalResult,
  rootPath: string,
): ProjectCandidate[] {
  const groups = new Map<string, ManifestObservation[]>();

  for (const observation of traversal.manifests) {
    const dir = directoryOf(observation.relativePath);
    const list = groups.get(dir) ?? [];
    list.push(observation);
    groups.set(dir, list);
  }

  const candidates: ProjectCandidate[] = [];

  for (const [relativeDir, observations] of [...groups.entries()].sort((left, right) =>
    left[0].localeCompare(right[0]),
  )) {
    const primary = primaryEcosystemOf(observations);
    const absoluteManifestPath = resolve(rootPath, primary.relativePath);
    const canRead = primary.signature.readContent && primary.parserState === "OK";
    const manifestText = canRead ? readBoundedText(absoluteManifestPath, MANIFEST_MAX_BYTES) : null;
    const detector =
      manifestText !== null ? parseManifest(manifestText, baseNameOf(primary.relativePath)) : null;

    candidates.push({
      relativeDir,
      canonicalPath: relativeDir.length === 0 ? rootPath : resolve(rootPath, relativeDir),
      observations,
      primary,
      detector,
      manifestText,
      hasTypeScriptConfig: observations.some(
        (observation) => observation.signature.evidenceLabel === "node.tsconfig",
      ),
      contentType: baseNameOf(primary.relativePath).toLowerCase() === "package.json" ? "package.json" : "other",
    });
  }

  return candidates;
}

/**
 * Resolves the project language from manifest content plus directory evidence.
 *
 * A `tsconfig.json` in the same directory is strong evidence that a Node
 * project is written in TypeScript, even when the workspace package itself
 * declares no `typescript` dependency because it inherits the toolchain.
 */
function effectiveLanguage(candidate: ProjectCandidate): string | null {
  const ecosystem = candidate.primary.signature.ecosystem;

  if (ecosystem === "NODE" && candidate.hasTypeScriptConfig) {
    return "TypeScript";
  }

  return (
    candidate.detector?.primaryLanguage ??
    ECOSYSTEM_META[ecosystem]?.language ??
    null
  );
}

function projectKindOf(candidate: ProjectCandidate): ProjectKind {
  if (candidate.relativeDir.length > 0) {
    return "APPLICATION";
  }

  const parsed = parseJsonObject(candidate.manifestText);
  const workspaces = parsed?.workspaces;

  if (workspaces !== undefined && workspaces !== null) {
    return "WORKSPACE_ROOT";
  }

  return "APPLICATION";
}

function insertEvidence(
  database: DatabaseSync,
  projectId: string,
  candidate: ProjectCandidate,
): void {
  database.prepare("DELETE FROM detection_evidence WHERE project_id = ?").run(projectId);

  const insert = database.prepare(
    `INSERT INTO detection_evidence
       (id, project_id, signature, relative_path, weight, parser_state, detail_json, observed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const observedAt = new Date().toISOString();

  candidate.observations.slice(0, 50).forEach((observation, index) => {
    const parserState =
      observation.parserState === "TOO_LARGE"
        ? "TOO_LARGE"
        : observation.parserState === "ERROR"
          ? "ERROR"
          : observation.parserState === "DENIED"
            ? "DENIED"
            : "OK";

    insert.run(
      `evidence_${projectId}_${index}`,
      projectId,
      observation.signature.evidenceLabel,
      observation.relativePath,
      observation.signature.strength === "STRONG" ? 1 : 0.5,
      parserState,
      JSON.stringify({ ecosystem: observation.signature.ecosystem, fingerprint: observation.fingerprint }),
      observedAt,
    );
  });
}

function insertTechnologies(
  database: DatabaseSync,
  projectId: string,
  candidate: ProjectCandidate,
): void {
  const ecosystem = candidate.primary.signature.ecosystem;
  const meta = ECOSYSTEM_META[ecosystem];
  const seen = new Set<string>();

  clearProjectTechnologies(database, projectId);

  const store = (
    key: string,
    name: string,
    kind: TechnologyKind,
    versionSpec: string | null,
    confidence: number,
  ): void => {
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    upsertTechnology(database, { key, name, kind });
    addProjectTechnology(database, {
      projectId,
      technologyKey: key,
      status: "DECLARED",
      versionSpec,
      confidence,
    });
  };

  // The runtime/ecosystem itself is always declared when the signature is strong.
  if (meta !== undefined) {
    store(meta.technology.key, meta.technology.name, meta.technology.kind, null, 0.95);
  }

  // Detector output is the single source of truth for declared technologies.
  for (const technology of candidate.detector?.technologies ?? []) {
    store(
      technology.key,
      technology.name,
      technology.kind,
      technology.versionSpec,
      technology.confidence,
    );
  }

  // The language is recorded as its own technology so the inventory can answer
  // "which projects are TypeScript?" without joining on a display string.
  const language = effectiveLanguage(candidate);

  if (language !== null) {
    const key = language.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    store(key, language, "LANGUAGE", null, candidate.detector?.confidence ?? 0.8);
  }
}

/**
 * Scans one authorized root and persists the detected projects.
 *
 * Only manifests already allowlisted by traversal are read, every read is
 * byte-bounded, and sensitive names are denied before any open. The scan never
 * follows reparse points (traversal enforces that) and never leaves the root.
 */
export async function scanRoot(request: ScanRequest): Promise<ScanSummary> {
  const { database, root } = request;
  const scanId = stableScanId();
  const startedAt = new Date();

  database
    .prepare(
      `INSERT INTO scan_runs (id, root_id, trigger, status, started_at)
       VALUES (?, ?, ?, 'RUNNING', ?)`,
    )
    .run(scanId, root.id, request.trigger ?? "MANUAL", startedAt.toISOString());

  const rules = loadExclusionRulesForRoot(database, root.id);
  const traversal = await traverseRoot({
    rootId: root.id,
    rootPath: root.canonicalPath,
    rules,
  });

  const candidates = buildCandidates(traversal, root.canonicalPath);
  const seenIds: string[] = [];
  let created = 0;
  let updated = 0;

  for (const candidate of candidates) {
    const existing = findProjectByCanonicalPath(database, candidate.canonicalPath);
    const projectId = existing?.id ?? stableProjectId(candidate.canonicalPath);
    seenIds.push(projectId);

    const detection = detectionStateFor(candidate.primary, candidate.detector);
    const displayName =
      candidate.detector?.projectName ??
      extractManifestName(candidate.manifestText, baseNameOf(candidate.primary.relativePath)) ??
      baseNameOf(candidate.canonicalPath) ??
      candidate.relativeDir;

    const update: ProjectUpdate = {
      displayName,
      kind: projectKindOf(candidate),
      primaryEcosystem: candidate.primary.signature.ecosystem,
      primaryLanguage: effectiveLanguage(candidate),
      category: null,
      detectionConfidence: detection.confidence,
      detectionState: detection.state,
      metadataStatus: detection.metadata,
    };

    withTransaction(database, () => {
      if (existing === undefined) {
        insertProject(database, {
          id: projectId,
          rootId: root.id,
          relativePath: candidate.relativeDir,
          canonicalPath: candidate.canonicalPath,
          displayName,
          kind: update.kind,
          primaryEcosystem: update.primaryEcosystem,
          primaryLanguage: update.primaryLanguage,
          category: update.category,
          detectionConfidence: update.detectionConfidence,
          detectionState: update.detectionState,
          metadataStatus: update.metadataStatus,
        });
        created += 1;
      } else {
        updateProject(database, existing.id, update);
        updated += 1;
      }

      insertEvidence(database, projectId, candidate);
      insertTechnologies(database, projectId, candidate);
    });
  }

  const missing = markMissingProjects(database, root.id, seenIds);
  const finishedAt = new Date();

  database
    .prepare(
      `UPDATE scan_runs
          SET status = ?, finished_at = ?, duration_ms = ?, directories_visited = ?,
              files_inspected = ?, projects_seen = ?, projects_created = ?,
              projects_updated = ?, projects_missing = ?, errors_count = ?,
              stats_json = ?
        WHERE id = ?`,
    )
    .run(
      traversal.status === "COMPLETED" ? "COMPLETED" : traversal.status === "FAILED" ? "FAILED" : "LIMIT_EXCEEDED",
      finishedAt.toISOString(),
      finishedAt.getTime() - startedAt.getTime(),
      traversal.stats.directoriesVisited,
      traversal.stats.filesInspected,
      candidates.length,
      created,
      updated,
      missing.length,
      traversal.errors.length,
      JSON.stringify(traversal.stats),
      scanId,
    );

  const persistErrors = Math.min(
    traversal.errors.length,
    request.maxErrorsPersisted ?? 50,
  );

  const insertError = database.prepare(
    `INSERT INTO scan_errors
       (id, scan_run_id, root_id, relative_path, error_code, message, occurred_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  for (let index = 0; index < persistErrors; index += 1) {
    const error = traversal.errors[index];

    if (error === undefined) {
      continue;
    }

    insertError.run(
      `scan_error_${scanId}_${index}`,
      scanId,
      root.id,
      error.relativePath,
      error.code,
      error.message,
      finishedAt.toISOString(),
    );
  }

  database
    .prepare("UPDATE project_roots SET last_scan_at = ?, updated_at = ? WHERE id = ?")
    .run(finishedAt.toISOString(), finishedAt.toISOString(), root.id);

  return {
    scanId,
    rootId: root.id,
    status: traversal.status,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    directoriesVisited: traversal.stats.directoriesVisited,
    filesInspected: traversal.stats.filesInspected,
    manifestsSeen: traversal.stats.manifestsSeen,
    projectsSeen: candidates.length,
    projectsCreated: created,
    projectsUpdated: updated,
    projectsMissing: missing.length,
    errorsCount: traversal.errors.length,
  };
}
