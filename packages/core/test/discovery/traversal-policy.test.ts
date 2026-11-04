import { describe, expect, it } from "vitest";

import {
  DEFAULT_TRAVERSAL_LIMITS,
  compareByRelativePath,
  emptyTraversalStats,
  normalizeTraversalLimits,
} from "../../src/discovery/traversal-policy.js";

describe("DEFAULT_TRAVERSAL_LIMITS", () => {
  it("matches the approved defaults", () => {
    expect(DEFAULT_TRAVERSAL_LIMITS).toEqual({
      maxDepth: 12,
      maxDirectories: 20_000,
      maxFilesInspected: 100_000,
      maxDurationMs: 120_000,
      concurrency: 8,
      maxManifestBytes: 256 * 1024,
      maxErrors: 200,
    });
  });
});

describe("normalizeTraversalLimits", () => {
  it("returns the defaults when nothing is overridden", () => {
    expect(normalizeTraversalLimits()).toEqual(DEFAULT_TRAVERSAL_LIMITS);
  });

  it("clamps out-of-range values instead of disabling the bound", () => {
    const limits = normalizeTraversalLimits({
      maxDepth: 9_999,
      maxDirectories: 0,
      maxFilesInspected: -1,
      concurrency: 500,
      maxManifestBytes: 0,
      maxErrors: 0,
    });

    expect(limits.maxDepth).toBe(64);
    expect(limits.maxDirectories).toBe(1);
    expect(limits.maxFilesInspected).toBe(1);
    expect(limits.concurrency).toBe(16);
    expect(limits.maxManifestBytes).toBe(1);
    expect(limits.maxErrors).toBe(1);
  });

  it("keeps zero duration allowed so a caller can request an immediate stop", () => {
    expect(normalizeTraversalLimits({ maxDurationMs: 0 }).maxDurationMs).toBe(0);
  });

  it("truncates fractional values and ignores non-finite ones", () => {
    const limits = normalizeTraversalLimits({
      maxDepth: 3.9,
      concurrency: Number.NaN,
      maxDirectories: Number.POSITIVE_INFINITY,
    });

    expect(limits.maxDepth).toBe(3);
    expect(limits.concurrency).toBe(DEFAULT_TRAVERSAL_LIMITS.concurrency);
    expect(limits.maxDirectories).toBe(DEFAULT_TRAVERSAL_LIMITS.maxDirectories);
  });
});

describe("traversal helpers", () => {
  it("produces zeroed stats", () => {
    expect(emptyTraversalStats()).toEqual({
      directoriesVisited: 0,
      directoriesSkipped: 0,
      filesInspected: 0,
      manifestsSeen: 0,
      manifestsRead: 0,
      errorsCount: 0,
    });
  });

  it("orders by relative path", () => {
    const paths = [{ relativePath: "b" }, { relativePath: "a" }, { relativePath: "a\\b" }];

    expect([...paths].sort(compareByRelativePath).map((entry) => entry.relativePath)).toEqual([
      "a",
      "a\\b",
      "b",
    ]);
  });
});
