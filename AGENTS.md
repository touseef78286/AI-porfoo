# AGENTS.md — Permanent Engineering Rules

This file is binding for every future coding session in this repository.

## 1. Mission

Build **My Local Project Intelligence**: a local-first system that discovers, analyzes, relates, and visualizes real software projects inside explicitly authorized Windows directories. A later public portfolio may display only explicitly approved, sanitized snapshots.

The product is an engineering intelligence system, not a mockup, a static project list, or an AI demonstration.

## 2. Read before changing code

Before modifying files:

1. Read this file.
2. Read [docs/ENGINEERING_PLAYBOOK.md](docs/ENGINEERING_PLAYBOOK.md) and select the applicable workflow.
3. Read [docs/ROADMAP.md](docs/ROADMAP.md) for current phase and next task.
4. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the relevant domain document.
5. Inspect the existing implementation and package scripts.
6. Check the working tree and recent Git history when a repository exists.
7. Identify the smallest correct change.
8. Preserve working code unless a documented decision justifies replacement.

Do not duplicate the playbook here. The playbook defines task classification, workflow steps, evidence formats, verification scope, and project-specific audit checklists.

Do not restart completed work without a stated reason.

## 3. Evidence rules

Never invent:

- Paths, files, or project structures.
- Installed packages, versions, or capabilities.
- Test results or successful builds.
- Database schemas that were not applied.
- Project metadata, Git remotes, or relationships.

Use one of these labels in implementation reports:

- `IMPLEMENTED` — code exists and the described behavior is present.
- `PARTIALLY IMPLEMENTED` — some behavior exists; missing parts are named.
- `NOT IMPLEMENTED` — no working implementation exists.
- `BLOCKED` — a concrete external constraint prevents progress.
- `VERIFIED` — executed evidence (test, command, inspected output) confirms the claim.

For audits, reviews, and verification, use `PASS`, `FAIL`, `PARTIAL`, `NOT IMPLEMENTED`, `UNVERIFIED`, and `BLOCKED` as defined in the playbook. Do not convert source-code presence into a passing or verified claim.

Documentation must describe implemented reality. Planned behavior must be labeled as planned.

## 4. Environment constraints

Measured target machine:

- Dell Latitude 5292.
- Windows 11 Pro, x64.
- 8 GB nominal RAM (~7.24 GiB usable); free RAM was below 1 GiB during the Phase 0 audit.
- 128 GB-class total storage; `C:` had only ~614 MiB free at audit time.
- Workspace: `T:\My AI portfolio`; use `T:` for build output, data, and temporary fixtures.
- Intel i5-8350U, 4C/8T.
- Node.js 24.11.0, npm 11.8.0, pnpm 10.34.5, Git 2.51.2.

Rules:

- Prefer one agent process plus a static dashboard build.
- Do not introduce Docker, Redis, Kafka, Kubernetes, or microservices without a demonstrated requirement.
- Use bounded concurrency and bounded reads.
- Do not run Vite, Next.js, tests, and multiple watchers simultaneously unless measured necessary.
- Keep dependencies minimal. Justify every runtime dependency.
- Keep caches and build output on a drive with space.
- Never claim performance without measuring it on this machine.

## 5. Filesystem and privacy red lines

