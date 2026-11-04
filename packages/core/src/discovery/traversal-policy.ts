import type { ManifestSignature } from "./manifests.js";

/**
 * Bounded traversal policy for Phase 1.
 *
 * Limits are explicit and clamped so a caller cannot accidentally request an
 * unbounded scan on this low-memory machine. The defaults match
 * docs/DISCOVERY.md section 4.
 */

export interface TraversalLimits {
  /** Maximum directory depth below the root. The root itself is depth 0. */
  readonly maxDepth: number;
  readonly maxDirectories: number;
  readonly maxFilesInspected: number;
  readonly maxDurationMs: number;
  /** Directories processed concurrently. */
  readonly concurrency: number;
  readonly maxManifestBytes: number;
  /** Errors kept in the result; further errors are dropped, not fatal. */
  readonly maxErrors: number;
}

export const DEFAULT_TRAVERSAL_LIMITS: TraversalLimits = Object.freeze({
  maxDepth: 12,
  maxDirectories: 20_000,
  maxFilesInspected: 100_000,
  maxDurationMs: 120_000,
  concurrency: 8,
  maxManifestBytes: 256 * 1024,
  maxErrors: 200,
});

function clampInteger(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

/**
 * Validates and clamps caller overrides. A malformed value never disables
 * bounding; it falls back or clamps into the safe range.
 */
export function normalizeTraversalLimits(
  overrides: Partial<TraversalLimits> = {},
): TraversalLimits {
  return {
    maxDepth: clampInteger(overrides.maxDepth, DEFAULT_TRAVERSAL_LIMITS.maxDepth, 0, 64),
    maxDirectories: clampInteger(overrides.maxDirectories, DEFAULT_TRAVERSAL_LIMITS.maxDirectories, 1, 200_000),
    maxFilesInspected: clampInteger(
      overrides.maxFilesInspected,
      DEFAULT_TRAVERSAL_LIMITS.maxFilesInspected,
      1,
      1_000_000,
    ),
    maxDurationMs: clampInteger(overrides.maxDurationMs, DEFAULT_TRAVERSAL_LIMITS.maxDurationMs, 0, 3_600_000),
    concurrency: clampInteger(overrides.concurrency, DEFAULT_TRAVERSAL_LIMITS.concurrency, 1, 16),
    maxManifestBytes: clampInteger(
      overrides.maxManifestBytes,
      DEFAULT_TRAVERSAL_LIMITS.maxManifestBytes,
      1,
      4 * 1024 * 1024,
    ),
    maxErrors: clampInteger(overrides.maxErrors, DEFAULT_TRAVERSAL_LIMITS.maxErrors, 1, 10_000),
  };
}

export type TraversalStatus = "COMPLETED" | "LIMIT_EXCEEDED" | "FAILED";

export type TraversalErrorCode =
  | "ROOT_UNAVAILABLE"
  | "PERMISSION_DENIED"
  | "UNREADABLE_DIRECTORY"
  | "UNREADABLE_FILE"
  | "REPARSE_POINT"
  | "DEPTH_LIMIT"
  | "LIMIT_EXCEEDED"
  | "TOO_LARGE"
  | "DENIED_SENSITIVE_FILE"
  | "PATH_ESCAPE";

export interface TraversalError {
  readonly code: TraversalErrorCode;
  /** Root-relative path with backslashes; empty for the root itself. */
  readonly relativePath: string;
  readonly message: string;
}

/** Mirrors `detection_evidence.parser_state` for a manifest observation. */
export type ManifestParserState = "OK" | "TOO_LARGE" | "DENIED" | "ERROR";

export interface ManifestObservation {
  readonly relativePath: string;
  readonly fileName: string;
  readonly signature: ManifestSignature;
  readonly sizeBytes: number;
  readonly parserState: ManifestParserState;
  /** SHA-256 of the bytes actually read; null when content was not read. */
  readonly fingerprint: string | null;
  readonly contentRead: boolean;
}

export interface TraversalStats {
  directoriesVisited: number;
  directoriesSkipped: number;
  filesInspected: number;
  manifestsSeen: number;
  manifestsRead: number;
  errorsCount: number;
}

export interface TraversalResult {
  readonly rootId: string;
  readonly rootPath: string;
  readonly status: TraversalStatus;
  readonly stats: TraversalStats;
  readonly manifests: readonly ManifestObservation[];
  readonly errors: readonly TraversalError[];
  /** Root-relative paths of reparse points that were skipped. */
  readonly skippedReparsePoints: readonly string[];
  readonly durationMs: number;
}

export function emptyTraversalStats(): TraversalStats {
  return {
    directoriesVisited: 0,
    directoriesSkipped: 0,
    filesInspected: 0,
    manifestsSeen: 0,
    manifestsRead: 0,
    errorsCount: 0,
  };
}

/** Deterministic ordering helper used by traversal results and tests. */
export function compareByRelativePath(
  left: { readonly relativePath: string },
  right: { readonly relativePath: string },
): number {
  return left.relativePath < right.relativePath ? -1 : left.relativePath > right.relativePath ? 1 : 0;
}
