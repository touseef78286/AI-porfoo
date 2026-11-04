import { mkdirSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { isReparsePoint, validateRootPath } from "../../src/roots/validate-root.js";
import { createWorkspaceTempDir, removeWorkspaceTempDir } from "../helpers/workspace-temp.js";

const tempDirectories: string[] = [];

function tempRoot(): string {
  const directory = createWorkspaceTempDir("roots");
  tempDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirectories) {
    removeWorkspaceTempDir(directory);
  }

  tempDirectories.length = 0;
});

describe("validateRootPath", () => {
  it("accepts an existing directory and returns a canonical comparison path", () => {
    const base = tempRoot();
    const directory = join(base, "project-a");
    mkdirSync(directory);

    const result = validateRootPath(directory);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.canonicalPath).toBe(realpathSync.native(directory).toLowerCase());
      expect(result.displayPath).toBe(directory);
    }
  });

  it("normalizes trailing separators and forward slashes to one canonical root", () => {
    const base = tempRoot();
    const directory = join(base, "project-b");
    mkdirSync(directory);

    const withSeparator = validateRootPath(`${directory}\\`);
    const withForwardSlashes = validateRootPath(directory.replace(/\\/g, "/"));

    expect(withSeparator.ok).toBe(true);
    expect(withForwardSlashes.ok).toBe(true);

    if (withSeparator.ok && withForwardSlashes.ok) {
      expect(withSeparator.canonicalPath).toBe(withForwardSlashes.canonicalPath);
    }
  });

  it("rejects empty input", () => {
    expect(validateRootPath("")).toMatchObject({ ok: false, code: "EMPTY" });
    expect(validateRootPath("   ")).toMatchObject({ ok: false, code: "EMPTY" });
  });

  it("rejects relative paths", () => {
    expect(validateRootPath("fixtures")).toMatchObject({ ok: false, code: "NOT_ABSOLUTE" });
  });

  it("rejects drive roots", () => {
    expect(validateRootPath("C:\\")).toMatchObject({ ok: false, code: "DRIVE_ROOT" });
    expect(validateRootPath("C:/")).toMatchObject({ ok: false, code: "DRIVE_ROOT" });
  });

  it("rejects Windows system directories", () => {
    expect(validateRootPath("C:\\Windows")).toMatchObject({
      ok: false,
      code: "SYSTEM_DIRECTORY",
    });
    expect(validateRootPath("C:\\Program Files")).toMatchObject({
      ok: false,
      code: "SYSTEM_DIRECTORY",
    });
  });

  it("rejects the user profile root and AppData", () => {
    const profile = process.env.USERPROFILE;

    if (profile === undefined || profile.length === 0) {
      throw new Error("USERPROFILE is not set on this machine");
    }

    expect(validateRootPath(profile)).toMatchObject({ ok: false, code: "USER_PROFILE_ROOT" });
    expect(validateRootPath(join(profile, "AppData"))).toMatchObject({
      ok: false,
      code: "CREDENTIAL_STORE",
    });
  });

  it("rejects traversal segments before touching the filesystem", () => {
    const base = tempRoot();

    // Built by hand: path.join would normalize `..` away before validation.
    expect(validateRootPath(`${base}\\missing\\..\\project`)).toMatchObject({
      ok: false,
      code: "TRAVERSAL",
    });
    expect(validateRootPath(`${base}\\..\\escape`)).toMatchObject({
      ok: false,
      code: "TRAVERSAL",
    });
  });

  it("rejects UNC paths", () => {
    expect(validateRootPath("\\\\server\\share")).toMatchObject({ ok: false, code: "UNC_PATH" });
  });

  it("rejects a path that does not exist", () => {
    const base = tempRoot();

    expect(validateRootPath(join(base, "absent"))).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("rejects a file", () => {
    const base = tempRoot();
    const file = join(base, "note.txt");
    writeFileSync(file, "not a directory", "utf8");

    expect(validateRootPath(file)).toMatchObject({ ok: false, code: "NOT_DIRECTORY" });
  });

  it("rejects a junction used as a root", (context) => {
    const base = tempRoot();
    const target = join(base, "target");
    const junction = join(base, "junction-link");
    mkdirSync(target);

    try {
      symlinkSync(target, junction, "junction");
    } catch {
      context.skip();
      return;
    }

    expect(isReparsePoint(junction)).toBe(true);
    expect(isReparsePoint(target)).toBe(false);
    expect(validateRootPath(junction)).toMatchObject({ ok: false, code: "REPARSE_ROOT" });
  });
});
