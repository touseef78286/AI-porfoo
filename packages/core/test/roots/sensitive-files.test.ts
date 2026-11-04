import { describe, expect, it } from "vitest";

import { checkManifestRead, isSensitiveFileName } from "../../src/roots/sensitive-files.js";

describe("isSensitiveFileName", () => {
  it.each([
    ".env",
    ".env.local",
    ".npmrc",
    ".netrc",
    ".git-credentials",
    "id_rsa",
    "id_ed25519",
    "credentials.json",
    "secrets.yaml",
    "server.pem",
    "private.key",
    "bundle.pfx",
    "vault.kdbx",
  ])("flags %s", (name) => {
    expect(isSensitiveFileName(name)).toBe(true);
  });

  it.each(["package.json", "Cargo.toml", "pubspec.yaml", "README.md", "tsconfig.json"])(
    "allows %s",
    (name) => {
      expect(isSensitiveFileName(name)).toBe(false);
    },
  );
});

describe("checkManifestRead", () => {
  it("allows ordinary manifests", () => {
    expect(checkManifestRead("package.json")).toEqual({ allowed: true });
    expect(checkManifestRead("apps/web/package.json")).toEqual({ allowed: true });
  });

  it("denies sensitive names before any read", () => {
    expect(checkManifestRead(".env")).toMatchObject({ allowed: false, code: "SENSITIVE_NAME" });
    expect(checkManifestRead("apps/web/.env.production")).toMatchObject({
      allowed: false,
      code: "SENSITIVE_NAME",
    });
  });

  it("denies sensitive extensions", () => {
    expect(checkManifestRead("certs/server.pem")).toMatchObject({
      allowed: false,
      code: "SENSITIVE_EXTENSION",
    });
  });

  it("denies files inside sensitive directories", () => {
    expect(checkManifestRead(".ssh/config")).toMatchObject({
      allowed: false,
      code: "SENSITIVE_DIRECTORY",
    });
    expect(checkManifestRead("AppData/Roaming/app/settings.json")).toMatchObject({
      allowed: false,
      code: "SENSITIVE_DIRECTORY",
    });
  });
});
