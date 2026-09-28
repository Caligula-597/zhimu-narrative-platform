-- Object Lifecycle Editor (缺口7): 物件生命周期状态机。
-- 每个物件一条生命周期：建立 → 变化 → 运行 → 回收 的递进状态链。
-- stages 存 JSONB（mirrors 关系过程 editors）：每阶段含状态名/描述/触发条件/状态变化/角色持有变化。

CREATE TABLE IF NOT EXISTS world_object_lifecycles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id      UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT '',                -- short label, e.g. "O-01"
  item_id       UUID,                                    -- bound to a physical item (nullable)
  item_label    TEXT NOT NULL DEFAULT '',                -- persistent display name if unbound
  summary       TEXT NOT NULL DEFAULT '',                -- overview of the lifecycle
  stages        JSONB NOT NULL DEFAULT '[]'::jsonb,      -- array of ObjectLifecycleStage
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_object_lifecycles_world
  ON world_object_lifecycles (world_id);

CREATE INDEX IF NOT EXISTS idx_object_lifecycles_item
  ON world_object_lifecycles (item_id);

COMMENT ON TABLE  world_object_lifecycles IS 'Per-object lifecycle state machine (建立→变化→运行→回收)';
COMMENT ON COLUMN world_object_lifecycles.stages IS 'Array of {id, label, description, trigger, change, holder}';