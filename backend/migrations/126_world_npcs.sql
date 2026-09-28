-- NPC Script Editor (缺口 N): NPC 专属内容。
-- 覆盖《青楼》NPC-01~NPC-xx。
-- 每个 NPC 槽位一条：独立剧本 + 身份人生 + 显著数值(JSONB, 如酒力固定 5)。

CREATE TABLE IF NOT EXISTS world_npcs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id        UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT '',              -- slot label, e.g. "NPC-01 柳诗诗"
  sequence        INTEGER NOT NULL DEFAULT 0,            -- ordering in the NPC list
  salient_nums    JSONB NOT NULL DEFAULT '{}'::jsonb,    -- 显著数值键值对, e.g. {酒力:5}
  summary         TEXT NOT NULL DEFAULT '',              -- 一句话定位
  bio             TEXT NOT NULL DEFAULT '',              -- 身份人生
  private_script  TEXT NOT NULL DEFAULT '',              -- 独立 NPC 剧本
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_npcs_world
  ON world_npcs (world_id);

CREATE INDEX IF NOT EXISTS idx_npcs_world_seq
  ON world_npcs (world_id, sequence);

COMMENT ON TABLE  world_npcs IS 'NPC 专属内容：独立剧本 + 身份人生 + 显著数值';