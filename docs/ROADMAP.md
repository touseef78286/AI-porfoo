# Roadmap and Engineering Status

Last updated: 2026-11-04

## Current state

| Item | Status |
|---|---|
| Phase 0 workspace audit | VERIFIED |
| Phase 0 architecture and documentation | IMPLEMENTED (this document set) |
| Phase 0 repository scaffold | IMPLEMENTED (metadata and docs only) |
| Engineering playbook | IMPLEMENTED (`docs/ENGINEERING_PLAYBOOK.md`) |
| Phase 1 implementation | IN PROGRESS — Gates 1–5 complete |
| Dependencies installed | MINIMAL PINNED TOOLCHAIN (92 packages) |
| Application code | DATABASE + ROOT POLICY + BOUNDED TRAVERSAL |
| Tests executed | 142 tests PASSING (15 files) |
| Git repository | INITIALIZED (`main`, 6 commits) |
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

**Gate 3 — database foundation (COMPLETE).**

- `node:sqlite` adapter in `apps/agent/src/db/connection.ts` applies `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`, and `synchronous=NORMAL`.
- Migration runner in `apps/agent/src/db/migration-runner.ts`: contiguous `NNNN_name.sql` files, SHA-256 checksums, one transaction per migration, rollback on failure, rejection of edited or missing migrations.
- `0001_discovery_schema.sql` creates the 12 Phase 1 tables plus `schema_migrations`.
- Deferred by design to later migrations: `relationships`, `publication_records`, `publication_snapshots`, `agent_settings`.
- Backup uses `VACUUM INTO`; restore copies to a new file and verifies `integrity_check`; overwriting an existing backup or database is refused.
- 25 database tests added; 26 tests pass across 5 files.
- No runtime database file exists yet: nothing writes one until scan orchestration lands in Gate 6.

**Gate 4 — root safety and exclusions (COMPLETE).**

- Pure domain rules in `@lpi/core` (no filesystem, database, or HTTP imports):
  - `roots/path-rules.ts`: separator normalization, comparison keys, absolute/drive-root/UNC detection, `..` traversal detection.
  - `roots/deny-rules.ts`: rejects UNC paths, drive roots, `C:\Windows`, `C:\Program Files`, `C:\ProgramData`, recycle/system-volume/recovery locations, the user profile root, `AppData`, and credential stores (`.ssh`, `.aws`, `.gnupg`, `.kube`, `.docker`, `secrets`, `credentials`, `.git-credentials`).
  - `roots/exclusions.ts`: the approved default ignore set, a case-insensitive `*`/`**`/`?` glob compiler, and a matcher that always evaluates system rules first and cannot be downgraded by a user rule.
  - `roots/sensitive-files.ts`: deny-before-read policy for `.env*`, `.npmrc`, `.netrc`, `.git-credentials`, `.pgpass`, SSH private keys, `credentials*`/`secrets*`, and `.pem`/`.key`/`.pfx`/`.p12`/`.jks`/`.kdbx`/`.gpg`/`.ppk` extensions, plus sensitive directories.
- Filesystem adapter in `apps/agent/src/roots/validate-root.ts`:
  - String rules run before any filesystem access, so denied locations are never probed.
  - Requires an existing absolute directory; rejects non-directories.
  - `lstat` first: a symbolic link or junction is rejected as a root with `REPARSE_ROOT` instead of being followed.
  - Canonicalizes with `realpathSync.native` and re-applies denial rules to the resolved path.
  - Also denies the machine's real system locations from the environment (`SystemRoot`, `windir`, `ProgramFiles`, `ProgramFiles(x86)`, `ProgramData`) and the profile root itself, so the policy holds when Windows or the profile is not on `C:`. Project folders inside a profile remain authorizable.
  - Stores the lowercase canonical comparison path while preserving the user's `displayPath`.
- Repositories over migration 0001: `root-repository.ts` (`insertRoot`, `findRootByCanonicalPath`, `listRoots`, `updateRootStatus`) and `exclusion-repository.ts` (`addExclusion`, `listExclusions`, `deleteUserExclusion`, `loadExclusionRulesForRoot`); system exclusions cannot be deleted.
- 76 tests added in this gate; the NTFS junction test executed on this machine (not skipped).
- Still absent at the end of this gate: traversal, scan orchestration, API, and any runtime database file.

**Gate 5 — bounded manifest-only traversal (COMPLETE).**

- Pure policy in `@lpi/core`:
  - `discovery/manifests.ts`: explicit signature table for Node, Python, Rust, Go, Dart, JVM, .NET, PHP, and Ruby, each marked `STRONG`/`SUPPORTING` and `readContent` true/false. Lockfile bodies are presence-only. `MANIFEST_MAX_BYTES` is 256 KiB.
  - `discovery/traversal-policy.ts`: approved defaults (`maxDepth` 12, 20,000 directories, 100,000 files, 120 s, concurrency 8, 200 errors) and `normalizeTraversalLimits`, which clamps overrides so no caller can request an unbounded scan. Result, error, and parser-state types mirror the database enums.
- Agent traversal in `apps/agent/src/discovery/`:
  - `traverseRoot` performs breadth-first traversal with bounded concurrency and an explicit queue.
  - Exclusions are evaluated before descending or opening; built-in rules are always applied.
  - Every entry is `lstat`ed; symbolic links and junctions are skipped, recorded as `REPARSE_POINT`, and returned in `skippedReparsePoints`.
  - Only allowlisted manifests are considered; readable ones are opened with `checkManifestRead` first, size-checked, read through a bounded buffer, and fingerprinted with SHA-256. Lockfiles are recorded without reading.
  - Budgets produce `LIMIT_EXCEEDED`; depth produces `DEPTH_LIMIT`; permission, disappearance, and resource failures are recorded generically without absolute paths, and traversal continues.
  - Results are sorted, so concurrent traversal is deterministic.
  - `traversal-io.ts` isolates filesystem access and error classification; it is also the test seam for permission failures on Windows.
- `listActiveRoots` was added so only `ACTIVE` roots are traversable.
- 37 tests added; 142 tests pass across 15 files.
- Self-check on this workspace: `COMPLETED`, 14 directories visited, 14 skipped, 34 files inspected, 5 manifests seen, 3 read, 116 ms, only `DEPTH_LIMIT` errors.
- Still absent: project detection/parsing, persistence of scan results, API, and any runtime database file.

### Remaining work

Gates 6–8 below remain outstanding.

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

**Phase 1 Gate 6 — ecosystem detectors and manifest parsing. Only when explicitly authorized.**

Gate 5 is complete and verified. Gate 6 must:

1. Parse only the bytes traversal already produced (`ManifestObservation`), never re-open arbitrary paths.
2. Handle JSON, TOML, YAML, and XML manifests with a bounded parser and no new heavyweight dependency unless measured necessary.
3. Return `INVALID` parser state for malformed content instead of throwing.
4. Map parsed fields to declarative detector output: ecosystem, primary language, framework/technology signals, and workspace declarations.
5. Keep detection rules pure in `@lpi/core`; parsing adapters may live in the agent.
6. Add malformed, empty, wrong-typed, and truncated-manifest fixtures.
7. Keep the 256 KiB read bound and add a parse-time budget.

Concretely: `package.json`, `pyproject.toml`, `requirements.txt`, `Pipfile`, `setup.py`, `Cargo.toml`, `go.mod`, `pubspec.yaml`, `pom.xml`, `build.gradle`/`.kts`, `*.csproj`, `*.sln`, `composer.json`, and `Gemfile`.

Do not begin Phase 2 until Phase 1 acceptance is verified.
