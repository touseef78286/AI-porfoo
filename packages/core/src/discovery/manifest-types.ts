/**
 * Shared detector types and small parsing helpers.
 *
 * Every manifest parser returns a `DetectorResult`. Keeping the type and the
 * result builders in one dependency-free module prevents import cycles between
 * the individual format parsers.
 */

import { collectTechnologies } from "./technologies.js";
import type { TechnologySignature } from "./technologies.js";

/** Ecosystem identifiers used throughout the detector layer. */
export type Ecosystem =
  | "NODE"
  | "PYTHON"
  | "RUST"
  | "GO"
  | "DART"
  | "JAVA"
  | "DOTNET"
  | "PHP"
  | "RUBY"
  | "UNKNOWN";

export type { TechnologyKind, TechnologySignature } from "./technologies.js";

/** Detector confidence, mirroring `detection_evidence.confidence`. */
export type DetectionConfidence = number;

/** Detector state, mirroring `detection_evidence.detection_state`. */
export type DetectionState =
  | "CONFIRMED"
  | "PROBABLE"
  | "CANDIDATE"
  | "NEEDS_REVIEW"
  | "INVALID";

/** Primary ecosystem/language signal from a parsed manifest. */
export interface ManifestEcosystem {
  readonly ecosystem: Ecosystem;
  readonly confidence: DetectionConfidence;
  readonly secondaryEcosystem: Ecosystem | null;
}

/** Detector result for one project root. */
export interface DetectorResult {
  readonly ecosystem: Ecosystem;
  /** Declared project name from the manifest, when it has one. */
  readonly projectName: string | null;
  readonly primaryLanguage: string | null;
  readonly technologies: readonly TechnologySignature[];
  readonly detectionState: DetectionState;
  readonly confidence: DetectionConfidence;
  readonly evidenceFile: string;
}

/** A declared dependency as written in the manifest. */
export interface Dependency {
  readonly name: string;
  readonly version: string | null;
}

/** Internal draft before technologies are derived. */
export interface Draft {
  readonly ecosystem: Ecosystem;
  readonly projectName?: string | null;
  readonly primaryLanguage: string | null;
  readonly dependencies?: readonly Dependency[];
  readonly technologies?: readonly TechnologySignature[];
  readonly confidence: number;
  readonly detectionState?: DetectionState;
}

/** Builds a detector result, deriving technologies from dependencies if needed. */
export function result(fileName: string, draft: Draft): DetectorResult {
  const technologies =
    draft.technologies ??
    collectTechnologies(draft.dependencies ?? [], draft.confidence);

  return {
    ecosystem: draft.ecosystem,
    projectName: draft.projectName ?? null,
    primaryLanguage: draft.primaryLanguage,
    technologies,
    detectionState: draft.detectionState ?? "CONFIRMED",
    confidence: draft.confidence,
    evidenceFile: fileName,
  };
}

/** Result for a recognized manifest whose content could not be understood. */
export function invalid(fileName: string): DetectorResult {
  return {
    ecosystem: "UNKNOWN",
    projectName: null,
    primaryLanguage: null,
    technologies: [],
    detectionState: "INVALID",
    confidence: 0,
    evidenceFile: fileName,
  };
}

/** Returns the first capture group, trimmed, or `null`. */
export function firstGroup(pattern: RegExp, text: string): string | null {
  const match = pattern.exec(text);
  const value = match?.[1]?.trim();

  return value !== undefined && value.length > 0 ? value : null;
}

/** Narrows an unknown JSON value to a plain object. */
export function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Reads a non-empty string field from a JSON object. */
export function stringField(payload: Record<string, unknown>, field: string): string | null {
  const value = payload[field];

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Splits `name>=1.2` style declarations into name and version.
 *
 * Returns `null` for comments, flags, and empty lines so callers can skip them.
 */
export function parseRequirementLine(declaration: string): Dependency | null {
  const cleaned = declaration.trim().replace(/^["']|["']$/g, "");

  if (cleaned.length === 0 || cleaned.startsWith("#") || cleaned.startsWith("-")) {
    return null;
  }

  const withoutMarker = cleaned.split(";")[0]?.trim() ?? "";

  if (withoutMarker.length === 0) {
    return null;
  }

  const match = /^([A-Za-z0-9@._/-]+)\s*(?:\[[^\]]*\])?\s*(.*)$/.exec(withoutMarker);
  const name = match?.[1];

  if (name === undefined) {
    return null;
  }

  const version = (match?.[2] ?? "").replace(/^[<>=!~^ ]+/, "").trim();

  return { name, version: version.length > 0 ? version : null };
}
