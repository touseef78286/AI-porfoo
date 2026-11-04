# Testing and Verification

Status: **Strategy defined. No application tests exist or have been run.**
Last updated: 2026-11-04

## 1. Testing principles

- Test actual behavior, not intended behavior.
- Use generated, non-sensitive fixtures.
- Never point tests at personal development directories.
- Never execute scripts from fixtures.
- Prefer deterministic tests with controlled clocks and temporary directories.
- Report failures accurately.
- A skipped symlink/junction test is `BLOCKED` or `SKIPPED` with a reason, never an implicit pass.
- No test may silently write outside the workspace temp directory.

## 2. Test levels

### Unit tests

Pure domain logic in `packages/core`:

- Signature weights and confidence thresholds.
- Directory aggregation.
- Nested/workspace resolution.
- Identity candidate selection.
- Manifest parsing adapters with bounded input.
- Technology normalization.
- Dependency extraction.
- Similarity scoring and edge canonicalization.
- Local dependency resolution.
- Publication allowlist sanitizer.
- Public schema validation.

### Integration tests

Agent adapters and persistence:

- SQLite migrations and foreign keys.
- WAL and busy behavior.
- Transactions and rollback.
- Root validation.
- Filesystem traversal with ignore rules.
- Sensitive-file denial.
- Reparse-point behavior.
- Scan persistence and history.
- API auth, Host/Origin, validation, rate limits.
- WebSocket handshake and event envelope.
- Watcher event coalescing and reconciliation.

### End-to-end tests

- Start the agent against a temporary fixture root.
- Discover projects.
- Query the API.
- Render the dashboard against the real local API.
- Create a project after startup and observe the update.
- Approve and publish a fixture project.
- Stop the agent and verify the public build still serves the snapshot.

## 3. Required fixtures

The fixture suite must cover all 20 requested cases.

| # | Fixture | Expected behavior |
|---|---|---|
| 1 | Valid React project | Detected as `PROBABLE`/`CONFIRMED`; React declared |
| 2 | Valid Next.js project | Detected; Next.js framework evidence |
| 3 | Valid Python project | Detected via `pyproject.toml`/requirements |
| 4 | Valid Flutter project | Detected via `pubspec.yaml` |
| 5 | Unknown folder | Not inventoried as a project |
| 6 | Empty folder | Not inventoried |
| 7 | Nested monorepository | Workspace root and members resolved deterministically |
| 8 | Multiple apps in one repo | Separate members, no duplicate parent count |
| 9 | Duplicate project signatures | One project per directory, multiple evidence rows |
| 10 | Missing configuration files | Only valid signatures create candidates |
| 11 | Malformed `package.json` | No crash; invalid parser state; review-visible |
| 12 | Restricted-access directory | Error recorded; scan continues |
| 13 | Symbolic link / junction | Not followed outside root; explicit result |
| 14 | Project rename | Identity preserved when evidence permits |
| 15 | Project deletion | Marked missing, history retained |
| 16 | Project restoration | Restored link to same record when identity matches |
| 17 | Excluded directory | Never descended/read |
| 18 | Sensitive files | Values never read/stored/logged |
| 19 | Shared local dependency | Verified directed edge with evidence |
| 20 | Technology-only similarity | Inferred similarity, never verified dependency |

Additional fixtures:

- Workspace with ambiguous member identity.
- Two projects with the same manifest name.
- Invalid/oversized manifest.
- Reparse point inside a root.
- Publication candidate with a private path and token-like string.
- Unapproved project adjacent to an approved project.
- Malformed public payload.

## 4. Security test matrix

- Missing token → 401.
- Invalid token → 401.
- Valid token, bad Host → rejected.
- Valid token, bad Origin → rejected.
- Valid token, valid Origin → accepted.
- No arbitrary path route exists.
- Project-open with a forged path parameter → rejected.
- Path traversal in root/exclusion input → rejected.
- Junction/symlink escape → skipped/blocked.
- `.env`, key, and credential fixtures never enter the DB.
- Oversized manifest → bounded error.
- Malformed JSON/TOML → no crash.
- SQL injection payload in search → treated as data.
- Rate limit triggers on repeated scans.
- Public snapshot contains no local paths, remotes, tokens, or unapproved records.
- Public build has no local API URL or dependency.

## 5. Windows-specific tests

- Paths with spaces and drive letters.
- Case-insensitive path comparisons.
- UNC paths rejected unless explicitly supported.
- Long paths where enabled; otherwise a documented bounded error.
- Junction and symbolic-link behavior.
- Locked files.
- Chokidar duplicate and rename events.
- Watcher overflow/reconciliation recovery.

