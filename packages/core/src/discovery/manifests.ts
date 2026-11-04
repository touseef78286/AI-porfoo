/**
 * Manifest allowlist for Phase 1 traversal.
 *
 * Traversal may only open files listed here with `readContent: true`. Every
 * other file is presence-only evidence or ignored entirely. Lockfile bodies are
 * never read in Phase 1, per docs/DISCOVERY.md section 5.
 */

export type Ecosystem =
  | "NODE"
  | "PYTHON"
  | "RUST"
  | "GO"
  | "DART"
  | "JAVA"
  | "DOTNET"
  | "PHP"
  | "RUBY"
  | "SHARED";

export type SignatureStrength = "STRONG" | "SUPPORTING";

export type SignatureMatch = "EXACT" | "EXTENSION" | "PREFIX";

export interface ManifestSignature {
  /** Human-readable evidence label stored with detection evidence. */
  readonly evidenceLabel: string;
  readonly ecosystem: Ecosystem;
  readonly match: SignatureMatch;
  /** Lowercase filename, extension, or prefix depending on `match`. */
  readonly pattern: string;
  readonly strength: SignatureStrength;
  /** Whether traversal may open the file. False means presence-only. */
  readonly readContent: boolean;
}

/** Maximum bytes traversal may read from a single manifest. */
export const MANIFEST_MAX_BYTES = 256 * 1024;

