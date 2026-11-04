# Engineering Playbook

Status: **IMPLEMENTED — operating manual for all future sessions.**
Last updated: 2026-11-04
Owner: project maintainer and every AI coding session.

This is the central operating manual for **My Local Project Intelligence**. It exists so the user can give a short objective ("check this file", "audit the scanner", "continue") and the agent can independently select the correct engineering workflow, inspect the real workspace, execute the appropriate checks, and report evidence.

This playbook does not replace product, architecture, security, database, discovery, relationship, API, or testing documents. It routes work to them.

## 1. Authority and precedence

When instructions conflict, apply this order:

1. Explicit user instruction for the current task.
2. [AGENTS.md](../AGENTS.md) permanent rules.
3. This playbook's operating and verification rules.
4. [SECURITY.md](SECURITY.md) and other approved constraints.
5. [PRODUCT_SPEC.md](PRODUCT_SPEC.md), [ARCHITECTURE.md](ARCHITECTURE.md), and domain documents.
6. [ROADMAP.md](ROADMAP.md) for phase and task state.

Rules:

- Security and privacy constraints cannot be waived by convenience.
- A user instruction may authorize a normally restricted action, but still requires reporting the risk and evidence.
- Do not silently change approved architecture. Record a decision in [DECISIONS.md](DECISIONS.md).
- If sources genuinely conflict, stop only the conflicting part, state the conflict, and take the safest reversible path.

## 2. Mandatory session start

Before acting on any engineering request:

1. Read [AGENTS.md](../AGENTS.md).
2. Read this playbook.
3. Read [ROADMAP.md](ROADMAP.md) for current phase and next task.
4. Read [ARCHITECTURE.md](ARCHITECTURE.md).
5. Identify the task class in section 4.
6. Load only the additional documents relevant to that class (section 2.2).
7. Inspect the actual files, package scripts, tests, and workspace state.
8. Check Git status/history when a repository exists. If it does not, state that history is unavailable.
9. Reconstruct current reality from files, not from prior conversation claims.
10. Select the workflow and verification scope.

Do not assume a file, dependency, endpoint, schema, test, or feature exists because a document says it should.

### 2.1 State reconstruction

At the start of a meaningful session, inspect:

- Current directory and top-level tree.
- `package.json` and available scripts.
- Installed dependencies or absence thereof.
- Git repository state and recent commits, if available.
- Current phase in the roadmap.
- Actual implementation under `apps/`, `packages/`, and `tests/`.
- Test results or lack of tests.
- Any uncommitted changes.

Never initialize Git, install packages, create a database, or scan external directories unless the task or an approved phase authorizes it.

### 2.2 Document loading matrix

| Task area | Read in addition to the mandatory set |
|---|---|
| File inspection | The file, direct imports/dependents, and related tests |
| Code review | Relevant domain doc, tests, contracts, and migration/API definitions |
| Project audit | [PRODUCT_SPEC.md](PRODUCT_SPEC.md), [SECURITY.md](SECURITY.md), [TESTING.md](TESTING.md), [DECISIONS.md](DECISIONS.md) |
| Security audit | [SECURITY.md](SECURITY.md), [API.md](API.md), [DISCOVERY.md](DISCOVERY.md), [DATABASE.md](DATABASE.md) |
| Debugging | Relevant domain doc, source, tests, logs, and recent changes |
| Testing | [TESTING.md](TESTING.md) and the relevant implementation |
| Architecture review | [ARCHITECTURE.md](ARCHITECTURE.md), [DECISIONS.md](DECISIONS.md), dependency graph |
| Implementation | Product spec, architecture, relevant domain doc, tests, API contract |
| Continuation | Roadmap, Git history if present, current implementation, latest test record |

Do not load every document for a small task. Context efficiency is part of engineering quality.

## 3. Current project state and constraints

This section is a snapshot. Verify it against the workspace before relying on it.

### 3.1 Product

Local-first project intelligence for authorized Windows development roots:

