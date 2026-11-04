# Discovery, Detection, and Incremental Scanning

Status: **Specification only. Not implemented.**
Last updated: 2026-11-04

## 1. Goals

- Discover real projects inside explicitly authorized roots.
- Prefer configuration evidence over filename guessing.
- Avoid duplicate counts from multiple signatures.
- Resolve nested projects deterministically.
- Preserve identity across moves and renames when evidence permits.
- Stay within the machine's resource limits.
- Never read secrets or source code for ordinary detection.

## 2. Non-goals

- Full-drive indexing.
- Finding every source file.
- Executing project code.
- Guessing frameworks without evidence.
- Treating every folder with a lockfile as a confirmed project.
- Automatically merging ambiguous projects.

## 3. Authorized roots

A root must be:

- Explicitly added by the user.
- An existing absolute directory.
- A subdirectory, not a drive root.
- Outside denied system/credential locations.
- Canonicalized and stored.
- Associated with a watcher preference and exclusions.

Removing a root:

- Stops scanning/watching it.
- Marks it `REMOVED`/unavailable.
- Preserves project history.
- Does not delete projects automatically.

Implementation status (Gate 4): validation for the first five bullets exists in `apps/agent/src/roots/validate-root.ts` and is tested. Repository persistence exists. Watcher preference, removal flow, and the confirmation UI do not exist yet.

## 4. Traversal policy

Default traversal:

- Breadth-first or bounded-depth-first with an explicit queue.
- Maximum depth configurable; a safe default will be chosen and tested.
- Bounded concurrency (initial target: 8 operations, subject to measurement).
- Ignore directory set evaluated before descending.
- Reparse points skipped and recorded.
- Permission errors recorded and traversal continues.
- Per-run directory/file/time/parse budgets with explicit `LIMIT_EXCEEDED`.
- Progress counters emitted at a throttled interval.
- No file content read except allowlisted manifests.

### Default ignored directories

- VCS internals: `.git`, `.hg`, `.svn` (metadata may be queried separately).
- Dependency/build output: `node_modules`, `bower_components`, `.venv`, `venv`, `env`, `__pycache__`, `.mypy_cache`, `.pytest_cache`, `.ruff_cache`, `target`, `build`, `dist`, `out`, `bin`, `obj`, `.next`, `.nuxt`, `.output`, `coverage`, `.gradle`, `.dart_tool`, `.pub-cache`, `Pods`, `DerivedData`, `vendor`.
- Tool caches: `.cache`, `.parcel-cache`, `.turbo`, `.nx`, `.angular`, `.expo`.
- Sensitive/infrastructure: `.ssh`, `.aws`, `.azure`, `.config`, `AppData`, browser profiles, `.docker`, `.kube`, `secrets`, `credentials`.
- IDE/editor internals where safe to skip: `.idea`, `.vscode` (config may be considered later, not for Phase 1 detection).

Built-in ignore rules are system exclusions. A user may add exclusions but cannot silently disable safety rules.

Implementation status (Gate 4): the set above is implemented as `DEFAULT_IGNORED_DIRECTORY_NAMES` in `packages/core/src/roots/exclusions.ts`. `createExclusionMatcher` evaluates system rules first, so an equivalent user rule cannot downgrade them. The matcher is unit-tested; traversal does not call it yet.

## 5. File reads

Allowed in Phase 1:

- Recognized manifests.
- Bounded metadata files needed for ecosystem/framework identification.
- A narrow set of Git metadata queries.

Rules:

- Deny sensitive filenames before opening.
- Check file type and size.
- Read at most a documented maximum (initial target: 256 KiB for manifests).
- Use a parse timeout/budget.
- Treat invalid JSON/TOML/XML as evidence with `INVALID` parser state, not a crash.
- Do not read source files, lockfile bodies, or dependency directories.
- Do not store raw manifest content in the database.

## 6. Signature model

Each signature has:

- Ecosystem.
- Filename or pattern.
- Strength: `STRONG` or `SUPPORTING`.
- Whether content parsing is required.
- Evidence label.
- Detector module ID.

### Strong signatures

| Ecosystem | Signatures |
|---|---|
| Node/JS/TS | `package.json` |
| Python | `pyproject.toml`, `requirements.txt`, `Pipfile`, `setup.py` |
| Rust | `Cargo.toml` |
| Go | `go.mod` |
| Dart/Flutter | `pubspec.yaml` |
| Java | `pom.xml`, `build.gradle`, `build.gradle.kts` |
| .NET | `*.sln`, `*.csproj` |
| PHP | `composer.json` |
| Ruby | `Gemfile` |