- Scan only roots explicitly configured through the product.
- Never scan `C:\`, `C:\Windows`, `C:\Program Files`, `C:\ProgramData`, `AppData`, user profile roots, browser profiles, credential stores, or unrelated personal directories.
- Do not follow symbolic links, junctions, or other reparse points outside authorized roots.
- Do not read source files for ordinary project detection. Read only recognized, size-bounded configuration manifests.
- Never read, store, log, publish, or transmit `.env` values, tokens, keys, passwords, cookies, private certificates, or credential files.
- Exclude sensitive filenames and directories before opening files.
- Do not execute scripts from discovered projects.
- Do not install packages into discovered projects.
- Do not send local source code or private project metadata to an external AI service.

## 6. Security rules

- Bind the local API to `127.0.0.1` only.
- Authenticate every data-bearing API request.
- Validate the `Host` header and browser `Origin` to prevent DNS rebinding and cross-site access.
- Validate every request body and query with schemas.
- Use parameterized SQL only.
- Restrict project-directory open operations to a database-resolved project under an authorized root; never accept an arbitrary path from the client.
- Apply body-size limits, pagination, graph caps, and rate limits to sensitive operations.
- Redact secrets and private paths from logs where they are not needed.
- Public output is built from an explicit allowlist and explicitly approved projects. Discovery never implies publication.
- Do not expose the local database, local API, or filesystem to the public application.

## 7. Architecture boundaries

Target shape:

```text
apps/agent        Filesystem, watcher, SQLite, Fastify, WebSocket, orchestration
apps/dashboard    Private React UI; API client only
packages/core     Pure domain logic, contracts, detectors, relationship rules
apps/portfolio    Deferred until Phase 5; consumes approved snapshots only
tests/fixtures    Generated or committed non-sensitive test projects
```

- Domain logic must not import Fastify, SQLite, React, or filesystem APIs.
- Filesystem access belongs in the agent's adapters.
- Database access belongs in repositories, not route handlers.
- Route handlers validate and delegate; they do not contain detection or relationship algorithms.
- UI must consume actual API data. No production path may fall back to mock projects.
- Avoid circular dependencies and duplicated business rules.

## 8. TypeScript and code quality

- TypeScript strict mode.
- No `any` unless isolated and justified; prefer `unknown` plus validation.
- Explicit public interfaces and return types where useful.
- Handle promises and errors; no floating promises.
- Centralized structured logging with request/scan IDs.
- Database migrations and transactions for multi-step writes.
- Unit tests for pure logic, integration tests for persistence/API, end-to-end tests where practical.
- Keep components and modules focused. Do not create giant files.
- Do not add abstractions without a current consumer.

## 9. Phase gates

Follow the phases in [docs/ROADMAP.md](docs/ROADMAP.md).

- Complete and verify the current phase before starting the next.
- Do not mark a phase complete while an acceptance criterion is unmet or unverified.
- If a phase is blocked, record the exact blocker and the next safe action.
- Do not silently change approved architecture. Add an ADR in [docs/DECISIONS.md](docs/DECISIONS.md) first or with the change.

## 10. Testing and verification

When code exists, run the applicable checks:

```powershell
npm run typecheck
npm test
npm run lint
npm run build
npm run verify
```

Only report commands that were actually executed. Report failures verbatim enough to reproduce, without exposing secrets.

Required evidence for a feature:

- Tests or an executed command demonstrating behavior.
- TypeScript check result.
- Build result where applicable.
- Inspected output for security-sensitive or data-sensitive changes.

Windows symlink/junction tests must report `BLOCKED` or `SKIPPED` with the reason if the environment cannot create them. They must never silently pass.

## 11. Documentation duties

Update the relevant documents whenever behavior changes:

- Operating procedure: `docs/ENGINEERING_PLAYBOOK.md`
- Product behavior: `docs/PRODUCT_SPEC.md`
- Components/processes: `docs/ARCHITECTURE.md`
- Security controls: `docs/SECURITY.md`
- Schema/migrations: `docs/DATABASE.md`
- Discovery/identity: `docs/DISCOVERY.md`
- Relationship rules: `docs/RELATIONSHIPS.md`
- API: `docs/API.md`
- Tests/results: `docs/TESTING.md`
- Progress/next task: `docs/ROADMAP.md`
- Decisions: `docs/DECISIONS.md`

Do not present planned features as implemented.

## 12. Session completion report

End every development session with:

1. What was inspected.
2. What was implemented, with status labels.
3. Files changed.
4. Commands/tests executed.
5. Actual results, including failures.
6. Known limitations.
7. Outstanding risks.
8. Exact next engineering task.

## 13. Current state

- Phase 0 is complete and confirmed by the user.
- Engineering playbook: `docs/ENGINEERING_PLAYBOOK.md` is implemented.
- Phase 1 is in progress: Gates 1 and 2 are complete (temporary storage verified, workspace packages created, pinned toolchain installed).
- Application code is scaffold only: two identity constants and one smoke test.
- `npm run typecheck`, `npm test`, and `npm run verify` pass.
- No database, migrations, scanner, API, watcher, or UI exists yet.
- Remaining Phase 1 gates require explicit continuation.
- Do not treat the installed toolchain as working product behavior.