Tests must run under Windows PowerShell without Linux-only commands.

## 6. Test data policy

- Fixtures are generated under a temporary directory or committed with fake content.
- No real secrets, personal paths, or copied source code.
- Sensitive-file fixtures contain unmistakably fake values and are still denied before read.
- Fixture project scripts, if present, are never executed.
- Tests must clean up temporary files, even on failure.

## 7. Commands

Available and executed in this workspace:

```powershell
npm run typecheck   # tsc -p tsconfig.json --noEmit
npm test            # vitest run --maxWorkers=2
npm run verify      # typecheck + test + phase 0 documentation check
npm run verify:phase0
```

Not yet available:

```powershell
npm run lint        # no lint configuration exists
npm run build       # no compiled artifact exists in Phase 1
```

Additional targeted commands will be documented with the package scripts. Do not report a command as passing until it has actually been executed.

## 8. Coverage expectations

- Core detection/identity/relationship logic: high branch coverage.
- API auth and path validation: mandatory tests.
- Publication sanitizer: mandatory allowlist and negative tests.
- UI: critical flows and empty/error/loading states, not pixel-perfect snapshots alone.
- Integration tests are preferred over excessive mocking.

Coverage numbers alone are not acceptance evidence.

## 9. Performance and resource verification

Benchmark on the actual target machine, separately from correctness tests:

- Fixture scan duration.
- Projects discovered.
- Files/directories inspected.
- Peak process memory where measurable.
- CPU behavior where measurable.
- Database size before/after scan.
- Watcher event processing latency.
- API response time for list/search/graph.
- Dashboard initial load and graph render.

Avoid concurrent heavy processes during measurement. Record the methodology and any anomalies. Do not invent performance claims.

## 10. Verification record

### Phase 0 — executed checks

| Check | Result |
|---|---|
| Workspace listing, including hidden entries | VERIFIED: empty before Phase 0 |
| Git repository state | VERIFIED: not a repository |
| Node.js version | VERIFIED: v24.11.0 |
| npm version | VERIFIED: 11.8.0 |
| pnpm version | VERIFIED: 10.34.5 |
| Yarn/Bun availability | VERIFIED: not installed |
| Git version | VERIFIED: 2.51.2.windows.1 |
| PowerShell version | VERIFIED: 5.1.26100.9444 |
| OS/CPU/memory/storage | VERIFIED via WMI and Node `os` |
| npm registry reachability | VERIFIED: PONG |
| `node:sqlite` in-memory smoke test | VERIFIED: query returned `{x:1}`; experimental warning |
| SQLite FTS5 availability | VERIFIED via compile options |
| NTFS junction creation | VERIFIED: created, detected, and removed in workspace temp |
| Direct symbolic-link creation | BLOCKED: administrator privilege required |
| Developer Mode / long-path configuration | VERIFIED absent/not configured |
| Application tests | NOT APPLICABLE: no application code |
| Type check / lint / build | NOT APPLICABLE: no source or scripts yet |

### Phase 1 — Gate 1 and Gate 2 executed checks

| Check | Result |
|---|---|
| `T:` temp directory creation | VERIFIED: `T:\My AI portfolio\.cache\tmp` |
| PowerShell `TEMP`/`TMP` redirect | VERIFIED within the process |
| .NET `Path::GetTempPath()` | VERIFIED: resolved to `T:` path |
| Node.js `os.tmpdir()` with redirected env | VERIFIED: resolved to `T:` path |
| Node compile cache actually written to `T:` | VERIFIED: `node-compile-cache` created under `.cache\tmp` |
| npm cache location | VERIFIED: `T:\npm-cache` |
| npm `tmp` project config | FAIL: npm 11.8.0 reports "Unknown project config tmp"; reverted |
| `C:` temp cleanup | PARTIAL: 2 of 3 approved entries removed; `wctDEBD.tmp` was locked and retained |
| Phase 0 documentation integrity | VERIFIED: 24 required files, valid JSON, links resolved |
| Dependency installation | VERIFIED: 92 packages, exit 0, `--ignore-scripts`, temp redirected |
| Disk cost of installation | VERIFIED: `C:` −139,264 B (noise); `T:` −173,531,136 B including npm cache growth |
| `npm run typecheck` | PASS: exit 0 |
| `npm test` | PASS: 1 file, 1 test, 247 ms |
| `npm run verify` | PASS: exit 0 |
| `npm run build` | NOT DEFINED: no compiled artifact in Phase 1 |

