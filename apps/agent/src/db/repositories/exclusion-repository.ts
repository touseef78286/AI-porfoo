import type { DatabaseSync } from "node:sqlite";

import type { ExclusionKind, ExclusionRule } from "@lpi/core";

export interface Exclusion {
  readonly id: string;
  readonly rootId: string | null;
  readonly pattern: string;
  readonly kind: ExclusionKind;
  readonly reason: string;
  readonly isSystem: boolean;
  readonly createdAt: string;
}

export interface NewExclusion {
  readonly id: string;
  readonly rootId?: string | null;
  readonly pattern: string;
  readonly kind: ExclusionKind;
  readonly reason: string;
  readonly isSystem?: boolean;
}

interface ExclusionRow {
  readonly id: string;
  readonly root_id: string | null;
  readonly pattern: string;
  readonly kind: ExclusionKind;
  readonly reason: string;
  readonly is_system: number;
  readonly created_at: string;
}

function mapRow(row: ExclusionRow): Exclusion {
  return {
    id: row.id,
    rootId: row.root_id,
    pattern: row.pattern,
    kind: row.kind,
    reason: row.reason,
    isSystem: row.is_system === 1,
    createdAt: row.created_at,
  };
}

export function addExclusion(database: DatabaseSync, exclusion: NewExclusion): void {
  database
    .prepare(
      `INSERT INTO exclusions (id, root_id, pattern, kind, reason, is_system, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      exclusion.id,
      exclusion.rootId ?? null,
      exclusion.pattern,
      exclusion.kind,
      exclusion.reason,
      exclusion.isSystem === true ? 1 : 0,
      new Date().toISOString(),
    );
}

/** Lists global rules plus the rules for one root when a root id is given. */
export function listExclusions(
  database: DatabaseSync,
  rootId?: string | null,
): Exclusion[] {
  if (rootId === undefined) {
    const rows = database
      .prepare("SELECT * FROM exclusions ORDER BY created_at, id")
      .all() as unknown as ExclusionRow[];

    return rows.map(mapRow);
  }

  const rows = database
    .prepare(
      "SELECT * FROM exclusions WHERE root_id IS NULL OR root_id = ? ORDER BY created_at, id",
    )
    .all(rootId) as unknown as ExclusionRow[];

  return rows.map(mapRow);
}

/**
 * Deletes a user rule. Built-in system rules cannot be removed, so this
 * returns false for them instead of throwing.
 */
export function deleteUserExclusion(database: DatabaseSync, id: string): boolean {
  const result = database
    .prepare("DELETE FROM exclusions WHERE id = ? AND is_system = 0")
    .run(id);

  return Number(result.changes) > 0;
}

/** Loads the rules that apply to a root in the shape the core matcher expects. */
export function loadExclusionRulesForRoot(
  database: DatabaseSync,
  rootId: string | null,
): ExclusionRule[] {
  return listExclusions(database, rootId).map((exclusion) => ({
    kind: exclusion.kind,
    pattern: exclusion.pattern,
    isSystem: exclusion.isSystem,
  }));
}
