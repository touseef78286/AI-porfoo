# Roadmap and Engineering Status

Last updated: 2026-11-04

## Current state

| Item | Status |
|---|---|
| Phase 0 workspace audit | VERIFIED |
| Phase 0 architecture and documentation | IMPLEMENTED (this document set) |
| Phase 0 repository scaffold | IMPLEMENTED (metadata and docs only) |
| Engineering playbook | IMPLEMENTED (`docs/ENGINEERING_PLAYBOOK.md`) |
| Phase 1 implementation | IN PROGRESS — Gates 1–2 complete |
| Dependencies installed | MINIMAL PINNED TOOLCHAIN (92 packages) |
| Application code | SCAFFOLD ONLY |
| Tests executed | 1 SMOKE TEST PASSING |
| Git repository | NOT INITIALIZED |
| Public portfolio | NOT STARTED |

Phase 0 is complete and confirmed by the user. The workspace remains in a controlled pre-implementation state until Phase 1 is explicitly authorized.

## Phase 0 — Workspace audit and foundation

**Status: COMPLETE — confirmed by the user on 2026-11-04.**

Deliverables:

- Environment audit with measured evidence.
- Product specification.
- Architecture and boundaries.
- Security threat model.
- Database target design.
- Discovery/identity model.
- Relationship model.
- API plan.
- Testing plan.
- Persistent rules in `AGENTS.md`.
- Root configuration and workspace scaffold.

Verification performed:

- Workspace and hidden entries inspected.
- Runtime, package managers, Git, OS, CPU, RAM, and storage measured.
- npm registry reachability measured.
- `node:sqlite` capability smoke-tested.
- No external directories scanned.
- No runtime, test, lint, or build claims made.

Not done by design:

- No `npm install`.
- No database.
- No server.
- No scanner.
- No UI.
- No public app.
- No Git commit.

## Phase 1 — Discovery foundation

**Status: IN PROGRESS.**

Goal: discover real projects inside explicitly authorized roots and persist a traceable inventory.

### Completed gates

**Gate 1 — environment preparation (COMPLETE and VERIFIED).**

- Temporary directory `T:\My AI portfolio\.cache\tmp` created and verified with PowerShell `TEMP`/`TMP`, .NET, and Node.js `os.tmpdir()`.
- Node compile cache confirmed writing to the redirected `T:` temp directory.
- npm cache confirmed at `T:\npm-cache`.
- `C:` temp directory inspected; one locked stale file retained, two approved stale entries removed.
- Resources re-measured; Phase 0 documentation verified intact.
- Note: the npm `tmp` configuration key is rejected by npm 11.8.0, so temp redirection must be set per process via `TEMP`/`TMP`. This is not persisted in `.npmrc`.

**Gate 2 — workspace and toolchain (COMPLETE).**

- Workspace packages `@lpi/core` and `@lpi/agent` created with pinned manifests.
- Root `tsconfig.json` and `vitest.config.ts` added.
- Pinned toolchain installed with `--ignore-scripts`: TypeScript 5.9.3, `@types/node` 24.19.2, tsx 4.23.15, Vitest 5.1.0; runtime dependencies fastify 5.12.8 and zod 4.6.7 in `@lpi/agent`.
- `npm run typecheck`, `npm test`, and `npm run verify` executed successfully.
- Source code remains scaffold only: two identity constants and one smoke test.
- Build command intentionally deferred: no compiled artifact exists yet, and Phase 1 runs TypeScript through `tsx`/Vitest.

### Remaining work

Gates 3–8 below remain outstanding.

### Planned implementation

1. Create npm workspace packages and install a minimal, pinned toolchain.
2. Add TypeScript project configuration, shared contracts, and test runner.
3. Implement the SQLite adapter and migrations.
4. Implement root validation, canonicalization, deny rules, and exclusions.
5. Implement bounded manifest-only traversal.
6. Implement detector registry for the required ecosystems.
7. Implement confidence scoring, aggregation, and nested resolution.
8. Implement stable project identity and lifecycle states.
9. Persist projects, evidence, scan history, and errors.
10. Add CLI/manual scan entry point and minimal protected API endpoints needed to configure roots and inspect inventory.
11. Generate the full fixture suite and integration tests.
12. Record actual results and update documentation.

### Acceptance criteria

