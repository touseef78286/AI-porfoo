# Architecture

Status: **Target architecture defined. Runtime implementation not started.**
Last updated: 2026-11-04

## 1. Implemented reality

As of Gate 4 of Phase 1:

- The repository contains documentation, root metadata, configuration, two workspace manifests, scaffold files, a database layer, and the root/exclusion safety policy.
- `@lpi/core` exports identity constants plus pure path, deny, exclusion, glob, and sensitive-file rules. It imports no filesystem, database, or HTTP module.
- `@lpi/agent` exports an identity constant, the SQLite adapter, migration runner, migration 0001, backup/restore helpers, the filesystem root validator, and root/exclusion repositories.
- A pinned development toolchain is installed and verified: type check and 102 tests pass.
- Migration 0001 defines the Phase 1 discovery tables and is verified against in-memory and temporary file databases.
- Root validation canonicalizes real directories, rejects drive roots, system/credential locations, UNC paths, traversal segments, and reparse-point roots; exclusions are enforced by a core matcher and persisted per root.
- No runtime database file exists, no API exists, no scanner or traversal exists, no watcher exists.
- No application entry point starts a process and no public portfolio exists.

Everything below describes the approved target architecture for upcoming phases. It must not be presented as implemented until code and verification exist.

## 2. Architectural style

A **modular monolith local agent** plus a separately built private SPA.

```text
Windows host
┌──────────────────────────────────────────────────────────────┐
│ Authorized roots (user-configured only)                      │
│        │                                                     │
│        ▼                                                     │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ apps/agent (single Node.js process)                      │ │
│ │                                                          │ │
│ │  CLI / lifecycle                                         │ │
│ │      │                                                   │ │
│ │      ├── Discovery + detection orchestration             │ │
│ │      ├── Chokidar watcher + reconciliation scheduler     │ │
│ │      ├── Metadata / technology / dependency extraction   │ │
│ │      ├── Relationship engine orchestration               │ │
│ │      ├── SQLite repositories + migrations                │ │
│ │      ├── Fastify HTTP API on 127.0.0.1                   │ │
│ │      └── WebSocket event stream                          │ │
│ └───────────────┬──────────────────────────────────────────┘ │
│                 │ loopback HTTP/WS + token                    │
│                 ▼                                             │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ apps/dashboard (static React build)                      │ │
│ │  Overview · Explorer · Graph · Management · Scanner      │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘

Later, Phase 5:

approved project + allowlist sanitizer + schema validation
        │
        ▼
public snapshot (JSON/static assets)
        │
        ▼
apps/portfolio (separate deployment, no laptop dependency)
```

### Why not microservices

The workload is local, single-user, and resource-constrained. A single process with clear internal boundaries is easier to secure, observe, and run within 8 GB RAM. Separate processes are justified only by a measured requirement.

### Why not Docker

Docker adds a daemon, image storage, and memory overhead without solving a demonstrated local problem. SQLite and Node.js run natively on Windows.

## 3. Process and deployment model

### Development

- Agent: TypeScript executed with a fast TS runner and watch mode during development.
- Dashboard: Vite dev server on loopback, proxying `/api` and `/ws` to the agent.
- Tests: run sequentially or with a low worker count by default.
- Only one heavy server should run at a time on this machine unless measured otherwise.

### Local production

- Build agent to JavaScript.
- Build dashboard to static assets.
- Agent serves the static dashboard and loopback API from the same origin.
- A startup URL/one-time bootstrap token authorizes the browser session.
- Agent is manually started. Windows startup integration is deferred.

### Public

- A static snapshot is generated locally after approval and sanitization.
- The public app is deployed separately.
- The public app has no route, credential, or network path to the local agent.
- Cloud synchronization is not required for the first local release.

## 4. Workspace boundaries

```text
apps/agent
  src/cli              process lifecycle and commands
  src/config           validated environment and settings
  src/fs               root validation, traversal, bounded reads, reparse handling
  src/watcher          Chokidar setup, debounce queue, reconciliation
  src/scanner          orchestration and progress
  src/detection        adapter from filesystem evidence to core detectors
  src/extractors       manifest parsing and Git metadata adapters
  src/db               connection, migrations, repositories, transactions
  src/relationships    orchestration and persistence
  src/api              Fastify routes, auth, validation, error mapping
  src/events           typed WebSocket event publication
  src/logging          structured redacted logs

packages/core
  src/contracts        shared API/DTO schemas and types
  src/detection        pure detector modules and confidence scoring
  src/identity         identity candidates and resolution rules
  src/relationships    pure similarity/dependency evidence rules
  src/publication      allowlist sanitizer and public schema validation
  src/shared           result types, clocks/interfaces where useful

apps/dashboard
  src/app              routing and layout
  src/features         overview, explorer, graph, scanner, management
  src/api              typed client, auth bootstrap, WebSocket client
  src/components       shared visual components
  src/styles           design tokens and global styles

tests/fixtures
  generated and committed non-sensitive sample projects
```

Rules:

- `packages/core` must remain free of Node filesystem, Fastify, SQLite, and React imports.
- The dashboard imports contracts and pure display helpers, not persistence code.
- Agent route handlers delegate to services/repositories.
- The scanner does not write UI-shaped payloads directly; it writes domain records.
- Publication code lives with the publishing boundary, not in UI components.

## 5. Discovery data flow

