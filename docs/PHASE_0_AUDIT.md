# Phase 0 — Workspace and Environment Audit

Date: 2026-11-04
Workspace: `T:\My AI portfolio`
Status: **COMPLETE** for audit and foundation; product implementation not started.

## 1. Scope

This audit covers:

- The current working directory.
- Existing files and repository state.
- Node.js, npm, pnpm, Git, and PowerShell availability.
- Operating system, CPU, memory, and storage.
- Package registry reachability.
- Feasibility of SQLite options available to the installed Node.js runtime.

No development directory outside `T:\My AI portfolio` was scanned. No personal project contents were read.

## 2. Workspace findings

| Check | Result |
|---|---|
| Current directory | `T:\My AI portfolio` |
| Initial visible entries | 0 |
| Initial hidden entries | 0 |
| Existing application | None |
| Existing `package.json` | None |
| Existing lockfile | None |
| Git repository | No (`fatal: not a git repository`) |
| Existing framework/tooling | None |
| Files modified before audit | None |

The workspace is empty. The directory name matches the product being requested, so it is treated as the intended workspace. Phase 1 still requires explicit user confirmation.

## 3. Runtime and tooling

| Tool | Result | Notes |
|---|---|---|
| Node.js | `v24.11.0` | x64, `C:\Program Files\nodejs\node.exe` |
| npm | `11.8.0` | npm cache at `T:\npm-cache` |
| pnpm | `10.34.5` | Store at `T:\.pnpm-store\v10` |
| Yarn | Not installed | Command not found |
| Bun | Not installed | Command not found |
| Git | `2.51.2.windows.1` | Global identity configured |
| PowerShell | `5.1.26100.9444` | Windows PowerShell |
| npm registry | Reachable | `npm ping` returned PONG in 601 ms |

No package dependencies are installed in the workspace.

## 4. System constraints

### Operating system

- Microsoft Windows 11 Pro
- Version `10.0.26200`
- Build `26200`
- 64-bit

### CPU

- Intel Core i5-8350U CPU @ 1.70 GHz
- 4 physical cores
- 8 logical processors

### Memory

- `Win32_OperatingSystem.TotalVisibleMemorySize`: 7,588,276 KB (~7.24 GiB)
- `FreePhysicalMemory` sample: 307,152 KB (~0.29 GiB)
- `os.freemem()` later sample: ~0.68 GiB

Free memory varied during the audit, but headroom was consistently below 1 GiB. This makes concurrent heavy development servers, large test workers, and unbounded scanning unacceptable defaults.

### Storage

| Volume | File system | Type | Size | Free |
|---|---|---:|---:|---:|
| `C:` | NTFS | Fixed | 149,228,089,344 B (~139 GiB) | 643,608,576 B (~614 MiB) |
| `T:` | NTFS | Fixed | 104,856,547,328 B (~97.7 GiB) | 42,145,705,984 B (~39.25 GiB) |

The workspace is on `T:`, which is correct for this environment. Builds and local data must not be redirected to `C:` without checking free space.

### Windows filesystem capabilities

A contained test was run under the workspace and cleaned up immediately:

| Capability | Result |
|---|---|
| NTFS junction creation | Available |
| Direct symbolic-link creation | `BLOCKED: Administrator privilege required for this operation.` |
| `fsutil behavior query SymlinkEvaluation` | Local-to-local enabled; local-to-remote enabled; remote-to-local/remote-to-remote disabled |
| Windows Developer Mode registry flag | Not present |
| Git `core.longpaths` | Not configured |

Implication: junction escape tests can run locally. Direct symbolic-link fixture creation requires an elevated test run or a fixture created during CI; the normal test run must report the capability as `BLOCKED` rather than silently passing. Long-path behavior must not be assumed.

## 5. SQLite capability check

Node's built-in `node:sqlite` was exercised in memory:

```powershell
node -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(':memory:'); db.exec('CREATE TABLE t(x INTEGER); INSERT INTO t VALUES (1);'); console.log(db.prepare('SELECT x FROM t').get()); db.close();"
```

Observed:

```json
{"x":1}
(node:23076) ExperimentalWarning: SQLite is an experimental feature and might change at any time
```

Additional observations:

- `PRAGMA compile_options` exposes `ENABLE_FTS5`, `ENABLE_FTS3`, `ENABLE_FTS3_PARENTHESIS`, `THREADSAFE=1`, and WAL defaults.
- `DatabaseSync` provides `exec` and `prepare`.
- No `backup` method was present on the database object.
- The API is experimental in this Node.js release.

Implication: `node:sqlite` is usable for Phase 1 behind a narrow adapter. Backups must use a supported SQL approach such as `VACUUM INTO`, and the adapter must allow a later migration to a stable driver if needed. See [DECISIONS.md](DECISIONS.md).

## 6. Environment risks

| Risk | Severity | Impact | Mitigation |
|---|---|---|---|
| Low free RAM | High | Concurrent Vite, Fastify, tests, and watchers may exhaust memory | One process at a time; bounded workers; lazy graph loading; measure |
| Low free space on `C:` | High | npm/global/temp writes can fail | Keep workspace, npm cache, pnpm store, and data on `T:`; monitor |
| `node:sqlite` experimental | Medium | API or behavior may change | Database adapter; pinned Node range; backup/export tests |
| Windows filesystem watching | Medium | Missed or duplicate events | Chokidar settings, debouncing, periodic reconciliation |
| Symlink/junction creation privileges | Medium | Junction tests can run; direct symbolic-link tests require elevation | Use junctions for normal fixtures; report symlink tests `BLOCKED` without privilege; never silently skip |
| PowerShell version 5.1 | Low | Some modern syntax unavailable in scripts | Use PowerShell 5.1-compatible operational commands |
| Public/private leakage | Critical | Private metadata exposure | Explicit approval + allowlist sanitizer + snapshot tests |

## 7. Architectural consequences

1. Use a **modular monolith**: one local agent process plus a static private dashboard build.
2. Use **npm workspaces**; npm is already present and npm's cache is on `T:`.
3. Keep the private dashboard as a Vite-built SPA. Do not run Next.js locally just for the private UI.
4. Defer the public application until Phase 5; select hosting based on a real deployment requirement.
5. Use bounded, manifest-only scanning by default.
6. Do not run multiple heavy dev servers simultaneously.
7. Treat the data directory as private and keep it out of Git.
8. Avoid Docker entirely.

## 8. Phase 0 verification

Phase 0 verification is documentation- and configuration-only:

- Read the empty workspace, including hidden entries.
- Confirmed runtime/tool versions.
- Confirmed storage and memory constraints.
- Confirmed registry reachability.
- Confirmed SQLite capability and its experimental status.
- Created repository rules, baseline configuration, and design documents.

No application tests, type checks, lint checks, or builds exist yet. They must not be reported as passing.

## 9. Confirmation required

Before Phase 1:

1. Confirm `T:\My AI portfolio` is the intended project workspace.
2. Approve the architecture and Phase 1 plan in [ARCHITECTURE.md](ARCHITECTURE.md) and [ROADMAP.md](ROADMAP.md).
3. Confirm that no development root outside this workspace should be scanned without being configured through the product.
