import { describe, expect, it } from "vitest";

import { classifyIoError } from "../../src/discovery/traversal-io.js";

function errorWithCode(code: string): Error {
  const error = new Error(`raw os text for ${code}`) as NodeJS.ErrnoException;
  error.code = code;
  return error;
}

describe("classifyIoError", () => {
  it("maps access failures to PERMISSION_DENIED", () => {
    expect(classifyIoError(errorWithCode("EACCES"), "DIRECTORY")).toEqual({
      code: "PERMISSION_DENIED",
      message: "Access denied",
    });
    expect(classifyIoError(errorWithCode("EPERM"), "FILE").code).toBe("PERMISSION_DENIED");
  });

  it("maps vanished paths by operation", () => {
    expect(classifyIoError(errorWithCode("ENOENT"), "DIRECTORY").code).toBe(
      "UNREADABLE_DIRECTORY",
    );
    expect(classifyIoError(errorWithCode("ENOENT"), "FILE").code).toBe("UNREADABLE_FILE");
    expect(classifyIoError(errorWithCode("ENOTDIR"), "DIRECTORY").code).toBe(
      "UNREADABLE_DIRECTORY",
    );
  });

  it("maps resource exhaustion to an unreadable path", () => {
    expect(classifyIoError(errorWithCode("EMFILE"), "FILE")).toEqual({
      code: "UNREADABLE_FILE",
      message: "Filesystem resource limit reached",
    });
  });

  it("falls back without leaking OS text or paths", () => {
    const classified = classifyIoError(new Error("E:\\private\\path denied"), "FILE");

    expect(classified.code).toBe("UNREADABLE_FILE");
    expect(classified.message).toBe("Path could not be read");
    expect(classified.message).not.toContain("private");
  });

  it("handles non-object throws", () => {
    expect(classifyIoError("boom", "DIRECTORY").code).toBe("UNREADABLE_DIRECTORY");
    expect(classifyIoError(undefined, "FILE").code).toBe("UNREADABLE_FILE");
  });
});
