-- Runtime State Machine + Host Exception Remediation (缺口 M): 运行时状态机。
-- 覆盖《长生叹》M-01~M-08 运行时状态机需求。
-- 每个运行时状态机描述主持执掌过程中一个阶段的推进：一串状态(states)，
-- 每个状态含进入条件、主持要推进的行动、下一状态转移目标，
-- 以及"异常补救"(remedy)：当该阶段无法按剧本推进时主持如何补救。

CREATE TABLE IF NOT EXISTS world_runtime_state_machines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id      UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT '',                -- short label, e.g. "M-01"
  sequence      INTEGER NOT NULL DEFAULT 0,              -- runtime execution order
  start_state   TEXT NOT NULL DEFAULT '',                -- initial state name
  end_state     TEXT NOT NULL DEFAULT '',                -- terminal state name
  summary       TEXT NOT NULL DEFAULT '',                -- overview of this runtime machine
  states        JSONB NOT NULL DEFAULT '[]'::jsonb,      -- array of RuntimeState
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runtime_state_machines_world
  ON world_runtime_state_machines (world_id);

CREATE INDEX IF NOT EXISTS idx_runtime_state_machines_world_seq
  ON world_runtime_state_machines (world_id, sequence);

COMMENT ON TABLE  world_runtime_state_machines IS 'Runtime state machines with per-state host exception remediation';
COMMENT ON COLUMN world_runtime_state_machines.states IS 'Array of {id, name, description, condition, action, nextState, remedy}';