- Deterministic project discovery and metadata extraction.
- SQLite inventory.
- Evidence-based relationships.
- Private local dashboard.
- Explicitly approved, sanitized public snapshots.
- No external AI dependency in core discovery.

### 3.2 Hardware and environment constraints

From the Phase 0 audit on 2026-11-04:

- Device: **Dell Latitude 5292**.
- OS: **Windows 11 Pro**, x64, build 26200.
- RAM: **8 GB nominal**, ~7.24 GiB usable. Free RAM was below 1 GiB during audit.
- Storage: user-reported **128 GB total**; measured volumes were `C:` ~139 GiB and `T:` ~97.7 GiB. Treat total capacity as a constraint regardless of reported/measured differences.
- `C:` free space at audit: **~614 MiB**. This is critically low.
- Workspace: **`T:\My AI portfolio`** with ~39.25 GiB free.
- CPU: Intel i5-8350U, 4 cores / 8 threads.
- Node.js 24.11.0, npm 11.8.0, pnpm 10.34.5, Git 2.51.2.
- Windows PowerShell 5.1.
- NTFS junction creation works; direct symbolic-link creation is blocked without elevation.
- Developer Mode and Git `core.longpaths` were not enabled/configured.

Implications:

- Keep build output, caches, local data, and temporary fixtures on `T:` when possible.
- Never fill `C:` with npm caches, logs, databases, or build artifacts.
- Run one heavy process at a time.
- Use bounded concurrency and low test worker counts.
- Do not add 3D rendering, heavy graph engines, Docker, or large AI dependencies without measured justification.
- Measure performance; never invent it.

### 3.3 Current implementation state

As of this playbook's creation:

- Phase 0 is complete and confirmed by the user.
- Documentation and scaffold exist.
- **No runtime implementation exists.**
- No packages are installed.
- No database or migration exists.
- No API, dashboard, or public app exists.
- No application tests exist or have run.
- No Git repository is initialized.

The source of truth for Phase 0 evidence remains [PHASE_0_AUDIT.md](PHASE_0_AUDIT.md) and [TESTING.md](TESTING.md).

## 4. Automatic task classification

Classify every request before acting. Do not ask which workflow to use when the task itself makes it clear.

| User intent | Workflow | Primary output |
|---|---|---|
| "Inspect/look at/explain this file" | A. File inspection | Findings, role, issues |
| "Review this code" | B. Code review | Severity-ranked findings |
| "Audit the project / is everything complete?" | C. Project audit | PASS/FAIL/PARTIAL/NOT IMPLEMENTED/UNVERIFIED/BLOCKED |
| "Review security / audit security" | D. Security audit | Threat-based findings and remediation |
| "Fix this / debug this" | E. Debugging | Root cause, fix, regression evidence |
| "Test this / verify this feature" | F. Testing | Executed test evidence |
| "Check the architecture" | G. Architecture review | Boundary/coupling findings |
| "Implement/add/build X" | H. Implementation | Changes, verification, docs |
| "Continue / next" | I. Continuation | Next unfinished task and verified progress |

### 4.1 Classification heuristics

- "Check this file" → inspect the file, its direct dependencies, and related tests.
- "Check whether this feature works" → trace the full path: UI/API → validation → service → persistence → response → tests. Then run tests.
- "Audit the scanner" → discovery logic, root validation, exclusions, reparse handling, sensitive-file denial, nested projects, identity, persistence, error handling, tests, performance.
- "Review the graph" → relationship data, edge classes, evidence, graph construction, filtering, rendering, interaction, accessibility, performance.
- "Review security" → filesystem boundaries, auth, Host/Origin, API exposure, secrets, logging, publication, dependencies.
- "Is everything complete?" → compare actual code and executed tests against product requirements and phase acceptance. Ignore README claims that lack evidence.
- "Fix it" → reproduce, root-cause, smallest safe correction, regression test, verification.
- "Continue" → read roadmap and actual implementation; do not repeat completed work.

### 4.2 Compound tasks

A request may require two workflows. Examples:

