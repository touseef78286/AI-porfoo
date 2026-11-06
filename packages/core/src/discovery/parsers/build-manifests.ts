/**
 * Build-tool manifest detectors: Maven `pom.xml`, Gradle build scripts, and
 * .NET solution/project files.
 *
 * XML is inspected with targeted regular expressions rather than a DOM parser,
 * because only element text and a handful of attributes are needed and the
 * input is already size-bounded by the caller.
 */

import { collectTechnologies, toSignature } from "../technologies.js";
import { firstGroup, result } from "../manifest-types.js";
import type { Dependency, DetectorResult } from "../manifest-types.js";

/** Detects a JVM project declared in a Maven `pom.xml`. */
export function detectPom(raw: string): DetectorResult {
  const dependencies: Dependency[] = [];

  for (const match of raw.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
    const body = match[1] ?? "";
    const artifact = firstGroup(/<artifactId>([^<]+)<\/artifactId>/i, body);
    const group = firstGroup(/<groupId>([^<]+)<\/groupId>/i, body);
    const version = firstGroup(/<version>([^<]+)<\/version>/i, body);

    if (artifact !== null) {
      dependencies.push({ name: group === null ? artifact : `${group}.${artifact}`, version });
    }
  }

  const artifactId =
    firstGroup(/<\/parent>[\s\S]*?<artifactId>([^<]+)<\/artifactId>/i, raw) ??
    firstGroup(/<artifactId>([^<]+)<\/artifactId>/i, raw);

  return result("pom.xml", {
    ecosystem: "JAVA",
    projectName: artifactId,
    primaryLanguage: "Java",
    dependencies,
    confidence: 0.9,
  });
}

/** Detects a JVM project declared in a Gradle build script. */
export function detectGradle(raw: string, fileName: string): DetectorResult {
  const dependencies: Dependency[] = [];

  for (const match of raw.matchAll(
    /(?:implementation|api|compileOnly|runtimeOnly|testImplementation|kapt)\s*[("']+\s*([A-Za-z0-9_.-]+):([A-Za-z0-9_.-]+)(?::([^"')]+))?/g,
  )) {
    if (match[1] !== undefined && match[2] !== undefined) {
      dependencies.push({ name: `${match[1]}.${match[2]}`, version: match[3] ?? null });
    }
  }

  const kotlin =
    fileName.toLowerCase().endsWith(".kts") ||
    /org\.jetbrains\.kotlin|kotlin\("jvm"\)/i.test(raw);

  return result(fileName, {
    ecosystem: "JAVA",
    primaryLanguage: kotlin ? "Kotlin" : "Java",
    dependencies,
    confidence: 0.85,
  });
}

/** Detects a .NET solution or project file. */
export function detectDotnet(raw: string, fileName: string): DetectorResult {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".sln")) {
    return result(fileName, {
      ecosystem: "DOTNET",
      projectName: fileName.replace(/\.sln$/i, ""),
      primaryLanguage: "C#",
      confidence: 0.9,
    });
  }

  const dependencies: Dependency[] = [];

  for (const match of raw.matchAll(/<PackageReference\s+([^>]+)>?/g)) {
    const attributes = match[1] ?? "";
    const include = /Include\s*=\s*"([^"]+)"/i.exec(attributes)?.[1];
    const version = /Version\s*=\s*"([^"]+)"/i.exec(attributes)?.[1];

    if (include !== undefined) {
      dependencies.push({ name: include, version: version ?? null });
    }
  }

  const targetFramework = firstGroup(/<TargetFramework>([^<]+)<\/TargetFramework>/i, raw);
  const language = lower.endsWith(".fsproj")
    ? "F#"
    : lower.endsWith(".vbproj")
      ? "VB.NET"
      : "C#";

  const technologies = collectTechnologies(dependencies, 0.85);

  if (targetFramework !== null) {
    technologies.push(
      toSignature({ key: "dotnet", name: ".NET", kind: "RUNTIME" }, targetFramework, 0.85),
    );
  }

  return result(fileName, {
    ecosystem: "DOTNET",
    projectName: fileName.replace(/\.(cs|fs|vb)proj$/i, ""),
    primaryLanguage: language,
    dependencies,
    technologies,
    confidence: 0.9,
  });
}
