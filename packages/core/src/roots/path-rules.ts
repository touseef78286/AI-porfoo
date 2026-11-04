/**
 * Pure Windows path-string helpers.
 *
 * These functions never touch the filesystem. Canonicalization that requires
 * the filesystem lives in the agent adapter.
 */

export const WINDOWS_DRIVE_ROOT_PATTERN = /^[a-z]:[\\/]?$/i;
export const UNC_PREFIX_PATTERN = /^\\\\/;
export const ABSOLUTE_WINDOWS_PATTERN = /^[a-z]:\\/i;

/** Converts forward slashes to backslashes. */
export function normalizeSeparators(input: string): string {
  return input.replace(/\//g, "\\");
}

/**
 * Produces a comparison key for case-insensitive Windows path matching.
 * Trailing separators are removed because they carry no identity.
 */
export function toComparisonPath(input: string): string {
  const normalized = normalizeSeparators(input.trim()).replace(/\\+$/, "");
  return normalized.toLowerCase();
}

/** Splits a path into non-empty segments. A drive prefix stays as its own segment. */
export function pathSegments(input: string): string[] {
  return normalizeSeparators(input)
    .split("\\")
    .filter((segment) => segment.length > 0);
}

export function isDriveRoot(input: string): boolean {
  return WINDOWS_DRIVE_ROOT_PATTERN.test(normalizeSeparators(input.trim()));
}

export function isUncPath(input: string): boolean {
  return UNC_PREFIX_PATTERN.test(normalizeSeparators(input.trim()));
}

export function isAbsoluteWindowsPath(input: string): boolean {
  const normalized = normalizeSeparators(input.trim());
  return ABSOLUTE_WINDOWS_PATTERN.test(normalized) || isUncPath(normalized);
}

/** True when any segment is exactly `..`, which could escape a configured root. */
export function hasTraversalSegment(input: string): boolean {
  return pathSegments(input).some((segment) => segment === "..");
}

/** Lowercased segments used for deny-list comparisons. */
export function comparisonSegments(input: string): string[] {
  return pathSegments(input).map((segment) => segment.toLowerCase());
}
