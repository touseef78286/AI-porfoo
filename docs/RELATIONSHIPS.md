# Relationship Intelligence

Status: **Rules specified. Not implemented.**
Last updated: 2026-11-04

## 1. Principle

A relationship is a claim. Every claim must state:

- What kind of relationship it is.
- Which projects it connects.
- What evidence supports it.
- How it was detected.
- How confident the system is.
- Whether a human or deterministic verifier confirmed it.
- When it was created and last verified.

Similarity is not dependency. Inferred is not verified. Manual is not machine-proven.

## 2. Relationship classes

### A. Technology similarity

**Meaning:** Two projects share one or more meaningful technologies.

Examples:

- Both declare React.
- Both declare TypeScript.
- Both use PostgreSQL client libraries.

**Type:** `TECHNOLOGY_SIMILARITY`
**State:** `INFERRED`
**Direction:** undirected
**Never:** presented as a dependency edge.

### B. Verified local dependency

**Meaning:** A project has concrete configuration evidence linking it to another discovered project.

Examples:

- npm workspace dependency using `workspace:*`.
- npm dependency using `file:../shared`.
- pnpm workspace link.
- Cargo path dependency.
- Go `replace` to a local module.
- .NET `ProjectReference` to a local project.
- Flutter path dependency.

**Type:** `VERIFIED_DEPENDENCY`
**State:** `VERIFIED` only when both source and target resolve unambiguously.
**Direction:** directed.

External package dependencies do not become project-to-project edges.

### C. Functional relationship

**Meaning:** Projects belong to the same product, workflow, or system, but not necessarily through a package dependency.

Examples:

- A mobile client and its backend.
- A dashboard and the ingestion service it operates.

**Type:** `FUNCTIONAL`
**State:** `MANUAL` after confirmation, or `UNVERIFIED` for explicitly labeled suggestions.
**Automatic detection:** not allowed as verified. Name similarity or technology overlap is insufficient.

### D. Manual relationship

**Meaning:** The user asserts a relationship for organizational or contextual reasons.

**Type:** `MANUAL`
**State:** `MANUAL`
**Direction:** user-selected directed or undirected.
**Evidence:** user note, optional selected reason, creation timestamp.
**Deletion:** user may remove it.

## 3. Verification states

| State | Meaning | Who can create |
|---|---|---|
| `VERIFIED` | Deterministic evidence proves the claim | Engine with concrete local evidence, or user confirmation if policy allows |
| `INFERRED` | Derived from evidence but not proof of dependency | Similarity engine |
| `MANUAL` | Asserted by the user | User |
| `UNVERIFIED` | Suggested or incomplete; not confirmed | Future suggestion flow, explicit labeling |
| `REJECTED` | User dismissed the edge; should not be recreated silently | User |

### State rules

- Similarity can never become `VERIFIED_DEPENDENCY`.
- A manual relationship does not upgrade a similarity edge; it creates a manual edge.
- Rejected edges are retained and excluded from the default graph.
- Re-running analysis may refresh evidence on an existing edge but must not overwrite `MANUAL` or `REJECTED` intent.
- Conflicting evidence marks the edge `NEEDS_REVIEW` in the UI rather than silently choosing.

## 4. Evidence model

Every edge stores a bounded, structured evidence object.

### Common evidence fields

```json
{
  "method": "workspace_link",
  "summary": "packages/web depends on @example/ui via workspace:*",
  "sources": [
    {
      "projectId": "source-uuid",
      "file": "package.json",
      "key": "dependencies.@example/ui"
    }
  ],
  "targets": [
    {
      "projectId": "target-uuid",
      "file": "packages/ui/package.json",
      "key": "name"
    }
  ],
  "observedAt": "2026-11-04T00:00:00Z"
}
```

### Similarity evidence

- Shared technology keys.
- Each project's evidence source for that technology.
- Overlap counts and weights.
- No claim of direct dependency.

### Dependency evidence

- Source manifest path and exact key.
- Declared dependency specifier.
- Resolution result (relative path, workspace declaration, project reference).
- Target manifest identity evidence.
- Resolution status and conflicts.

### Functional/manual evidence

- User note.
- Reason category if selected.
- Timestamp.
- Explicit "manual" marker.

Evidence must not include secrets, full lockfiles, or source code.

## 5. Similarity rules

### Eligible technologies

Use meaningful technology classes:

- Languages.
- Frameworks.
- Databases.
- Platforms/runtimes when discriminative.

Avoid edges based only on ubiquitous or non-discriminative entries such as `npm`, `git`, or a generic test runner.

### Initial scoring

For each project pair:

```text
sharedWeight = sum(weight(tech) for shared eligible technologies)
unionWeight  = sum(weight(tech) for all eligible technologies in either project)
similarity   = sharedWeight / unionWeight
```

