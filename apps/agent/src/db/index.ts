export { IN_MEMORY_DATABASE, openDatabase, readScalarInt, withTransaction } from "./connection.js";
export type { OpenDatabaseOptions } from "./connection.js";

export {
  applyMigrations,
  defaultMigrationsDirectory,
  loadMigrations,
  MigrationError,
  readCurrentVersion,
} from "./migration-runner.js";
export type { ApplyMigrationsResult, Migration } from "./migration-runner.js";

export { backupDatabase, inspectDatabase, restoreDatabase } from "./backup.js";
export type { DatabaseInspection } from "./backup.js";

export {
  findRootByCanonicalPath,
  insertRoot,
  listActiveRoots,
  listRoots,
  updateRootStatus,
} from "./repositories/root-repository.js";
export type { NewProjectRoot, ProjectRoot, RootStatus } from "./repositories/root-repository.js";

export {
  addExclusion,
  deleteUserExclusion,
  listExclusions,
  loadExclusionRulesForRoot,
} from "./repositories/exclusion-repository.js";
export type { Exclusion, NewExclusion } from "./repositories/exclusion-repository.js";
