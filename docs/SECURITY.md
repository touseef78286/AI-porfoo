# Security and Privacy

Status: **Target controls defined. No security control is implemented yet.**
Last updated: 2026-11-04

## 1. Security objectives

1. Prevent unauthorized access to the local API and database.
2. Prevent scanning outside explicitly authorized roots.
3. Prevent reading or persisting secret material.
4. Prevent path traversal and unsafe reparse-point traversal.
5. Prevent private data from entering public snapshots.
6. Prevent a malicious web page from using the loopback API.
7. Keep the public application independent of the local machine.
8. Make security-relevant behavior testable.

## 2. Data classification

| Class | Examples | Storage | Public |
|---|---|---|---|
| Secret | `.env` values, tokens, private keys, passwords, cookies | Never read/stored | Never |
| Private local | Filesystem paths, Git remotes, raw manifest contents | Local DB only; minimize | Never |
| Private derived | Project names, dependencies, relationships, scan history | Local DB | Only if explicitly approved and allowlisted |
| Public approved | Sanitized title, description, technologies, categories, selected relationships | Snapshot | Yes |
| Operational | Logs, scan errors, request IDs | Local logs | Never |

## 3. Threat model

| Threat | Example | Impact | Required controls | Phase |
|---|---|---|---|---|
| Unauthorized local API use | Another local process calls the API | Data disclosure or mutation | Per-run bearer token; Host/Origin checks; loopback bind | 1/4 |
| DNS rebinding | A website resolves to 127.0.0.1 | Browser reads local data | Exact Host allowlist; Origin validation; token; no permissive CORS | 1 |
| CSRF-style browser request | Malicious form posts to local API | State change | Token in Authorization header, not cookies; Origin check | 1 |
| Path traversal | `../../Windows` in a request | Arbitrary filesystem access | No arbitrary path API; DB-resolved paths; canonical containment | 1 |
| Symlink/junction escape | Reparse point leaves authorized root | Unauthorized scan/read | `lstat` detection; skip reparse points; realpath containment | 1 |
| Scraping sensitive files | `.env`, `id_rsa`, `.npmrc` | Credential theft | Deny patterns applied before read; no source reads | 1 |
| Malicious manifest | Huge/deeply nested/invalid JSON | DoS or parser crash | Size limit, parse budget, error isolation, no execution | 1 |
| SQL injection | Crafted search/filter | Database compromise | Prepared statements; typed validation | 1 |
| Stored XSS | Project name contains markup | Dashboard compromise | React escaping; no raw HTML; CSP; sanitize any markdown | 4 |
| Public leakage | Local path in snapshot | Privacy breach | Explicit approval; allowlist sanitizer; schema validation; tests | 5 |
| Public app reaches local machine | Runtime fetch to loopback | Local exposure | Static snapshot only; no local endpoint configuration | 5 |
| Log leakage | Token/path in logs | Disclosure | Structured allowlisted fields; redaction; no request headers | 1 |
| Resource exhaustion | Huge scan or graph query | Local DoS | Root limits, ignore rules, concurrency, pagination, graph caps, rate limits | 1/4 |
| Supply-chain compromise | Malicious package | Code execution | Minimal dependencies; lockfile; audit; review install scripts | 1+ |
| Unapproved publication | Project auto-published | Privacy breach | Private-by-default state; explicit approval; publication tests | 5 |

## 4. Local API security

### 4.1 Binding

- Listen on `127.0.0.1` only.
- Do not bind `0.0.0.0`, `::`, or a LAN interface.
- Do not enable UPnP, port forwarding, or remote access.

### 4.2 Authentication

- Generate a cryptographically random token per agent run (at least 256 bits).
- Store it in a private, gitignored runtime file with restrictive permissions.
- Require `Authorization: Bearer <token>` for data-bearing routes.
- Use constant-time comparison where practical.
- Reject missing, malformed, or stale tokens.
- Do not put the token in URLs that are logged. The dashboard bootstrap uses a fragment or one-time exchange so the token is not sent to the server as a path/query value.
- WebSocket authentication occurs during the handshake, before subscribing to events.
- Provide an explicit "rotate token" operation for the user.

Health checks may be unauthenticated only if they reveal no private data.

### 4.3 Host and Origin

