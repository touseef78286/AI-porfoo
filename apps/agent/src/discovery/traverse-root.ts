import { createHash } from "node:crypto";
import { join } from "node:path";

import {
  checkManifestRead,
  compareByRelativePath,
  createExclusionMatcher,
  emptyTraversalStats,
  matchManifest,
  normalizeTraversalLimits,
  toComparisonPath,
} from "@lpi/core";
import type {
  ExclusionRule,
  ManifestObservation,
  TraversalError,
  TraversalErrorCode,
  TraversalLimits,
  TraversalResult,
  TraversalStats,
  TraversalStatus,
} from "@lpi/core";

import { classifyIoError, createNodeTraversalIo } from "./traversal-io.js";
import type { TraversalIo } from "./traversal-io.js";

export interface TraverseRootOptions {
  readonly rootId: string;
  /** Canonical absolute root path, as produced by the root validator. */
  readonly rootPath: string;
  /** Developer-defined exclusions; built-in system rules always apply. */
  readonly rules?: readonly ExclusionRule[];
  readonly limits?: Partial<TraversalLimits>;
  /** Test seam for filesystem failures. Defaults to the real filesystem. */
  readonly io?: TraversalIo;
  readonly onProgress?: (stats: Readonly<TraversalStats>) => void;
}

interface DirectoryTask {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly depth: number;
}

type ManifestReadOutcome =
  | { readonly state: "OK"; readonly fingerprint: string }
  | { readonly state: "TOO_LARGE" }
  | { readonly state: "ERROR"; readonly code: TraversalErrorCode; readonly message: string };

function isInsideRoot(rootComparison: string, candidatePath: string): boolean {
  const candidate = toComparisonPath(candidatePath);

  return candidate === rootComparison || candidate.startsWith(`${rootComparison}\\`);
}

async function readManifestBounded(
  io: TraversalIo,
  absolutePath: string,
  maxBytes: number,
): Promise<ManifestReadOutcome> {
  let handle: Awaited<ReturnType<TraversalIo["openForRead"]>>;

  try {
    handle = await io.openForRead(absolutePath);
  } catch (error) {
    const classified = classifyIoError(error, "FILE");
    return { state: "ERROR", code: classified.code, message: classified.message };
  }

  try {
    const buffer = Buffer.alloc(maxBytes + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);

    if (bytesRead > maxBytes) {
      return { state: "TOO_LARGE" };
    }

    const fingerprint = createHash("sha256").update(buffer.subarray(0, bytesRead)).digest("hex");

    return { state: "OK", fingerprint };
  } catch (error) {
    const classified = classifyIoError(error, "FILE");
    return { state: "ERROR", code: classified.code, message: classified.message };
  } finally {
    await handle.close().catch(() => undefined);
  }
}

/**
 * Traverses one authorized root breadth-first with bounded concurrency.
 *
 * Ordering guarantees: decisions are made per directory in sorted order, and
 * the returned manifest, error, and reparse lists are sorted, so the result is
 * deterministic even though directories run concurrently.
 *
 * Safety guarantees: exclusions are evaluated before descending or opening a
 * file, reparse points are never followed, sensitive names are denied before
 * any open, and every read is byte-bounded.
 */
