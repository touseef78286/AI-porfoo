# Local Agent

Status: **Scaffold only. No implementation exists.**

Planned responsibilities:

- CLI and process lifecycle.
- Authorized-root validation.
- Bounded filesystem traversal and manifest reads.
- Chokidar watchers and reconciliation.
- Metadata, technology, and dependency extraction.
- SQLite adapter, migrations, and repositories.
- Fastify API on `127.0.0.1`.
- WebSocket event publication.
- Structured, redacted logging.
- Publication snapshot orchestration in Phase 5.

Boundaries:

- No UI code.
- No generic filesystem API.
- No execution of project scripts.
- No scanning outside configured roots.
- Domain algorithms belong in `packages/core`, not route handlers.

See [../../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) and [../../docs/SECURITY.md](../../docs/SECURITY.md).
