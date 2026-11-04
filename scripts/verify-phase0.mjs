import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const requiredFiles = [
  "README.md",
  "AGENTS.md",
  "package.json",
  "tsconfig.base.json",
  ".gitignore",
  ".editorconfig",
  ".npmrc",
  ".node-version",
  "docs/PHASE_0_AUDIT.md",
  "docs/ENGINEERING_PLAYBOOK.md",
  "docs/PRODUCT_SPEC.md",
  "docs/ARCHITECTURE.md",
  "docs/SECURITY.md",
  "docs/DATABASE.md",
  "docs/DISCOVERY.md",
  "docs/RELATIONSHIPS.md",
  "docs/API.md",
  "docs/TESTING.md",
  "docs/ROADMAP.md",
  "docs/DECISIONS.md",
  "apps/agent/README.md",
  "apps/dashboard/README.md",
  "packages/core/README.md",
  "tests/fixtures/README.md",
];

const failures = [];

for (const relativePath of requiredFiles) {
  try {
    const info = await stat(path.join(root, relativePath));
    if (!info.isFile()) {
      failures.push(`${relativePath}: expected a file`);
    }
  } catch {
    failures.push(`${relativePath}: missing`);
  }
}

for (const jsonPath of ["package.json", "tsconfig.base.json"]) {
  try {
    const text = await readFile(path.join(root, jsonPath), "utf8");
    JSON.parse(text);
  } catch (error) {
    failures.push(`${jsonPath}: invalid JSON (${error.message})`);
  }
}

const markdownFiles = requiredFiles.filter(
  (relativePath) => relativePath.endsWith(".md") || relativePath === "README.md",
);

const markdownLinkPattern = /\[[^\]]*]\(([^)]+)\)/g;

for (const relativePath of markdownFiles) {
  let text;
  try {
    text = await readFile(path.join(root, relativePath), "utf8");
  } catch {
    continue;
  }

  for (const match of text.matchAll(markdownLinkPattern)) {
    const target = match[1]?.trim();
    if (!target || target.startsWith("#") || /^[a-z]+:/i.test(target)) {
      continue;
    }

    const withoutAnchor = target.split("#")[0];
    const resolved = path.resolve(path.dirname(path.join(root, relativePath)), withoutAnchor);

    try {
      await stat(resolved);
    } catch {
      failures.push(`${relativePath}: broken link -> ${target}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Phase 0 verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Phase 0 verification passed: ${requiredFiles.length} required files, valid JSON, internal links resolved.`);
}
