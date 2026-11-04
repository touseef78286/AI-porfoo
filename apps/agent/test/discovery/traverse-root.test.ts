import { mkdirSync, rmdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createNodeTraversalIo } from "../../src/discovery/traversal-io.js";
import type { TraversalIo } from "../../src/discovery/traversal-io.js";
import { traverseRoot } from "../../src/discovery/traverse-root.js";
import { createWorkspaceTempDir, removeWorkspaceTempDir } from "../helpers/workspace-temp.js";

const tempDirectories: string[] = [];

function tempBase(): string {
  const directory = createWorkspaceTempDir("traverse");
  tempDirectories.push(directory);
  return directory;
}

function writeFile(base: string, relativePath: string, content = "{}"): void {
  const target = join(base, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
}

afterEach(() => {
  for (const directory of tempDirectories) {
    removeWorkspaceTempDir(directory);
  }

  tempDirectories.length = 0;
});

describe("traverseRoot — discovery", () => {
  it("finds manifests at any depth and fingerprints only readable ones", async () => {
    const root = join(tempBase(), "root");
    writeFile(root, "package.json", '{"name":"demo"}');
    writeFile(root, "apps\\web\\package.json", '{"name":"web"}');
    writeFile(root, "package-lock.json", "{}");
    writeFile(root, "src\\main.ts", "export {}");
    writeFile(root, "README.md", "# demo");

    const result = await traverseRoot({ rootId: "root-1", rootPath: root });

    expect(result.status).toBe("COMPLETED");
    expect(result.manifests.map((manifest) => manifest.relativePath)).toEqual([
      "apps\\web\\package.json",
      "package-lock.json",
      "package.json",
    ]);

    const packageManifests = result.manifests.filter((manifest) => manifest.fileName === "package.json");

    for (const manifest of packageManifests) {
      expect(manifest.contentRead).toBe(true);
      expect(manifest.parserState).toBe("OK");
      expect(manifest.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    }

    const lockfile = result.manifests.find((manifest) => manifest.fileName === "package-lock.json");

    expect(lockfile).toMatchObject({ contentRead: false, fingerprint: null, parserState: "OK" });
    expect(result.stats.manifestsRead).toBe(2);
    expect(result.stats.errorsCount).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("returns deterministic ordering across repeated runs", async () => {
    const root = join(tempBase(), "root");
    writeFile(root, "b\\package.json");
    writeFile(root, "a\\package.json");
    writeFile(root, "c\\pyproject.toml");

    const first = await traverseRoot({ rootId: "root-1", rootPath: root });
    const second = await traverseRoot({ rootId: "root-1", rootPath: root });

    expect(second.manifests).toEqual(first.manifests);
    expect(second.errors).toEqual(first.errors);
    expect(first.manifests.map((manifest) => manifest.relativePath)).toEqual([
      "a\\package.json",
      "b\\package.json",
      "c\\pyproject.toml",
    ]);
  });

  it("never surfaces sensitive files and never reads them", async () => {
    const root = join(tempBase(), "root");
    writeFile(root, "package.json", '{"name":"demo"}');
    writeFile(root, ".env", "SECRET=value");
    writeFile(root, "id_rsa", "PRIVATE KEY");
    writeFile(root, "certs\\server.pem", "CERT");

    const result = await traverseRoot({ rootId: "root-1", rootPath: root });

    expect(result.manifests.map((manifest) => manifest.fileName)).toEqual(["package.json"]);
    expect(result.manifests.every((manifest) => !manifest.relativePath.includes(".env"))).toBe(true);
    expect(result.errors.some((error) => error.code === "DENIED_SENSITIVE_FILE")).toBe(false);
  });
});

describe("traverseRoot — exclusions", () => {
  it("never descends into the built-in ignore set", async () => {
    const root = join(tempBase(), "root");
    writeFile(root, "package.json");
    writeFile(root, "node_modules\\pkg\\package.json");
    writeFile(root, "dist\\package.json");
    writeFile(root, "src\\build\\package.json");

    const result = await traverseRoot({ rootId: "root-1", rootPath: root });

    expect(result.manifests.map((manifest) => manifest.relativePath)).toEqual(["package.json"]);
    expect(result.stats.directoriesSkipped).toBe(3);
  });

  it("applies user directory and path rules", async () => {
    const root = join(tempBase(), "root");
    writeFile(root, "generated\\package.json");
    writeFile(root, "apps\\legacy\\package.json");
    writeFile(root, "apps\\current\\package.json");

    const result = await traverseRoot({
      rootId: "root-1",
      rootPath: root,
      rules: [
        { kind: "DIRECTORY", pattern: "generated" },
        { kind: "PATH", pattern: "apps\\legacy" },
      ],
    });

    expect(result.manifests.map((manifest) => manifest.relativePath)).toEqual([
      "apps\\current\\package.json",
    ]);
    expect(result.stats.directoriesSkipped).toBe(2);
  });
});

describe("traverseRoot — reparse points", () => {
  it("skips a junction, records it, and does not follow it", async (context) => {
    const base = tempBase();
    const root = join(base, "root");
    const outside = join(base, "outside");
    writeFile(root, "package.json");
    writeFile(outside, "package.json", '{"name":"outside"}');

    const junction = join(root, "linked");

    try {
      symlinkSync(outside, junction, "junction");
    } catch {
      context.skip();
      return;
    }

    try {
      const result = await traverseRoot({ rootId: "root-1", rootPath: root });

      expect(result.skippedReparsePoints).toEqual(["linked"]);
      expect(result.errors).toContainEqual({
        code: "REPARSE_POINT",
        relativePath: "linked",
        message: "Reparse point skipped and not followed",
      });
      expect(result.manifests.map((manifest) => manifest.relativePath)).toEqual(["package.json"]);
    } finally {
      try {
        rmdirSync(junction);
      } catch {
        // Cleanup of the parent temp directory handles the rest.
      }
    }
  });
});

describe("traverseRoot — limits", () => {
  it("stops descending at the configured depth", async () => {
    const root = join(tempBase(), "root");
    writeFile(root, "package.json");
    writeFile(root, "a\\b\\c\\package.json");

    const result = await traverseRoot({ rootId: "root-1", rootPath: root, limits: { maxDepth: 1 } });

    expect(result.manifests.map((manifest) => manifest.relativePath)).toEqual(["package.json"]);
    expect(result.errors.some((error) => error.code === "DEPTH_LIMIT")).toBe(true);
    expect(result.status).toBe("COMPLETED");
  });

  it("records TOO_LARGE without reading the file", async () => {
    const root = join(tempBase(), "root");
    writeFile(root, "package.json", "x".repeat(4096));

    const result = await traverseRoot({
      rootId: "root-1",
      rootPath: root,
      limits: { maxManifestBytes: 1024 },
    });

    expect(result.manifests[0]).toMatchObject({
      parserState: "TOO_LARGE",
      contentRead: false,
      fingerprint: null,
    });
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "TOO_LARGE", relativePath: "package.json" }),
    );
  });

  it("stops at the directory budget with LIMIT_EXCEEDED", async () => {
    const root = join(tempBase(), "root");
    writeFile(root, "a\\package.json");
    writeFile(root, "b\\package.json");

    const result = await traverseRoot({
      rootId: "root-1",
      rootPath: root,
      limits: { maxDirectories: 1 },
    });

    expect(result.status).toBe("LIMIT_EXCEEDED");
    expect(result.stats.directoriesVisited).toBe(1);
    expect(result.errors.some((error) => error.code === "LIMIT_EXCEEDED")).toBe(true);
  });

  it("stops immediately when the duration budget is zero", async () => {
    const root = join(tempBase(), "root");
    writeFile(root, "package.json");

    const result = await traverseRoot({
      rootId: "root-1",
      rootPath: root,
      limits: { maxDurationMs: 0 },
    });

    expect(result.status).toBe("LIMIT_EXCEEDED");
    expect(result.stats.directoriesVisited).toBe(0);
    expect(result.manifests).toEqual([]);
  });

  it("stops at the file inspection budget", async () => {
    const root = join(tempBase(), "root");

    for (let index = 0; index < 6; index += 1) {
      writeFile(root, `file-${index}.txt`, "x");
    }

    const result = await traverseRoot({
      rootId: "root-1",
      rootPath: root,
      limits: { maxFilesInspected: 2, concurrency: 1 },
    });

    expect(result.status).toBe("LIMIT_EXCEEDED");
    expect(result.stats.filesInspected).toBe(2);
  });
});

describe("traverseRoot — errors", () => {
  it("reports an unavailable root without throwing", async () => {
    const root = join(tempBase(), "absent");

    const result = await traverseRoot({ rootId: "root-1", rootPath: root });

    expect(result.status).toBe("FAILED");
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "ROOT_UNAVAILABLE", relativePath: "" }),
    );
  });

  it("records a permission failure and keeps scanning other directories", async () => {
    const root = join(tempBase(), "root");
    writeFile(root, "blocked\\package.json");
    writeFile(root, "open\\package.json");

    const real = createNodeTraversalIo();
    const io: TraversalIo = {
      lstat: (path) => real.lstat(path),
      readdir: async (path) => {
        if (path.toLowerCase().endsWith("\\blocked")) {
          const error = new Error("denied") as NodeJS.ErrnoException;
          error.code = "EACCES";
          throw error;
        }

        return real.readdir(path);
      },
      openForRead: (path) => real.openForRead(path),
    };

    const result = await traverseRoot({ rootId: "root-1", rootPath: root, io });

    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "PERMISSION_DENIED", relativePath: "blocked" }),
    );
    expect(result.manifests.map((manifest) => manifest.relativePath)).toEqual([
      "open\\package.json",
    ]);
    expect(result.status).toBe("COMPLETED");
  });
});
