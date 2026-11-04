/**
 * Default traversal exclusions and user-defined exclusion matching.
 *
 * A user may add exclusions but cannot silently disable a built-in safety rule;
 * built-in rules are always evaluated first and are marked as system rules.
 */

export type ExclusionKind = "DIRECTORY" | "PATH" | "GLOB" | "SENSITIVE_NAME";

export interface ExclusionRule {
  readonly kind: ExclusionKind;
  readonly pattern: string;
  readonly isSystem?: boolean;
}

export interface ExclusionMatch {
  readonly kind: ExclusionKind;
  readonly pattern: string;
  readonly isSystem: boolean;
}

/**
 * Built-in directory names that are never traversed. This mirrors the approved
 * default ignore set in docs/DISCOVERY.md section 4.
 */
export const DEFAULT_IGNORED_DIRECTORY_NAMES: readonly string[] = Object.freeze([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "bower_components",
  ".venv",
  "venv",
  "env",
  "__pycache__",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  "target",
  "build",
  "dist",
  "out",
  "bin",
  "obj",
  ".next",
  ".nuxt",
  ".output",
  "coverage",
  ".gradle",
  ".dart_tool",
  ".pub-cache",
  "pods",
  "deriveddata",
  "vendor",
  ".cache",
  ".parcel-cache",
  ".turbo",
  ".nx",
  ".angular",
  ".expo",
  ".ssh",
  ".aws",
  ".azure",
  ".config",
  "appdata",
  ".docker",
  ".kube",
  "secrets",
  "credentials",
  ".idea",
  ".vscode",
]);

const DEFAULT_IGNORED = new Set(DEFAULT_IGNORED_DIRECTORY_NAMES);

export function isDefaultIgnoredDirectory(name: string): boolean {
  return DEFAULT_IGNORED.has(name.toLowerCase());
}

function escapeRegExpCharacter(character: string): string {
  return character.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

/**
 * Minimal glob support for `*`, `**`, and `?`.
 *
 * `*` never crosses a separator, `**` crosses separators, and matching is
 * case-insensitive because Windows paths are case-insensitive.
 */
export function globToRegExp(pattern: string): RegExp {
  const source = pattern.replace(/\\/g, "/");
  let expression = "^";

  for (let index = 0; index < source.length; index += 1) {
    const character = source.charAt(index);

    if (character === "*") {
      if (source.charAt(index + 1) === "*") {
        index += 1;

        if (source.charAt(index + 1) === "/") {
          // `**/` matches zero or more complete path segments only, so
          // `src/**/test` matches `src/test` and `src/a/test`, never `src/atest`.
          expression += "(?:.*/)?";
          index += 1;
        } else {
          expression += ".*";
        }
      } else {
        expression += "[^/]*";
      }
      continue;
    }

    if (character === "?") {
      expression += "[^/]";
      continue;
    }

    expression += escapeRegExpCharacter(character);
  }

  expression += "$";

  return new RegExp(expression, "i");
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").toLowerCase();
}

function lastSegmentName(relativePath: string): string {
  const normalized = normalizeRelativePath(relativePath);
  const segments = normalized.split("/");
  return segments[segments.length - 1] ?? "";
}

/**
 * Builds a matcher that reports the first applicable exclusion for a directory
 * or file, evaluated before descent or before a read.
 */
export function createExclusionMatcher(
  rules: readonly ExclusionRule[] = [],
): (relativePath: string) => ExclusionMatch | null {
  const prepared = rules.map((rule) => ({
    rule,
    normalizedPattern: normalizeRelativePath(rule.pattern),
    glob: rule.kind === "GLOB" ? globToRegExp(rule.pattern) : null,
  }));

  return (relativePath: string): ExclusionMatch | null => {
    const normalized = normalizeRelativePath(relativePath);

    if (normalized.length === 0) {
      return null;
    }

    const segments = normalized.split("/");

    for (const segment of segments) {
      if (DEFAULT_IGNORED.has(segment)) {
        return { kind: "DIRECTORY", pattern: segment, isSystem: true };
      }
    }

    for (const entry of prepared) {
      const isSystem = entry.rule.isSystem === true;

      if (entry.rule.kind === "DIRECTORY" && segments.includes(entry.normalizedPattern)) {
        return { kind: "DIRECTORY", pattern: entry.rule.pattern, isSystem };
      }

      if (
        entry.rule.kind === "PATH" &&
        (normalized === entry.normalizedPattern ||
          normalized.startsWith(`${entry.normalizedPattern}/`))
      ) {
        return { kind: "PATH", pattern: entry.rule.pattern, isSystem };
      }

      if (entry.rule.kind === "GLOB" && entry.glob !== null && entry.glob.test(normalized)) {
        return { kind: "GLOB", pattern: entry.rule.pattern, isSystem };
      }

      if (entry.rule.kind === "SENSITIVE_NAME" && lastSegmentName(normalized) === entry.normalizedPattern) {
        return { kind: "SENSITIVE_NAME", pattern: entry.rule.pattern, isSystem };
      }
    }

    return null;
  };
}