1. User adds an authorized root through the API.
2. Root validator canonicalizes and rejects unsafe locations.
3. Scanner traverses with ignore rules, depth limits, and bounded concurrency.
4. Recognized manifests are read with size limits; source files are not read.
5. Pure detectors produce candidates, signatures, evidence, and confidence.
6. Nested-project resolver assigns roles: standalone, workspace root, member, or module.
7. Identity resolver matches path/stable identity to existing records.
8. Repository persists project, evidence, technologies, dependencies, and scan metrics in a transaction.
9. Relationship engine recomputes eligible inferred edges without overwriting manual/rejected states.
10. Event bus notifies the dashboard.
11. Scan history records what happened, including errors.

## 6. Incremental monitoring

- Chokidar watches authorized roots with a shared ignore policy.
- Relevant manifest events are debounced per project directory.
- Only the affected project is refreshed where possible.
- Delete events are confirmed before marking a project `MISSING`.
- Rename/move uses identity matching, not path alone.
- Periodic reconciliation runs independently of watcher events.
- A scan mutex prevents overlapping full scans.
- Resource ceilings stop runaway scans with an explicit error, not a silent truncation.

Detailed rules: [DISCOVERY.md](DISCOVERY.md).

## 7. Persistence

- SQLite database in a gitignored private data directory.
- WAL mode, foreign keys enabled, busy timeout, explicit transactions.
- Versioned SQL migrations applied at startup.
- Prepared statements only.
- Stable internal project IDs plus identity records.
- Local database is never exposed to the public app.

Detailed schema: [DATABASE.md](DATABASE.md).

## 8. Local API and events

- Fastify on `127.0.0.1` only.
- Bearer token for data-bearing requests.
- Host allowlist and Origin validation.
- Schema validation for every input.
- Structured errors with request IDs.
- WebSocket for scan/project/relationship updates.
- No generic filesystem endpoints.
- No browser CORS by default; explicit development origin only.

Detailed contracts: [API.md](API.md).

## 9. Relationship engine

Four classes:

1. Technology similarity (`INFERRED`).
2. Verified local dependency (`VERIFIED`).
3. Functional relationship (manual confirmation; suggestions unverified).
4. Manual relationship.

The engine is deterministic. Similarity and dependency use different types and UI treatments. AI is not required and may never create verified edges silently.

Detailed rules: [RELATIONSHIPS.md](RELATIONSHIPS.md).

## 10. Public publishing boundary

```text
private project
  → explicit approval for named fields
  → allowlist projection
  → secret/path/URL checks
  → public schema validation
  → immutable snapshot with hash
  → deployment/sync
```

Properties:

- Deny by default.
- Private by default.
- Public output contains no local paths, remotes, source, environment values, tokens, logs, or unapproved records.
- Snapshot generation works offline.
- The public app reads only the generated snapshot assets.
- Unpublish creates a new snapshot; it never mutates the local project.

## 11. Technology choices

| Area | Choice | Status |
|---|---|---|
| Runtime | Node.js 24.11.x | Verified available |
| Language | TypeScript strict mode | Planned |
| Package manager | npm workspaces | Chosen |
| HTTP | Fastify | Planned |
| WebSocket | Fastify WebSocket integration / `ws` | Planned |
| Filesystem watch | Chokidar | Planned |
| Database | SQLite via `node:sqlite` behind adapter | Provisional |
| Validation | Zod contracts in `packages/core` | Planned |
| Private UI | React + Vite | Planned |
| Graph | Evaluate React Flow first; benchmark before adding heavier 3D | Planned |
| Tests | Vitest plus integration/E2E tooling | Planned |
| Public UI | Deferred; likely static Next.js or static React | Not decided |
| External AI | Not required | Excluded from core |

Exact package versions will be resolved and recorded during Phase 1 installation. They must not be guessed in documentation.

## 12. Resource budget

Targets to be measured, not assumed:

- One agent process when idle.
- No duplicate watchers.
- No full-disk indexing.
- Bounded concurrency for traversal and parsing.
- Bounded manifest reads.
- Lazy-loaded graph and detail panels.
- Paginated API queries.
- Graph response caps with explicit truncation metadata.
- Low test worker count.
- Database WAL checkpointing and periodic vacuum strategy.
- No heavy animation bundles on the private dashboard.

Phase 6 will record actual scan duration, peak memory, CPU behavior, DB size, and watcher processing time.

## 13. Failure behavior

| Failure | Expected behavior |
|---|---|
| Root missing or inaccessible | Mark root unavailable; preserve projects; report error |
| Permission denied | Record bounded error; continue scan |
| Malformed manifest | Keep candidate with invalid metadata state; do not crash |
| Locked file | Retry within budget; record warning if unresolved |
| Watcher overflow/missed event | Queue reconciliation; expose health state |
| Database locked | Retry with bounded backoff; fail operation explicitly |
| Migration failure | Stop before serving; keep backup |
| API auth failure | Reject without data leakage |
| Public validation failure | Do not publish; show actionable error |
| Scan exceeds limits | Stop with explicit `LIMIT_EXCEEDED`; do not silently truncate |

## 14. Security architecture

See [SECURITY.md](SECURITY.md) for the threat model. Security is a boundary in the agent and publishing layers, not a UI-only concern.

## 15. Open architecture questions

1. Final SQLite driver after Phase 1 measurement (`node:sqlite` vs stable native driver).
2. Public hosting and whether Next.js is justified in Phase 5.
3. Graph library choice after actual dataset performance tests.
4. Whether Windows startup integration is desired after the local product is stable.
5. Data directory default for distribution versus this machine's `T:` volume.

These are intentionally unresolved until evidence exists.
