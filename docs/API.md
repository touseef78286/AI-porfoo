# Local API Contract

Status: **Implemented against Gate 7 (loopback server running on 127.0.0.1:3001, 186 tests passing).**
Last updated: 2026-11-04

## 1. Scope

The local API serves the private dashboard only. It is not a public API, not a filesystem API, and not a general automation surface.

Base URL (planned):

```text
http://127.0.0.1:<port>/api
```

Default port will be chosen after checking local availability; it must be configurable. The server binds only to `127.0.0.1`.

## 2. Authentication and request security

All data-bearing requests require:

```http
Authorization: Bearer <per-run-token>
```

Additional controls:

- Exact `Host` allowlist for `127.0.0.1:<port>`.
- `Origin` allowlist for the served dashboard and explicit development origin.
- No wildcard CORS.
- JSON body limit (default 1 MiB; sensitive routes smaller).
- Schema validation with unknown-field rejection on mutations.
- Rate limits on scans, root changes, publication, and directory opening.
- Request IDs in responses and logs.
- No secret values or absolute paths in error responses.

WebSocket authentication occurs during the handshake. Unauthorized sockets are closed before subscriptions.

## 3. Response conventions

Success:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_...",
    "generatedAt": "2026-11-04T00:00:00Z"
  }
}
```

Lists:

```json
{
  "data": [],
  "meta": {
    "requestId": "req_...",
    "page": { "nextCursor": null, "hasMore": false },
    "total": 0
  }
}
```

Error:

```json
{
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "Safe, actionable message",
    "requestId": "req_...",
    "details": {}
  }
}
```

Codes (initial):

- `UNAUTHORIZED`
- `FORBIDDEN_ORIGIN`
- `INVALID_ARGUMENT`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `SCAN_IN_PROGRESS`
- `LIMIT_EXCEEDED`
- `ROOT_UNAVAILABLE`
- `UNSAFE_PATH`
- `PUBLICATION_INVALID`
- `INTERNAL_ERROR`

## 4. Health

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | Optional/minimal | Liveness and version only; no inventory data |

Health must not reveal paths, counts, tokens, or database contents if unauthenticated.

## 5. Dashboard bootstrap and settings

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/bootstrap` | Yes | Initial summary, agent version, scanner state, feature flags |
| GET | `/api/settings` | Yes | Safe settings only |
| PATCH | `/api/settings` | Yes | Validated settings update |
| POST | `/api/auth/rotate-token` | Yes | Rotate the local token; invalidate existing sessions |

Token bootstrap is a separate one-time flow. The token must not appear in logged request URLs.

## 6. Projects

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/projects` | Yes | Paginated project list |
| GET | `/api/projects/:id` | Yes | Detail with evidence summary |
| GET | `/api/projects/:id/evidence` | Yes | Detection/technology/dependency evidence |
| GET | `/api/projects/:id/activity` | Yes | Status and metadata history |
| PATCH | `/api/projects/:id/classification` | Yes | Category, status, display name |
| PATCH | `/api/projects/:id/overrides` | Yes | Validated metadata overrides |
| POST | `/api/projects/:id/exclude` | Yes | Exclude from active inventory |
| POST | `/api/projects/:id/restore` | Yes | Restore to active inventory |
| POST | `/api/projects/:id/open` | Yes | Open DB-resolved project folder |
| DELETE | `/api/projects/:id` | Yes | Archive/purge only with explicit confirmation semantics |

`GET /api/projects` query parameters (initial):

- `search`
- `category`
- `language`
- `framework`
- `status`
- `detectionState`
- `rootId`
- `sort`
- `cursor`
- `limit` (server maximum enforced)

`POST /api/projects/:id/open` accepts no path. The server resolves the project, verifies it is under an authorized root, and opens it through the OS shell.

Deletion must not silently erase historical records. A hard purge is a separate, explicit operation if implemented.

## 7. Roots, exclusions, and scans

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/roots` | Yes | List authorized roots and status |
| POST | `/api/roots` | Yes | Add and validate root |
| PATCH | `/api/roots/:id` | Yes | Update display/watch settings |
| DELETE | `/api/roots/:id` | Yes | Remove authorization, preserve history |
| GET | `/api/exclusions` | Yes | List effective exclusions |
| POST | `/api/exclusions` | Yes | Add user exclusion |
| DELETE | `/api/exclusions/:id` | Yes | Remove user exclusion if not system |
| POST | `/api/scans` | Yes | Start manual scan |
| GET | `/api/scans/current` | Yes | Current progress or null |
| POST | `/api/scans/current/cancel` | Yes | Request cancellation |
| GET | `/api/scans` | Yes | Paginated scan history |
| GET | `/api/scans/:id` | Yes | Scan detail and errors |
| POST | `/api/watcher/pause` | Yes | Pause watcher processing |
| POST | `/api/watcher/resume` | Yes | Resume watcher processing |
| GET | `/api/scanner/health` | Yes | Watcher/root/reconciliation health |

