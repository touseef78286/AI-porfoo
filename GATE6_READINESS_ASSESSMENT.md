# Gate 6 Readiness Assessment

## Implementation Status: Partially Implemented (Gate 5 delivered foundation)

### Already Implemented (Gate 5 work products)

| Module | Key Functions | Status |
|---|---|---|
| `packages/core/src/discovery/manifest-parser.ts` | `parseManifest()`, `inspectJsonManifest()`, ecosystem inference (NODE/PYTHON/RUST/GO/DART), `MANIFEST_PARSER_MAX_BYTES` = 256 KiB, `exceedsParserBound()`, `isParserStateInvalid()` | ✅ Complete |
| `packages/core/src/discovery/manifests.ts` | 5 ecosystem signatures (NODE, PYTHON, RUST, GO, DART), EXACT/EXTENSION/PREFIX matching, `readContent` flags, `MANIFEST_SIGNATURES` table, `matchManifest()`, `isAllowlistedManifest()`, `shouldReadManifest()` | ✅ Complete |
| `packages/core/src/discovery/traversal-policy.ts` | `DEFAULT_TRAVERSAL_LIMITS` (maxDepth 12, 20,000 dirs, 100,000 files, 120s, concurrency 8, 200 errors), `normalizeTraversalLimits()` clamping guarantees | ✅ Complete |
| `packages/core/src/discovery/index.ts` | Clean public API re-exports | ✅ Complete |

### Gate 6 Remaining Work (when explicitly authorized)

| Task | Description | Estimated Effort |
|---|---|---|
| Expand ecosystem detection | Add TOML, YAML, XML manifest parsing with bounded parser (no heavyweight dependency unless measured necessary) | Medium |
| INVALID parser state | Implement malformed content handling that returns `INVALID` parser state instead of throwing errors | Medium |
| Fixture tests | Add malformed, empty, wrong-typed, and truncated-manifest fixture tests | Low |
| Parsing adapters | Add agent-layer parsing adapters that consume `ManifestObservation` bytes and return declarative `DetectorResult` output | Medium |
| Detector registry pattern | Implement the detector registry pattern described in Roadmap item 6 ("Implement detector registry for the required ecosystems") | Medium |

### What "Detector Registry" Entails (Roadmap Item 6)

The roadmap specifies: "6. Implement detector registry for the required ecosystems."

This means creating a registry/economy map that:
- Maps manifest signatures to ecosystem identifiers
- Provides confidence scores and detection states
- Maps parsed fields to technology signals
- Integrates with the traversal output (`ManifestObservation`) to produce persistent project records

Foundation exists in `manifest-parser.ts` but a full registry is not yet implemented.

### Test Status

| Metric | Value |
|---|---|
| Working tests | 103 across 11 files |
| Pre-existing failures | 4 files (oxc transformer issue, also fails in original codebase) |
| Typecheck | PASS |
| Type coverage | Manifest parser, traversal policy, matching functions |

### Phase Gate Status

| Gate | Status |
|---|---|
| Gates 1–5 | Complete |
| Gate 6 | Awaiting explicit authorization |
| Phase 1 acceptance | Gates 1–5 verified; Gate 6 next |

### Authorization Request

**Gate 6 — Ecosystem Detectors and Manifest Parsing**

This gate requires explicit user authorization. When authorized, the following will be implemented:

1. Expand `packages/core/src/discovery/manifest-parser.ts` to handle TOML, YAML, XML manifests
2. Add `INVALID` parser state path for malformed content
3. Add fixture tests for malformed/empty/wrong-typed/truncated manifests
4. Add parsing adapter modules in the agent layer
5. Implement detector registry pattern mapping manifests to ecosystem/technology declarations

**No work on Gate 6 should begin until explicit authorization is given.**

---
*Assessment date: 2026-11-04*