/// <reference types="node" />
/**
 * Relationship repository for persisting and querying project relationships.
 *
 * Manages the detection, storage, and retrieval of relationships between
 * projects and other entities (technologies, ecosystems, languages, etc.).
 *
 * Security boundaries (per SECURITY.md A5-6, AGENTS.md A13):
 * - Only records relationships from authorized roots
 * - Relationships are derived from manifest analysis, not raw file contents
 * - Client must tolerate re-fetches; relationships are not source of truth
 * - Relationships are bounded by the set of scanned projects
 */
import type { DatabaseSync } from "node:sqlite";
import type { Project } from "./project-repository.js";

/** Relationship types between entities */
export type RelationshipType =
  | "DECLARED"
  | "IMPORTED"
  | "DEPENDS_ON"
  | "CONTAINS"
  | "LANGUAGE_OF"
  | "ECOSYSTEM_OF"
  | "FRAMEWORK_FOR"
  | "LIBRARY_FOR";

/** Relationship direction */
export interface RelationshipDirection {
  from: string; // source entity ID
  to: string; // target entity ID
}

/** Edge in a relationship graph */
export interface RelationshipEdge {
  from: string;
  to: string;
  kind: RelationshipType;
  weight?: number; // strength/confidence of the relationship
  detectedAt: string; // ISO timestamp when relationship was detected
}

/** Node in a relationship graph */
export interface RelationshipNode {
  id: string;
  label: string;
  type: string;
  metadata?: Record<string, unknown>; // additional properties
}

/** Create a new relationship record */
export interface CreateRelationship {
  /** Source project ID or entity ID */
  from: string;
  /** Target entity ID */
  to: string;
  /** Type of relationship */
  kind: RelationshipType;
  /** Optional confidence weight (0.0 - 1.0) */
  weight?: number;
}

