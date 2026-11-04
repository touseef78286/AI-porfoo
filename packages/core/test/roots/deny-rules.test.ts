import { describe, expect, it } from "vitest";

import { findPathDenial } from "../../src/roots/deny-rules.js";

describe("findPathDenial", () => {
  it.each([
    ["C:\\", "DRIVE_ROOT"],
    ["T:\\", "DRIVE_ROOT"],
    ["C:/", "DRIVE_ROOT"],
    ["c:", "DRIVE_ROOT"],
    ["\\\\server\\share", "UNC_PATH"],
    ["C:\\Windows", "SYSTEM_DIRECTORY"],
    ["c:\\windows\\system32", "SYSTEM_DIRECTORY"],
    ["C:\\Program Files\\App", "SYSTEM_DIRECTORY"],
    ["C:\\ProgramData", "SYSTEM_DIRECTORY"],
    ["C:\\Users\\touse", "USER_PROFILE_ROOT"],
    ["C:\\Users\\touse\\AppData\\Local", "CREDENTIAL_STORE"],
    ["T:\\projects\\.ssh", "CREDENTIAL_STORE"],
    ["T:\\projects\\.aws\\keys", "CREDENTIAL_STORE"],
    ["T:\\work\\node_modules\\pkg", "IGNORED_DIRECTORY"],
    ["T:\\work\\.git\\objects", "IGNORED_DIRECTORY"],
  ])("denies %s with %s", (path, expectedCode) => {
    const denial = findPathDenial(path);

    expect(denial?.code).toBe(expectedCode);
  });

  it.each([
    "T:\\My AI portfolio",
    "T:\\projects\\demo",
    "T:\\projects\\build",
    "T:\\projects\\env",
    "D:\\src\\app",
  ])("allows %s", (path) => {
    expect(findPathDenial(path)).toBeNull();
  });

  it("ignores path casing", () => {
    expect(findPathDenial("c:\\WINDOWS\\System32")?.code).toBe("SYSTEM_DIRECTORY");
  });
});
