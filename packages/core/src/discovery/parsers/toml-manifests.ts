/**
 * TOML manifest detectors: `pyproject.toml`, `Cargo.toml`, and `Pipfile`.
 *
 * A line-oriented scanner is used instead of a full TOML parser: only section
 * headers, scalar keys, and dependency lines are needed, and adding a TOML
 * dependency would violate the minimal-dependency rule.
 */

import { result } from "../manifest-types.js";
import type { Dependency, DetectorResult } from "../manifest-types.js";

interface TomlTable {
  readonly header: string;
  readonly lines: readonly string[];
}

function scanTomlTables(raw: string): TomlTable[] {
  const tables: { header: string; lines: string[] }[] = [{ header: "", lines: [] }];

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    const header = /^\[\[?([^\]]+)\]\]?$/.exec(trimmed);

    if (header?.[1] !== undefined) {
      tables.push({ header: header[1].trim().toLowerCase(), lines: [] });
      continue;
    }

    tables[tables.length - 1]?.lines.push(line);
  }

  return tables;
}

function tomlScalar(lines: readonly string[], key: string): string | null {
  const pattern = new RegExp(`^\\s*["']?${key}["']?\\s*=\\s*(.+)$`, "i");

  for (const line of lines) {
    const match = pattern.exec(line);
    const raw = match?.[1]?.trim();

    if (raw === undefined || raw.length === 0) {
      continue;
    }

    const quoted = /^["']([^"']*)["']/.exec(raw);

    if (quoted?.[1] !== undefined) {
      return quoted[1];
    }

    const inlineVersion = /version\s*=\s*["']([^"']+)["']/i.exec(raw);

    if (inlineVersion?.[1] !== undefined) {
      return inlineVersion[1];
    }

    return raw.replace(/[,\s]+$/, "");
  }

  return null;
}

function tomlDependencies(lines: readonly string[]): Dependency[] {
  const dependencies: Dependency[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith("#") || trimmed.startsWith("[")) {
      continue;
    }

    const match = /^["']?([A-Za-z0-9@._/-]+)["']?\s*=\s*(.+)$/.exec(trimmed);

    if (match?.[1] === undefined) {
      continue;
    }

    const rawValue = match[2]?.trim() ?? "";
    const quoted = /^["']([^"']*)["']/.exec(rawValue);
    const inlineVersion = /version\s*=\s*["']([^"']+)["']/i.exec(rawValue);

    dependencies.push({
      name: match[1],
      version: quoted?.[1] ?? inlineVersion?.[1] ?? null,
    });
  }

  return dependencies;
}

/** Detects a Python project declared in `pyproject.toml`. */
export function detectPyproject(raw: string): DetectorResult {
  const tables = scanTomlTables(raw);
  const project = tables.find((table) => table.header === "project");
  const poetry = tables.find((table) => table.header === "tool.poetry");
  const poetryDependencies = tables.find(
    (table) => table.header === "tool.poetry.dependencies",
  );
  const projectDependencies = tables.find((table) => table.header === "project.dependencies");

  const dependencies: Dependency[] = [
    ...tomlDependencies(poetryDependencies?.lines ?? []),
    ...tomlDependencies(projectDependencies?.lines ?? []),
  ];

  const arrayBlock = /^\s*dependencies\s*=\s*\[([\s\S]*?)\]/m.exec(raw);

  if (arrayBlock?.[1] !== undefined) {
    for (const match of arrayBlock[1].matchAll(/["']([^"']+)["']/g)) {
      const declaration = match[1];
      const parsed = declaration === undefined ? null : parseDependencyDeclaration(declaration);

      if (parsed !== null) {
        dependencies.push(parsed);
      }
    }
  }

  const buildSystem = tables.find((table) => table.header === "build-system");

  if (buildSystem !== undefined) {
    for (const line of buildSystem.lines) {
      for (const match of line.matchAll(/["']([^"']+)["']/g)) {
        const name = match[1];

        if (name !== undefined && !name.includes(".build_meta")) {
          dependencies.push({ name, version: null });
        }
      }
    }
  }

  return result("pyproject.toml", {
    ecosystem: "PYTHON",
    projectName: tomlScalar(project?.lines ?? [], "name") ?? tomlScalar(poetry?.lines ?? [], "name"),
    primaryLanguage: "Python",
    dependencies,
    confidence: 0.95,
  });
}

function parseDependencyDeclaration(declaration: string): Dependency | null {
  const match = /^([A-Za-z0-9@._/-]+)\s*(?:\[[^\]]*\])?\s*(.*)$/.exec(declaration.trim());
  const name = match?.[1];

  if (name === undefined) {
    return null;
  }

  const version = (match?.[2] ?? "").replace(/^[<>=!~^ ]+/, "").trim();

  return { name, version: version.length > 0 ? version : null };
}

/** Detects a Rust project declared in `Cargo.toml`. */
export function detectCargo(raw: string): DetectorResult {
  const tables = scanTomlTables(raw);
  const packageTable = tables.find((table) => table.header === "package");
  const dependencies: Dependency[] = [];

  for (const table of tables) {
    if (
      table.header === "dependencies" ||
      table.header === "dev-dependencies" ||
      table.header === "build-dependencies" ||
      table.header === "workspace.dependencies"
    ) {
      dependencies.push(...tomlDependencies(table.lines));
    }
  }

  return result("Cargo.toml", {
    ecosystem: "RUST",
    projectName: tomlScalar(packageTable?.lines ?? [], "name"),
    primaryLanguage: "Rust",
    dependencies,
    confidence: 0.95,
  });
}

/** Detects a Python project declared in a `Pipfile`. */
export function detectPipfile(raw: string): DetectorResult {
  const tables = scanTomlTables(raw);
  const dependencies: Dependency[] = [];

  for (const table of tables) {
    if (table.header === "packages" || table.header === "dev-packages") {
      dependencies.push(...tomlDependencies(table.lines));
    }
  }

  return result("Pipfile", {
    ecosystem: "PYTHON",
    primaryLanguage: "Python",
    dependencies,
    confidence: 0.9,
  });
}
