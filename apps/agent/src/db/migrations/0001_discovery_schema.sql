-- Phase 1 discovery schema.
--
-- Scope: authorized roots, projects, identity, detection evidence, technologies,
-- dependencies, scan history/errors, exclusions, overrides, and status history.
--
-- Deferred to a later migration by design:
--   relationships, publication_records, publication_snapshots, agent_settings.
-- Those tables belong to Phase 3 and Phase 5 behavior and are not needed to
-- discover and persist a Phase 1 inventory.

CREATE TABLE project_roots (
  id TEXT PRIMARY KEY,
  canonical_path TEXT NOT NULL UNIQUE,
  display_path TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'PAUSED', 'UNAVAILABLE', 'REMOVED')),
  watch_enabled INTEGER NOT NULL DEFAULT 0 CHECK (watch_enabled IN (0, 1)),
  last_scan_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_project_roots_status ON project_roots (status);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  root_id TEXT NOT NULL REFERENCES project_roots (id) ON DELETE RESTRICT,
  relative_path TEXT NOT NULL,
  canonical_path TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (
    kind IN ('APPLICATION', 'LIBRARY', 'WORKSPACE_ROOT', 'WORKSPACE_MEMBER', 'SOLUTION', 'UNKNOWN')
  ),
  primary_ecosystem TEXT,
  primary_language TEXT,
  category TEXT,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'MISSING', 'EXCLUDED', 'ARCHIVED')),
  detection_confidence REAL NOT NULL CHECK (detection_confidence >= 0.0 AND detection_confidence <= 1.0),
  detection_state TEXT NOT NULL CHECK (
    detection_state IN ('CONFIRMED', 'PROBABLE', 'CANDIDATE', 'NEEDS_REVIEW')
  ),
  metadata_status TEXT NOT NULL CHECK (metadata_status IN ('VALID', 'PARTIAL', 'INVALID', 'UNKNOWN')),
  git_root_path TEXT,
  git_branch TEXT,
  git_remote TEXT,
  manifest_fingerprint TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_scanned_at TEXT,
  missing_since TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (root_id, relative_path)
);

CREATE INDEX idx_projects_root_id ON projects (root_id);
CREATE INDEX idx_projects_status ON projects (status);
CREATE INDEX idx_projects_category ON projects (category);
CREATE INDEX idx_projects_primary_language ON projects (primary_language);
CREATE INDEX idx_projects_display_name ON projects (display_name);
CREATE INDEX idx_projects_last_seen_at ON projects (last_seen_at);

