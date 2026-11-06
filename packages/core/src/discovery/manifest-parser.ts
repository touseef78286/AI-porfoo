/**
 * Manifest parser dispatch.
 *
 * Parsing is selected strictly by the allowlisted filename. There is no
 * content sniffing, because a generic "contains a colon" or "contains an equals
 * sign" heuristic mislabels unrelated formats. Each parser is bounded by the
 * caller (`MANIFEST_PARSER_MAX_BYTES`) and performs no I/O.
 *
 * Only data needed for identification is extracted: name, language, ecosystem,
 * declared technologies, and version constraints. Source code is never read.
 */

import { shouldReadManifest } from "./manifests.js";
import { invalid } from "./manifest-types.js";
import type { DetectorResult } from "./manifest-types.js";
import { detectDotnet, detectGradle, detectPom } from "./parsers/build-manifests.js";
import { detectJsonManifest } from "./parsers/json-manifests.js";
import {
  detectGemfile,
  detectGoMod,
  detectPubspec,
  detectRequirements,
  detectSetupPy,
} from "./parsers/line-manifests.js";
import { detectCargo, detectPipfile, detectPyproject } from "./parsers/toml-manifests.js";

export type {
  DetectorResult,
  Ecosystem,
  ManifestEcosystem,
  TechnologyKind,
  TechnologySignature,
  DetectionState,
  DetectionConfidence,
} from "./manifest-types.js";

/** Maximum bytes the parser may read. Must not exceed MANIFEST_MAX_BYTES. */
export const MANIFEST_PARSER_MAX_BYTES = 256 * 1024;

/** Return `true` when `raw` exceeds the parser bound. */
export function exceedsParserBound(raw: string): boolean {
  return raw.length > MANIFEST_PARSER_MAX_BYTES;
}

/** `true` when the given parser state indicates an invalid parse. */
export function isParserStateInvalid(state: string): state is "INVALID" {
  return state === "INVALID";
}

/**
 * Parses one allowlisted manifest.
 *
 * Returns `null` when the filename is not an allowlisted manifest. Returns a
 * result with `detectionState: "INVALID"` when the file is recognized but its
 * content cannot be understood, so the scanner flags it for review instead of
 * crashing or silently dropping the project.
 */
export function parseManifest(raw: string, fileName: string): DetectorResult | null {
  if (!shouldReadManifest(fileName)) {
    return null;
  }

  const normalized = fileName.trim().toLowerCase();

  try {
    switch (normalized) {
      case "package.json":
      case "composer.json":
        return detectJsonManifest(raw, fileName);
      case "pyproject.toml":
        return detectPyproject(raw);
      case "cargo.toml":
        return detectCargo(raw);
      case "pipfile":
        return detectPipfile(raw);
      case "requirements.txt":
        return detectRequirements(raw);
      case "setup.py":
        return detectSetupPy(raw);
      case "go.mod":
        return detectGoMod(raw);
      case "pubspec.yaml":
        return detectPubspec(raw);
      case "gemfile":
        return detectGemfile(raw);
      case "pom.xml":
        return detectPom(raw);
      case "build.gradle":
      case "build.gradle.kts":
        return detectGradle(raw, fileName);
      default:
        if (
          normalized.endsWith(".sln") ||
          normalized.endsWith(".csproj") ||
          normalized.endsWith(".fsproj") ||
          normalized.endsWith(".vbproj")
        ) {
          return detectDotnet(raw, fileName);
        }

        return invalid(fileName);
    }
  } catch {
    return invalid(fileName);
  }
}
