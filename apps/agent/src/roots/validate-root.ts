import { lstatSync, realpathSync, statSync } from "node:fs";
import type { Stats } from "node:fs";

import {
  findPathDenial,
  hasTraversalSegment,
  isAbsoluteWindowsPath,
  toComparisonPath,
} from "@lpi/core";
import type { PathDenialCode } from "@lpi/core";

export type RootValidationCode =
  | "EMPTY"
  | "NOT_ABSOLUTE"
  | "TRAVERSAL"
  | "NOT_FOUND"
  | "NOT_DIRECTORY"
  | "REPARSE_ROOT"
  | PathDenialCode;

export type RootValidationResult =
  | {
      readonly ok: true;
      /** Canonical, lowercase comparison form of the real path. */
      readonly canonicalPath: string;
      /** Path as the user supplied it, trimmed. */
      readonly displayPath: string;
    }
  | {
      readonly ok: false;
      readonly code: RootValidationCode;
      readonly message: string;
    };

function failure(code: RootValidationCode, message: string): RootValidationResult {
  return { ok: false, code, message };
}

function safeLstat(path: string): Stats | null {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

/**
 * True for symbolic links and NTFS junctions. Node reports both as symbolic
 * links on Windows.
 */
export function isReparsePoint(path: string): boolean {
  const stats = safeLstat(path);
  return stats !== null && stats.isSymbolicLink();
}

/**
 * Validates a candidate authorized root.
 *
 * String rules run before any filesystem access so denied locations such as
 * `C:\Windows` are rejected without being probed. After that the path must
 * exist, be a real directory (not a reparse point), and stay allowed once
 * canonicalized.
 */
export function validateRootPath(input: string): RootValidationResult {
  const trimmed = input.trim();
  const normalized = trimmed.replace(/\//g, "\\");

  if (trimmed.length === 0) {
    return failure("EMPTY", "Root path is empty");
  }

  if (!isAbsoluteWindowsPath(normalized)) {
    return failure("NOT_ABSOLUTE", "Root path must be an absolute Windows path");
  }

  if (hasTraversalSegment(normalized)) {
    return failure("TRAVERSAL", "Root path must not contain '..' segments");
  }

  const denial = findPathDenial(normalized);

  if (denial !== null) {
    return failure(denial.code, denial.message);
  }

  const linkStats = safeLstat(normalized);

  if (linkStats === null) {
    return failure("NOT_FOUND", "Root path does not exist");
  }

  if (linkStats.isSymbolicLink()) {
    return failure(
      "REPARSE_ROOT",
      "A symbolic link or junction cannot be an authorized root; authorize its real target instead",
    );
  }

  let canonicalPath: string;

  try {
    canonicalPath = realpathSync.native(normalized);
  } catch {
    return failure("NOT_FOUND", "Root path could not be resolved");
  }

  const directoryStats = safeLstat(canonicalPath);

  if (directoryStats === null) {
    return failure("NOT_FOUND", "Resolved root path does not exist");
  }

  if (!directoryStats.isDirectory()) {
    return failure("NOT_DIRECTORY", "Root path must be a directory");
  }

  const canonicalDenial = findPathDenial(canonicalPath);

  if (canonicalDenial !== null) {
    return failure(canonicalDenial.code, canonicalDenial.message);
  }

  return {
    ok: true,
    canonicalPath: toComparisonPath(canonicalPath),
    displayPath: trimmed,
  };
}
