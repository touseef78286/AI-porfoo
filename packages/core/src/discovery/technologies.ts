/**
 * Technology vocabulary for detection.
 *
 * This module is pure: it maps a dependency or manifest identifier to a
 * canonical technology record. The scanner persists these records; it must not
 * invent its own names, otherwise the same technology appears under several
 * spellings across projects.
 */

export type TechnologyKind =
  | "LANGUAGE"
  | "FRAMEWORK"
  | "RUNTIME"
  | "TOOL"
  | "DATABASE"
  | "PLATFORM";

export interface TechnologySpec {
  /** Stable, lowercase key used for aggregation and graph identity. */
  readonly key: string;
  /** Human-readable display name. */
  readonly name: string;
  readonly kind: TechnologyKind;
}

export interface TechnologySignature {
  readonly key: string;
  readonly name: string;
  readonly kind: TechnologyKind;
  readonly versionSpec: string | null;
  readonly confidence: number;
}

function spec(key: string, name: string, kind: TechnologyKind): TechnologySpec {
  return Object.freeze({ key, name, kind });
}

/**
 * Exact-match dependency rules, keyed by lowercase package/module name.
 *
 * Only dependencies that add real information are listed. An unknown package is
 * deliberately ignored rather than stored as a technology, so the inventory
 * stays a curated fingerprint instead of a raw dependency dump.
 */