- "Audit and fix security" → D, then E/H only after findings are reported.
- "Review this code and test it" → B, then F.
- "Check whether the feature works and update docs" → F, then documentation updates.

Execute in dependency order. Do not skip the diagnostic workflow because a fix seems obvious.

## 5. Evidence and reporting standard

### 5.1 Status vocabulary

For audits, reviews, and verification, use:

- `PASS` — executed evidence confirms the requirement.
- `FAIL` — a confirmed defect or unmet requirement.
- `PARTIAL` — some required behavior exists, with named gaps.
- `NOT IMPLEMENTED` — required behavior is absent.
- `UNVERIFIED` — insufficient evidence; not proven either way.
- `BLOCKED` — verification could not proceed for a stated external reason.
- `VERIFIED` — used only where executed evidence or inspected output proves a claim.

For implementation change reports, `IMPLEMENTED`, `PARTIALLY IMPLEMENTED`, `NOT IMPLEMENTED`, and `BLOCKED` remain valid.

Never convert "source code exists" into `PASS` or `VERIFIED`. Never claim tests, builds, or security checks ran without actual output.

### 5.2 Severity

Use for review and audit findings:

- `Critical` — secret exposure, arbitrary filesystem access, public leakage, remote compromise, data destruction.
- `High` — auth bypass, path escape, persistent corruption, major requirement failure.
- `Medium` — edge-case correctness, resource risk, missing validation, maintainability risk with real impact.
- `Low` — localized quality issue, minor UX/type weakness.
- `Info` — observation, tradeoff, or follow-up.

### 5.3 Finding format

Every significant finding includes:

```text
Severity:
Status:
Location: path:line / function / component
Observed behavior:
Why it matters:
Recommended correction:
Verification method:
```

For clean results, state what was inspected and what remains `UNVERIFIED`.

### 5.4 Evidence capture

- Record the exact command and a concise result.
- Include failure text enough to reproduce, with secrets and private paths redacted.
- Do not paste tokens, environment values, or full private manifests.
- A skipped test is `BLOCKED`/`SKIPPED` with a reason, never a pass.
- For UI work, inspect actual rendered behavior where practical.

## 6. Workflows

### A. File inspection

Use when asked to look at, explain, or inspect a file.

Steps:

1. Locate the exact file; do not guess among similar names.
2. Read the complete relevant content, not only a fragment.
3. Identify its role, exports, direct dependencies, and direct consumers.
4. Find related tests, types, schemas, or documentation.
5. Check for actual problems: incorrect logic, unhandled errors, unsafe assumptions, drift from docs.
6. Distinguish observed facts from hypotheses.
7. Do not modify unless explicitly asked or a modification is strictly necessary for the requested inspection.

Output: `FINDINGS` with evidence and recommended actions.

If the file does not exist, report `NOT IMPLEMENTED`/missing and the paths checked. Never invent contents.

### B. Code review

Use for code quality, correctness, and risk review.

Steps:

1. Establish the review scope (diff, file, module, or feature).
2. Read the implementation, tests, contracts, and relevant domain rules.
3. Check:
   - Logic and edge cases.
   - Type safety and prohibited `any`.
   - Error handling and promise handling.
   - Input validation and trust boundaries.
   - Resource use and bounded work.
   - Security issues.
   - Duplicated business logic and boundary violations.
   - Test coverage of the changed behavior.
   - Documentation drift.
4. Run scoped type checks/tests if available and safe.
5. Report findings by severity. Do not rewrite code unless the user asked for a fix.

Output: `CODE REVIEW` with findings and a brief overall assessment.

Do not flood the report with style preferences that do not affect correctness or maintainability.

### C. Project audit

Use when asked to audit the project, assess completeness, or determine whether everything works.

Steps:

1. Read the roadmap, product spec, architecture, security, testing, and decisions.
2. Inventory the actual workspace: packages, source, tests, migrations, scripts, docs.
3. Build a requirement-to-evidence map.
4. Inspect each claimed feature and identify missing integration points.
5. Run `npm run verify` if it exists; otherwise run the available checks, including `npm run verify:phase0`.
6. Compare implementation against acceptance criteria.
7. Identify incomplete, incorrectly implemented, undocumented, or untested behavior.
8. Report by requirement and severity.

