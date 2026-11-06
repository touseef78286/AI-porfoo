export {
  MANIFEST_MAX_BYTES,
  MANIFEST_SIGNATURES,
  isAllowlistedManifest,
  matchManifest,
  shouldReadManifest,
} from "./manifests.js";

export type {
  ManifestSignature,
  SignatureMatch,
  SignatureStrength,
} from "./manifests.js";

export type {
  DetectorResult,
  Ecosystem,
  ManifestEcosystem,
  TechnologySignature,
  TechnologyKind,
  DetectionState,
  DetectionConfidence,
} from "./manifest-parser.js";

export {
  parseManifest,
  exceedsParserBound,
  isParserStateInvalid,
} from "./manifest-parser.js";

export {
  TECHNOLOGY_RULES,
  collectTechnologies,
  normalizeDependencyName,
  technologySpecFor,
  toSignature,
} from "./technologies.js";

export {
  DEFAULT_TRAVERSAL_LIMITS,
  compareByRelativePath,
  emptyTraversalStats,
  normalizeTraversalLimits,
} from "./traversal-policy.js";

export type {
  ManifestObservation,
  ManifestParserState,
  TraversalError,
  TraversalErrorCode,
  TraversalLimits,
  TraversalResult,
  TraversalStats,
  TraversalStatus,
} from "./traversal-policy.js";