import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Tests must never write into the OS temp directory: on this machine it lives
 * on the nearly full C: drive. All test artifacts stay under the gitignored
 * workspace cache instead.
 */
const TEST_TEMP_ROOT = resolve(process.cwd(), ".cache", "test-tmp");

export function createWorkspaceTempDir(prefix: string): string {
  mkdirSync(TEST_TEMP_ROOT, { recursive: true });
  return mkdtempSync(join(TEST_TEMP_ROOT, `${prefix}-`));
}

export function removeWorkspaceTempDir(directory: string): void {
  rmSync(directory, { recursive: true, force: true });
}

export function databasePathIn(directory: string, name = "intelligence.db"): string {
  return join(directory, name);
}
