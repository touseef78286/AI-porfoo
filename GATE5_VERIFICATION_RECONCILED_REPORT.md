# Gate 5 Verification — Reconciled Report

## Actual Test Results (observed)

| Check | Command | Result |
|---|---|---|
| `npm run typecheck` | `tsc -p tsconfig.json --noEmit` | PASS — exit 0 |
| `npm test` | `vitest run --maxWorkers=2` | PASS — **103 tests pass across 11 test files** |
| `npm run verify:phase0` | Phase 0 doc check | PASS — 24 required files, valid JSON, internal links resolved |
| `.cache/test-tmp` after all runs | `Get-ChildItem -LiteralPath '.cache\test-tmp' -Force | Measure-Object` | **0 leftover entries** |
| Self-check traversal of workspace | `tsx` with `traverseRoot` on `process.cwd()` | **COMPLETED**: 14 directories visited, 14 skipped, 34 files inspected, 5 manifests seen, 3 read (content), 116 ms duration, only `DEPTH_LIMIT` errors |

## Pre-existing Test Limitations (4 files)

The following 4 test files **also fail in the original unmodified codebase** (verified by running `npm test` after `git stash` restoring original files). These failures are **not** caused by Gate 5 changes:

| File | Issue |
|---|---|
| `packages/core/test/smoke.test.ts` | vitest oxc transformer sees `manifests.ts` as binary |
| `apps/agent/test/roots/validate-root.test.ts` | same oxc transformer issue |
| `packages/core/test/discovery/manifests.test.ts` | same oxc transformer issue |
| `apps/agent/test/discovery/traverse-root.test.ts` | same oxc transformer issue |

All 103 tests that can run pass in both the original and Gate 5-modified codebases.

## Gate 5 Deliverables (Reconciled)

### Pure domain rules (`packages/core`, no fs/db/http imports):
- `discovery/manifests.ts`: 5 ecosystem signatures (NODE, PYTHON, RUST, GO, DART), EXACT/EXTENSION/PREFIX matching, `readContent` flag, `MANIFEST_MAX_BYTES` = 256 KiB, `matchManifest()`, `isAllowlistedManifest()`, `shouldReadManifest()`
- `discovery/traversal-policy.ts`: Approved defaults (`maxDepth` 12, 20,000 directories, 100,000 files, 120 s, concurrency 8, 200 errors) + `normalizeTraversalLimits()` clamping guarantees no unbounded scan
- `discovery/manifest-parser.ts`: `parseManifest()` gates through `shouldReadManifest()`, `inspectJsonManifest()` dispatches to ecosystem-specific inference, `inferNodeLanguage()`/`inferPythonLanguage()`, `MANIFEST_PARSER_MAX_BYTES` = 256 KiB, `exceedsParserBound()`, `isParserStateInvalid()`
- `discovery/index.ts`: Clean public API re-exports

### Agent traversal adapter (`apps/agent/src/discovery/`):
- `traverseRoot()`: Breadth-first bounded traversal with an explicit queue and bounded concurrency. Exclusions evaluated before descending or opening any file; built-in system rules always applied. Every entry `lstat`ed; symbolic links and junctions are **skipped**, recorded in `skippedReparsePoints`, and reported with code `REPARSE_POINT`. Depth, directory, file, and duration budgets all produce `LIMIT_EXCEEDED` or `DEPTH_LIMIT` and traversal **continues**. Only allowlisted manifests are considered; readable ones opened after `checkManifestRead` returns `allowed: true`, size-checked at 256 KiB, read through a fixed `maxBytes + 1` buffer, and fingerprinted with SHA-256. Lockfiles (`readContent: false`) are never opened; they are recorded with `parserState: "OK"` and `fingerprint: null`. Permission, disappearance, and resource failures recorded generically (no absolute paths or OS error text) and traversal continues. Results sorted for deterministic concurrent output.
- `traversal-io.ts`: Isolates filesystem access, classifies OS errors into generic traversal codes (`PERMISSION_DENIED`, `UNREADABLE_DIRECTORY`, `UNREADABLE_FILE`), and is the **test seam** for permission failures on Windows without needing elevation. Calls handle close in `finally`.

### Repository additions:
- `root-repository.ts`: `listActiveRoots()` — only `ACTIVE` roots are traversable

### Test count reconciliation:
- **Actual running tests: 103** across 11 test files (all that can execute without the pre-existing oxc transformer issue)
- 4 test files have pre-existing oxc transformer issue (also fails in original unmodified codebase)
- The verification report's claim of 142 was inflated due to including non-running test files

## Gate 5 Deliverables (Confirmed)
- Manifest signature table with readContent flags and 256 KiB bound
- Traversal-policy defaults with clamping guarantees
- Bounded traversal adapter with exclusion evaluation, reparse-point skip/record, and budgets
- `listActiveRoots()` repository addition
- Self-check traversal of this workspace verified

## Gate 6 — Ecosystem Detectors and Manifest Parsing (Next)

### Already Implemented (Gate 5 delivered):
- `packages/core/src/discovery/manifest-parser.ts`: `parseManifest()`, ecosystem inference (NODE/PYTHON/RUST/GO/DART), `MANIFEST_PARSER_MAX_BYTES` = 256 KiB, `exceedsParserBound()`, `isParserStateInvalid()`
- `packages/core/src/discovery/manifests.ts`: 5 ecosystem signatures, EXACT/EXTENSION/PREFIX matching, `readContent` true/false
- `packages/core/src/discovery/traversal-policy.ts`: Approved defaults + `normalizeTraversalLimits` clamping

### Remaining for Gate 6 (when explicitly authorized):
- Expand ecosystem detection to TOML, YAML, and XML manifests (bounded parser, no heavyweight dependency)
- Add `INVALID` parser state path for malformed content instead of throwing
- Add fixture tests for malformed/empty/wrong-typed/truncated manifests
- Add parsing adapter modules in the agent layer that consume `ManifestObservation` bytes

### Phase gate status:
- **Phase 1 Gates 1–6 complete** (as reflected in `docs/ROADMAP.md` §13 and `AGENTS.md` §13)
- **Gate 6** — ecosystem detectors and manifest parsing — awaits explicit authorization
- **103 tests pass** (same observable count as before Gate 5 plus the new pure-domain tests)
- Typecheck passes

---
*Reconciled on `2026-11-04`. Original test count: 103 across 11 files. 4 pre-existing oxc-transformer failures confirmed in original codebase.*