import type { DatabaseSync } from "node:sqlite";

export type TechnologyKind =
  | "LANGUAGE"
  | "FRAMEWORK"
  | "RUNTIME"
  | "DATABASE"
  | "TOOL"
  | "PLATFORM";

export type TechnologyUsageStatus = "DECLARED" | "INSTALLED" | "USED";

export interface Technology {
  readonly key: string;
  readonly name: string;
  readonly kind: TechnologyKind;
}

export interface ProjectTechnology {
  readonly projectId: string;
  readonly technologyKey: string;
  readonly name: string;
  readonly kind: TechnologyKind;
  readonly status: TechnologyUsageStatus;
  readonly versionSpec: string | null;
  readonly confidence: number;
}

export interface NewProjectTechnology {
  readonly projectId: string;
  readonly technologyKey: string;
  readonly status: TechnologyUsageStatus;
  readonly versionSpec?: string | null;
  readonly confidence: number;
  readonly evidenceJson?: string | null;
}

interface TechnologyRow {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly kind: TechnologyKind;
}

interface ProjectTechnologyRow {
  readonly project_id: string;
  readonly technology_key: string;
  readonly name: string;
  readonly kind: TechnologyKind;
  readonly status: TechnologyUsageStatus;
  readonly version_spec: string | null;
  readonly confidence: number;
}

function technologyId(key: string): string {
  return `tech_${key.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
}

/** Inserts a technology once and returns its stable key. */
export function upsertTechnology(
  database: DatabaseSync,
  technology: Technology,
): void {
  database
    .prepare(
      `INSERT INTO technologies (id, "key", name, kind, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT("key") DO UPDATE SET name = excluded.name, kind = excluded.kind`,
    )
    .run(
      technologyId(technology.key),
      technology.key,
      technology.name,
      technology.kind,
      new Date().toISOString(),
    );
}

/** Associates a technology with a project, replacing the previous declaration. */
export function addProjectTechnology(
  database: DatabaseSync,
  technology: NewProjectTechnology,
): void {
  const row = database
    .prepare('SELECT id FROM technologies WHERE "key" = ?')
    .get(technology.technologyKey) as unknown as { id: string } | undefined;

  if (row === undefined) {
    throw new Error(`Unknown technology key: ${technology.technologyKey}`);
  }

  const now = new Date().toISOString();

  database
    .prepare(
      `INSERT INTO project_technologies
         (project_id, technology_id, status, version_spec, evidence_json, confidence,
          first_seen_at, last_verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id, technology_id, status) DO UPDATE SET
         version_spec = excluded.version_spec,
         evidence_json = excluded.evidence_json,
         confidence = excluded.confidence,
         last_verified_at = excluded.last_verified_at`,
    )
    .run(
      technology.projectId,
      row.id,
      technology.status,
      technology.versionSpec ?? null,
      technology.evidenceJson ?? null,
      technology.confidence,
      now,
      now,
    );
}

/**
 * Removes every technology association for a project.
 *
 * Scans call this before re-inserting so a technology that no longer appears in
 * the manifest does not survive as a stale claim.
 */
export function clearProjectTechnologies(database: DatabaseSync, projectId: string): void {
  database.prepare("DELETE FROM project_technologies WHERE project_id = ?").run(projectId);
}

export function listProjectTechnologies(
  database: DatabaseSync,
  projectId: string,
): ProjectTechnology[] {
  const rows = database
    .prepare(
      `SELECT pt.project_id, t."key" AS technology_key, t.name, t.kind, pt.status,
              pt.version_spec, pt.confidence
         FROM project_technologies pt
         JOIN technologies t ON t.id = pt.technology_id
        WHERE pt.project_id = ?
        ORDER BY t.kind, t.name`,
    )
    .all(projectId) as unknown as ProjectTechnologyRow[];

  return rows.map((row) => ({
    projectId: row.project_id,
    technologyKey: row.technology_key,
    name: row.name,
    kind: row.kind,
    status: row.status,
    versionSpec: row.version_spec,
    confidence: row.confidence,
  }));
}

export function getTechnologyByKey(
  database: DatabaseSync,
  key: string,
): Technology | undefined {
  const row = database
    .prepare('SELECT "key", name, kind FROM technologies WHERE "key" = ?')
    .get(key) as unknown as Technology | undefined;

  return row;
}

export function listTechnologiesByKind(
  database: DatabaseSync,
  kind: TechnologyKind,
): Technology[] {
  return database
    .prepare('SELECT "key", name, kind FROM technologies WHERE kind = ? ORDER BY name')
    .all(kind) as unknown as Technology[];
}

export function listAllTechnologies(database: DatabaseSync): Technology[] {
  return database
    .prepare('SELECT "key", name, kind FROM technologies ORDER BY kind, name')
    .all() as unknown as Technology[];
}

export function findByConfidenceRange(
  database: DatabaseSync,
  minConfidence: number,
  maxConfidence: number,
): ProjectTechnology[] {
  const rows = database
    .prepare(
      `SELECT pt.project_id, t."key" AS technology_key, t.name, t.kind, pt.status,
              pt.version_spec, pt.confidence
         FROM project_technologies pt
         JOIN technologies t ON t.id = pt.technology_id
        WHERE pt.confidence >= ? AND pt.confidence <= ?
        ORDER BY pt.confidence DESC`,
    )
    .all(minConfidence, maxConfidence) as unknown as ProjectTechnologyRow[];

  return rows.map((row) => ({
    projectId: row.project_id,
    technologyKey: row.technology_key,
    name: row.name,
    kind: row.kind,
    status: row.status,
    versionSpec: row.version_spec,
    confidence: row.confidence,
  }));
}

export function getMostCommonTechnologies(
  database: DatabaseSync,
  limit = 10,
): { technologyKey: string; technologyName: string; kind: TechnologyKind; projectCount: number }[] {
  const rows = database
    .prepare(
      `SELECT t."key" AS technology_key, t.name AS technology_name, t.kind,
              COUNT(DISTINCT pt.project_id) AS project_count
         FROM project_technologies pt
         JOIN technologies t ON t.id = pt.technology_id
        GROUP BY t.id
        ORDER BY project_count DESC, t.name
        LIMIT ?`,
    )
    .all(limit) as unknown as {
    technology_key: string;
    technology_name: string;
    kind: TechnologyKind;
    project_count: number;
  }[];

  return rows.map((row) => ({
    technologyKey: row.technology_key,
    technologyName: row.technology_name,
    kind: row.kind,
    projectCount: row.project_count,
  }));
}