export const TECHNOLOGY_RULES: Readonly<Record<string, TechnologySpec>> = Object.freeze({
  // Node.js / JavaScript / TypeScript
  node: spec("node", "Node.js", "RUNTIME"),
  typescript: spec("typescript", "TypeScript", "LANGUAGE"),
  react: spec("react", "React", "FRAMEWORK"),
  "react-dom": spec("react", "React", "FRAMEWORK"),
  next: spec("nextjs", "Next.js", "FRAMEWORK"),
  vue: spec("vue", "Vue", "FRAMEWORK"),
  nuxt: spec("nuxt", "Nuxt", "FRAMEWORK"),
  svelte: spec("svelte", "Svelte", "FRAMEWORK"),
  "@sveltejs/kit": spec("sveltekit", "SvelteKit", "FRAMEWORK"),
  "@angular/core": spec("angular", "Angular", "FRAMEWORK"),
  astro: spec("astro", "Astro", "FRAMEWORK"),
  "solid-js": spec("solid", "Solid", "FRAMEWORK"),
  express: spec("express", "Express", "FRAMEWORK"),
  fastify: spec("fastify", "Fastify", "FRAMEWORK"),
  koa: spec("koa", "Koa", "FRAMEWORK"),
  "@nestjs/core": spec("nestjs", "NestJS", "FRAMEWORK"),
  hono: spec("hono", "Hono", "FRAMEWORK"),
  "socket.io": spec("socketio", "Socket.IO", "FRAMEWORK"),
  electron: spec("electron", "Electron", "PLATFORM"),
  "react-native": spec("react-native", "React Native", "PLATFORM"),
  expo: spec("expo", "Expo", "PLATFORM"),
  vite: spec("vite", "Vite", "TOOL"),
  webpack: spec("webpack", "Webpack", "TOOL"),
  rollup: spec("rollup", "Rollup", "TOOL"),
  esbuild: spec("esbuild", "esbuild", "TOOL"),
  tsx: spec("tsx", "tsx", "TOOL"),
  "ts-node": spec("ts-node", "ts-node", "TOOL"),
  tailwindcss: spec("tailwindcss", "Tailwind CSS", "TOOL"),
  jest: spec("jest", "Jest", "TOOL"),
  vitest: spec("vitest", "Vitest", "TOOL"),
  "@playwright/test": spec("playwright", "Playwright", "TOOL"),
  storybook: spec("storybook", "Storybook", "TOOL"),
  zod: spec("zod", "Zod", "TOOL"),
  axios: spec("axios", "Axios", "TOOL"),
  prisma: spec("prisma", "Prisma", "DATABASE"),
  "@prisma/client": spec("prisma", "Prisma", "DATABASE"),
  mongoose: spec("mongoose", "Mongoose", "DATABASE"),
  "drizzle-orm": spec("drizzle", "Drizzle", "DATABASE"),
  "better-sqlite3": spec("sqlite", "SQLite", "DATABASE"),
  sqlite3: spec("sqlite", "SQLite", "DATABASE"),
  pg: spec("postgresql", "PostgreSQL", "DATABASE"),
  mysql2: spec("mysql", "MySQL", "DATABASE"),
  redis: spec("redis", "Redis", "DATABASE"),

  // Python
  django: spec("django", "Django", "FRAMEWORK"),
  flask: spec("flask", "Flask", "FRAMEWORK"),
  fastapi: spec("fastapi", "FastAPI", "FRAMEWORK"),
  starlette: spec("starlette", "Starlette", "FRAMEWORK"),
  celery: spec("celery", "Celery", "FRAMEWORK"),
  "sqlalchemy": spec("sqlalchemy", "SQLAlchemy", "DATABASE"),
  pydantic: spec("pydantic", "Pydantic", "TOOL"),
  pytest: spec("pytest", "pytest", "TOOL"),
  numpy: spec("numpy", "NumPy", "TOOL"),
  pandas: spec("pandas", "pandas", "TOOL"),
  torch: spec("pytorch", "PyTorch", "FRAMEWORK"),
  tensorflow: spec("tensorflow", "TensorFlow", "FRAMEWORK"),
  uvicorn: spec("uvicorn", "Uvicorn", "RUNTIME"),
  gunicorn: spec("gunicorn", "Gunicorn", "RUNTIME"),

  // Rust
  tokio: spec("tokio", "Tokio", "RUNTIME"),
  axum: spec("axum", "Axum", "FRAMEWORK"),
  "actix-web": spec("actix-web", "Actix Web", "FRAMEWORK"),
  rocket: spec("rocket", "Rocket", "FRAMEWORK"),
  serde: spec("serde", "Serde", "TOOL"),
  diesel: spec("diesel", "Diesel", "DATABASE"),
  sqlx: spec("sqlx", "SQLx", "DATABASE"),
  bevy: spec("bevy", "Bevy", "FRAMEWORK"),

  // Go
  "github.com/gin-gonic/gin": spec("gin", "Gin", "FRAMEWORK"),
  "github.com/labstack/echo/v4": spec("echo", "Echo", "FRAMEWORK"),
  "github.com/gofiber/fiber/v2": spec("fiber", "Fiber", "FRAMEWORK"),
  "gorm.io/gorm": spec("gorm", "GORM", "DATABASE"),
  "github.com/spf13/cobra": spec("cobra", "Cobra", "TOOL"),

  // Dart / Flutter
  flutter: spec("flutter", "Flutter", "FRAMEWORK"),
  provider: spec("provider", "Provider", "TOOL"),
  flutter_riverpod: spec("riverpod", "Riverpod", "TOOL"),
  flutter_bloc: spec("bloc", "Bloc", "TOOL"),
  dio: spec("dio", "Dio", "TOOL"),

  // JVM
  "org.springframework.boot": spec("spring-boot", "Spring Boot", "FRAMEWORK"),
  "org.springframework": spec("spring", "Spring", "FRAMEWORK"),
  hibernate: spec("hibernate", "Hibernate", "DATABASE"),
  junit: spec("junit", "JUnit", "TOOL"),
  "org.jetbrains.kotlin": spec("kotlin", "Kotlin", "LANGUAGE"),

  // .NET
  "microsoft.aspnetcore": spec("aspnet-core", "ASP.NET Core", "FRAMEWORK"),
  "microsoft.entityframeworkcore": spec("ef-core", "Entity Framework Core", "DATABASE"),
  "newtonsoft.json": spec("newtonsoft-json", "Newtonsoft.Json", "TOOL"),
  xunit: spec("xunit", "xUnit", "TOOL"),
  nunit: spec("nunit", "NUnit", "TOOL"),

  // PHP
  "laravel/framework": spec("laravel", "Laravel", "FRAMEWORK"),
  "symfony/framework-bundle": spec("symfony", "Symfony", "FRAMEWORK"),
  "phpunit/phpunit": spec("phpunit", "PHPUnit", "TOOL"),
  "doctrine/orm": spec("doctrine", "Doctrine", "DATABASE"),

  // Ruby
  rails: spec("rails", "Ruby on Rails", "FRAMEWORK"),
  sinatra: spec("sinatra", "Sinatra", "FRAMEWORK"),
  rspec: spec("rspec", "RSpec", "TOOL"),
  sidekiq: spec("sidekiq", "Sidekiq", "FRAMEWORK"),
  puma: spec("puma", "Puma", "RUNTIME"),
});

