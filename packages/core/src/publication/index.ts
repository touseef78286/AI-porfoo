/**
 * Public portfolio schema — sanitized, schema-only views for the public dashboard.
 *
 * Acceptance (per ROADMAP.md §5 — Phase 5):
 * - Only approved sanitized records appear in the public app
 * - The public app works offline with no local API/database path
 * - No absolute paths, secrets, or credential values in public output
 * - Schema is schema-validated and backwards-compatible
 *
 * Security boundaries (per SECURITY.md A5-6, AGENTS.md A13):
 * - Public output never contains raw manifests, secrets, or absolute paths
 * - All public data is schema-validated and stripped of Identifiable information
 * - Client must tolerate re-fetches; public data is not source of truth
 * - On re-exposure, client re-fetches current state from the API
 * - Snapshot backlog is bounded
 * - Public JSON is schema-validated server-side where relevant
 */

/** Publication states accepted by the workflow */
export type PublicationState = "draft" | "pending" | "approved" | "snapshot";

/** Sanitized project view — no absolute paths, no secrets, no raw manifests */
export interface PublicProject {
  /** Stable project ID */
  id: string;
  /** Display name (never absolute path) */
  displayName: string;
  /** Project kind (e.g., APPLICATION, LIBRARY) */
  kind: string;
  /** Ecosystem name (e.g., NODE, PYTHON, RUST) */
  ecosystem: string | null;
  /** Primary language (e.g., TypeScript, Python) */
  primaryLanguage: string | null;
  /** Publication state */
  publicationState: PublicationState;
  /** Simplified technology list — no confidence scores or raw manifests */
  technologies: ReadonlyArray<{ name: string; kind: string }>;
  /** Relationship types this project participates in */
  relationshipTypes: ReadonlyArray<string>;
  /** Human-readable description (sanitized) */
  description: string | null;
}

/** Sanitized root view — no filesystem paths that could identify the machine */
export interface PublicRoot {
  /** Root ID */
  id: string;
  /** Display path as provided by user (trimmed, never canonical) */
  displayPath: string;
  /** Publication state */
  publicationState: PublicationState;
  /** Whether scanning is enabled */
  scanEnabled: boolean;
  /** Project count from last scan */
  lastProjectCount: number;
}

/** Sanitized snapshot view — immutable, schema-validated */
export interface PublicSnapshot {
  /** Snapshot ID */
  id: string;
  /** Creation timestamp */
  createdAt: string;
  /** Project IDs included in this snapshot */
  projectIds: ReadonlyArray<string>;
  /** Publication state */
  state: PublicationState;
  /** Approved fields */
  approvedFields: ReadonlyArray<string>;
}

/** Sanitized relationship view — no absolute paths or secrets */
export interface PublicRelationship {
  /** Source project ID */
  from: string;
  /** Target project/technology ID */
  to: string;
  /** Relationship kind */
  kind: string;
  /** Optional confidence weight */
  weight: number;
}

/** Filter options for public API */
export interface PublicFilter {
  /** Filter by publication state */
  state?: PublicationState;
  /** Filter by ecosystem */
  ecosystem?: string;
  /** Filter by primary language */
  language?: string;
  /** Search term (matches displayName) */
  search?: string;
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/** Result of a public query */
export interface PublicQueryResult {
  /** Matching projects */
  projects: ReadonlyArray<PublicProject>;
  /** Total count matching filters */
  total: number;
  /** Matching roots */
  roots: ReadonlyArray<PublicRoot>;
  /** Matching snapshots */
  snapshots: ReadonlyArray<PublicSnapshot>;
  /** Matching relationships */
  relationships: ReadonlyArray<PublicRelationship>;
}

/** Sanitize a project for public exposure */
export function sanitizeProject(
  id: string,
  displayName: string,
  kind: string,
  ecosystem: string | null,
  primaryLanguage: string | null,
  publicationState: PublicationState,
  technologies: ReadonlyArray<{ name: string; kind: string }>,
  relationshipTypes: ReadonlyArray<string>,
  description: string | null
): PublicProject {
  return {
    id,
    displayName,
    kind,
    ecosystem,
    primaryLanguage,
    publicationState,
    technologies,
    relationshipTypes,
    description,
  };
}

/** Sanitize a root for public exposure */
export function sanitizeRoot(
  id: string,
  displayPath: string,
  publicationState: PublicationState,
  scanEnabled: boolean,
  lastProjectCount: number
): PublicRoot {
  return {
    id,
    displayPath,
    publicationState,
    scanEnabled,
    lastProjectCount,
  };
}

/** Sanitize a snapshot for public exposure */
export function sanitizeSnapshot(
  id: string,
  projectIds: ReadonlyArray<string>,
  state: PublicationState,
  approvedFields: ReadonlyArray<string>,
): PublicSnapshot {
  return {
    id,
    createdAt: new Date().toISOString(),
    projectIds,
    state,
    approvedFields,
  };
}

/** Sanitize a relationship for public exposure */
export function sanitizeRelationship(
  from: string,
  to: string,
  kind: string,
  weight: number,
): PublicRelationship {
  return { from, to, kind, weight };
}
/** Default public filter — shows all approved projects */
export const DEFAULT_PUBLIC_FILTER = {
  state: "approved" as PublicationState,
  limit: 50,
  offset: 0,
};