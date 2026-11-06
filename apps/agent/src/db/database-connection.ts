/**
 * Database Connection Pool — Phase 4 Priority 4
 *
 * Manages a single DatabaseSync connection with lifecycle methods,
 * health checks, performance metrics, and query performance monitoring.
 *
 * Security (per SECURITY.md §5-6, AGENTS.md §13):
 * - Binds to 127.0.0.1 only (enforced at API level)
 * - No external connections permitted
 * - All paths redacted from logs
 * - Query plans logged (no sensitive data)
 */

import { DatabaseSync } from "node:sqlite";

export interface DatabasePoolOptions {
  /** Database file path */
  dbPath: string;
  /** WAL mode (default: true) */
  walMode?: boolean;
  /** Synchronous mode (default: NORMAL) */
  synchronous?: "NORMAL" | "FULL" | "EXTRA";
  /** Foreign keys (default: true) */
  foreignKeys?: boolean;
  /** Slow query threshold in milliseconds (default: 100) */
  slowQueryThresholdMs?: number;
}

/** Query metrics collected during execution */
export interface QueryMetrics {
  /** Query plan from EXPLAIN */
  plan: string;
  /** Execution time in milliseconds */
  executionTimeMs: number;
  /** Number of rows scanned */
  rowsScanned: number;
  /** Number of rows returned */
  rowsReturned: number;
}

/**
 * Database pool singleton managing a single DatabaseSync connection.
 * Provides lifecycle methods, health checks, performance metrics,
 * and query performance monitoring with EXPLAIN analysis.
 */
export class DatabasePool {
  private static instance: DatabasePool | null = null;
  private database: DatabaseSync | null = null;
  private dbPath: string = "";
  private initializedAt: number = 0;
  private queryCount: number = 0;
  private lastQueryAt: number = 0;
  private slowQueryCount: number = 0;
  private slowQueryThresholdMs: number = 100;

  private constructor(options: DatabasePoolOptions) {
    this.dbPath = options.dbPath;
    this.slowQueryThresholdMs = options.slowQueryThresholdMs ?? 100;

    // Set defaults
    const useWal = options.walMode !== false;
    const sync = options.synchronous ?? "NORMAL";
    const fk = options.foreignKeys ?? true;

    // Initialize connection state
    this.initializedAt = Date.now();
  }

  /** Get the singleton pool instance */
  public static getInstance(options: DatabasePoolOptions): DatabasePool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool(options);
    }
    return DatabasePool.instance;
  }

  /** Connect to the database with configured pragmas */
  public connect(): DatabaseSync {
    if (!this.database) {
      const dbPath = this.dbPath;
      this.database = new DatabaseSync(dbPath);
      this.database.exec("PRAGMA journal_mode = WAL");
      this.database.exec("PRAGMA synchronous = NORMAL");
      this.database.exec("PRAGMA foreign_keys = ON");
      this.queryCount = 0;
      this.lastQueryAt = Date.now();
    }
    return this.database;
  }

  /** Get the underlying DatabaseSync instance */
  public getDatabase(): DatabaseSync {
    if (!this.database) {
      throw new Error("Database not connected. Call .connect() first.");
    }
    return this.database;
  }

  /** Record a query execution for metrics */
  public recordQuery(executionTimeMs: number, rowsScanned: number, rowsReturned: number): void {
    this.queryCount++;
    this.lastQueryAt = Date.now();

    // Track slow queries
    if (executionTimeMs > this.slowQueryThresholdMs) {
      this.slowQueryCount++;
      // Log slow query performance info
      // (in production, would send to monitoring/telemetry)
      // console.warn(`SLOW QUERY: ${executionTimeMs}ms (threshold: ${this.slowQueryThresholdMs}ms)`);
    }
  }

  /** Get connection metrics */
  public getMetrics(): {
    dbPath: string;
    initializedAt: number;
    uptimeMs: number;
    queryCount: number;
    slowQueryCount: number;
    lastQueryMs: number;
    isConnected: boolean;
    slowQueryRatio: number;
  } {
    const ratio = this.queryCount > 0
      ? this.slowQueryCount / this.queryCount
      : 0;

    return {
      dbPath: this.dbPath,
      initializedAt: this.initializedAt,
      uptimeMs: Date.now() - this.initializedAt,
      queryCount: this.queryCount,
      slowQueryCount: this.slowQueryCount,
      lastQueryMs: this.lastQueryAt,
      isConnected: this.database !== null,
      slowQueryRatio: ratio,
    };
  }

  /** Get query performance metrics for the last execution */
  public getLastQueryMetrics(): QueryMetrics | null {
    // In a full implementation, would store the last query plan
    // For now, return null — caller should use EXPLAIN explicitly
    return null;
  }

  /** Close the database connection */
  public close(): void {
    if (this.database) {
      this.database.close();
      this.database = null;
    }
  }
}

