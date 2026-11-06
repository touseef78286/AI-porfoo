/**
 * Line-oriented manifest detectors: `requirements.txt`, `setup.py`, `go.mod`,
 * `pubspec.yaml`, and `Gemfile`.
 *
 * These formats are not parsed in full. Only dependency names, versions, and
 * the declared project name are extracted, which is all identification needs.
 */

import { firstGroup, parseRequirementLine, result } from "../manifest-types.js";
import type { Dependency, DetectorResult } from "../manifest-types.js";

/** Detects a Python project declared in `requirements.txt`. */
export function detectRequirements(raw: string): DetectorResult {
  const dependencies: Dependency[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const dependency = parseRequirementLine(line);

    if (dependency !== null) {
      dependencies.push(dependency);
    }
  }

  return result("requirements.txt", {
    ecosystem: "PYTHON",
    primaryLanguage: "Python",
    dependencies,
    confidence: 0.9,
  });
}

/** Detects a Python project declared in `setup.py`. */
export function detectSetupPy(raw: string): DetectorResult {
  const dependencies: Dependency[] = [];
  const block = /install_requires\s*=\s*\[([\s\S]*?)\]/m.exec(raw);

  if (block?.[1] !== undefined) {
    for (const match of block[1].matchAll(/["']([^"']+)["']/g)) {
      const dependency = parseRequirementLine(match[1] ?? "");

      if (dependency !== null) {
        dependencies.push(dependency);
      }
    }
  }

  return result("setup.py", {
    ecosystem: "PYTHON",
    projectName: firstGroup(/name\s*=\s*["']([^"']+)["']/m, raw),
    primaryLanguage: "Python",
    dependencies,
    confidence: 0.9,
  });
}

/** Detects a Go project declared in `go.mod`. */
export function detectGoMod(raw: string): DetectorResult {
  const dependencies: Dependency[] = [];
  const block = /^\s*require\s*\(([\s\S]*?)^\s*\)/m.exec(raw);

  if (block?.[1] !== undefined) {
    for (const line of block[1].split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);

      if (parts[0] !== undefined && parts[0].length > 0) {
        dependencies.push({ name: parts[0], version: parts[1] ?? null });
      }
    }
  }

  for (const match of raw.matchAll(/^\s*require\s+(\S+)\s+(\S+)/gm)) {
    if (match[1] !== undefined) {
      dependencies.push({ name: match[1], version: match[2] ?? null });
    }
  }

  return result("go.mod", {
    ecosystem: "GO",
    projectName: firstGroup(/^\s*module\s+(\S+)/m, raw),
    primaryLanguage: "Go",
    dependencies,
    confidence: 0.95,
  });
}

interface YamlEntry {
  readonly name: string;
  readonly value: string | null;
}

function yamlChildEntries(raw: string, key: string): YamlEntry[] {
  const lines = raw.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => new RegExp(`^${key}\\s*:`).test(line));

  if (startIndex === -1) {
    return [];
  }

  const collected: { indent: number; text: string }[] = [];

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const indent = line.length - line.trimStart().length;

    if (indent === 0) {
      break;
    }

    collected.push({ indent, text: trimmed });
  }

  if (collected.length === 0) {
    return [];
  }

  const minimal = Math.min(...collected.map((entry) => entry.indent));

  return collected
    .filter((entry) => entry.indent === minimal)
    .map((entry) => {
      const match = /^([^:]+):\s*(.*)$/.exec(entry.text);

      return match?.[1] === undefined
        ? { name: entry.text, value: null }
        : { name: match[1].trim(), value: (match[2] ?? "").trim() || null };
    });
}

/** Detects a Dart/Flutter project declared in `pubspec.yaml`. */
export function detectPubspec(raw: string): DetectorResult {
  const dependencies = [
    ...yamlChildEntries(raw, "dependencies"),
    ...yamlChildEntries(raw, "dev_dependencies"),
  ].map((entry) => ({ name: entry.name, version: entry.value }));

  return result("pubspec.yaml", {
    ecosystem: "DART",
    projectName: firstGroup(/^name\s*:\s*(\S+)/m, raw),
    primaryLanguage: "Dart",
    dependencies,
    confidence: 0.95,
  });
}

/** Detects a Ruby project declared in a `Gemfile`. */
export function detectGemfile(raw: string): DetectorResult {
  const dependencies: Dependency[] = [];

  for (const match of raw.matchAll(/^\s*gem\s+["']([^"']+)["'](?:\s*,\s*["']([^"']+)["'])?/gm)) {
    if (match[1] !== undefined) {
      dependencies.push({ name: match[1], version: match[2] ?? null });
    }
  }

  return result("Gemfile", {
    ecosystem: "RUBY",
    primaryLanguage: "Ruby",
    dependencies,
    confidence: 0.9,
  });
}
