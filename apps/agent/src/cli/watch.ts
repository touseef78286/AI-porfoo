/// <reference types="node" />
/**
 * Live monitoring watcher entry point.
 *
 * Starts the watcher service that monitors authorized roots and
 * emits WebSocket events for project creation, updates, status changes,
 * and lifecycle events.
 *
 * Usage:
 *   npm run watch
 *
 * The watcher will begin monitoring all authorized roots with watch_enabled=1,
 * emit events via WebSocket, and run periodic reconciliation every 5 minutes.
 * Press Ctrl+C to stop.
 */

import { openDevDatabase } from "../server.js";
import WatcherService from "../watcher.ts";

async function main(): Promise<void> {
  const database = openDevDatabase();

  const watcher = new WatcherService(database, database, {
    maxConcurrentScans: 4,
    debounceMs: 250,
    autoScanNewRoots: false,
  });

  console.log("Local Project Intelligence — Watcher starting…");
  console.log("State: IDLE — monitoring authorized roots");
  console.log("");

  // Start watching all roots that have watch_enabled=1
  const roots = database
    .prepare("SELECT id, canonical_path, display_path FROM project_roots WHERE watch_enabled = 1")
    .all() as any[];

  if (roots.length === 0) {
    console.log("No authorized roots found. Use `npm run scan -- \"<path>\"` to authorize a root.");
    database.close();
    process.exit(0);
  }

  for (const root of roots) {
    try {
      await watcher.addRoot(root.id, root.canonicalPath);
      console.log(`Watching root: ${root.displayPath}`);
    } catch (error) {
      console.error(`Failed to watch root ${root.id}: ${error}`);
    }
  }

  // Start all reconciliation timers
  watcher.startAllReconciliation();
  console.log("Reconciliation started (every 5 minutes)");

  console.log("");
  console.log("Watcher is running… press Ctrl+C to stop");
  console.log("");

  // Keep process running until interrupted
  // @ts-ignore - Node.js signal events
  process.on('SIGINT', async () => {
    console.log("\nStopping watcher…");
    await watcher.stop();
    database.close();
    process.exit(0);
  });
}

await main();