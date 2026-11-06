-- Phase 5 publication workflow schema.
--
-- Phase 1 persists discovery facts only. Publication approval is a separate,
-- explicit decision and therefore gets its own columns plus an immutable
-- snapshot table. Discovery never sets an approved state.

ALTER TABLE projects ADD COLUMN publication_state TEXT NOT NULL DEFAULT 'pending'
  CHECK (publication_state IN ('pending', 'approved', 'rejected', 'snapshot', 'published'));

ALTER TABLE projects ADD COLUMN publication_approved_fields TEXT NOT NULL DEFAULT '[]';

ALTER TABLE projects ADD COLUMN publication_rejection_reason TEXT;

CREATE TABLE publication_snapshots (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('GENERATED', 'PUBLISHED', 'REVOKED')),
  project_count INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  generated_by TEXT NOT NULL
);

CREATE INDEX idx_publication_snapshots_generated_at ON publication_snapshots (generated_at);