Root creation request contains a path. It is validated server-side. No endpoint accepts an arbitrary path for reading arbitrary files.

## 8. Technologies, dependencies, and relationships

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/technologies` | Yes | Aggregated technology list with counts |
| GET | `/api/projects/:id/technologies` | Yes | Per-project technology evidence |
| GET | `/api/projects/:id/dependencies` | Yes | Declared/installed/used distinction |
| GET | `/api/relationships` | Yes | Filtered paginated relationships |
| GET | `/api/relationships/:id` | Yes | Evidence and state |
| POST | `/api/relationships` | Yes | Create manual relationship |
| PATCH | `/api/relationships/:id` | Yes | Edit manual metadata or reject |
| DELETE | `/api/relationships/:id` | Yes | Remove a manual relationship |
| POST | `/api/relationships/:id/verify` | Yes | User verification where allowed |
| POST | `/api/relationships/:id/reject` | Yes | Dismiss an inferred edge |
| POST | `/api/relationships/recompute` | Yes | Explicit rebuild with progress |

Relationship types and states are defined in [RELATIONSHIPS.md](RELATIONSHIPS.md).

## 9. Graph

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/graph` | Yes | Bounded graph projection |

Query parameters:

- `centerProjectId` (optional).
- `depth` (bounded).
- `relationshipTypes`.
- `states`.
- `technologyKeys`.
- `categories`.
- `nodeLimit`, `edgeLimit` (server caps).
- `includeRejected` (default false).

Response includes:

- Nodes with display fields and counts.
- Edges with class, state, and evidence-summary reference.
- `truncated` and totals.
- A stable ordering strategy.

The graph endpoint never returns raw manifests.

## 10. Publication

Phase 5 only:

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/publication/candidates` | Yes | Projects with publication state |
| GET | `/api/projects/:id/publication` | Yes | Approval/sanitized payload/history |
| POST | `/api/projects/:id/publication/approve` | Yes | Approve explicit fields |
| PATCH | `/api/projects/:id/publication` | Yes | Update approved fields |
| POST | `/api/projects/:id/publication/unpublish` | Yes | Remove from next snapshot |
| POST | `/api/publication/validate` | Yes | Validate without publishing |
| POST | `/api/publication/snapshots` | Yes | Generate immutable snapshot |
| GET | `/api/publication/snapshots` | Yes | Publication history |
| GET | `/api/publication/snapshots/:id` | Yes | Validation and sync status |

No route returns private data to an unapproved public consumer.

## 11. WebSocket events

Endpoint (planned): `/ws`

Envelope:

```json
{
  "type": "scan.progress",
  "eventId": "evt_...",
  "occurredAt": "2026-11-04T00:00:00Z",
  "data": {}
}
```

Initial event types:

- `agent.ready`
- `scanner.state`
- `scan.started`
- `scan.progress`
- `scan.completed`
- `scan.failed`
- `project.created`
- `project.updated`
- `project.missing`
- `project.restored`
- `relationship.changed`
- `watcher.state`
- `publication.changed`

Rules:

- Events contain identifiers and safe summaries, not raw manifests or secrets.
- The client must tolerate reconnects.
- On reconnect, the client re-fetches current state; events are not the source of truth.
- Event backlog is bounded.
- WebSocket messages are schema-validated server-side where relevant.

## 12. Pagination and limits

- Cursor-based pagination for projects, relationships, scans, and publication history.
- Server-enforced maximum page size.
- Graph node/edge caps independent of page size.
- Search input length capped.
- Body and query sizes capped.
- Rate limits for scans, roots, open-folder, and publication operations.

## 13. Versioning

The API is private and co-versioned with the dashboard. A `/api/meta` or bootstrap response will expose:

- Agent version.
- API schema version.
- Database schema version.
- Public snapshot schema version when relevant.

Breaking changes require a documented migration and dashboard update.

## 14. Verification requirements

Before an endpoint is marked implemented:

- Auth test exists.
- Host/Origin rejection test exists.
- Input validation test exists.
- Happy-path integration test exists.
- Error path test exists.
- No arbitrary filesystem behavior is exposed.
- Response schema is tested.
- Logs do not contain secrets or tokens.

No endpoint in this document is currently implemented.
