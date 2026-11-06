import { describe, expect, it } from "vitest";

import { parseManifest } from "../../src/discovery/manifest-parser.js";

function parse(raw: string, fileName: string) {
  const result = parseManifest(raw, fileName);

  if (result === null) {
    throw new Error(`Expected ${fileName} to be recognized`);
  }

  return result;
}

describe("Node manifests", () => {
  it("detects a TypeScript project and its frameworks", () => {
    const result = parse(
      JSON.stringify({
        name: "dashboard",
        version: "1.0.0",
        scripts: { build: "vite build" },
        dependencies: { react: "^18.2.0", fastify: "^5.0.0" },
        devDependencies: { typescript: "^5.4.0", vitest: "^5.0.0" },
      }),
      "package.json",
    );

    expect(result.ecosystem).toBe("NODE");
    expect(result.projectName).toBe("dashboard");
    expect(result.primaryLanguage).toBe("TypeScript");
    expect(result.detectionState).toBe("CONFIRMED");
    expect(result.technologies.map((technology) => technology.key)).toEqual(
      expect.arrayContaining(["react", "fastify", "typescript", "vitest", "node"]),
    );
  });

  it("detects a private workspace package without a version or scripts", () => {
    const result = parse(
      JSON.stringify({
        name: "@acme/core",
        private: true,
        type: "module",
        dependencies: { zod: "^3.23.0" },
      }),
      "package.json",
    );

    expect(result.ecosystem).toBe("NODE");
    expect(result.projectName).toBe("@acme/core");
    expect(result.detectionState).toBe("CONFIRMED");
    expect(result.primaryLanguage).toBe("JavaScript");
  });

  it("treats engines.node as a runtime constraint, not a language", () => {
    const result = parse(
      JSON.stringify({
        name: "runtime-range",
        engines: { node: ">=20 <21" },
      }),
      "package.json",
    );

    expect(result.primaryLanguage).toBe("JavaScript");
    expect(result.primaryLanguage).not.toContain("20");

    const node = result.technologies.find((technology) => technology.key === "node");
    expect(node?.versionSpec).toBe(">=20 <21");
  });

  it("flags malformed JSON as INVALID instead of throwing", () => {
    const result = parse('{ "name": "broken",, }', "package.json");

    expect(result.detectionState).toBe("INVALID");
    expect(result.ecosystem).toBe("UNKNOWN");
  });
});

describe("Python manifests", () => {
  it("detects a pyproject project with PEP 621 dependencies", () => {
    const result = parse(
      [
        "[project]",
        'name = "analytics-api"',
        'dependencies = ["fastapi>=0.110", "pydantic>=2"]',
        "",
        "[build-system]",
        'requires = ["setuptools>=68"]',
      ].join("\n"),
      "pyproject.toml",
    );

    expect(result.ecosystem).toBe("PYTHON");
    expect(result.projectName).toBe("analytics-api");
    expect(result.primaryLanguage).toBe("Python");
    expect(result.technologies.map((technology) => technology.key)).toEqual(
      expect.arrayContaining(["fastapi", "pydantic"]),
    );
  });

  it("detects a poetry project", () => {
    const raw = [
      "[tool.poetry]",
      'name = "worker"',
      "",
      "[tool.poetry.dependencies]",
      'python = "^3.11"',
      'celery = "^5.3"',
    ].join("\n");

    const result = parse(raw, "pyproject.toml");

    expect(result.projectName).toBe("worker");
    expect(result.technologies.map((technology) => technology.key)).toContain("celery");
  });

  it("detects requirements.txt dependencies and skips comments", () => {
    const result = parse(
      ["# runtime", "django>=4.2", "requests[socks]==2.31.0", "-e .", ""].join("\n"),
      "requirements.txt",
    );

    expect(result.ecosystem).toBe("PYTHON");
    expect(result.technologies.map((technology) => technology.key)).toEqual(["django"]);
  });

  it("does not mislabel a pyproject file as Rust", () => {
    const result = parse('[project]\nname = "x"\n', "pyproject.toml");

    expect(result.ecosystem).toBe("PYTHON");
  });
});

