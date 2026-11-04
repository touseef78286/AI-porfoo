import { describe, expect, it } from "vitest";

import {
  createExclusionMatcher,
  globToRegExp,
  isDefaultIgnoredDirectory,
} from "../../src/roots/exclusions.js";

describe("isDefaultIgnoredDirectory", () => {
  it("matches built-in names case-insensitively", () => {
    expect(isDefaultIgnoredDirectory("node_modules")).toBe(true);
    expect(isDefaultIgnoredDirectory("NODE_MODULES")).toBe(true);
    expect(isDefaultIgnoredDirectory(".git")).toBe(true);
    expect(isDefaultIgnoredDirectory("demo")).toBe(false);
  });
});

describe("createExclusionMatcher", () => {
  it("excludes built-in directories at any depth and marks them as system rules", () => {
    const matches = createExclusionMatcher();

    expect(matches("node_modules/pkg/index.js")).toMatchObject({ isSystem: true, pattern: "node_modules" });
    expect(matches("apps/web/node_modules")).toMatchObject({ isSystem: true });
    expect(matches(".git/config")).toMatchObject({ isSystem: true });
    expect(matches("src/index.ts")).toBeNull();
  });

  it("applies user directory rules", () => {
    const matches = createExclusionMatcher([{ kind: "DIRECTORY", pattern: "generated" }]);

    expect(matches("src/generated/types.ts")).toMatchObject({ kind: "DIRECTORY", isSystem: false });
    expect(matches("src/generate/types.ts")).toBeNull();
  });

  it("applies user path rules as a prefix", () => {
    const matches = createExclusionMatcher([{ kind: "PATH", pattern: "apps\\legacy" }]);

    expect(matches("apps/legacy")).toMatchObject({ kind: "PATH" });
    expect(matches("apps/legacy/src/main.ts")).toMatchObject({ kind: "PATH" });
    expect(matches("apps/legacy-tools")).toBeNull();
  });

  it("applies glob rules", () => {
    const matches = createExclusionMatcher([{ kind: "GLOB", pattern: "**/*.tmp" }]);

    expect(matches("a.tmp")).toMatchObject({ kind: "GLOB" });
    expect(matches("deep/nested/cache.tmp")).toMatchObject({ kind: "GLOB" });
    expect(matches("deep/nested/cache.txt")).toBeNull();
  });

  it("does not let a user rule downgrade a system rule", () => {
    const matches = createExclusionMatcher([{ kind: "DIRECTORY", pattern: "node_modules" }]);

    expect(matches("node_modules/x")).toMatchObject({ isSystem: true });
  });

  it("ignores empty relative paths", () => {
    expect(createExclusionMatcher()("")).toBeNull();
  });
});

describe("globToRegExp", () => {
  it("supports recursive globs", () => {
    expect(globToRegExp("src/**/test").test("src/test")).toBe(true);
    expect(globToRegExp("src/**/test").test("src/a/b/test")).toBe(true);
    expect(globToRegExp("src/**/test").test("src/atest")).toBe(false);
  });

  it("keeps single-star inside one segment", () => {
    expect(globToRegExp("src/*.ts").test("src/a.ts")).toBe(true);
    expect(globToRegExp("src/*.ts").test("src/a/b.ts")).toBe(false);
  });
});
