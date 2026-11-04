import { describe, expect, it } from "vitest";

import {
  MANIFEST_MAX_BYTES,
  MANIFEST_SIGNATURES,
  isAllowlistedManifest,
  matchManifest,
  shouldReadManifest,
} from "../../src/discovery/manifests.js";

describe("MANIFEST_SIGNATURES", () => {
  it("has unique evidence labels and lowercase patterns", () => {
    const labels = MANIFEST_SIGNATURES.map((signature) => signature.evidenceLabel);
    const patterns = MANIFEST_SIGNATURES.map((signature) => signature.pattern);

    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(patterns).size).toBe(patterns.length);

    for (const pattern of patterns) {
      expect(pattern).toBe(pattern.toLowerCase());
    }
  });

  it("defines a bounded read size", () => {
    expect(MANIFEST_MAX_BYTES).toBe(256 * 1024);
  });
});

describe("matchManifest", () => {
  it("matches exact names case-insensitively", () => {
    expect(matchManifest("package.json")?.evidenceLabel).toBe("node.package-json");
    expect(matchManifest("PACKAGE.JSON")?.evidenceLabel).toBe("node.package-json");
    expect(matchManifest("Pipfile")?.evidenceLabel).toBe("python.pipfile");
  });

  it("prefers exact matches over extensions", () => {
    expect(matchManifest("build.gradle.kts")?.evidenceLabel).toBe("java.gradle-kts");
    expect(matchManifest("build.gradle")?.evidenceLabel).toBe("java.gradle");
  });

  it("matches .NET project and solution extensions", () => {
    expect(matchManifest("App.csproj")?.evidenceLabel).toBe("dotnet.project");
    expect(matchManifest("Solution.SLN")?.evidenceLabel).toBe("dotnet.solution");
  });

  it("matches framework config prefixes", () => {
    expect(matchManifest("next.config.mjs")?.evidenceLabel).toBe("node.next-config");
    expect(matchManifest("vite.config.ts")?.evidenceLabel).toBe("node.vite-config");
  });

  it("rejects unknown, empty, and misleading names", () => {
    expect(matchManifest("main.ts")).toBeNull();
    expect(matchManifest("package.json.bak")).toBeNull();
    expect(matchManifest("")).toBeNull();
    expect(matchManifest("   ")).toBeNull();
    expect(matchManifest("notpackage.json")).toBeNull();
  });
});

describe("read policy", () => {
  it("reads strong manifests and not lockfile bodies", () => {
    expect(shouldReadManifest("package.json")).toBe(true);
    expect(shouldReadManifest("pyproject.toml")).toBe(true);
    expect(shouldReadManifest("package-lock.json")).toBe(false);
    expect(shouldReadManifest("yarn.lock")).toBe(false);
    expect(shouldReadManifest("tsconfig.json")).toBe(false);
  });

  it("treats presence-only signatures as allowlisted but unreadable", () => {
    expect(isAllowlistedManifest("pnpm-lock.yaml")).toBe(true);
    expect(shouldReadManifest("pnpm-lock.yaml")).toBe(false);
  });

  it("does not allow unknown files", () => {
    expect(isAllowlistedManifest(".env")).toBe(false);
    expect(isAllowlistedManifest("server.pem")).toBe(false);
    expect(shouldReadManifest(".env")).toBe(false);
  });
});
