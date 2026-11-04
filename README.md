# My Local Project Intelligence

A local-first project intelligence platform for Windows development machines. It discovers software projects inside explicitly authorized directories, extracts evidence-based metadata, stores the inventory in SQLite, and presents a private engineering dashboard. A separately published, explicitly approved snapshot can later power a public portfolio without exposing the local machine or database.

## Current status

**Phase 1 — discovery foundation, in progress (Gates 1–2 complete).**

Phase 0 is complete and confirmed. The workspace now contains the pinned toolchain and scaffold packages, but there is **still no working product**:

- No scanner implementation.
- No database schema applied.
- No local API.
- No dashboard.
- No public portfolio.
- Toolchain installed; type check and one smoke test pass.

Phase 1 implementation continues only on explicit authorization.

## Product principles

- Discovery is restricted to user-authorized roots.
- No secret extraction and no source-file archiving.
- Every relationship carries evidence and a verification state.
- Similar technology is never represented as a dependency.
- Publication requires explicit, per-project approval and sanitization.
- The public application consumes approved snapshots, never the local database.
- The system must remain usable offline and within the target machine's resource limits.

## Measured target environment

| Item | Evidence |
|---|---|
| Operating system | Windows 11 Pro, build 26200, 64-bit |
| CPU | Intel Core i5-8350U, 4 cores / 8 logical processors |
| RAM | ~7.24 GiB usable; 0.29–0.68 GiB free during audit |
| Workspace drive | `T:` fixed NTFS, ~39.25 GiB free |
| System drive | `C:` fixed NTFS, ~614 MiB free |
| Node.js | v24.11.0 x64 |
| npm | 11.8.0 |
| pnpm | 10.34.5 |
| Git | 2.51.2.windows.1 |
| npm registry | Reachable (`npm ping` PONG) |
| Workspace | `T:\My AI portfolio`, empty before Phase 0 |

The low free space on `C:` and low free RAM are design constraints, not incidental details. Build output, caches, and local data must stay on a suitable drive, and development must avoid running multiple heavy servers concurrently.

Full audit: [docs/PHASE_0_AUDIT.md](docs/PHASE_0_AUDIT.md).

## Planned workspace layout

```text
.
├── AGENTS.md                 Permanent engineering rules
├── apps
│   ├── agent                 Local agent, scanner, SQLite, Fastify API
│   └── dashboard             Private React dashboard
├── packages
│   └── core                  Pure domain logic and shared contracts
├── tests
│   └── fixtures              Repeatable discovery and security fixtures
├── docs
│   ├── PRODUCT_SPEC.md
│   ├── ARCHITECTURE.md
│   ├── SECURITY.md
│   ├── DATABASE.md
│   ├── DISCOVERY.md
│   ├── RELATIONSHIPS.md
│   ├── API.md
│   ├── TESTING.md
│   ├── ROADMAP.md
│   ├── DECISIONS.md
│   └── PHASE_0_AUDIT.md
└── scripts                   Verification and operational scripts (later)
```

`apps/portfolio` is intentionally absent until Phase 5. Its hosting choice is not yet justified or decided.

## Documentation map

| Document | Purpose |
|---|---|
| [AGENTS.md](AGENTS.md) | Permanent rules for every future coding session |
| [PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) | Functional requirements and acceptance criteria |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Component boundaries and runtime design |
| [SECURITY.md](docs/SECURITY.md) | Threat model and required controls |
| [DATABASE.md](docs/DATABASE.md) | Target schema and persistence rules |
| [DISCOVERY.md](docs/DISCOVERY.md) | Scanning, confidence, identity, and reconciliation |
| [RELATIONSHIPS.md](docs/RELATIONSHIPS.md) | Relationship classes and evidence rules |
| [API.md](docs/API.md) | Planned local API and event contracts |
| [TESTING.md](docs/TESTING.md) | Test strategy, fixtures, and recorded results |
| [ROADMAP.md](docs/ROADMAP.md) | Phase status and next task |
| [DECISIONS.md](docs/DECISIONS.md) | Architecture decision records |

## Prerequisites

- Node.js `>=24.11.0 <25` (verified locally).
- npm `>=11.8.0 <12` (verified locally).
- Git for version history.
- Windows PowerShell 5.1 or PowerShell 7+.
- A writable data directory on a drive with sufficient free space.

Node's built-in `node:sqlite` module currently emits an experimental warning on this runtime. It is available and FTS5-enabled, but it is isolated behind a database adapter so the decision can be revisited. See [DECISIONS.md](docs/DECISIONS.md).

## Setup and verification

No application setup is available yet. Phase 0 deliberately does not install packages or expose placeholder application commands that might be mistaken for working software.

The only runnable command is the Phase 0 documentation/configuration check:

```powershell
npm run verify:phase0
```

It uses Node.js built-ins only. It verifies required files, parses JSON configuration, and checks internal Markdown links. It does **not** test application behavior.

The application verification entry point will be added only when the corresponding scripts and tests exist:

```powershell
npm run verify
```

## Privacy and safety

- Do not place secrets, `.env` values, tokens, or private keys in this repository.
- Scanner tests must use generated fixtures, not personal project directories.
- Never point the scanner at `C:\`, a user profile root, system directories, or cloud-synced credential folders.
- Public snapshots must be generated from an allowlist of fields, not by deleting fields from a private payload.

See [docs/SECURITY.md](docs/SECURITY.md).
