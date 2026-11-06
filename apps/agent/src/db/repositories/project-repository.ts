import type { DatabaseSync } from "node:sqlite";

export type ProjectStatus = "ACTIVE" | "MISSING" | "EXCLUDED" | "ARCHIVED";

export type ProjectKind =
  | "APPLICATION"
  | "LIBRARY"
  | "WORKSPACE_ROOT"
  | "WORKSPACE_MEMBER"
  | "SOLUTION"
  | "UNKNOWN";

export type DetectionState = "CONFIRMED" | "PROBABLE" | "CANDIDATE" | "NEEDS_REVIEW";

export type MetadataStatus = "VALID" | "PARTIAL" | "INVALID" | "UNKNOWN";

export type PublicationState = "pending" | "approved" | "rejected" | "snapshot" | "published";

export interface ProjectPublication {
  readonly state: PublicationState;
  readonly approvedFields: readonly string[];
  readonly rejectionReason: string | null;
}

export interface Project {
  readonly id: string;
  readonly rootId: string;
  readonly relativePath: string;
  readonly canonicalPath: string;
  readonly displayName: string;
  readonly kind: ProjectKind;
  readonly primaryEcosystem: string | null;
  readonly primaryLanguage: string | null;
  readonly category: string | null;
  readonly status: ProjectStatus;
  readonly detectionConfidence: number;
  readonly detectionState: DetectionState;
  readonly metadataStatus: MetadataStatus;
  readonly gitBranch: string | null;
  readonly gitRemote: string | null;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly lastScannedAt: string | null;
  readonly publication: ProjectPublication;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NewProject {
  readonly id: string;
  readonly rootId: string;
  readonly relativePath: string;
  readonly canonicalPath: string;
  readonly displayName: string;
  readonly kind: ProjectKind;
  readonly primaryEcosystem?: string | null;
  readonly primaryLanguage?: string | null;
  readonly category?: string | null;
  readonly status?: ProjectStatus;
  readonly detectionConfidence: number;
  readonly detectionState: DetectionState;
  readonly metadataStatus: MetadataStatus;
}

interface ProjectRow {
  readonly id: string;
  readonly root_id: string;
  readonly relative_path: string;
  readonly canonical_path: string;
  readonly display_name: string;
  readonly kind: ProjectKind;
  readonly primary_ecosystem: string | null;
  readonly primary_language: string | null;
  readonly category: string | null;
  readonly status: ProjectStatus;
  readonly detection_confidence: number;
  readonly detection_state: DetectionState;
  readonly metadata_status: MetadataStatus;
  readonly git_branch: string | null;
  readonly git_remote: string | null;
  readonly first_seen_at: string;
  readonly last_seen_at: string;
  readonly last_scanned_at: string | null;
  readonly publication_state: PublicationState;
  readonly publication_approved_fields: string;
  readonly publication_rejection_reason: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

function parseApprovedFields(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

function mapRow(row: ProjectRow): Project {
  return {
    id: row.id,
    rootId: row.root_id,
    relativePath: row.relative_path,
    canonicalPath: row.canonical_path,
    displayName: row.display_name,
    kind: row.kind,
    primaryEcosystem: row.primary_ecosystem,
    primaryLanguage: row.primary_language,
    category: row.category,
    status: row.status,
    detectionConfidence: row.detection_confidence,
    detectionState: row.detection_state,
    metadataStatus: row.metadata_status,
    gitBranch: row.git_branch,
    gitRemote: row.git_remote,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    lastScannedAt: row.last_scanned_at,
    publication: {
      state: row.publication_state,
      approvedFields: parseApprovedFields(row.publication_approved_fields),
      rejectionReason: row.publication_rejection_reason,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recordStatusChange(
  database: DatabaseSync,
  projectId: string,
  fromStatus: string | null,
  toStatus: string,
  reason: string,
): void {
  database
    .prepare(
      `INSERT INTO project_status_history
         (id, project_id, from_status, to_status, reason, observed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      `history_${projectId}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      projectId,
      fromStatus,
      toStatus,
      reason,
      new Date().toISOString(),
    );
}

/** Inserts a discovered project. The canonical path is unique. */
export function insertProject(database: DatabaseSync, project: NewProject): void {
  const now = new Date().toISOString();

  database
    .prepare(
      `INSERT INTO projects
         (id, root_id, relative_path, canonical_path, display_name, kind,
          primary_ecosystem, primary_language, category, status,
          detection_confidence, detection_state, metadata_status,
          first_seen_at, last_seen_at, last_scanned_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      project.id,
      project.rootId,
      project.relativePath,
      project.canonicalPath,
      project.displayName,
      project.kind,
      project.primaryEcosystem ?? null,
      project.primaryLanguage ?? null,
      project.category ?? null,
      project.status ?? "ACTIVE",
      project.detectionConfidence,
      project.detectionState,
      project.metadataStatus,
      now,
      now,
      now,
      now,
      now,
    );

  recordStatusChange(database, project.id, null, project.status ?? "ACTIVE", "Project discovered");
}

export interface ProjectUpdate {
  readonly displayName: string;
  readonly kind: ProjectKind;
  readonly primaryEcosystem: string | null;
  readonly primaryLanguage: string | null;
  readonly category: string | null;
  readonly detectionConfidence: number;
  readonly detectionState: DetectionState;
  readonly metadataStatus: MetadataStatus;
}

/** Updates an existing project in place and refreshes last-seen timestamps. */
export function updateProject(
  database: DatabaseSync,
  id: string,
  update: ProjectUpdate,
): boolean {
  const now = new Date().toISOString();

  const result = database
    .prepare(
      `UPDATE projects
          SET display_name = ?, kind = ?, primary_ecosystem = ?, primary_language = ?,
              category = ?, detection_confidence = ?, detection_state = ?,
              metadata_status = ?, status = 'ACTIVE', missing_since = NULL,
              last_seen_at = ?, last_scanned_at = ?, updated_at = ?
        WHERE id = ?`,
    )
    .run(
      update.displayName,
      update.kind,
      update.primaryEcosystem,
      update.primaryLanguage,
      update.category,
      update.detectionConfidence,
      update.detectionState,
      update.metadataStatus,
      now,
      now,
      now,
      id,
    );

  return Number(result.changes) > 0;
}

export function findProject(database: DatabaseSync, id: string): Project | undefined {
  const row = database
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(id) as unknown as ProjectRow | undefined;

  return row === undefined ? undefined : mapRow(row);
}

export function findProjectByCanonicalPath(
  database: DatabaseSync,
  canonicalPath: string,
): Project | undefined {
  const row = database
    .prepare("SELECT * FROM projects WHERE canonical_path = ?")
    .get(canonicalPath) as unknown as ProjectRow | undefined;

  return row === undefined ? undefined : mapRow(row);
}

export function listProjects(database: DatabaseSync): Project[] {
  const rows = database
    .prepare("SELECT * FROM projects ORDER BY display_name")
    .all() as unknown as ProjectRow[];

  return rows.map(mapRow);
}

export function listProjectsByStatus(
  database: DatabaseSync,
  status: ProjectStatus,
): Project[] {
  const rows = database
    .prepare("SELECT * FROM projects WHERE status = ? ORDER BY display_name")
    .all(status) as unknown as ProjectRow[];

  return rows.map(mapRow);
}

export function listProjectsByEcosystem(
  database: DatabaseSync,
  ecosystem: string,
): Project[] {
  const rows = database
    .prepare("SELECT * FROM projects WHERE primary_ecosystem = ? ORDER BY display_name")
    .all(ecosystem) as unknown as ProjectRow[];

  return rows.map(mapRow);
}

export function searchProjects(database: DatabaseSync, query: string): Project[] {
  const pattern = `%${query.toLowerCase()}%`;
  const rows = database
    .prepare(
      "SELECT * FROM projects WHERE LOWER(display_name) LIKE ? ORDER BY display_name",
    )
    .all(pattern) as unknown as ProjectRow[];

  return rows.map(mapRow);
}

/** Updates a project status and records the transition. */
export function updateProjectStatus(
  database: DatabaseSync,
  id: string,
  status: ProjectStatus,
  reason?: string,
): boolean {
  const current = findProject(database, id);

  if (current === undefined) {
    return false;
  }

  if (current.status === status) {
    return true;
  }

  const now = new Date().toISOString();

  database
    .prepare(
      "UPDATE projects SET status = ?, updated_at = ?, missing_since = ? WHERE id = ?",
    )
    .run(status, now, status === "MISSING" ? now : null, id);

  recordStatusChange(database, id, current.status, status, reason ?? "Manual status update");

  return true;
}

export function countByStatus(database: DatabaseSync): Record<string, number> {
  const rows = database
    .prepare("SELECT status, COUNT(*) AS cnt FROM projects GROUP BY status")
    .all() as unknown as { status: string; cnt: number }[];

  const counts: Record<string, number> = {};

  for (const row of rows) {
    counts[row.status] = row.cnt;
  }

  return counts;
}

const PUBLICATION_TRANSITIONS: Record<PublicationState, readonly PublicationState[]> = {
  pending: ["approved", "rejected", "snapshot"],
  approved: ["snapshot", "published", "rejected"],
  rejected: ["pending", "approved"],
  snapshot: ["approved", "published"],
  published: [],
};

/** Returns whether a publication state change is allowed. */
export function canTransitionPublication(
  from: PublicationState,
  to: PublicationState,
): boolean {
  return PUBLICATION_TRANSITIONS[from].includes(to);
}

/** Updates publication state; the caller validates the transition first. */
export function setPublicationState(
  database: DatabaseSync,
  id: string,
  state: PublicationState,
  options: { approvedFields?: readonly string[]; rejectionReason?: string | null } = {},
): void {
  database
    .prepare(
      `UPDATE projects
          SET publication_state = ?, publication_approved_fields = ?,
              publication_rejection_reason = ?, updated_at = ?
        WHERE id = ?`,
    )
    .run(
      state,
      JSON.stringify(options.approvedFields ?? []),
      options.rejectionReason ?? null,
      new Date().toISOString(),
      id,
    );
}

/**
 * Marks ACTIVE projects under a root as MISSING when a scan did not see them.
 * Returns the ids that changed.
 */
export function markMissingProjects(
  database: DatabaseSync,
  rootId: string,
  seenIds: readonly string[],
): string[] {
  const active = database
    .prepare("SELECT id FROM projects WHERE root_id = ? AND status = 'ACTIVE'")
    .all(rootId) as unknown as { id: string }[];

  const seen = new Set(seenIds);
  const missing: string[] = [];

  for (const row of active) {
    if (!seen.has(row.id)) {
      missing.push(row.id);
    }
  }

  const now = new Date().toISOString();
  const update = database.prepare(
    "UPDATE projects SET status = 'MISSING', missing_since = ?, updated_at = ? WHERE id = ?",
  );

  for (const id of missing) {
    update.run(now, now, id);
    recordStatusChange(database, id, "ACTIVE", "MISSING", "Project no longer present during scan");
  }

  return missing;
}

/** Total number of projects, optionally filtered by status. */
export function countProjects(database: DatabaseSync): number {
  const row = database.prepare("SELECT COUNT(*) AS cnt FROM projects").get() as unknown as {
    cnt: number;
  };

  return row.cnt;
}