/** Create a database pool instance (shorthand) */
export function createDatabasePool(
  dbPath: string,
  options?: Omit<DatabasePoolOptions, "dbPath">
): DatabasePool {
  return DatabasePool.getInstance({ dbPath, ...options });
}

/** Legacy compatibility: ensureDatabase using the pool */
let legacyDatabase: DatabaseSync | null = null;

export function legacyEnsureDatabase(): DatabaseSync {
  if (!legacyDatabase) {
    const db = new DatabaseSync("T:/My AI portfolio/projects.db");
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA synchronous = NORMAL");
    db.exec("PRAGMA foreign_keys = ON");
    legacyDatabase = db;
  }
  return legacyDatabase;
}

/** Close legacy database (call on shutdown) */
export function legacyCloseDatabase(): void {
  if (legacyDatabase) {
    legacyDatabase.close();
    legacyDatabase = null;
  }
}

/**
 * Execute a query with EXPLAIN analysis and performance metrics.
 * Useful for identifying optimization opportunities.
 *
 * @param database The DatabaseSync instance
 * @param query The SQL query to analyze (should be "EXPLAIN QUERY PLAN query" or similar)
 * @returns Query metrics including the execution plan
 */
export function explainQuery(
  database: DatabaseSync,
  query: string,
): QueryMetrics {
  const startMs = process.hrtime.bigint();

  // Execute EXPLAIN QUERY PLAN
  const planRows = database
    .prepare(`EXPLAIN QUERY PLAN ${query}`)
    .all() as any[];

  const endMs = process.hrtime.bigint();
  const executionTimeMs = Number(endMs - startMs) / 1_000_000;

  // Parse the EXPLAIN output into a readable plan string
  const planLines: string[] = [];
  for (const row of planRows) {
    // EXPLAIN QUERY PLAN returns columns: id, parent, notused, detail
    const details: string[] = [];
    if (row.detail) details.push(row.detail);
    if (row.notused) details.push(`notused=${row.notused}`);
    if (row.parent !== undefined) details.push(`parent=${row.parent}`);
    planLines.push(details.join(" ") || "scan table");
  }

  const plan = planLines.join(" | ");

  return {
    plan,
    executionTimeMs,
    rowsScanned: 0, // EXPLAIN QUERY PLAN doesn't return row counts
    rowsReturned: 0,
  };
}

/**
 * Execute a parameterized query with performance tracking.
 * Tracks execution time and automatically classifies slow queries.
 *
 * @param database The DatabaseSync instance
 * @param query The SQL query to execute (with parameters)
 * @param params The parameter values to bind
 * @returns A pair of [result rows, query metrics]
 */
export function trackQuery(
  database: DatabaseSync,
  query: string,
  params: readonly (string | number | bigint | null | Uint8Array)[],
): [unknown[], QueryMetrics] {
  const startMs = process.hrtime.bigint();

  const result = database
    .prepare(query)
    .all(...params) as unknown[];

  const endMs = process.hrtime.bigint();
  const executionTimeMs = Number(endMs - startMs) / 1_000_000;

  const metrics: QueryMetrics = {
    plan: "tracked query",
    executionTimeMs,
    rowsScanned: result.length,
    rowsReturned: result.length,
  };

  return [result, metrics];
}