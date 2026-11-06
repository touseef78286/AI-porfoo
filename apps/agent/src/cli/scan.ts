/// <reference types="node" />
/**
 * Manual scan entry point.
 *
 * Usage:
 *   npm run scan -- "T:\path\to\authorized\root"
 *
 * The path argument is the explicit root authorization required by the
 * product's privacy rules. The CLI validates it, records it, and scans it.
 */

import { openDevDatabase } from "../server.js";
import { findRootByCanonicalPath, insertRoot, listRoots } from "../db/repositories/root-repository.js";
import type { ProjectRoot } from "../db/repositories/root-repository.js";
import { validateRootPath } from "../roots/validate-root.js";
import { scanRoot } from "../scan/scan-service.js";

async function main(): Promise<void> {
  const target = process.argv[2];

  if (target === undefined || target.trim().length === 0) {
    console.error('Usage: npm run scan -- "<absolute directory path>"');
    process.exitCode = 1;
    return;
  }

  const validation = validateRootPath(target);

  if (!validation.ok) {
    console.error(`Root rejected (${validation.code}): ${validation.message}`);
    process.exitCode = 1;
    return;
  }

  const database = openDevDatabase();

  try {
    const existing = findRootByCanonicalPath(database, validation.canonicalPath);
    let root: ProjectRoot;

    if (existing === undefined) {
      const id = `root_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
      insertRoot(database, {
        id,
        canonicalPath: validation.canonicalPath,
        displayPath: validation.displayPath,
      });

      const inserted = listRoots(database).find((candidate) => candidate.id === id);

      if (inserted === undefined) {
        throw new Error("Root was inserted but could not be read back");
      }

      root = inserted;
      console.log(`Authorized root: ${validation.displayPath}`);
    } else {
      root = existing;
      console.log(`Using authorized root: ${validation.displayPath}`);
    }

    console.log("Scanning (bounded traversal, manifest-only reads)…");
    const summary = await scanRoot({ database, root });

    console.log("");
    console.log("Scan completed");
    console.log(`  status          ${summary.status}`);
    console.log(`  duration        ${summary.durationMs} ms`);
    console.log(`  directories     ${summary.directoriesVisited}`);
    console.log(`  manifests       ${summary.manifestsSeen}`);
    console.log(`  projects seen   ${summary.projectsSeen}`);
    console.log(`  created         ${summary.projectsCreated}`);
    console.log(`  updated         ${summary.projectsUpdated}`);
    console.log(`  missing         ${summary.projectsMissing}`);
    console.log(`  errors          ${summary.errorsCount}`);
  } finally {
    database.close();
  }
}

await main();
