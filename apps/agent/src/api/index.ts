/// <reference types="node" />
/**
 * Development server entry point.
 *
 * Starts the loopback API and dashboard on http://127.0.0.1:3001 and opens the
 * default browser unless LPI_NO_OPEN=1.
 */

import { spawn } from "node:child_process";

import { startServer } from "../server.js";

const started = await startServer();

// eslint-disable-next-line no-console
console.log("");
// eslint-disable-next-line no-console
console.log("  Local Project Intelligence");
// eslint-disable-next-line no-console
console.log(`  ${started.url}`);
// eslint-disable-next-line no-console
console.log("  Loopback only · Bearer-authenticated · Host and Origin validated");
// eslint-disable-next-line no-console
console.log("");

if (process.env.LPI_NO_OPEN !== "1") {
  try {
    spawn("cmd", ["/c", "start", "", started.url], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }).unref();
  } catch {
    // Opening a browser is a convenience; the printed URL is authoritative.
  }
}

async function shutdown(): Promise<void> {
  await started.server.close();
  started.database.close();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
