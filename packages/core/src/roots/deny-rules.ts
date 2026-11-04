import {
  comparisonSegments,
  isDriveRoot,
  isUncPath,
  toComparisonPath,
} from "./path-rules.js";

export type PathDenialCode =
  | "UNC_PATH"
  | "DRIVE_ROOT"
  | "SYSTEM_DIRECTORY"
  | "USER_PROFILE_ROOT"
  | "CREDENTIAL_STORE"
  | "IGNORED_DIRECTORY";

export interface PathDenial {
  readonly code: PathDenialCode;
  readonly message: string;
}

const DENIED_SYSTEM_PREFIXES: readonly string[] = [
  "c:\\windows",
  "c:\\program files",
  "c:\\program files (x86)",
  "c:\\programdata",
  "c:\\$recycle.bin",
  "c:\\system volume information",
  "c:\\recovery",
  "c:\\perflogs",
];

const CREDENTIAL_SEGMENTS = new Set([
  ".ssh",
  ".aws",
  ".azure",
  ".gnupg",
  ".kube",
  ".docker",
  ".password-store",
  ".git-credentials",
  "secrets",
  "credentials",
]);

const USER_PROFILE_ROOT_PATTERN = /^c:\\users\\[^\\]+$/;

/**
 * Directories that can never BE an authorized root.
 *
 * This is narrower than the traversal ignore set on purpose: a folder named
 * `build` or `env` is a valid project location, it is only skipped when found
 * as a child during traversal.
 */
const ROOT_DENIED_DIRECTORY_NAMES = new Set([".git", ".hg", ".svn", "node_modules"]);

/**
 * String-level denial rules for authorized roots.
 *
 * This is intentionally filesystem-free: the agent adds existence, directory
 * type, and reparse-point checks after these rules pass.
 */
export function findPathDenial(input: string): PathDenial | null {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (isUncPath(trimmed)) {
    return {
      code: "UNC_PATH",
      message: "UNC paths are not supported as authorized roots",
    };
  }

  if (isDriveRoot(trimmed)) {
    return {
      code: "DRIVE_ROOT",
      message: "A drive root cannot be an authorized root",
    };
  }

  const comparison = toComparisonPath(trimmed);

  for (const prefix of DENIED_SYSTEM_PREFIXES) {
    if (comparison === prefix || comparison.startsWith(`${prefix}\\`)) {
      return {
        code: "SYSTEM_DIRECTORY",
        message: "Windows system directories cannot be authorized roots",
      };
    }
  }

  if (USER_PROFILE_ROOT_PATTERN.test(comparison)) {
    return {
      code: "USER_PROFILE_ROOT",
      message: "A user profile root cannot be an authorized root",
    };
  }

  const segments = comparisonSegments(trimmed);

  for (const segment of segments) {
    if (segment === "appdata") {
      return {
        code: "CREDENTIAL_STORE",
        message: "AppData cannot be an authorized root",
      };
    }

    if (CREDENTIAL_SEGMENTS.has(segment)) {
      return {
        code: "CREDENTIAL_STORE",
        message: `Credential or secret directory is not allowed: ${segment}`,
      };
    }
  }

  for (const segment of segments) {
    if (ROOT_DENIED_DIRECTORY_NAMES.has(segment)) {
      return {
        code: "IGNORED_DIRECTORY",
        message: `Repository or dependency internals cannot be an authorized root: ${segment}`,
      };
    }
  }

  return null;
}
