-- Historical Causality Table (缺口 H): 历史因果表编辑器。
-- 覆盖《长生叹》H-01~H-26 历史事件（500 年 26 个）。
-- 每个事件是一条因果链上的环节：前因(cause) → 事件(event) → 后果(effect)。
-- 用 sequence + when_text(年代) 表达历史因果顺序，支撑"谁引发、改变了世界局势"的因果链。

CREATE TABLE IF NOT EXISTS world_history_causal_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id      UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT '',                -- short label, e.g. "H-01"
  sequence      INTEGER NOT NULL DEFAULT 0,              -- causal chain order (年代先后)
  when_text     TEXT NOT NULL DEFAULT '',                -- 年代/纪年, e.g. "前 480 年"
  actors        TEXT NOT NULL DEFAULT '',                -- 角色/势力标签 (逗号分隔)
  cause_text    TEXT NOT NULL DEFAULT '',                -- 前因：什么导致了这个事件
  event_text    TEXT NOT NULL DEFAULT '',                -- 事件本身：发生了什么
  effect_text   TEXT NOT NULL DEFAULT '',                -- 后果：改变了什么，引出哪个后续事件
  summary       TEXT NOT NULL DEFAULT '',                -- 该事件在整条因果链中的作用概述
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_history_causal_links_world
  ON world_history_causal_links (world_id);

CREATE INDEX IF NOT EXISTS idx_history_causal_links_world_seq
  ON world_history_causal_links (world_id, sequence);

COMMENT ON TABLE  world_history_causal_links IS 'Historical events as a causal chain (cause → event → effect)';
COMMENT ON COLUMN world_history_causal_links.sequence IS 'Causal/precedence order across world history';