Initial weights (subject to tests):

- Framework: 3
- Database: 3
- Language: 2
- Platform/runtime: 1
- Tool: 0.5

Initial threshold:

- Create an inferred edge when `similarity >= 0.30` and at least one shared framework/database/language.
- Require at least two shared meaningful technologies for framework-only overlaps if the initial graph is too noisy.
- Confidence maps from similarity with an explicit formula, not ad hoc values.

The thresholds and weights are part of tested domain logic and must be documented when tuned.

### Limits

- Cap similarity pairs per project and total edges per graph query.
- Prefer the strongest N edges per project for the default view.
- Always expose total/truncated counts.
- Similarity computation must be deterministic and stable under ordering.

## 6. Verified local dependency rules

### Node.js / npm / pnpm

Evidence accepted:

- `package.json` `workspaces` plus a dependency matching a discovered member package name.
- Dependency specifier `workspace:*`, `workspace:^`, `workspace:~`.
- `file:` or relative path that canonicalizes to a discovered project.
- `link:` where supported by the package manager.
- pnpm workspace catalog/link when concretely resolvable.

Not accepted:

- Matching package names without a workspace/link declaration.
- `node_modules` presence alone.
- Similar dependency lists.

### Rust

- `[dependencies] foo = { path = "../foo" }` or `[dev-dependencies]` resolving to a discovered Cargo project.
- Cargo workspace member links when concretely declared.

### Go

- `replace example.com/foo => ../foo` resolving to a discovered `go.mod`.
- `go.work` `use` entries resolving to discovered modules.

### .NET

- `<ProjectReference Include="..\Lib\Lib.csproj" />` resolving to a discovered project.
- Solution nesting is membership evidence, not necessarily a dependency edge.

### Flutter/Dart

- `path:` dependency resolving to a discovered package.

### Resolution requirements

1. Resolve the target path canonically.
2. Confirm containment in an authorized root.
3. Confirm the target is a discovered project.
4. Confirm the target manifest identity.
5. If more than one target matches, mark ambiguous and do not create `VERIFIED`.
6. Store the source and target evidence.

## 7. Manual relationship behavior

- Create with source, target, type, direction, and optional note.
- Edit note/direction/type with a new `updated_at`.
- Remove the edge or mark it rejected.
- Manual edges survive recomputation.
- Manual edges do not imply a package dependency.
- Deleting a project does not silently delete manual history; it becomes inactive/unresolved until resolved.

## 8. Rejected edges

- Rejecting an inferred edge records state, timestamp, and optional reason.
- Recompute must skip an equivalent rejected edge unless the evidence materially changes.
- "Materially changes" must be defined per method, for example a new workspace declaration or a new shared framework.
- Users can restore a rejected edge.

## 9. Recompute strategy

When a project or technology changes:

1. Load the affected project and its technologies/dependencies.
2. Recompute outgoing similarity pairs and local dependency resolution.
3. Upsert deterministic edges.
4. Preserve manual and rejected states.
5. Remove stale machine-only edges that no longer have evidence.
6. Emit a relationship change event.
7. Record counts/time for diagnostics.

Full relationship rebuild is allowed after schema migration or explicit user request, with a progress event.

## 10. Graph presentation rules

- Node types reflect projects, not raw files.
- Grouping by technology/category is a view, not a relationship.
- Edge style and label must indicate class:
  - Verified dependency: solid, directional.
  - Similarity: dashed, undirected.
  - Manual: distinct style with a manual badge.
  - Unverified suggestion: muted and labeled.
- The details panel always shows evidence, method, confidence, state, and timestamps.
- A legend is persistent.
- Users can hide similarity or unverified edges.
- Rejected edges are hidden by default.
- Node/edge caps and truncation are visible.

## 11. AI policy

- AI may suggest a functional grouping or description only as an explicit suggestion.
- Suggestions are `UNVERIFIED` and visually labeled.
- AI never creates `VERIFIED` edges.
- No source code, secrets, or private manifests are sent externally.
- Core relationship computation works offline without AI.

## 12. Tests

Required:

- Two React projects produce similarity, not dependency.
- Similar names with no evidence produce no verified edge.
- Workspace `workspace:*` produces a verified directed edge.
- `file:` path traversal outside roots is rejected.
- Cargo path dependency resolves correctly.
- Go `replace` resolves correctly.
- .NET `ProjectReference` resolves correctly.
- Ambiguous target produces no verified edge.
- Manual edge survives recompute.
- Rejected edge is not silently recreated.
- Evidence is present on every edge.
- Graph filtering exposes class and state correctly.
- Duplicate edges are not created.

No relationship test has been executed yet.