Output: `AUDIT SUMMARY` followed by findings and next steps.

Do not mark a phase complete because files or documentation exist. Phase completion requires verified acceptance criteria.

### D. Security audit

Use for security-focused review. Default to read-only unless a fix is requested.

Inspect:

1. Authorized-root validation and canonicalization.
2. Drive-root and system-directory rejection.
3. Exclusions and sensitive-file denial before read.
4. Path traversal and project-open behavior.
5. Symbolic-link, junction, and reparse-point handling.
6. Local API binding, token auth, token bootstrap, rotation, and storage.
7. Host-header and Origin validation, CORS, and DNS-rebinding defense.
8. WebSocket authentication and event leakage.
9. Request validation, body limits, pagination, graph caps, rate limits.
10. SQL parameterization and database access boundaries.
11. Logging redaction and error responses.
12. Secret handling and absence of secret storage.
13. Public approval, sanitization, schema validation, and offline separation.
14. XSS/CSP and untrusted metadata rendering.
15. Dependency and install-script risk.

Rules:

- Do not perform active network scanning, exploit attempts on external systems, or destructive tests without explicit approval.
- Do not claim the system is "secure" based on code presence. Report controls as `PASS`, `PARTIAL`, `UNVERIFIED`, or `FAIL` with evidence.
- Report severity and concrete remediation.

Output: severity-ranked security findings and residual risk.

### E. Debugging

Use when asked to fix, diagnose, or investigate a failure.

Steps:

1. Capture the exact symptom, command, environment, and error. Redact secrets.
2. Reproduce with the smallest safe setup, preferably a fixture.
3. If reproduction is impossible, state `UNVERIFIED` and narrow the cause with evidence.
4. Inspect relevant source, logs, tests, and recent changes.
5. Trace the data/control path to the failure.
6. Identify the root cause; do not merely suppress the symptom.
7. Implement the smallest safe correction.
8. Add or update a regression test.
9. Run the focused test, then relevant type/build checks.
10. Verify the original issue and check for obvious regressions.

Do not refactor unrelated code during a bug fix.

Output: root cause, fix, tests, actual results, remaining uncertainty.

### F. Testing

Use when asked to test or verify behavior.

Steps:

1. Identify the feature, risk, and relevant test suites.
2. Inspect existing tests and fixtures.
3. Run the narrowest meaningful tests first.
4. Run broader checks only when scope or risk requires them.
5. Add missing tests when the request requires verification and coverage is absent.
6. Never fabricate execution or results.
7. Report command, result, failures, skips, and blockers.
8. Distinguish test pass from feature completeness.

Resource rules:

- Respect the low-RAM machine. Use low concurrency.
- Avoid running unrelated heavy builds and dev servers together.
- Use temporary fixture databases and roots.
- Never execute scripts from discovered or fixture projects.

Output: `TEST RESULTS` with actual evidence and coverage gaps.

### G. Architecture review

Use for boundary, coupling, scalability, and design-fit questions.

Steps:

1. Inspect the actual directory and dependency structure.
2. Compare against [ARCHITECTURE.md](ARCHITECTURE.md) and [DECISIONS.md](DECISIONS.md).
3. Check boundary violations:
   - `packages/core` importing filesystem, SQLite, Fastify, React, or Node-only modules.
   - Route handlers containing domain algorithms.
   - Repositories leaking into UI/domain.
   - UI reaching the database or filesystem directly.
   - Duplicated detection/relationship rules.
4. Check circular dependencies and unnecessary abstractions.
5. Check resource behavior, startup model, watcher duplication, and query limits.
6. Recommend changes only with a demonstrated problem.
7. Require an ADR for approved architectural changes.

Do not modify architecture during a review unless the user asked for implementation and the change is justified.

