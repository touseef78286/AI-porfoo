/**
 * Sensitive-file policy. These rules run before any file is opened, so a
 * matching file is never read, stored, logged, or parsed.
 */

export type ReadDenialCode =
  | "SENSITIVE_NAME"
  | "SENSITIVE_EXTENSION"
  | "SENSITIVE_DIRECTORY";

export type ReadDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly code: ReadDenialCode; readonly message: string };

const SENSITIVE_NAME_PATTERNS: readonly RegExp[] = [
  /^\.env(\..+)?$/i,
  /^\.npmrc$/i,
  /^\.netrc$/i,
  /^\.git-credentials$/i,
  /^\.htpasswd$/i,
  /^\.pgpass$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /^credentials(\..+)?$/i,
  /^secrets?(\..+)?$/i,
  /^wallet\.dat$/i,
];

const SENSITIVE_EXTENSIONS = new Set([
  ".pem",
  ".key",
  ".pfx",
  ".p12",
  ".jks",
  ".keystore",
  ".kdbx",
  ".gpg",
  ".pgp",
  ".ppk",
]);

const SENSITIVE_DIRECTORY_SEGMENTS = new Set([
  ".ssh",
  ".aws",
  ".azure",
  ".gnupg",
  ".kube",
  ".docker",
  "appdata",
]);

function extensionOf(name: string): string {
  const lastDot = name.lastIndexOf(".");

  if (lastDot <= 0) {
    return "";
  }

  return name.slice(lastDot).toLowerCase();
}

export function isSensitiveFileName(name: string): boolean {
  if (SENSITIVE_NAME_PATTERNS.some((pattern) => pattern.test(name))) {
    return true;
  }

  return SENSITIVE_EXTENSIONS.has(extensionOf(name));
}

/**
 * Decides whether a manifest read is permitted.
 *
 * The caller must check this before opening the file; it does not inspect
 * content, because content must never be read for denied files.
 */
export function checkManifestRead(relativePath: string): ReadDecision {
  const normalized = relativePath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter((segment) => segment.length > 0);
  const name = segments[segments.length - 1] ?? "";

  for (const segment of segments) {
    if (SENSITIVE_DIRECTORY_SEGMENTS.has(segment.toLowerCase())) {
      return {
        allowed: false,
        code: "SENSITIVE_DIRECTORY",
        message: `Reading from a sensitive directory is denied: ${segment}`,
      };
    }
  }

  if (SENSITIVE_NAME_PATTERNS.some((pattern) => pattern.test(name))) {
    return {
      allowed: false,
      code: "SENSITIVE_NAME",
      message: "Sensitive file name is denied before read",
    };
  }

  if (SENSITIVE_EXTENSIONS.has(extensionOf(name))) {
    return {
      allowed: false,
      code: "SENSITIVE_EXTENSION",
      message: "Sensitive file extension is denied before read",
    };
  }

  return { allowed: true };
}
