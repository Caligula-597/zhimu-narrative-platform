-- Economic System Editor (缺口 E): 经济系统。
-- 覆盖《青楼》ECON-01~ECON-xx 与 CFG-05 银两初始资源。
-- 每条记录是一条世界经济事实，按 category 分组：
--   initial 银两初始资源 / auction 拍卖 / treasure 宝箱 / rule 经济规则。
-- amount 为数值（银两/物品量）。
-- 本表输出给"机制生成流线"(预留接口)：生成流线就绪后，auction→auction_exchange、
-- rule→resource_allocation 等可折叠成主持端/玩家端可操控小游戏系统。

CREATE TABLE IF NOT EXISTS world_econ_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id      UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT '',              -- short label, e.g. "ECON-01"
  category      TEXT NOT NULL DEFAULT 'initial'
                CHECK (category IN ('initial','auction','treasure','rule')),
  sequence      INTEGER NOT NULL DEFAULT 0,            -- ordering within category
  actor_label   TEXT NOT NULL DEFAULT '',              -- 涉及角色/势力标签
  amount        NUMERIC NOT NULL DEFAULT 0,            -- 数值（银两/物品量）
  source        TEXT NOT NULL DEFAULT '',              -- 来源（章节/条目编号/备注出处）
  note          TEXT NOT NULL DEFAULT '',              -- 说明 / 结算规则
  summary       TEXT NOT NULL DEFAULT '',              -- 在经济闭环中的作用概述
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_econ_records_world
  ON world_econ_records (world_id);

CREATE INDEX IF NOT EXISTS idx_econ_records_world_cat_seq
  ON world_econ_records (world_id, category, sequence);

COMMENT ON TABLE  world_econ_records IS 'World economic records: 银两初始资源/拍卖/宝箱/经济规则';
COMMENT ON COLUMN world_econ_records.amount IS 'Numeric amount (silver/quantity); feeds 机制生成流线 later';