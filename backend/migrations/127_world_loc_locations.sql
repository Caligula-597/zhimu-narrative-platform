-- Location / Scene-State Enhancement (缺口 L): 地点/开放地图/现场状态。
-- 覆盖《青楼》LOC-01~LOC-xx。
-- 登记衙门令搜证、现场改写（已搜证/被改写/尸体数）、监狱即时杀人点。
-- 属"增强"性质，前端编辑器 CRUD 登记即可满足需求。

CREATE TABLE IF NOT EXISTS world_loc_locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id      UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT '',              -- short label, e.g. "LOC-01 城西青树"
  sequence      INTEGER NOT NULL DEFAULT 0,            -- ordering within kind
  kind          TEXT NOT NULL DEFAULT '现场'
                CHECK (kind IN ('衙门','监狱','开放地图','现场')),
  searchable    BOOLEAN NOT NULL DEFAULT TRUE,         -- 是否可搜证
  rewritable    BOOLEAN NOT NULL DEFAULT FALSE,        -- 现场是否可被改写
  state         JSONB NOT NULL DEFAULT '{}'::jsonb,    -- 现场状态(已搜证/被改写/尸体数…)
  combat        BOOLEAN NOT NULL DEFAULT FALSE,        -- 是否为监狱即时杀人点
  items_note    TEXT NOT NULL DEFAULT '',              -- 物品/陈列说明
  note          TEXT NOT NULL DEFAULT '',              -- 备注
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loc_locations_world
  ON world_loc_locations (world_id);

CREATE INDEX IF NOT EXISTS idx_loc_locations_world_kind_seq
  ON world_loc_locations (world_id, kind, sequence);

COMMENT ON TABLE  world_loc_locations IS 'Locations / open maps / scene-state registration (衙门令搜证/现场改写/监狱即时杀人点)';