describe("other ecosystems", () => {
  it("detects Rust from Cargo.toml", () => {
    const result = parse(
      ['[package]', 'name = "engine"', 'version = "0.1.0"', "", "[dependencies]", 'axum = "0.7"'].join(
        "\n",
      ),
      "Cargo.toml",
    );

    expect(result.ecosystem).toBe("RUST");
    expect(result.projectName).toBe("engine");
    expect(result.primaryLanguage).toBe("Rust");
    expect(result.technologies.map((technology) => technology.key)).toContain("axum");
  });

  it("detects Go from go.mod, including require blocks", () => {
    const result = parse(
      ["module example.com/service", "", "go 1.22", "", "require (", "\tgithub.com/gin-gonic/gin v1.9.0", ")"].join(
        "\n",
      ),
      "go.mod",
    );

    expect(result.ecosystem).toBe("GO");
    expect(result.projectName).toBe("example.com/service");
    expect(result.primaryLanguage).toBe("Go");
    expect(result.technologies.map((technology) => technology.key)).toContain("gin");
  });

  it("detects Dart from pubspec.yaml without duplicating nested SDK keys", () => {
    const result = parse(
      ['name: mobile_app', "dependencies:", "  flutter:", "    sdk: flutter", "  dio: ^5.4.0"].join("\n"),
      "pubspec.yaml",
    );

    expect(result.ecosystem).toBe("DART");
    expect(result.projectName).toBe("mobile_app");
    expect(result.technologies.map((technology) => technology.key)).toEqual(
      expect.arrayContaining(["flutter", "dio"]),
    );
    expect(result.technologies.map((technology) => technology.key)).not.toContain("sdk");
  });

  it("detects Java from pom.xml", () => {
    const result = parse(
      [
        "<project>",
        "  <artifactId>billing</artifactId>",
        "  <dependencies>",
        "    <dependency>",
        "      <groupId>org.springframework.boot</groupId>",
        "      <artifactId>spring-boot-starter-web</artifactId>",
        "      <version>3.2.0</version>",
        "    </dependency>",
        "  </dependencies>",
        "</project>",
      ].join("\n"),
      "pom.xml",
    );

    expect(result.ecosystem).toBe("JAVA");
    expect(result.projectName).toBe("billing");
    expect(result.primaryLanguage).toBe("Java");
    expect(result.technologies.map((technology) => technology.key)).toContain("spring");
  });

  it("detects Kotlin from build.gradle.kts", () => {
    const result = parse(
      ['plugins { kotlin("jvm") version "2.0.0" }', 'implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.0")'].join(
        "\n",
      ),
      "build.gradle.kts",
    );

    expect(result.ecosystem).toBe("JAVA");
    expect(result.primaryLanguage).toBe("Kotlin");
  });

  it("detects .NET from a csproj and records the target framework", () => {
    const result = parse(
      [
        '<Project Sdk="Microsoft.NET.Sdk">',
        "  <PropertyGroup>",
        "    <TargetFramework>net8.0</TargetFramework>",
        "  </PropertyGroup>",
        "  <ItemGroup>",
        '    <PackageReference Include="Microsoft.EntityFrameworkCore" Version="8.0.0" />',
        "  </ItemGroup>",
        "</Project>",
      ].join("\n"),
      "Service.csproj",
    );

    expect(result.ecosystem).toBe("DOTNET");
    expect(result.projectName).toBe("Service");
    expect(result.primaryLanguage).toBe("C#");
    expect(result.technologies.map((technology) => technology.key)).toEqual(
      expect.arrayContaining(["ef-core", "dotnet"]),
    );
  });

  it("detects PHP from composer.json", () => {
    const result = parse(
      JSON.stringify({
        name: "acme/shop",
        require: { php: "^8.2", "laravel/framework": "^10.0" },
      }),
      "composer.json",
    );

    expect(result.ecosystem).toBe("PHP");
    expect(result.projectName).toBe("acme/shop");
    expect(result.primaryLanguage).toBe("PHP");
    expect(result.technologies.map((technology) => technology.key)).toContain("laravel");
  });

  it("detects Ruby from a Gemfile", () => {
    const result = parse(
      ['source "https://rubygems.org"', 'gem "rails", "~> 7.1"', 'gem "puma"'].join("\n"),
      "Gemfile",
    );

    expect(result.ecosystem).toBe("RUBY");
    expect(result.primaryLanguage).toBe("Ruby");
    expect(result.technologies.map((technology) => technology.key)).toEqual(
      expect.arrayContaining(["rails", "puma"]),
    );
  });
});

describe("parser boundaries", () => {
  it("returns null for filenames that are not allowlisted", () => {
    expect(parseManifest("anything", "notes.txt")).toBeNull();
    expect(parseManifest("anything", ".env")).toBeNull();
    expect(parseManifest("anything", "package-lock.json")).toBeNull();
  });

  it("never reads lockfile bodies", () => {
    expect(parseManifest('{"lockfileVersion": 3}', "package-lock.json")).toBeNull();
  });
});
