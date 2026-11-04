# Architecture Decision Records

Format: context, decision, consequences. Status values: proposed, accepted, provisional, superseded.

---

## ADR-001 — Modular monolith local agent

Date: 2026-11-04
Status: Accepted

### Context

The product is single-user, local-first, and must run on a laptop with limited RAM and storage. Discovery, persistence, and local API are tightly coupled by data flow.

### Decision

Use a single Node.js agent process with internal module boundaries for filesystem, scanning, detection, persistence, relationships, API, and events. Build the private dashboard as a separate static SPA.

### Consequences

- Simple startup and low idle overhead.
- One set of security controls for the local surface.
- Modules must be kept honest through tests and import boundaries.
- A separate worker or service requires a measured justification.

---

## ADR-002 — npm workspaces and TypeScript strict mode

Date: 2026-11-04
Status: Accepted

### Context

Node.js 24.11.0 and npm 11.8.0 are installed. npm's cache is on `T:`. pnpm is also installed, but adding a second package-manager workflow is unnecessary.

### Decision

Use npm workspaces with `apps/*` and `packages/*`. Use TypeScript strict mode with additional safety flags in `tsconfig.base.json`.

### Consequences

- Native npm commands work without extra bootstrapping.
- Lockfile and workspace dependency graph are auditable.
- `save-exact=true` and `engine-strict=true` improve reproducibility.
- Package scripts and build order must be defined explicitly in Phase 1.

---

## ADR-003 — SQLite via a narrow database adapter

Date: 2026-11-04
Status: Provisional

### Context

SQLite is required. Node 24.11.0 includes `node:sqlite`, which worked in an in-memory smoke test and exposes FTS5. It also emits an experimental warning and has no `backup` method on the tested object.

### Decision

Implement Phase 1 behind an internal database adapter using `node:sqlite`, with migrations, prepared statements, transactions, and `VACUUM INTO` backups. Re-evaluate during Phase 1 if stability, type support, or backup behavior is insufficient.

### Consequences

- No native addon or compiler requirement.
- Smaller dependency footprint.
- Experimental API risk is contained in one module.
- Node version must be pinned in the supported range.
- A later driver swap must not change domain code or SQL schema semantics.

Revisit trigger: any reproducible API instability, missing required feature, or unacceptable type/runtime behavior.

---

## ADR-004 — Private dashboard: React + Vite

Date: 2026-11-04
Status: Accepted

### Context

The private dashboard is authenticated, local, highly interactive, and not the public marketing surface. Running a server-rendered framework locally for the private UI adds build and memory overhead.

### Decision

Build the private dashboard with React and Vite. In production, serve the static build from the local agent. In development, use Vite with a loopback API proxy.

### Consequences

- Fast builds and small static output.
- Clear separation from the public application.
- Auth bootstrap and WebSocket integration must be designed for a SPA.
- Lazy loading is required for graph/heavy views.

---

## ADR-005 — Defer public portfolio implementation and hosting choice

Date: 2026-11-04
Status: Accepted

### Context

No existing portfolio architecture exists in the workspace. Public hosting has not been chosen. The first local release must not depend on cloud synchronization.

### Decision

Defer `apps/portfolio` until Phase 5. Generate and validate a static public snapshot locally first. Choose Next.js static export or another static stack only when hosting, SEO, and content requirements are known.

### Consequences

- Avoids installing a heavy framework before it is justified.
- Keeps Phase 1–4 focused on local reliability.
- Public schema and sanitizer must still be designed before Phase 5.
- The public app will never read the local database.

---

## ADR-006 — Local API authentication and anti-rebinding controls

Date: 2026-11-04
Status: Accepted

### Context

A loopback server is reachable by any local process and potentially by malicious web pages through the browser. Binding to `127.0.0.1` alone is not authentication.

### Decision