Output: `ARCHITECTURE REVIEW` with boundary findings and justified recommendations.

### H. Implementation

Use when asked to add or change behavior.

Steps:

1. Understand the requirement and its acceptance criteria.
2. Inspect existing code, tests, docs, and phase state.
3. Plan the smallest coherent change.
4. Check whether a new dependency is genuinely necessary.
5. Implement incrementally while preserving working behavior.
6. Add/update types and validation.
7. Add/update unit, integration, or E2E tests.
8. Run focused checks, then the scope-appropriate verification.
9. Update documentation that describes actual behavior.
10. Report files changed, decisions, tests, results, and limitations.

Rules:

- Do not implement future-phase work without instruction.
- Do not silently change architecture or data contracts.
- No production mock-data fallback.
- No secrets in code, fixtures, logs, or snapshots.
- No unhandled promises or silent errors.
- Keep modules and components focused.

Output: `CHANGES MADE` plus verification evidence.

### I. Continuation

Use for "continue", "next", "keep going", or similar.

Steps:

1. Read [AGENTS.md](../AGENTS.md), this playbook, and [ROADMAP.md](ROADMAP.md).
2. Inspect Git state/history if available.
3. Inspect actual implementation and latest verified test evidence.
4. Identify the next unfinished task.
5. Confirm that the current phase's acceptance criteria are met before advancing.
6. Do not repeat completed work.
7. Continue with the appropriate workflow.
8. Update roadmap/testing/decision docs for meaningful state changes.

If Phase 1 is not explicitly authorized or a phase gate is unmet, stop and report the gate rather than inventing work.

Output: `CURRENT PHASE`, verified progress, outstanding work, next task.

## 7. Verification selection

### 7.1 Available now

| Scope | Command | Status |
|---|---|---|
| Documentation/config | `npm run verify:phase0` | Available; checks required files, JSON, internal links |
| TypeScript | `npm run typecheck` | Not available; no package scripts yet |
| Tests | `npm test` | Not available; no test runner installed |
| Lint | `npm run lint` | Not available; no lint configuration |
| Build | `npm run build` | Not available; no build scripts |
| Full verification | `npm run verify` | Not available; no application scripts |

If a command is unavailable, report that fact and use the best available alternative. Do not invent a passing result.

### 7.2 Risk-based verification matrix

| Change scope | Minimum verification |
|---|---|
| Documentation only | `npm run verify:phase0`; inspect rendered links/content |
| Pure domain logic | Type check + focused unit tests |
| Scanner/root/exclusions | Type check + unit + integration fixtures + security path tests |
| Database/migration | Migration from empty, rollback, foreign keys, backup/restore |
| API/auth | Type check + API integration + auth/Host/Origin tests |
| UI feature | Type check + component test + build; E2E for critical flow |
| Relationship/graph | Domain tests + API graph contract + UI render/performance check |
| Publication | Sanitizer negative tests + schema validation + offline public test |
| Security fix | Focused regression + related security matrix |
| Full phase | All applicable acceptance tests and recorded evidence |

Do not run unrelated expensive checks for a trivial local change. Do not skip checks because they are inconvenient.

### 7.3 Resource-aware execution

- Prefer one test process with bounded workers.
- Do not run Vite, the agent, tests, and a public build concurrently on this machine without measurement.
- Keep generated fixtures and temporary databases on `T:`.
- Check free space before installing or building.
- Avoid watch mode during automated verification.
- Close temporary servers and handles.

## 8. Safe change policy

### 8.1 Always

- Inspect before editing.
- Read the whole relevant file before targeted edits.
- Preserve working code.
- Make the smallest justified change.
- Avoid unrelated formatting or refactors.
- Keep changes inside the authorized workspace.
- Update tests and docs for behavior changes.
- Report actual verification.

### 8.2 Explicit approval required

Ask before:

