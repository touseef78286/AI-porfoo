# Product Specification

Status: **Requirements defined; implementation not started.**
Last updated: 2026-11-04

## 1. Purpose

My Local Project Intelligence discovers software projects inside authorized local directories, builds a traceable inventory, explains relationships between projects, and presents the result through a private dashboard and an optional approved public portfolio.

The system must remain useful with no network connection and no external AI service.

## 2. Users and contexts

### Primary user

A developer on a resource-constrained Windows laptop who needs to understand:

- What projects exist.
- What each project uses.
- Which projects are related and why.
- What changed since the previous scan.
- Which projects are suitable for public display.

### Public visitor

A visitor to the portfolio who sees only explicitly approved, sanitized project information. The visitor never reaches the local API, local database, filesystem, or private repository information.

## 3. Product surfaces

### 3.1 Private dashboard

Dark-first, dense, technical, and responsive. It must display actual local database data through the local API.

### 3.2 Public portfolio

A separately deployed application consuming an approved snapshot. It must not require the laptop to be online. It must never query the local machine.

### 3.3 Local agent

A manually started Windows process that scans, watches, stores, and serves. Windows startup integration is optional and later.

## 4. Functional requirements

Status key: `NOT IMPLEMENTED`, `PARTIALLY IMPLEMENTED`, `IMPLEMENTED`, `VERIFIED`, `BLOCKED`.

### 4.1 Authorized roots and exclusions

| ID | Requirement | Phase | Status |
|---|---|---|---|
| R-ROOT-1 | Add an authorized scan root with canonical path validation | 1 | NOT IMPLEMENTED |
| R-ROOT-2 | Remove an authorized root without deleting historical project records | 1 | NOT IMPLEMENTED |
| R-ROOT-3 | Reject drive roots, Windows system directories, credential stores, and unsupported locations | 1 | NOT IMPLEMENTED |
| R-ROOT-4 | Configure exclusions by directory name, relative path, or glob | 1 | NOT IMPLEMENTED |
| R-ROOT-5 | Pause and resume scanning/watching | 2 | NOT IMPLEMENTED |
| R-EXCL-1 | Excluded directories are never read by the scanner | 1 | NOT IMPLEMENTED |
| R-EXCL-2 | Sensitive files are denied before any read, regardless of exclusions | 1 | NOT IMPLEMENTED |

### 4.2 Discovery and detection

| ID | Requirement | Phase | Status |
|---|---|---|---|
| R-DISC-1 | Detect supported ecosystems by recognized manifests | 1 | NOT IMPLEMENTED |
| R-DISC-2 | Require evidence and compute confidence; a lone weak signature is not a confirmed project | 1 | NOT IMPLEMENTED |
| R-DISC-3 | Detect nested projects and workspace members deterministically | 1 | NOT IMPLEMENTED |
| R-DISC-4 | Avoid duplicate projects when multiple signatures exist in one directory | 1 | NOT IMPLEMENTED |
| R-DISC-5 | Assign a stable internal project identifier | 1 | NOT IMPLEMENTED |
| R-DISC-6 | Preserve history when a project is renamed, moved, deleted, or restored | 1–2 | NOT IMPLEMENTED |
| R-DISC-7 | Request manual identity resolution when confidence is insufficient | 2 | NOT IMPLEMENTED |

### 4.3 Incremental monitoring

| ID | Requirement | Phase | Status |
|---|---|---|---|
| R-WATCH-1 | Watch only authorized roots and relevant paths | 2 | NOT IMPLEMENTED |
| R-WATCH-2 | Debounce and coalesce filesystem events | 2 | NOT IMPLEMENTED |
| R-WATCH-3 | Refresh only affected project metadata | 2 | NOT IMPLEMENTED |
| R-WATCH-4 | Handle deletion, rename, move, and restore | 2 | NOT IMPLEMENTED |
| R-WATCH-5 | Run periodic reconciliation independent of watcher events | 2 | NOT IMPLEMENTED |
| R-WATCH-6 | Recover from watcher failures without losing inventory | 2 | NOT IMPLEMENTED |

### 4.4 Metadata and technology intelligence

| ID | Requirement | Phase | Status |
|---|---|---|---|
| R-META-1 | Extract name, path, ecosystem, category, status, and timestamps | 1 | NOT IMPLEMENTED |
| R-META-2 | Extract Git repository information without reading source code | 1 | NOT IMPLEMENTED |
| R-TECH-1 | Fingerprint languages, frameworks, runtimes, and databases from manifests | 3 | NOT IMPLEMENTED |
| R-TECH-2 | Distinguish declared, installed, and actually used dependencies | 3 | NOT IMPLEMENTED |
| R-DEP-1 | Store dependencies with ecosystem, scope, version spec, source file, and evidence | 3 | NOT IMPLEMENTED |
| R-DEP-2 | Never execute project scripts or install into discovered projects | Always | NOT IMPLEMENTED |

### 4.5 Relationships

