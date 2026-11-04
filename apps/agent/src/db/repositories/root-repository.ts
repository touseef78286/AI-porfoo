import type { DatabaseSync } from "node:sqlite";

export type RootStatus = "ACTIVE" | "PAUSED" | "UNAVAILABLE" | "REMOVED";

export interface ProjectRoot {
  readonly id: string;
  readonly canonicalPath: string;
  readonly displayPath: string;
  readonly status: RootStatus;
  readonly watchEnabled: boolean;
  readonly lastScanAt: string | null;
  readonly lastError: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NewProjectRoot {
  readonly id: string;
  /** Canonical path produced by the root validator. Stored lowercase. */
  readonly canonicalPath: string;
  readonly displayPath: string;
  readonly status?: RootStatus;
  readonly watchEnabled?: boolean;
}

interface ProjectRootRow {
  readonly id: string;
  readonly canonical_path: string;
  readonly display_path: string;
  readonly status: RootStatus;
  readonly watch_enabled: number;
  readonly last_scan_at: string | null;
  readonly last_error: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

function mapRow(row: ProjectRootRow): ProjectRoot {
  return {
    id: row.id,
    canonicalPath: row.canonical_path,
    displayPath: row.display_path,
    status: row.status,
    watchEnabled: row.watch_enabled === 1,
    lastScanAt: row.last_scan_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Inserts a root; the unique index rejects a duplicate canonical path. */
export function insertRoot(database: DatabaseSync, root: NewProjectRoot): void {
  const now = new Date().toISOString();

  database
    .prepare(
      `INSERT INTO project_roots
         (id, canonical_path, display_path, status, watch_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      root.id,
      root.canonicalPath,
      root.displayPath,
      root.status ?? "ACTIVE",
      root.watchEnabled === false ? 0 : 1,
      now,
      now,
    );
}

export function findRootByCanonicalPath(
  database: DatabaseSync,
  canonicalPath: string,
): ProjectRoot | undefined {
  const row = database
    .prepare("SELECT * FROM project_roots WHERE canonical_path = ?")
    .get(canonicalPath) as unknown as ProjectRootRow | undefined;

  return row === undefined ? undefined : mapRow(row);
}

export function listRoots(database: DatabaseSync): ProjectRoot[] {
  const rows = database
    .prepare("SELECT * FROM project_roots ORDER BY canonical_path")
    .all() as unknown as ProjectRootRow[];

  return rows.map(mapRow);
}

export function updateRootStatus(
  database: DatabaseSync,
  id: string,
  status: RootStatus,
  lastError: string | null = null,
): boolean {
  const result = database
    .prepare(
      "UPDATE project_roots SET status = ?, last_error = ?, updated_at = ? WHERE id = ?",
    )
    .run(status, lastError, new Date().toISOString(), id);

  return Number(result.changes) > 0;
}