export const MANIFEST_SIGNATURES: readonly ManifestSignature[] = Object.freeze([
  // Node.js / JavaScript / TypeScript
  { evidenceLabel: "node.package-json", ecosystem: "NODE", match: "EXACT", pattern: "package.json", strength: "STRONG", readContent: true },
  { evidenceLabel: "node.package-lock", ecosystem: "NODE", match: "EXACT", pattern: "package-lock.json", strength: "SUPPORTING", readContent: false },
  { evidenceLabel: "node.pnpm-lock", ecosystem: "NODE", match: "EXACT", pattern: "pnpm-lock.yaml", strength: "SUPPORTING", readContent: false },
  { evidenceLabel: "node.yarn-lock", ecosystem: "NODE", match: "EXACT", pattern: "yarn.lock", strength: "SUPPORTING", readContent: false },
  { evidenceLabel: "node.bun-lock", ecosystem: "NODE", match: "EXACT", pattern: "bun.lock", strength: "SUPPORTING", readContent: false },
  { evidenceLabel: "node.bun-lockb", ecosystem: "NODE", match: "EXACT", pattern: "bun.lockb", strength: "SUPPORTING", readContent: false },
  { evidenceLabel: "node.tsconfig", ecosystem: "NODE", match: "EXACT", pattern: "tsconfig.json", strength: "SUPPORTING", readContent: false },
  { evidenceLabel: "node.angular-workspace", ecosystem: "NODE", match: "EXACT", pattern: "angular.json", strength: "SUPPORTING", readContent: false },
  { evidenceLabel: "node.next-config", ecosystem: "NODE", match: "PREFIX", pattern: "next.config.", strength: "SUPPORTING", readContent: false },
  { evidenceLabel: "node.vite-config", ecosystem: "NODE", match: "PREFIX", pattern: "vite.config.", strength: "SUPPORTING", readContent: false },
  { evidenceLabel: "node.svelte-config", ecosystem: "NODE", match: "PREFIX", pattern: "svelte.config.", strength: "SUPPORTING", readContent: false },
  { evidenceLabel: "node.nuxt-config", ecosystem: "NODE", match: "PREFIX", pattern: "nuxt.config.", strength: "SUPPORTING", readContent: false },

  // Python
  { evidenceLabel: "python.pyproject", ecosystem: "PYTHON", match: "EXACT", pattern: "pyproject.toml", strength: "STRONG", readContent: true },
  { evidenceLabel: "python.requirements", ecosystem: "PYTHON", match: "EXACT", pattern: "requirements.txt", strength: "STRONG", readContent: true },
  { evidenceLabel: "python.pipfile", ecosystem: "PYTHON", match: "EXACT", pattern: "pipfile", strength: "STRONG", readContent: true },
  { evidenceLabel: "python.setup-py", ecosystem: "PYTHON", match: "EXACT", pattern: "setup.py", strength: "STRONG", readContent: true },
  { evidenceLabel: "python.setup-cfg", ecosystem: "PYTHON", match: "EXACT", pattern: "setup.cfg", strength: "SUPPORTING", readContent: false },
  { evidenceLabel: "python.pipfile-lock", ecosystem: "PYTHON", match: "EXACT", pattern: "pipfile.lock", strength: "SUPPORTING", readContent: false },
  { evidenceLabel: "python.poetry-lock", ecosystem: "PYTHON", match: "EXACT", pattern: "poetry.lock", strength: "SUPPORTING", readContent: false },

  // Rust
  { evidenceLabel: "rust.cargo-toml", ecosystem: "RUST", match: "EXACT", pattern: "cargo.toml", strength: "STRONG", readContent: true },
  { evidenceLabel: "rust.cargo-lock", ecosystem: "RUST", match: "EXACT", pattern: "cargo.lock", strength: "SUPPORTING", readContent: false },

  // Go
  { evidenceLabel: "go.go-mod", ecosystem: "GO", match: "EXACT", pattern: "go.mod", strength: "STRONG", readContent: true },
  { evidenceLabel: "go.go-sum", ecosystem: "GO", match: "EXACT", pattern: "go.sum", strength: "SUPPORTING", readContent: false },

  // Dart / Flutter
  { evidenceLabel: "dart.pubspec", ecosystem: "DART", match: "EXACT", pattern: "pubspec.yaml", strength: "STRONG", readContent: true },
  { evidenceLabel: "dart.pubspec-lock", ecosystem: "DART", match: "EXACT", pattern: "pubspec.lock", strength: "SUPPORTING", readContent: false },

  // JVM
  { evidenceLabel: "java.maven-pom", ecosystem: "JAVA", match: "EXACT", pattern: "pom.xml", strength: "STRONG", readContent: true },
  { evidenceLabel: "java.gradle", ecosystem: "JAVA", match: "EXACT", pattern: "build.gradle", strength: "STRONG", readContent: true },
  { evidenceLabel: "java.gradle-kts", ecosystem: "JAVA", match: "EXACT", pattern: "build.gradle.kts", strength: "STRONG", readContent: true },
  { evidenceLabel: "java.gradle-settings", ecosystem: "JAVA", match: "EXACT", pattern: "settings.gradle", strength: "SUPPORTING", readContent: false },

  // .NET
  { evidenceLabel: "dotnet.solution", ecosystem: "DOTNET", match: "EXTENSION", pattern: ".sln", strength: "STRONG", readContent: true },
  { evidenceLabel: "dotnet.project", ecosystem: "DOTNET", match: "EXTENSION", pattern: ".csproj", strength: "STRONG", readContent: true },

  // PHP
  { evidenceLabel: "php.composer", ecosystem: "PHP", match: "EXACT", pattern: "composer.json", strength: "STRONG", readContent: true },
  { evidenceLabel: "php.composer-lock", ecosystem: "PHP", match: "EXACT", pattern: "composer.lock", strength: "SUPPORTING", readContent: false },

  // Ruby
  { evidenceLabel: "ruby.gemfile", ecosystem: "RUBY", match: "EXACT", pattern: "gemfile", strength: "STRONG", readContent: true },
  { evidenceLabel: "ruby.gemfile-lock", ecosystem: "RUBY", match: "EXACT", pattern: "gemfile.lock", strength: "SUPPORTING", readContent: false },
]);

/**
 * Returns the first matching signature for a filename.
 *
 * Matching is case-insensitive because Windows filenames are. Exact matches are
 * checked before extensions so `build.gradle.kts` is not treated as unknown.
 */
export function matchManifest(fileName: string): ManifestSignature | null {
  const normalized = fileName.trim().toLowerCase();

  if (normalized.length === 0) {
    return null;
  }

  for (const signature of MANIFEST_SIGNATURES) {
    if (signature.match === "EXACT" && normalized === signature.pattern.toLowerCase()) {
      return signature;
    }
  }

  for (const signature of MANIFEST_SIGNATURES) {
    if (signature.match === "EXTENSION" && normalized.endsWith(signature.pattern.toLowerCase())) {
      return signature;
    }
  }

  for (const signature of MANIFEST_SIGNATURES) {
    if (signature.match === "PREFIX" && normalized.startsWith(signature.pattern.toLowerCase())) {
      return signature;
    }
  }

  return null;
}

export function isAllowlistedManifest(fileName: string): boolean {
  return matchManifest(fileName) !== null;
}

/** True when traversal is permitted to open and fingerprint this file. */
export function shouldReadManifest(fileName: string): boolean {
  return matchManifest(fileName)?.readContent === true;
}
