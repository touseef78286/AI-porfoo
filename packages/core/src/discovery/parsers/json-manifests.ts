/**
 * JSON manifest detectors: `package.json` and `composer.json`.
 *
 * Only declared identity and dependency names are read. Dependency bodies are
 * never fetched, and lockfiles are never opened.
 */

import { collectTechnologies, toSignature, technologySpecFor } from "../technologies.js";
import type { TechnologySignature } from "../technologies.js";
import { asRecord, invalid, result, stringField } from "../manifest-types.js";
import type { Dependency, DetectorResult } from "../manifest-types.js";

function jsonDependencies(
  payload: Record<string, unknown>,
  fields: readonly string[],
): Dependency[] {
  const dependencies: Dependency[] = [];

  for (const field of fields) {
    const value = asRecord(payload[field]);

    if (value === null) {
      continue;
    }

    for (const [name, version] of Object.entries(value)) {
      dependencies.push({
        name,
        version: typeof version === "string" ? version : null,
      });
    }
  }

  return dependencies;
}

function detectNodeManifest(payload: Record<string, unknown>): DetectorResult | null {
  const dependencies = jsonDependencies(payload, [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ]);

  const scripts = asRecord(payload.scripts);
  const hasScripts = scripts !== null && Object.keys(scripts).length > 0;

  // A package.json is a project signal by itself. Requiring `version` or
  // `scripts` would miss private workspace packages, which commonly omit both.
  const declaresNode =
    typeof payload.name === "string" ||
    hasScripts ||
    dependencies.length > 0 ||
    payload.workspaces !== undefined ||
    payload.exports !== undefined ||
    payload.main !== undefined ||
    payload.type !== undefined;

  if (!declaresNode) {
    return null;
  }

  // `engines.node` is a runtime requirement, never a language. Language comes
  // from an explicit TypeScript declaration only.
  const usesTypeScript =
    dependencies.some((dependency) => dependency.name.toLowerCase() === "typescript") ||
    Object.keys(payload).includes("types");

  const technologies: TechnologySignature[] = collectTechnologies(dependencies, 0.9);
  const runtime = technologySpecFor("node");

  if (runtime !== null && !technologies.some((technology) => technology.key === runtime.key)) {
    const engines = asRecord(payload.engines);
    const nodeRange = engines !== null ? stringField(engines, "node") : null;

    technologies.push(toSignature(runtime, nodeRange, 0.85));
  }

  if (usesTypeScript && !technologies.some((technology) => technology.key === "typescript")) {
    const typescript = technologySpecFor("typescript");

    if (typescript !== null) {
      technologies.push(toSignature(typescript, null, 0.9));
    }
  }

  return result("package.json", {
    ecosystem: "NODE",
    projectName: stringField(payload, "name"),
    primaryLanguage: usesTypeScript ? "TypeScript" : "JavaScript",
    technologies,
    confidence: 0.95,
  });
}

function detectComposerManifest(payload: Record<string, unknown>): DetectorResult {
  const require = asRecord(payload.require);
  const dependencies: Dependency[] = [];

  if (require !== null) {
    for (const [name, version] of Object.entries(require)) {
      const lowered = name.toLowerCase();

      if (lowered === "php" || lowered.startsWith("ext-") || lowered.startsWith("lib-")) {
        continue;
      }

      dependencies.push({
        name,
        version: typeof version === "string" ? version : null,
      });
    }
  }

  return result("composer.json", {
    ecosystem: "PHP",
    projectName: stringField(payload, "name"),
    primaryLanguage: "PHP",
    dependencies,
    confidence: 0.95,
  });
}

/** Parses a JSON manifest by filename. */
export function detectJsonManifest(raw: string, fileName: string): DetectorResult {
  let payload: unknown;

  try {
    payload = JSON.parse(raw);
  } catch {
    return invalid(fileName);
  }

  const record = asRecord(payload);

  if (record === null) {
    return invalid(fileName);
  }

  switch (fileName.trim().toLowerCase()) {
    case "package.json":
      return detectNodeManifest(record) ?? invalid(fileName);
    case "composer.json":
      return detectComposerManifest(record);
    default:
      return invalid(fileName);
  }
}
