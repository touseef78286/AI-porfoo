import type { DatabaseSync } from "node:sqlite";

export interface StatusChangeRecord {
  readonly id: string;
  readonly projectId: string;
  readonly fromStatus: string | null;
  readonly toStatus: string;
  readonly reason: string;
  readonly observedAt: string;
}

interface StatusChangeRow {
  readonly id: string;
  readonly project_id: string;
  readonly from_status: string | null;
  readonly to_status: string;
  readonly reason: string;
  readonly observed_at: string;
}

function mapRow(row: StatusChangeRow): StatusChangeRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    reason: row.reason,
    observedAt: row.observed_at,
  };
}

/** Record a status change for a project. */
export function recordStatusChange(
  database: DatabaseSync,
  projectId: string,
  fromStatus: string | null,
  toStatus: string,
  reason?: string,
): string {
  const id = `history_${projectId}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const now = new Date().toISOString();

  database
    .prepare(
      `INSERT INTO project_status_history
         (id, project_id, from_status, to_status, reason, observed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, projectId, fromStatus, toStatus, reason ?? "", now);

  return id;
}

/** List the full status history for a project, most recent first. */
export function listStatusHistory(
  database: DatabaseSync,
  projectId: string,
): StatusChangeRecord[] {
  const rows = database
    .prepare(
      "SELECT * FROM project_status_history WHERE project_id = ? ORDER BY observed_at DESC",
    )
    .all(projectId) as unknown as StatusChangeRow[];

  return rows.map(mapRow);
}

/** List all status changes across all projects, most recent first. */
export function listAllStatusChanges(
  database: DatabaseSync,
): StatusChangeRecord[] {
  const rows = database
    .prepare("SELECT * FROM project_status_history ORDER BY observed_at DESC")
    .all() as unknown as StatusChangeRow[];

  return rows.map(mapRow);
}

/** Count status changes by fromStatus -> toStatus. */
export function countStatusChanges(
  database: DatabaseSync,
): Record<string, number> {
  const rows = database
    .prepare(
      "SELECT from_status, to_status, COUNT(*) as cnt FROM project_status_history GROUP BY from_status, to_status",
    )
    .all() as any[];

  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = `${row.from_status} -> ${row.to_status}`;
    counts[key] = row.cnt;
  }

  return counts;
}

/** Get status transition statistics. */
export function getStatusTransitionStats(
  database: DatabaseSync,
): Record<string, { from: string; to: string; count: number; lastObserved: string }> {
  const rows = database
    .prepare(
      "SELECT from_status, to_status, COUNT(*) as cnt, MAX(observed_at) as last_observed FROM project_status_history GROUP BY from_status, to_status",
    )
    .all() as any[];

  const stats: Record<string, { from: string; to: string; count: number; lastObserved: string }> = {};
  for (const row of rows) {
    const key = `${row.from_status} -> ${row.to_status}`;
    stats[key] = {
      from: row.from_status,
      to: row.to_status,
      count: row.cnt,
      lastObserved: row.last_observed,
    };
  }

  return stats;
}

/** List project IDs that have had a status change from a given fromStatus. */
export function listProjectsWithStatusChanges(
  database: DatabaseSync,
  fromStatus: string,
): string[] {
  const rows = database
    .prepare(
      "SELECT DISTINCT project_id FROM project_status_history WHERE from_status = ?",
    )
    .all(fromStatus) as unknown as { project_id: string }[];

  return rows.map((row) => row.project_id);
}