- A configured fixture root is scanned without reading outside it.
- All required fixture project types are detected correctly.
- Unknown/empty folders are not counted as projects.
- Multiple signatures in one directory do not duplicate a project.
- Nested workspaces are resolved deterministically and visibly.
- Malformed manifests do not crash the scan.
- Sensitive files are denied before read and never stored.
- Excluded directories are inaccessible to traversal.
- Projects receive stable IDs; path/identity behavior is tested.
- Scan history and errors persist.
- Type check, tests, and build pass, with actual output recorded.
- The database can be backed up and restored into a temporary file.
- No external development directory is scanned automatically.

### Verification commands

```powershell
npm run typecheck   # available and passing
npm test            # available and passing
npm run verify      # available and passing (typecheck + test + phase0)
npm run build       # NOT YET DEFINED: no compiled artifact exists in Phase 1
```

Targeted scanner/database integration tests will be listed after the scripts exist.

### Blocked/unknown items

- Final SQLite driver viability after backup tests.
- Windows symlink/junction privileges for fixture creation.
- Actual scan performance on this hardware.

## Phase 2 — Live monitoring

**Status: NOT STARTED.**

- Chokidar watchers per authorized root.
- Debounce and coalescing.
- New project detection.
- Metadata refresh.
- Rename/move identity resolution.
- Missing/restore lifecycle.
- Watcher pause/resume.
- Periodic reconciliation.
- Watcher error recovery.

Acceptance: creating a valid project inside a monitored fixture root updates the inventory without restarting the agent; injected missed events are repaired by reconciliation; duplicate watchers do not occur.

## Phase 3 — Project intelligence

**Status: NOT STARTED.**

- Technology fingerprinting.
- Declared/installed/used distinction.
- Dependency extraction across supported ecosystems.
- Similarity engine.
- Verified local dependency edges.
- Manual relationships.
- Evidence/confidence/state persistence.
- Recompute and rejection behavior.

Acceptance: every displayed edge has evidence and the correct class; similarity never appears as a dependency; tests cover all relationship rules.

## Phase 4 — Private dashboard

**Status: NOT STARTED.**

- Overview.
- Project explorer, search, filters.
- Project details and evidence.
- Interactive graph with zoom/pan/select/reset.
- Classification, exclusion/restore, overrides.
- Manual relationships.
- Scanner controls, roots, exclusions, progress, history, errors.
- Real API data only.

Acceptance: no production mock data; all sections work against the local API; graph performance is measured on the target machine.

## Phase 5 — Public portfolio

**Status: NOT STARTED.**

- Publication approval workflow.
- Allowlist sanitizer.
- Public schema.
- Snapshot generation and validation.
- Local preview.
- Optional cloud synchronization.
- Unpublish and history.
- Public app deployment.

Acceptance: only approved sanitized records appear; the public app works with the laptop offline and has no local API/database path.

## Phase 6 — Visual polish and optimization

**Status: NOT STARTED.**

- Refined private dashboard design.
- Cinematic public graph and restrained transitions.
- Responsive/accessibility pass.
- Performance profiling.
- Security audit.
- End-to-end verification on the target hardware.
- Final benchmark report.

Acceptance: complete system works reliably on the measured hardware and all security/performance claims have evidence.

## Cross-phase risks

| Risk | State | Action |
|---|---|---|
| Low free RAM | Open | Sequential heavy commands; measure; keep bundles small |
| Low free space on `C:` | Open | Keep artifacts/caches/data on `T:` |
| Experimental `node:sqlite` | Open | Adapter, backup tests, reconsider in Phase 1 |
| Windows watcher behavior | Open | Debounce + reconciliation; Windows-specific tests |
| Symlink/junction privileges | Partially known | Junction creation works; direct symbolic-link creation is blocked without elevation. Use junctions and report symlink cases `BLOCKED`. |
| Privacy leakage | Open | Approval + allowlist + negative tests |
| Graph performance | Unknown | Benchmark before choosing library/effects |

## Exact next engineering task

**Phase 1 — Discovery foundation, only when explicitly authorized.**

When authorized:

1. Initialize Git.
2. Create the npm workspace packages.
3. Install the minimal Phase 1 toolchain.
4. Implement migrations and the SQLite adapter.
5. Begin with root validation and fixture-root scanning.

Do not begin Phase 2 until Phase 1 acceptance is verified.
