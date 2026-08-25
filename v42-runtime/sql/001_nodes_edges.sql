-- V4.2 Phase 1 schema skeleton (JSONB nodes). Not wired to product migrations yet.

CREATE TABLE IF NOT EXISTS v42_projects (
    id UUID PRIMARY KEY,
    spec JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS v42_nodes (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES v42_projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    version INTEGER NOT NULL,
    status TEXT NOT NULL,
    lock_level INTEGER NOT NULL DEFAULT 0,
    locked BOOLEAN NOT NULL DEFAULT FALSE,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v42_nodes_project_type
    ON v42_nodes (project_id, type);

CREATE TABLE IF NOT EXISTS v42_edges (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES v42_projects(id) ON DELETE CASCADE,
    from_node_id UUID NOT NULL,
    to_node_id UUID NOT NULL,
    relation TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v42_edges_from
    ON v42_edges (from_node_id);
CREATE INDEX IF NOT EXISTS idx_v42_edges_to
    ON v42_edges (to_node_id);

CREATE TABLE IF NOT EXISTS v42_module_instances (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES v42_projects(id) ON DELETE CASCADE,
    module_id TEXT NOT NULL,
    flags JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS v42_pipeline_runs (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES v42_projects(id) ON DELETE CASCADE,
    stage TEXT NOT NULL,
    status TEXT NOT NULL,
    detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS v42_agent_runs (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES v42_projects(id) ON DELETE CASCADE,
    task JSONB NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS v42_validation_results (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES v42_projects(id) ON DELETE CASCADE,
    validator_id TEXT NOT NULL,
    status TEXT NOT NULL,
    severity TEXT NOT NULL,
    affected_nodes JSONB NOT NULL,
    evidence JSONB NOT NULL,
    explanation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS v42_patch_requests (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES v42_projects(id) ON DELETE CASCADE,
    request JSONB NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS v42_patch_operations (
    id UUID PRIMARY KEY,
    patch_request_id UUID NOT NULL REFERENCES v42_patch_requests(id) ON DELETE CASCADE,
    operation JSONB NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS v42_session_states (
    session_id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES v42_projects(id) ON DELETE CASCADE,
    state JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