- Accept only exact loopback host values configured for the agent port, such as `127.0.0.1:<port>`.
- Reject unknown `Host` values (DNS rebinding defense).
- For browser-originated requests, accept only the production dashboard origin and an explicitly enabled development origin.
- Do not use wildcard CORS.
- Reject WebSocket connections with disallowed Origin.

### 4.4 Input validation and limits

- Validate body, query, and params with shared schemas.
- Default JSON body limit no larger than 1 MiB; sensitive routes smaller.
- Paginate lists with server-enforced maximum page size.
- Cap graph node and edge counts and return truncation metadata.
- Rate-limit scans, root changes, publication actions, and open-folder requests.
- Reject unknown fields on sensitive mutation schemas.
- Reject duplicate or conflicting operations idempotently.

### 4.5 Errors and logging

- Return stable error codes, a safe message, and a request ID.
- Do not include stack traces, filesystem paths, SQL, or secret values in responses.
- Log structured fields from an allowlist.
- Never log Authorization headers, tokens, environment values, or raw manifests.
- Redact home-directory prefixes where full paths are unnecessary.

## 5. Filesystem security

### 5.1 Authorized roots

A root is accepted only after:

1. It exists and is a directory.
2. It is absolute and canonicalized.
3. It is not a drive root.
4. It is not inside a denied system/credential directory.
5. It is not a reparse point pointing outside the intended location.
6. The user explicitly confirms it.
7. It is persisted with an audit timestamp.

Implementation status (Gate 4, `VERIFIED` by tests): `apps/agent/src/roots/validate-root.ts` enforces items 1–4 on both the supplied and the resolved path, and rejects *any* symbolic link or junction as a root (`REPARSE_ROOT`), which is stricter than item 5. `@lpi/core` deny rules reject drive roots, UNC paths, system directories, the user profile root, `AppData`, and credential stores; the agent adapter additionally denies the machine's environment-derived system locations and profile root, so the policy is not tied to `C:`. Items 6–7 are API/UI work and do not exist yet.

### 5.2 Traversal

- Never follow symbolic links, junctions, mount points, or other reparse points by default.
- Detect reparse points with `lstat`/Windows attributes where supported.
- If a reparse point is encountered, record a warning and skip it.
- For every file operation, verify canonical containment within an authorized root.
- Do not expose a generic `readFile`, `listDirectory`, or `openPath` API.
- Open-folder operations resolve a project ID from the database, verify it is under an authorized root, and then invoke the OS shell with an argument array.
- Do not execute discovered project scripts or binaries.

Implementation status (Gate 5, `VERIFIED` by tests): `traverseRoot` uses `lstat` per entry, skips and records reparse points, never follows them, and checks that every candidate path stays under the root's canonical comparison path. Error messages are generic and never contain absolute paths. The remaining bullets (project-open, OS shell) belong to later API work.

### 5.3 Sensitive deny list

Deny before opening, at minimum:

- `.env`, `.env.*` (except `.env.example` only if explicitly needed; default deny all).
- `*.pem`, `*.key`, `*.pfx`, `*.p12`, `*.jks`, `*.keystore`.
- `id_rsa*`, `id_ed25519*`, `*.ppk`.
- `.npmrc`, `.pypirc`, `.netrc`, `.git-credentials`, `.htpasswd`.
- `credentials*`, `secrets*`, `*.kdbx`, `*.mobileprovision`.
- Browser profile directories, SSH directories, cloud credential directories.
- `.git` object internals, not the repository metadata needed for discovery.

Only a narrow allowlist of manifest/config filenames is read. The deny list is defense in depth, not the primary boundary.

Implementation status (Gate 4): the name, extension, and directory rules are implemented in `packages/core/src/roots/sensitive-files.ts` and exposed as `checkManifestRead`. They are unit-tested but not yet called by a reader, because traversal does not exist. `.env.example` is currently denied as well.

### 5.4 Bounded reads

- Read only recognized manifests and bounded metadata files.
- Use per-file size limits (for example, 256 KiB for typical manifests).
- Use an aggregate parse budget per scan.
- Do not read lockfile contents merely to detect a project; presence is enough in Phase 1.
- Do not read source files for detection.
- Close file handles promptly.

Implementation status (Gate 5): only allowlisted manifests are opened, `readContent: false` entries (all lockfiles and config files) are never opened at all, reads are capped at `maxManifestBytes` (256 KiB default) with a `maxBytes + 1` buffer, and handles close in `finally`. Content is hashed and discarded; nothing is stored.