export async function traverseRoot(options: TraverseRootOptions): Promise<TraversalResult> {
  const limits = normalizeTraversalLimits(options.limits);
  const io = options.io ?? createNodeTraversalIo();
  const matchesExclusion = createExclusionMatcher(options.rules ?? []);
  const rootComparison = toComparisonPath(options.rootPath);
  const startedAt = Date.now();

  const stats = emptyTraversalStats();
  const manifests: ManifestObservation[] = [];
  const errors: TraversalError[] = [];
  const skippedReparsePoints: string[] = [];
  let status: TraversalStatus = "COMPLETED";
  let stopped = false;

  const elapsedMs = (): number => Date.now() - startedAt;

  function pushError(code: TraversalErrorCode, relativePath: string, message: string): void {
    if (errors.length >= limits.maxErrors) {
      return;
    }

    errors.push({ code, relativePath, message });
  }

  function stopForLimit(relativePath: string, message: string): void {
    if (stopped) {
      return;
    }

    stopped = true;
    status = "LIMIT_EXCEEDED";
    pushError("LIMIT_EXCEEDED", relativePath, message);
  }

  function budgetExceeded(relativePath: string): boolean {
    if (elapsedMs() >= limits.maxDurationMs) {
      stopForLimit(relativePath, "Duration budget exceeded");
      return true;
    }

    return false;
  }

  function finalize(): TraversalResult {
    stats.errorsCount = errors.length;

    return {
      rootId: options.rootId,
      rootPath: options.rootPath,
      status,
      stats,
      manifests: [...manifests].sort(compareByRelativePath),
      errors: [...errors].sort(
        (left, right) =>
          compareByRelativePath(left, right) || left.code.localeCompare(right.code),
      ),
      skippedReparsePoints: [...skippedReparsePoints].sort(),
      durationMs: elapsedMs(),
    };
  }

  if (budgetExceeded("")) {
    return finalize();
  }

  try {
    const rootStats = await io.lstat(options.rootPath);

    if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
      pushError("ROOT_UNAVAILABLE", "", "Root is not a traversable directory");
      status = "FAILED";
      return finalize();
    }
  } catch {
    pushError("ROOT_UNAVAILABLE", "", "Root is unavailable");
    status = "FAILED";
    return finalize();
  }

  const queue: DirectoryTask[] = [
    { absolutePath: options.rootPath, relativePath: "", depth: 0 },
  ];

  async function visitDirectory(task: DirectoryTask): Promise<void> {
    if (stopped || budgetExceeded(task.relativePath)) {
      return;
    }

    if (stats.directoriesVisited >= limits.maxDirectories) {
      stopForLimit(task.relativePath, "Directory budget exceeded");
      return;
    }

    stats.directoriesVisited += 1;

    let entries: Awaited<ReturnType<TraversalIo["readdir"]>>;

    try {
      entries = await io.readdir(task.absolutePath);
    } catch (error) {
      const classified = classifyIoError(error, "DIRECTORY");
      pushError(classified.code, task.relativePath, classified.message);
      return;
    }

    const sortedEntries = [...entries].sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );

    for (const entry of sortedEntries) {
      if (stopped || budgetExceeded(task.relativePath)) {
        return;
      }

      const relativePath =
        task.relativePath.length === 0 ? entry.name : `${task.relativePath}\\${entry.name}`;
      const absolutePath = join(task.absolutePath, entry.name);

      if (!isInsideRoot(rootComparison, absolutePath)) {
        pushError("PATH_ESCAPE", relativePath, "Entry resolved outside the authorized root");
        continue;
      }

      if (matchesExclusion(relativePath) !== null) {
        if (entry.isDirectory()) {
          stats.directoriesSkipped += 1;
        }
        continue;
      }

      let entryStats: Awaited<ReturnType<TraversalIo["lstat"]>>;

      try {
        entryStats = await io.lstat(absolutePath);
      } catch (error) {
        const classified = classifyIoError(error, entry.isDirectory() ? "DIRECTORY" : "FILE");
        pushError(classified.code, relativePath, classified.message);
        continue;
      }

      if (entryStats.isSymbolicLink()) {
        skippedReparsePoints.push(relativePath);
        pushError("REPARSE_POINT", relativePath, "Reparse point skipped and not followed");
        continue;
      }

      if (entryStats.isDirectory()) {
        if (task.depth + 1 > limits.maxDepth) {
          stats.directoriesSkipped += 1;
          pushError("DEPTH_LIMIT", relativePath, "Maximum traversal depth reached");
          continue;
        }

        queue.push({ absolutePath, relativePath, depth: task.depth + 1 });
        continue;
      }

      if (!entryStats.isFile()) {
        continue;
      }

      if (stats.filesInspected >= limits.maxFilesInspected) {
        stopForLimit(relativePath, "File inspection budget exceeded");
        return;
      }

      stats.filesInspected += 1;

      const signature = matchManifest(entry.name);

      if (signature === null) {
        continue;
      }

      stats.manifestsSeen += 1;

      const denial = checkManifestRead(relativePath);

      if (!denial.allowed) {
        // Denied before any open: no handle, no bytes, no fingerprint.
        pushError("DENIED_SENSITIVE_FILE", relativePath, denial.message);
        continue;
      }

      const observation = {
        relativePath,
        fileName: entry.name,
        signature,
        sizeBytes: entryStats.size,
      } as const;

      if (!signature.readContent) {
        manifests.push({ ...observation, parserState: "OK", fingerprint: null, contentRead: false });
        continue;
      }

      if (entryStats.size > limits.maxManifestBytes) {
        manifests.push({
          ...observation,
          parserState: "TOO_LARGE",
          fingerprint: null,
          contentRead: false,
        });
        pushError("TOO_LARGE", relativePath, "Manifest exceeds the size limit");
        continue;
      }

      const read = await readManifestBounded(io, absolutePath, limits.maxManifestBytes);

      if (read.state === "OK") {
        stats.manifestsRead += 1;
        manifests.push({
          ...observation,
          parserState: "OK",
          fingerprint: read.fingerprint,
          contentRead: true,
        });
        continue;
      }

      if (read.state === "TOO_LARGE") {
        manifests.push({
          ...observation,
          parserState: "TOO_LARGE",
          fingerprint: null,
          contentRead: false,
        });
        pushError("TOO_LARGE", relativePath, "Manifest exceeds the size limit");
        continue;
      }

      manifests.push({
        ...observation,
        parserState: "ERROR",
        fingerprint: null,
        contentRead: false,
      });
      pushError(read.code, relativePath, read.message);
    }
  }

  const running = new Set<Promise<void>>();

  while (!stopped && (queue.length > 0 || running.size > 0)) {
    while (!stopped && running.size < limits.concurrency && queue.length > 0) {
      const task = queue.shift();

      if (task === undefined) {
        break;
      }

      let pending: Promise<void>;
      pending = visitDirectory(task)
        .catch(() => undefined)
        .finally(() => {
          running.delete(pending);
        });
      running.add(pending);
    }

    if (running.size === 0) {
      break;
    }

    await Promise.race(running);
    options.onProgress?.({ ...stats });
  }

  if (stopped) {
    queue.length = 0;
    await Promise.allSettled([...running]);
  }

  return finalize();
}