CREATE TABLE project_identities (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE RESTRICT,
  identity_type TEXT NOT NULL CHECK (
    identity_type IN ('GIT_REMOTE', 'MANIFEST_NAME', 'PATH', 'MANUAL')
  ),
  identity_key TEXT NOT NULL,
  method TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX idx_project_identities_lookup ON project_identities (identity_type, identity_key);
CREATE INDEX idx_project_identities_project_id ON project_identities (project_id);

CREATE TABLE detection_evidence (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE RESTRICT,
  signature TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  weight REAL NOT NULL,
  parser_state TEXT NOT NULL CHECK (
    parser_state IN ('OK', 'INVALID', 'TOO_LARGE', 'DENIED', 'ERROR')
  ),
  detail_json TEXT,
  observed_at TEXT NOT NULL
);

CREATE INDEX idx_detection_evidence_project_id ON detection_evidence (project_id);
CREATE INDEX idx_detection_evidence_signature ON detection_evidence (project_id, signature);

CREATE TABLE technologies (
  id TEXT PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (
    kind IN ('LANGUAGE', 'FRAMEWORK', 'RUNTIME', 'DATABASE', 'TOOL', 'PLATFORM')
  ),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_technologies_kind ON technologies (kind);
CREATE INDEX idx_technologies_name ON technologies (name);

CREATE TABLE project_technologies (
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE RESTRICT,
  technology_id TEXT NOT NULL REFERENCES technologies (id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('DECLARED', 'INSTALLED', 'USED')),
  version_spec TEXT,
  evidence_json TEXT,
  confidence REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
  first_seen_at TEXT NOT NULL,
  last_verified_at TEXT NOT NULL,
  PRIMARY KEY (project_id, technology_id, status)
);

CREATE INDEX idx_project_technologies_technology_id ON project_technologies (technology_id);
CREATE INDEX idx_project_technologies_status ON project_technologies (status);

CREATE TABLE dependencies (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE RESTRICT,
  ecosystem TEXT NOT NULL,
  name TEXT NOT NULL,
  version_spec TEXT,
  resolved_version TEXT,
  dependency_type TEXT NOT NULL CHECK (
    dependency_type IN ('RUNTIME', 'DEV', 'PEER', 'OPTIONAL', 'BUILD')
  ),
  status TEXT NOT NULL CHECK (status IN ('DECLARED', 'INSTALLED', 'USED')),
  source_file TEXT NOT NULL,
  source_key TEXT,
  is_local INTEGER NOT NULL DEFAULT 0 CHECK (is_local IN (0, 1)),
  local_target_project_id TEXT REFERENCES projects (id) ON DELETE SET NULL,
  evidence_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_dependencies_project_id ON dependencies (project_id);
CREATE INDEX idx_dependencies_project_ecosystem ON dependencies (project_id, ecosystem);
CREATE INDEX idx_dependencies_name ON dependencies (name);
CREATE INDEX idx_dependencies_local_target ON dependencies (local_target_project_id);

CREATE TABLE scan_runs (
  id TEXT PRIMARY KEY,
  root_id TEXT REFERENCES project_roots (id) ON DELETE SET NULL,
  trigger TEXT NOT NULL CHECK (trigger IN ('MANUAL', 'STARTUP', 'WATCH', 'RECONCILIATION')),
  status TEXT NOT NULL CHECK (
    status IN ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'LIMIT_EXCEEDED')
  ),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  duration_ms INTEGER,
  directories_visited INTEGER NOT NULL DEFAULT 0,
  files_inspected INTEGER NOT NULL DEFAULT 0,
  projects_seen INTEGER NOT NULL DEFAULT 0,
  projects_created INTEGER NOT NULL DEFAULT 0,
  projects_updated INTEGER NOT NULL DEFAULT 0,
  projects_missing INTEGER NOT NULL DEFAULT 0,
  errors_count INTEGER NOT NULL DEFAULT 0,
  stats_json TEXT
);

CREATE INDEX idx_scan_runs_started_at ON scan_runs (started_at);
CREATE INDEX idx_scan_runs_status ON scan_runs (status);
CREATE INDEX idx_scan_runs_root_id ON scan_runs (root_id);

CREATE TABLE scan_errors (
  id TEXT PRIMARY KEY,
  scan_run_id TEXT NOT NULL REFERENCES scan_runs (id) ON DELETE RESTRICT,
  root_id TEXT REFERENCES project_roots (id) ON DELETE SET NULL,
  relative_path TEXT,
  error_code TEXT NOT NULL,
  message TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);

CREATE INDEX idx_scan_errors_scan_run_id ON scan_errors (scan_run_id);
CREATE INDEX idx_scan_errors_error_code ON scan_errors (error_code);

CREATE TABLE exclusions (
  id TEXT PRIMARY KEY,
  root_id TEXT REFERENCES project_roots (id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('DIRECTORY', 'PATH', 'GLOB', 'SENSITIVE_NAME')),
  reason TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_exclusions_root_id ON exclusions (root_id);

CREATE TABLE project_overrides (
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  value_json TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, field)
);

CREATE TABLE project_status_history (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE RESTRICT,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  observed_at TEXT NOT NULL
);

CREATE INDEX idx_project_status_history_project_id ON project_status_history (project_id);