### Supporting signatures

- `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, `bun.lockb`.
- `tsconfig.json`.
- Framework config names such as `next.config.*`, `vite.config.*`, `angular.json`.
- Manifest-adjacent source/build directories, used only as supporting evidence.
- Git repository presence, used only as supporting evidence.

A supporting signature alone does not create a confirmed project.

## 7. Confidence model

Initial weights (deterministic, testable):

| Evidence | Weight |
|---|---:|
| Valid strong manifest | 0.60 |
| Strong manifest with invalid/unreadable content | 0.40 |
| Additional distinct strong ecosystem manifest in same directory | +0.10 (cap 0.15) |
| Lockfile matching the manifest ecosystem | +0.10 |
| `tsconfig.json` / framework config | +0.05 |
| Recognized source/build directory | +0.05 |
| Git repository evidence | +0.05 |
| Declared workspace membership | +0.10 |
| Conflicting/ambiguous ownership | −0.10 |

States:

- `CONFIRMED`: score ≥ 0.80, at least one valid strong manifest, no unresolved ownership conflict.
- `PROBABLE`: score 0.60–0.79, at least one strong manifest or valid strong parse.
- `CANDIDATE`: score 0.40–0.59; excluded from default inventory totals but visible in review.
- `NEEDS_REVIEW`: metadata invalid/ambiguous or identity unresolved.
- Below 0.40: not inventoried as a project.

A single valid `package.json` starts at 0.60 (`PROBABLE`) and becomes `CONFIRMED` with another supporting signal. This prevents a lone file from being presented as a verified complete application while still surfacing real candidates.

The exact weights and thresholds must be covered by tests and may be tuned with evidence, not intuition. Every score must be reproducible from stored evidence.

## 8. Directory aggregation

One directory is one project candidate, even if it has multiple manifests.

- Merge JS + TypeScript + lockfile + tsconfig into one Node project.
- A `.sln` and its root `.csproj` in the same directory are one .NET solution candidate.
- Do not create one project per manifest.
- Record each signature as evidence.
- Choose a primary ecosystem deterministically, with conflicts recorded.

## 9. Nested-project resolution

### Inputs

- Candidate directories.
- Declared workspaces:
  - `package.json` `workspaces`.
  - `pnpm-workspace.yaml`.
  - `Cargo.toml` `[workspace]`.
  - `go.work`.
  - `.sln` project references.
  - Other ecosystem workspace declarations added by detectors.
- Independent identity evidence:
  - Own Git root.
  - Own lockfile at a different root.
  - Manifest name.
  - Path dependency links.

### Resolution order

1. Identify the nearest ancestor with a declared workspace containing the candidate.
2. If contained, classify the parent as a workspace root and the candidate as a workspace member. Keep both as distinct entities; the UI can nest them, and the inventory clearly labels the aggregate.
3. If not contained, evaluate independence:
   - Own Git root → standalone.
   - Own lockfile not inherited from parent → likely standalone.
   - Manifest name distinct and at least one additional strong/supporting signal → probable standalone.
   - Otherwise → module/package of the nearest ancestor, not a separate top-level project.
4. If two candidates share a directory, merge.
5. If ownership remains ambiguous, create a `NEEDS_REVIEW` candidate and do not merge automatically.
6. Never merge based on similar names or technologies.

Nested `node_modules` and build output are never candidates.

## 10. Project identity

Every project gets an internal UUID. Identity evidence is separate and can change.

Resolution sequence on scan:

1. **Exact path match** for an existing active project in the same root.
2. **Strong identity match**:
   - Normalized Git remote + relative workspace path.
   - Manifest ecosystem + unique name + kind.
3. **Manual identity link** established by the user.
4. Otherwise, create a new candidate.

Rules:

- Strong identity may move a project when the match is unique.
- Two projects claiming the same strong identity are not auto-merged; mark `NEEDS_REVIEW`.
- A path that disappears is not deleted immediately.
- A project is marked `MISSING` after the deletion is confirmed by two reconciliation observations or a configured grace period.
- If a missing project's identity reappears at a new path, restore/move the record with evidence.
- Historical status transitions are stored.
- Users can manually merge/split/relink records in a later management flow.

Identity examples:

```text
git:github.com/example/app + packages/web
manifest:npm:@example/web
path:T:/Projects/app
```

Git remote normalization must remove credentials, protocol differences, trailing `.git`, and case differences where safe, without losing meaningful path identity.

## 11. Initial vs incremental scans

### Initial/manual full scan

- Enumerate authorized roots.
- Read only allowed manifests.
- Resolve candidates and identities.
- Upsert projects and evidence.
- Recompute technologies/dependencies in Phase 3.
- Recompute eligible relationships.
- Write scan history.

### Incremental update

Triggered by relevant file events:

- `package.json`, lockfiles, `tsconfig.json`, ecosystem manifests, workspace files, `*.csproj`, `*.sln`.
- Creation/deletion of a directory that may contain a manifest.
- Directory rename/move.

Process:

1. Coalesce events for the affected path.
2. Re-detect that directory and, if needed, its immediate children.
3. Compare fingerprints.
4. Update only changed records.
5. Reconcile workspace membership if a workspace manifest changed.
6. Emit update events.

Do not rescan the entire root for a single `package.json` change.

## 12. Watcher configuration

Using Chokidar:

- `ignoreInitial: true` after the initial scan.
- Ignore rules shared with the scanner.
- `awaitWriteFinish` with a small stability threshold.
- `atomic` handling where beneficial on Windows.
- Depth limit.
- `followSymlinks: false`.
- One watcher per authorized root, managed centrally; never duplicate watchers for the same canonical root.
- Debounce queue with per-path timers and a global throughput limit.
- Pause/resume stops event processing without destroying inventory.
- Watcher errors update health state and schedule reconciliation.

## 13. Reconciliation

Filesystem events can be lost. A separate scheduled job:

- Runs at startup and on a configurable interval (initial default: 24 hours; may be tuned).
- Re-enumerates manifests with the same safety limits.
- Uses manifest stats/fingerprints to skip unchanged projects.
- Detects missing, moved, and restored projects.
- Recomputes workspace ownership if workspace manifests changed.
- Records a scan run with trigger `RECONCILIATION`.
- Does not run concurrently with a full scan.

Phase 2 acceptance requires an injected missed-event test proving reconciliation repairs the inventory.

## 14. Error handling

| Condition | Behavior |
|---|---|
| Root missing | Mark root unavailable; preserve projects; emit health event |
| Permission denied | Record error with relative path; continue |
| Locked manifest | Retry briefly; record warning if unresolved |
| Invalid JSON/TOML/XML | Keep candidate; parser state invalid; no crash |
| File too large | Skip content; record `TOO_LARGE` |
| Reparse point | Skip; record security warning |
| Duplicate events | Debounce/coalesce |
| Watcher restart | Reconcile affected root |
| Scan budget exceeded | Stop with `LIMIT_EXCEEDED` and report actual counters |
| Database error | Abort affected transaction; surface error; keep prior state |

## 15. Progress and cancellation

Scan progress includes:

- Root.
- Phase (`ENUMERATING`, `DETECTING`, `RESOLVING`, `PERSISTING`, `RELATING`).
- Directories visited.
- Files inspected.
- Candidates found.
- Projects created/updated.
- Errors.
- Elapsed time.
- Cancellation state.

Only one destructive/full scan at a time. A cancel request stops new work, closes handles, and records `CANCELLED`.

## 16. Resource limits

Initial configurable limits (to be validated by benchmarks):

- Max depth: 12 (configurable).
- Concurrency: 8 filesystem operations.
- Max manifest size: 256 KiB.
- Max candidates per scan: 10,000.
- Max entries visited per scan: 250,000.
- Max scan duration: 10 minutes for a manual scan; reconciliation may be shorter.
- Parse cache per scan: bounded.

Exceeding a limit is explicit, not silent. The values will be adjusted only after measuring real fixtures and real usage.

## 17. Security invariants

- Sensitive files never reach a parser.
- Reparse points never escape a root.
- No source code is read for detection.
- No project scripts are executed.
- No secrets are logged or stored.
- Exclusions are enforced before directory descent and file open.
- The scanner cannot be pointed at a path through an API that accepts arbitrary paths.

## 18. Phase 1 tests

- Valid Node, Next.js, Python, Flutter, and unknown folders.
- Empty and malformed manifests.
- Nested monorepo and multiple apps.
- Duplicate signatures.
- Excluded directory.
- Sensitive file never read.
- Permission error.
- Symbolic link/junction (or explicit `BLOCKED`).
- Identity, rename, delete, restore.
- Deterministic ordering and duplicate-free results.