- Initializing or rewriting Git history.
- Installing/uninstalling packages outside an approved implementation task.
- Deleting user data or private runtime data.
- Destructive database migrations or purges.
- Scanning any directory outside the workspace through the product.
- Writing outside the workspace.
- Running unknown project scripts or executables.
- Network operations that transmit private data.
- Enabling remote access, public exposure, or cloud publishing.
- Elevating privileges or changing system configuration.
- Changing approved architecture.
- Any action that is irreversible or security-sensitive.

Ordinary, reversible workspace edits clearly required by the task do not need repeated confirmation.

### 8.3 Never

- Blindly overwrite files.
- Delete files to make tests pass.
- Add a dependency to avoid understanding the code.
- Hide failures or skipped checks.
- Store secrets in source, fixtures, logs, or documentation.
- Execute discovered project code.
- Change architecture silently.

## 9. Security and privacy protocol

This project's non-negotiables:

1. Scan only explicitly authorized roots.
2. Never scan drive roots, Windows system directories, `AppData`, browser profiles, cloud credential stores, or unrelated personal folders.
3. Do not follow reparse points outside authorized roots.
4. Deny sensitive filenames before opening files.
5. Never read or store `.env` values, tokens, keys, passwords, cookies, certificates, or credentials.
6. Do not read source code for ordinary project detection.
7. Do not execute project scripts or install into discovered projects.
8. Bind the local API to `127.0.0.1` only.
9. Require authentication, Host validation, and Origin validation.
10. No arbitrary filesystem API; project-open uses a database-resolved project under an authorized root.
11. Parameterized SQL only.
12. Public output is private-by-default, explicitly approved, allowlist-sanitized, and schema-validated.
13. The public app never reaches the local database, API, or filesystem.
14. No private source or metadata to external AI services.
15. Logs contain no secrets and minimize private paths.

Security review findings must state what was actually exercised. A control described in docs is `NOT IMPLEMENTED` until code and tests exist.

## 10. Project-specific audit checklists

### 10.1 Scanner audit

- Root validation and canonicalization.
- Drive-root/system/credential rejection.
- Exclusions applied before descent.
- Sensitive filenames denied before read.
- Reparse points skipped and reported.
- Bounded depth, concurrency, file size, time, and candidate count.
- Manifest-only reads.
- Signature confidence and evidence.
- Directory aggregation without duplicates.
- Nested/workspace resolution.
- Stable identity and rename/move/delete/restore behavior.
- Scan history, errors, progress, and cancellation.
- Watcher debounce and reconciliation.
- Fixture coverage for cases 1–20 in [TESTING.md](TESTING.md).
- Actual performance measurement.

### 10.2 API and auth audit

- Loopback-only binding.
- Bearer token generation, storage, rotation, and comparison.
- Token not logged or placed in logged URLs.
- Host allowlist and DNS-rebinding defense.
- Origin allowlist and CORS behavior.
- WebSocket handshake auth.
- Schema validation and unknown-field rejection.
- Body/query limits, pagination, graph caps, rate limits.
- No arbitrary path/read/write route.
- Project-open resolves from DB and authorized root.
- Structured errors without paths, SQL, stacks, or secrets.
- Request IDs and redacted logs.

### 10.3 Database audit

- Migrations from empty state.
- Schema version/checksum handling.
- Foreign keys and indexes.
- WAL, busy timeout, and transaction behavior.
- Rollback on failure.
- Backup and restore with the chosen SQLite API.
- No raw manifests, secrets, or source stored.
- Soft lifecycle states preserve history.
- Publication data separated from private data.

### 10.4 Relationship and graph audit

- Four relationship classes are distinct.
- Similarity is never rendered as dependency.
- Every edge has method, evidence, confidence, state, timestamps.
- Verified local dependencies resolve to discovered targets.
- Ambiguous links do not become `VERIFIED`.
- Manual and rejected edges survive recomputation.
- Rejected edges are not silently recreated.
- Graph filtering, caps, truncation, legend, and evidence panel.
- Performance measured on the target machine.

### 10.5 Publication audit