### Phase 1 — Gate 3 executed checks

Executed on 2026-11-04 with Vitest 5.1.0, 2 workers, 12.07 s and 11.55 s runs.

| Check | Result |
|---|---|
| `npm run typecheck` | PASS: exit 0 |
| `npm test` | PASS: 5 files, 26 tests |
| `npm run verify` | PASS: exit 0, Phase 0 documentation check included |
| Migration from empty database | PASS |
| Idempotent re-apply | PASS |
| Checksum tampering rejected | PASS |
| Missing-migration detection | PASS |
| Failing migration rollback | PASS |
| WAL / foreign keys / busy timeout | PASS |
| Foreign key violation rejected | PASS |
| Transaction rollback | PASS |
| Duplicate project path rejected | PASS |
| CHECK constraint enforcement | PASS |
| `VACUUM INTO` backup | PASS |
| Restore integrity and row parity | PASS |
| Backup/restore overwrite protection | PASS |
| Sensitive-column scan of all tables | PASS |
| Test artifact cleanup | VERIFIED: `.cache/test-tmp` empty, zero stray `.db` files |

### Phase 1 — Gate 4 executed checks

Executed on 2026-11-04 with Vitest 5.1.0, 2 workers; full suite 18.72 s, `npm run verify` 16.31 s.

| Check | Result |
|---|---|
| `npm run typecheck` | PASS: exit 0 |
| `npm test` | PASS: 11 files, 102 tests |
| `npm run verify` | PASS: exit 0, Phase 0 documentation check included |
| Drive root rejection (`C:\`, `T:\`, `C:/`, `c:`) | PASS: `DRIVE_ROOT` |
| UNC path rejection | PASS: `UNC_PATH` |
| System directory rejection (`C:\Windows`, `Program Files`, `ProgramData`) | PASS: `SYSTEM_DIRECTORY` |
| User profile root rejection | PASS: `USER_PROFILE_ROOT` |
| `AppData` and credential-store rejection | PASS: `CREDENTIAL_STORE` |
| Repository/dependency internals as root (`.git`, `node_modules`) | PASS: `IGNORED_DIRECTORY` |
| Valid project directory accepted | PASS: canonical path returned |
| Trailing separator and forward-slash variants collapse to one identity | PASS |
| Empty / relative / nonexistent / file input rejected | PASS: `EMPTY`, `NOT_ABSOLUTE`, `NOT_FOUND`, `NOT_DIRECTORY` |
| `..` traversal segment rejected before filesystem access | PASS: `TRAVERSAL` |
| NTFS junction rejected as a root and detected as a reparse point | PASS: executed, not skipped |
| Default ignore set applied at any depth | PASS |
| User `DIRECTORY` / `PATH` / `GLOB` rules | PASS |
| System rule precedence over an equivalent user rule | PASS |
| Recursive glob `**/` matches whole segments only | PASS |
| Sensitive name/extension/directory denied before read | PASS |
| Root repository insert, duplicate rejection, lookup, ordering, status update | PASS |
| Exclusion repository persistence, global vs root scoping, system-delete refusal | PASS |
| Test artifact cleanup | VERIFIED: `.cache/test-tmp` empty |

Two defects were found and fixed during this gate rather than worked around:

- `globToRegExp("src/**/test")` incorrectly matched `src/atest` because `**/` was translated as `.*(?:/)?`. Translated to `(?:.*/)?` so `**/` consumes zero or more complete segments.
- A traversal test used `path.join`, which normalizes `..` away, so the validator never saw the segment. The test now builds the raw path string; the production rule was correct all along.

## 11. Known test limitations

- The machine has low free RAM; test concurrency must remain bounded.
- Direct symbolic-link creation is blocked without administrator privilege on the audited machine. Junction creation works. Tests must use junctions for normal local fixtures and report direct symlink cases as `BLOCKED`.
- Windows Developer Mode is not enabled and Git `core.longpaths` is not configured; long-path behavior must be measured, not assumed.
- `node:sqlite` is experimental; backup/restore must be explicitly tested.
- No Git repository was initialized during the audit; history starts after Phase 0 setup.
- Automated test execution is available as of Gate 2 (Vitest). As of Gate 4, 102 tests cover the database layer, root/exclusion policy, and sensitive-file denial. Traversal, detection, identity, and API behavior remain untested because they do not exist.

## 12. Definition of verified

A feature may be described as `VERIFIED` only when:

1. The relevant test or command was executed in this workspace or against this machine.
2. The actual output was inspected.
3. Failures and skips are reported.
4. Documentation matches the observed behavior.
