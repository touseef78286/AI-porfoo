import { open, readdir, lstat } from "node:fs/promises";
import type { Stats } from "node:fs";

/**
 * Minimal filesystem surface used by traversal.
 *
 * It exists so integration tests can inject a permission failure on Windows,
 * where ACL manipulation needs elevation, and so traversal is not coupled to a
 * specific filesystem module.
 */
export interface TraversalDirectoryEntry {
  readonly name: string;
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
}

export interface TraversalFileHandle {
  read(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number,
  ): Promise<{ readonly bytesRead: number }>;
  close(): Promise<void>;
}

export interface TraversalIo {
  lstat(path: string): Promise<Stats>;
  readdir(path: string): Promise<readonly TraversalDirectoryEntry[]>;
  openForRead(path: string): Promise<TraversalFileHandle>;
}

export function createNodeTraversalIo(): TraversalIo {
  return {
    lstat: (path) => lstat(path),
    readdir: (path) => readdir(path, { withFileTypes: true }),
    openForRead: (path) => open(path, "r"),
  };
}

export type IoOperation = "DIRECTORY" | "FILE";

export type IoErrorCode = "PERMISSION_DENIED" | "UNREADABLE_DIRECTORY" | "UNREADABLE_FILE";

export interface ClassifiedIoError {
  readonly code: IoErrorCode;
  /** Generic message only; the caller attaches the root-relative path. */
  readonly message: string;
}

function errorCodeOf(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const candidate = (error as { readonly code?: unknown }).code;

  return typeof candidate === "string" ? candidate : undefined;
}

/**
 * Maps a filesystem error to a traversal code without exposing absolute paths
 * or OS error text in persisted messages.
 */
export function classifyIoError(error: unknown, operation: IoOperation): ClassifiedIoError {
  const code = errorCodeOf(error);

  if (code === "EACCES" || code === "EPERM") {
    return { code: "PERMISSION_DENIED", message: "Access denied" };
  }

  if (code === "ENOENT" || code === "ENOTDIR") {
    return {
      code: operation === "DIRECTORY" ? "UNREADABLE_DIRECTORY" : "UNREADABLE_FILE",
      message: "Path disappeared during the scan",
    };
  }

  if (code === "EMFILE" || code === "ENFILE" || code === "ENOMEM") {
    return {
      code: operation === "DIRECTORY" ? "UNREADABLE_DIRECTORY" : "UNREADABLE_FILE",
      message: "Filesystem resource limit reached",
    };
  }

  return {
    code: operation === "DIRECTORY" ? "UNREADABLE_DIRECTORY" : "UNREADABLE_FILE",
    message: "Path could not be read",
  };
}