Use a high-entropy per-run bearer token for API and WebSocket access, validate the `Host` header against an exact allowlist, validate `Origin` for browser requests, and avoid permissive CORS. Bootstrap the dashboard through a one-time token flow that does not put the token in server access logs.

### Consequences

- Requires a deliberate browser bootstrap UX.
- Prevents casual cross-site access and DNS rebinding.
- Token file must be protected and gitignored.
- Tests must cover missing/invalid token, bad Host, bad Origin, and WebSocket auth.

---

## ADR-007 — Stable project identity with explicit uncertainty

Date: 2026-11-04
Status: Accepted

### Context

Paths change. Git remotes may be absent. Manifest names may collide. Silently merging unrelated projects destroys history; treating every move as a new project corrupts the inventory.

### Decision

Assign a stable internal UUID to each project. Maintain identity evidence separately:

1. Git canonical remote plus relative workspace path.
2. Manifest ecosystem/name when unique.
3. Canonical path when no stronger identity exists.

Path match is checked first for the same location. Strong identity can move a record when the match is unique. Ambiguous cases remain separate and require manual resolution.

### Consequences

- Rename/move can preserve history with evidence.
- No silent destructive merges.
- Additional identity table and reconciliation logic.
- Some moves will require manual resolution, which is acceptable and explicit.

---

## ADR-008 — Evidence-first relationship model

Date: 2026-11-04
Status: Accepted

### Context

Technology similarity is easy to compute but is not a dependency. Presenting it as one would be misleading.

### Decision

Store relationship class, method, evidence JSON, confidence, and verification state separately. Similarity edges are `INFERRED`; verified local dependency edges require manifest/path evidence. Functional edges require manual confirmation. AI may suggest but never verify.

### Consequences

- Graph UI can filter by evidence class.
- Relationship recomputation must preserve manual/rejected states.
- More schema and tests, but correct semantics.

---

## ADR-009 — No external AI dependency in core discovery

Date: 2026-11-04
Status: Accepted

### Context

The product must work offline, deterministically, and without sending private data to third parties. Paid APIs must not be introduced silently.

### Decision

Use deterministic parsers and rules for detection, dependency extraction, evidence, relationships, and publication validation. Do not send local source, secrets, or private metadata to an AI service. Any future AI-assisted description is opt-in, labeled as a suggestion, and reviewed before approval.

### Consequences

- Predictable behavior and no API cost.
- Some semantic grouping remains manual.
- Optional enrichment is a separate, explicit feature.

---

## ADR-010 — Private data directory outside source control

Date: 2026-11-04
Status: Accepted

### Context

The database contains local paths and project metadata. It must never be committed or included in public artifacts. The machine's `C:` drive has little free space.

### Decision

Store runtime data in a configurable private directory, defaulting during development to a gitignored directory under the workspace on `T:`. Production packaging will choose an application-data location and document it. The database and logs are excluded from Git and from public snapshots.

### Consequences

- `.data/` is ignored.
- Tests use temporary fixture databases, not the real inventory.
- Backups and retention are required.
- Path disclosure is limited to local logs/UI.

---

## ADR-011 — Public snapshots, not a live public API

Date: 2026-11-04
Status: Accepted

### Context

The public portfolio must work while the laptop is offline and must never expose the local system.

### Decision

Publish immutable, validated snapshots generated from approved records. The public app consumes only those assets. No public request reaches the local agent or database.

### Consequences

- Offline laptop is fine.
- Publishing is an explicit operation.
- Updates require a new snapshot and deployment/sync.
- Publication history and validation are required.

---

## ADR-012 — No Docker in the first release

Date: 2026-11-04
Status: Accepted

### Context

Docker is not needed for a single-user local agent and would consume storage and memory.

### Decision

Run natively on Windows. Reconsider only if a concrete deployment or isolation requirement appears.

### Consequences

- Simpler operations.
- Windows path, watcher, and symlink behavior must be handled directly.
- No container-based reproducibility; lockfiles and documented commands compensate.
