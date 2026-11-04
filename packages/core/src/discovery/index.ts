export {
  MANIFEST_MAX_BYTES,
  MANIFEST_SIGNATURES,
  isAllowlistedManifest,
  matchManifest,
  shouldReadManifest,
} from "./manifests.js";
export type {
  Ecosystem,
  ManifestSignature,
  SignatureMatch,
  SignatureStrength,
} from "./manifests.js";

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