## 6. Git metadata

Allowed:

- Repository root detection.
- Branch name.
- Remote URL stored locally only.
- Last commit timestamp/hash if obtainable without executing untrusted hooks.

Not allowed:

- Reading `.git/config` secrets beyond the required remote URL.
- Running repository scripts/hooks.
- Publishing remotes.
- Reading commit contents or source history.

Git operations must not execute project code. Use bounded, non-interactive commands and a timeout.

## 7. Secret handling

- Never read secrets into memory.
- Never store secret values in SQLite.
- Never include secrets in logs, fixtures, screenshots, or public output.
- Test fixtures must use obviously fake values and still be deny-listed.
- If a file is accidentally read, do not log its content; record only the relative path and error class.
- `.env` files are gitignored by default.

## 8. Publication security

Public projection is allowlist-based:

Allowed fields (subject to approval):

- Public project ID.
- Title.
- Sanitized short description.
- Approved long description/case study.
- Approved categories.
- Approved technology names and versions.
- Approved relationships with public labels.
- Approved dates and screenshots/assets.

Denied fields:

- Local absolute paths.
- Relative paths that reveal identity.
- Git remotes and private repository URLs.
- Source code.
- Environment variables or secrets.
- Internal logs, scan errors, database IDs not intended for public use.
- Unapproved projects.
- Internal notes, raw dependency graphs, and scanner internals.

Controls:

1. Approval is per project and explicit.
2. Sanitizer constructs a new object; it does not mutate/delete private fields.
3. Schema validation runs before writing.
4. Automated scans reject path/URL/token patterns.
5. Snapshot includes a content hash and publication timestamp.
6. Unpublish creates a new snapshot.
7. Public assets are generated outside the private database path.
8. Tests assert unapproved projects never appear and the public app has no local API dependency.

## 9. Web security

- Production dashboard served with a restrictive Content Security Policy.
- No `unsafe-eval` in production.
- No raw HTML rendering of project metadata unless it passes a sanitizer and the need is documented.
- External links use `rel="noopener noreferrer"`.
- No third-party analytics on the private dashboard.
- Public portfolio analytics, if any, must not receive private data.
- Use same-origin API calls.
- Set frame-ancestors to prevent embedding the private dashboard.

## 10. Supply chain

- Commit lockfiles.
- Use exact versions (`save-exact=true`).
- Review new dependencies for necessity and install scripts.
- Run `npm audit` and record results; do not claim zero vulnerabilities without evidence.
- Avoid packages that execute network calls at install time.
- Do not add a dependency for trivial functionality.
- Document any package with native or postinstall behavior.

## 11. Backup and recovery

- Back up the local database before migrations.
- Use a consistent SQLite backup method (`VACUUM INTO` initially).
- Keep a small bounded set of backups in a private directory.
- Do not back up secrets because none should be stored.
- Test restore into a temporary database.
- A failed migration must stop startup before the API serves data.

## 12. Security verification matrix

| Test | Phase |
|---|---|
| API rejects missing/invalid token | 1 |
| API rejects bad Host and Origin | 1 |
| API contains no arbitrary filesystem route | 1 |
| Path traversal and junction escape are blocked | 1 |
| Sensitive fixture files never enter DB/logs | 1 |
| Malformed manifests do not crash scan | 1 |
| Scan limits stop runaway traversal | 1 |
| SQL injection payloads are treated as data | 1 |
| Public sanitizer excludes denied fields | 5 |
| Unapproved project absent from snapshot | 5 |
| Public app works with local agent stopped | 5 |
| CSP and XSS payload behavior verified | 4/6 |

## 13. Residual risks

- Any process running as the same Windows user may access local files outside the app's controls. The app reduces its own surface but cannot secure the whole user account.
- Windows reparse-point behavior varies by filesystem and privilege. Tests must record actual capability.
- Metadata can be sensitive even without source code. Public approval is mandatory.
- `node:sqlite` is experimental on the verified runtime; backup and migration behavior require tests.
- npm dependencies can change behavior across versions; lockfiles and review are required.

## 14. Reporting a security issue

Do not paste secrets, private paths, or full manifests into an issue. Record a minimal reproduction, affected component, and the security-relevant error class. Rotate any exposed local token.