| ID | Requirement | Phase | Status |
|---|---|---|---|
| R-REL-1 | Compute technology similarity with shared-technology evidence | 3 | NOT IMPLEMENTED |
| R-REL-2 | Verify local workspace/path dependencies with concrete manifest evidence | 3 | NOT IMPLEMENTED |
| R-REL-3 | Never represent similarity as a dependency | 3 | NOT IMPLEMENTED |
| R-REL-4 | Support manual relationships | 3–4 | NOT IMPLEMENTED |
| R-REL-5 | Store evidence, method, confidence, verification state, and timestamps | 3 | NOT IMPLEMENTED |
| R-REL-6 | Support reject/dismiss behavior without recreating a rejected edge automatically | 3 | NOT IMPLEMENTED |
| R-REL-7 | Keep every relationship explainable in the UI | 4 | NOT IMPLEMENTED |

### 4.6 Private dashboard

| ID | Requirement | Phase | Status |
|---|---|---|---|
| R-UI-1 | Overview with actual totals, categories, technologies, recent discoveries, scanner health, last scan, and pending approvals | 4 | NOT IMPLEMENTED |
| R-UI-2 | Project explorer with search and filters | 4 | NOT IMPLEMENTED |
| R-UI-3 | Project detail with evidence and local folder opening | 4 | NOT IMPLEMENTED |
| R-UI-4 | Interactive relationship graph with filtering, zoom, pan, selection, and reset | 4 | NOT IMPLEMENTED |
| R-UI-5 | Classification, exclusion/restore, overrides, and manual relationships | 4 | NOT IMPLEMENTED |
| R-UI-6 | Scanner controls, roots, exclusions, progress, history, and errors | 4 | NOT IMPLEMENTED |
| R-UI-7 | No production mock data fallback | 4 | NOT IMPLEMENTED |

### 4.7 Publication

| ID | Requirement | Phase | Status |
|---|---|---|---|
| R-PUB-1 | Private by default; explicit per-project approval required | 5 | NOT IMPLEMENTED |
| R-PUB-2 | Sanitize through an allowlist, not by removing known-bad fields | 5 | NOT IMPLEMENTED |
| R-PUB-3 | Validate the public schema before writing a snapshot | 5 | NOT IMPLEMENTED |
| R-PUB-4 | Publish, update, unpublish, and record history | 5 | NOT IMPLEMENTED |
| R-PUB-5 | Public app operates without the laptop online | 5 | NOT IMPLEMENTED |
| R-PUB-6 | No local paths, remotes, source, secrets, logs, or unapproved records in public output | 5 | NOT IMPLEMENTED |

### 4.8 Search and history

| ID | Requirement | Phase | Status |
|---|---|---|---|
| R-HIST-1 | Record scan runs, counts, duration, errors, and trigger | 1 | NOT IMPLEMENTED |
| R-HIST-2 | Show scan history and error reports | 4 | NOT IMPLEMENTED |
| R-HIST-3 | Search project name, description, technology, and category | 4 | NOT IMPLEMENTED |
| R-HIST-4 | Preserve historical project records and identity links | 2 | NOT IMPLEMENTED |

## 5. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | Bind local API only to `127.0.0.1`. |
| NFR-2 | Authenticate data-bearing requests and validate Host/Origin. |
| NFR-3 | Bound scans by roots, ignore rules, file size, concurrency, and time. |
| NFR-4 | Keep idle agent memory low enough for an 8 GB Windows laptop; measure, do not guess. |
| NFR-5 | Keep database and build artifacts off a nearly full system drive. |
| NFR-6 | Use transactions for multi-step writes and migrations. |
| NFR-7 | Run with no external AI dependency. |
| NFR-8 | Work offline for discovery, dashboard, and local publication preview. |
| NFR-9 | Maintain accessible controls and readable graph content. |
| NFR-10 | Record actual test and benchmark evidence. |

## 6. Supported ecosystems

Initial detectors:

| Ecosystem | Signatures |
|---|---|
| JavaScript / TypeScript | `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, `bun.lockb`, `tsconfig.json` |
| Python | `requirements.txt`, `pyproject.toml`, `Pipfile`, `setup.py` |
| Rust | `Cargo.toml` |
| Go | `go.mod` |
| Flutter / Dart | `pubspec.yaml` |
| Java | `pom.xml`, `build.gradle`, `build.gradle.kts` |
| .NET | `*.sln`, `*.csproj` |
| PHP | `composer.json` |
| Ruby | `Gemfile` |

Additional ecosystems require a detector module, tests, and documentation. They must not be inferred without a signature.

## 7. Out of scope for the first release

- Scanning entire drives.
- Reading or indexing all source code.
- Executing project tests or builds.
- Cloud AI enrichment of private data.
- Multi-user accounts or remote access.
- Windows service/startup integration.
- Mobile applications.
- Real-time collaboration.
- Public hosting as a prerequisite for local operation.

## 8. Acceptance criteria by phase

See [ROADMAP.md](ROADMAP.md). A phase is complete only when its criteria are verified with executed evidence.

## 9. Product invariants

1. Discovery does not imply publication.
2. Similarity does not imply dependency.
3. Missing evidence means `UNKNOWN`, not a guessed value.
4. Deleted projects are historical records, not silent deletions.
5. The public app never reads the local database.
6. The scanner never reads secrets.
7. Every important operation is testable and logged.