- Private by default.
- Explicit per-project approval.
- Allowlist projection, not field deletion.
- No paths, remotes, source, secrets, logs, or unapproved records.
- Public schema validation.
- Snapshot hash/version/history.
- Unpublish behavior.
- Public app works with the local agent stopped.
- Negative tests for every denied field.

## 11. Phase discipline and continuity

- Follow [ROADMAP.md](ROADMAP.md).
- Do not start a phase until the prior phase's acceptance criteria are verified.
- Do not mark a phase complete with unmet or unverified criteria.
- Record blockers precisely.
- Update the roadmap when meaningful state changes.
- Record test evidence in [TESTING.md](TESTING.md) when tests are added or run.
- Record architecture decisions in [DECISIONS.md](DECISIONS.md).
- Keep the relevant domain document aligned with actual behavior.
- Leave the exact next task at the end of a session.

When resuming, trust files and executed evidence over conversational memory.

## 12. Response formats

### Inspection

```text
FINDINGS
- Evidence and relevant files.
- Issues identified.
- Recommended actions.
```

### Audit

```text
AUDIT SUMMARY
- Overall status: PASS / FAIL / PARTIAL / UNVERIFIED.

FINDINGS
- Severity, location, observed behavior, impact, correction, verification.

MISSING REQUIREMENTS
- ...

RECOMMENDED NEXT STEPS
- ...
```

### Implementation

```text
CHANGES MADE
- Files modified.
- Technical decisions.
- Tests executed.
- Actual results.
- Remaining limitations.
```

### Continuation

```text
CURRENT PHASE
- Verified progress.
- Outstanding work.
- Next task.
```

Keep responses concise but technically meaningful. Do not omit failures, skips, or uncertainty.

## 13. Definition of done

### File inspection

- Exact file read.
- Role/dependencies identified.
- Findings evidenced.
- No unrequested modifications.

### Code review

- Relevant implementation and tests inspected.
- Findings severity-ranked.
- No unverified claim of correctness.

### Project audit

- Requirements mapped to actual evidence.
- Checks executed or marked unavailable.
- Gaps and next steps stated.

### Security audit

- Threat areas checked.
- Controls marked with evidence status.
- Residual risk stated.
- No blanket security claim.

### Debugging

- Root cause identified or uncertainty stated.
- Smallest fix applied when requested.
- Regression test added/updated.
- Original failure verified fixed.

### Testing

- Relevant tests executed.
- Results recorded.
- Missing coverage identified.

### Architecture review

- Actual structure compared to approved architecture.
- Boundary/coupling/resource findings evidenced.
- Changes justified and ADR-backed.

### Implementation

- Requirement met.
- Types/validation/errors handled.
- Tests pass or failures reported.
- Build/typecheck run where applicable.
- Documentation updated.
- No unrelated changes.

### Continuation

- Current state reconstructed from files.
- Completed work not repeated.
- Next task identified and justified.

## 14. Playbook maintenance

- Update this playbook when the operating procedure changes.
- Do not duplicate full product/architecture/security content; link to it.
- Keep the "current state" snapshot accurate or clearly dated.
- Architecture changes require an ADR, not just a playbook edit.
- Product behavior changes require the relevant domain document update.
- If a rule becomes obsolete, replace it with a recorded reason, not silent deletion.

## 15. Quick decision index

| If the user says... | Do this first |
|---|---|
| "Inspect this file" | Read it fully, find dependents/tests, report findings |
| "Review this code" | Read implementation + tests, severity-ranked review, no edits unless asked |
| "Audit the project" | Requirements-to-evidence audit, run available checks |
| "Review security" | Threat/control review, no active exploitation |
| "Fix this" | Reproduce, root-cause, smallest fix, regression verification |
| "Test this" | Inspect tests, run focused suites, record actual results |
| "Check the architecture" | Compare actual boundaries to approved architecture |
| "Implement X" | Inspect, plan, implement incrementally, verify, document |
| "Continue" | Read roadmap + state, find next unfinished task, proceed |
| "Is everything complete?" | Audit against acceptance criteria, not README claims |
| "Check whether it works" | Trace the full path and execute relevant tests |