interface PrefixRule {
  readonly prefix: string;
  readonly spec: TechnologySpec;
}

/**
 * Prefix rules for dependency families whose leaf name varies (for example
 * `@angular/core`, `@angular/router`, `@angular/common`).
 */
const PREFIX_RULES: readonly PrefixRule[] = Object.freeze([
  { prefix: "@angular/", spec: spec("angular", "Angular", "FRAMEWORK") },
  { prefix: "@nestjs/", spec: spec("nestjs", "NestJS", "FRAMEWORK") },
  { prefix: "@sveltejs/", spec: spec("sveltekit", "SvelteKit", "FRAMEWORK") },
  { prefix: "@prisma/", spec: spec("prisma", "Prisma", "DATABASE") },
  { prefix: "@playwright/", spec: spec("playwright", "Playwright", "TOOL") },
  { prefix: "@tailwindcss/", spec: spec("tailwindcss", "Tailwind CSS", "TOOL") },
  { prefix: "org.springframework.", spec: spec("spring", "Spring", "FRAMEWORK") },
  { prefix: "microsoft.aspnetcore.", spec: spec("aspnet-core", "ASP.NET Core", "FRAMEWORK") },
  { prefix: "microsoft.entityframeworkcore.", spec: spec("ef-core", "Entity Framework Core", "DATABASE") },
  { prefix: "symfony/", spec: spec("symfony", "Symfony", "FRAMEWORK") },
  { prefix: "doctrine/", spec: spec("doctrine", "Doctrine", "DATABASE") },
]);

/** Normalizes a dependency name for rule lookup. */
export function normalizeDependencyName(name: string): string {
  return name.trim().toLowerCase();
}

/** Resolves a dependency name to a canonical technology, or `null`. */
export function technologySpecFor(name: string): TechnologySpec | null {
  const normalized = normalizeDependencyName(name);

  if (normalized.length === 0) {
    return null;
  }

  const exact = TECHNOLOGY_RULES[normalized];

  if (exact !== undefined) {
    return exact;
  }

  for (const rule of PREFIX_RULES) {
    if (normalized.startsWith(rule.prefix)) {
      return rule.spec;
    }
  }

  return null;
}

/** Builds a signature, deduplicating by technology key is the caller's job. */
export function toSignature(
  technology: TechnologySpec,
  versionSpec: string | null,
  confidence: number,
): TechnologySignature {
  return {
    key: technology.key,
    name: technology.name,
    kind: technology.kind,
    versionSpec,
    confidence,
  };
}

/**
 * Collects technologies from a list of dependency names, keeping the first
 * occurrence of each canonical key and preserving input order.
 */
export function collectTechnologies(
  dependencies: readonly { readonly name: string; readonly version: string | null }[],
  confidence: number,
  limit = 24,
): TechnologySignature[] {
  const seen = new Set<string>();
  const result: TechnologySignature[] = [];

  for (const dependency of dependencies) {
    if (result.length >= limit) {
      break;
    }

    const technology = technologySpecFor(dependency.name);

    if (technology === null || seen.has(technology.key)) {
      continue;
    }

    seen.add(technology.key);
    result.push(toSignature(technology, dependency.version, confidence));
  }

  return result;
}
