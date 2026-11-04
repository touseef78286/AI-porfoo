# Core Domain

Status: **Scaffold only. No implementation exists.**

Planned contents:

- Shared TypeScript contracts and schemas.
- Ecosystem detector modules.
- Confidence scoring.
- Nested-project and identity rules.
- Technology normalization.
- Similarity and local-dependency relationship rules.
- Publication allowlist and public schema validation.
- Pure helpers used by the agent and private dashboard.

Boundaries:

- No Node filesystem APIs.
- No Fastify, SQLite, React, or browser APIs.
- No external AI calls.
- No secret handling.

The package must remain deterministic and unit-testable.

See [../../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).
