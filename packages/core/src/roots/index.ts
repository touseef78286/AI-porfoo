export {
  ABSOLUTE_WINDOWS_PATTERN,
  UNC_PREFIX_PATTERN,
  WINDOWS_DRIVE_ROOT_PATTERN,
  comparisonSegments,
  hasTraversalSegment,
  isAbsoluteWindowsPath,
  isDriveRoot,
  isUncPath,
  normalizeSeparators,
  pathSegments,
  toComparisonPath,
} from "./path-rules.js";

export { findPathDenial } from "./deny-rules.js";
export type { PathDenial, PathDenialCode } from "./deny-rules.js";

export {
  DEFAULT_IGNORED_DIRECTORY_NAMES,
  createExclusionMatcher,
  globToRegExp,
  isDefaultIgnoredDirectory,
} from "./exclusions.js";
export type { ExclusionKind, ExclusionMatch, ExclusionRule } from "./exclusions.js";

export { checkManifestRead, isSensitiveFileName } from "./sensitive-files.js";
export type { ReadDecision, ReadDenialCode } from "./sensitive-files.js";