/** Query options for relationships */
export interface QueryRelationships {
  /** Filter by relationship type */
  kind?: RelationshipType;
  /** Filter from specific source */
  from?: string;
  /** Filter to specific target */
  to?: string;
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/** Result of a relationship query */
export interface QueryResult {
  /** matching relationships */
  relationships: RelationshipEdge[];
  /** total count matching filters */
  total: number;
}

/** Get all relationship types */
export const RELATIONSHIP_TYPES: RelationshipType[] = [
  "DECLARED",
  "IMPORTED",
  "DEPENDS_ON",
  "CONTAINS",
  "LANGUAGE_OF",
  "ECOSYSTEM_OF",
  "FRAMEWORK_FOR",
  "LIBRARY_FOR",
];

/**
 * Repository for managing project relationships.
 *
 * Responsibilities:
 * - Persist relationships detected from project manifests
 * - Query relationships with filters and pagination
 * - Detect and record new relationships during scanning
 * - Remove stale relationships when projects are removed
 */
export default class RelationshipRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
    // Ensure schema is initialized
    this.ensureSchema();
  }

  /** Ensure database schema exists */
  private ensureSchema(): void {
    this.database.prepare(`
      CREATE TABLE IF NOT EXISTS relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        weight REAL DEFAULT 1.0,
        detected_at TEXT NOT NULL,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      )
    `).run();

    this.database.prepare(`
      CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships(from_id);
    `).run();

    this.database.prepare(`
      CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_id);
    `).run();

    this.database.prepare(`
      CREATE INDEX IF NOT EXISTS idx_relationships_kind ON relationships(kind);
    `).run();
  }

  /** Create a new relationship */
  create(rel: CreateRelationship): RelationshipEdge {
    const detectedAt = new Date().toISOString();

    const result = this.database.prepare(`
      INSERT INTO relationships (from_id, to_id, kind, weight, detected_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(rel.from, rel.to, rel.kind, rel.weight ?? 1.0, detectedAt);

    return {
      from: rel.from,
      to: rel.to,
      kind: rel.kind,
      weight: rel.weight ?? 1.0,
      detectedAt: detectedAt,
    };
  }

  /** Create relationships from a project's technologies */
  createFromProjectTechnologies(
    projectId: string,
    technologies: Array<{ technologyKey: string; name: string }>
  ): RelationshipEdge[] {
    const edges: RelationshipEdge[] = [];

    for (const tech of technologies) {
      const techNodeId = `tech:${tech.technologyKey}`;

      // DECLARED relationship: project declares this technology
      const edge = this.create({
        from: projectId,
        to: techNodeId,
        kind: "DECLARED",
        weight: 1.0,
      });

      edges.push(edge);
    }

    return edges;
  }

  /** Create relationships from a project's ecosystem */
  createFromEcosystem(
    projectId: string,
    ecosystem: string | null
  ): RelationshipEdge[] {
    if (ecosystem === undefined || ecosystem === null) {
      return [];
    }

    const ecosystemNodeId = `eco:${ecosystem}`;

    return [this.create({
      from: projectId,
      to: ecosystemNodeId,
      kind: "ECOSYSTEM_OF",
      weight: 1.0,
    })];
  }

  /** Create language relationship */
  createLanguageRelationship(
    projectId: string,
    language: string | null
  ): RelationshipEdge[] {
    if (language === undefined || language === null) {
      return [];
    }

    const languageNodeId = `lang:${language}`;

    return [this.create({
      from: projectId,
      to: languageNodeId,
      kind: "LANGUAGE_OF",
      weight: 1.0,
    })];
  }

  /** Query relationships with filters */
  query(
    options: QueryRelationships = {}
  ): QueryResult {
    let sql = "SELECT * FROM relationships WHERE 1=1";
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (options.kind !== undefined) {
      conditions.push("kind = ?");
      params.push(options.kind);
    }

    if (options.from !== undefined) {
      conditions.push("from_id = ?");
      params.push(options.from);
    }

    if (options.to !== undefined) {
      conditions.push("to_id = ?");
      params.push(options.to);
    }

    if (conditions.length > 0) {
      sql += " AND " + conditions.join(" AND ");
    }

    // Apply limit and offset
    if (options.limit !== undefined) {
      sql += " LIMIT ?";
      params.push(options.limit);

      if (options.offset !== undefined) {
        sql += ` OFFSET ?`;
        params.push(options.offset);
      }
    }

    const rows = this.database.prepare(sql).all() as any[];

    const relationships: RelationshipEdge[] = rows.map((row) => ({
      from: row.from_id,
      to: row.to_id,
      kind: row.kind as RelationshipType,
      weight: row.weight,
      detectedAt: row.detected_at,
    }));

    // Count total (simple count without limit/offset)
    let countSql = "SELECT COUNT(*) as count FROM relationships WHERE 1=1";
    let countParams: unknown[] = [];
    if (options.kind !== undefined) {
      countSql += " AND kind = ?";
      countParams.push(options.kind);
    }
    if (options.from !== undefined) {
      countSql += " AND from_id = ?";
      countParams.push(options.from);
    }
    if (options.to !== undefined) {
      countSql += " AND to_id = ?";
      countParams.push(options.to);
    }
    const countRow = this.database.prepare(countSql).get() as any;
    const total = countRow?.count ?? 0;

    return { relationships, total };
  }

  /** Get relationships by type */
  byKind(kind: RelationshipType): RelationshipEdge[] {
    const rows = this.database
      .prepare("SELECT * FROM relationships WHERE kind = ?")
      .all(kind) as any[];

    return rows.map((row) => ({
      from: row.from_id,
      to: row.to_id,
      kind: row.kind as RelationshipType,
      weight: row.weight,
      detectedAt: row.detected_at,
    }));
  }

  /** Get relationships from a specific source */
  from(source: string): RelationshipEdge[] {
    const rows = this.database
      .prepare("SELECT * FROM relationships WHERE from_id = ?")
      .all(source) as any[];

    return rows.map((row) => ({
      from: row.from_id,
      to: row.to_id,
      kind: row.kind as RelationshipType,
      weight: row.weight,
      detectedAt: row.detected_at,
    }));
  }

  /** Get relationships to a specific target */
  to(target: string): RelationshipEdge[] {
    const rows = this.database
      .prepare("SELECT * FROM relationships WHERE to_id = ?")
      .all(target) as any[];

    return rows.map((row) => ({
      from: row.from_id,
      to: row.to_id,
      kind: row.kind as RelationshipType,
      weight: row.weight,
      detectedAt: row.detected_at,
    }));
  }

  /** Remove all relationships for a project */
  removeByProject(projectId: string): number {
    const result = this.database
      .prepare("DELETE FROM relationships WHERE from_id = ? OR to_id = ?")
      .run(projectId, projectId);

    return (result as any).changes ?? 0;
  }

  /** Remove specific relationship */
  remove(fromId: string, toId: string, kind: RelationshipType): boolean {
    const result = this.database
      .prepare(
        "DELETE FROM relationships WHERE from_id = ? AND to_id = ? AND kind = ?"
      )
      .run(fromId, toId, kind);

    return (result as any).changes > 0;
  }

  /** Get all relationship types that exist in the database */
  existingTypes(): RelationshipType[] {
    const rows = this.database
      .prepare("SELECT DISTINCT kind FROM relationships")
      .all() as any[];

    return rows.map((row) => row.kind as RelationshipType);
  }

  /** Get count of relationships per type */
  typeCounts(): Record<RelationshipType, number> {
    const counts: Record<RelationshipType, number> = {
      DECLARED: 0,
      IMPORTED: 0,
      DEPENDS_ON: 0,
      CONTAINS: 0,
      LANGUAGE_OF: 0,
      ECOSYSTEM_OF: 0,
      FRAMEWORK_FOR: 0,
      LIBRARY_FOR: 0,
    };

    const rows = this.database
      .prepare("SELECT kind, COUNT(*) as count FROM relationships GROUP BY kind")
      .all() as any[];

    for (const row of rows) {
      const kind = row.kind as keyof typeof counts;
      if (kind in counts) {
        counts[kind] = row.count;
      }
    }

    return counts;
  }
}