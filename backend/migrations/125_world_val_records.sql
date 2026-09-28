-- Val Consistency Ledger (缺口 V): 一致性台账。
-- 覆盖《青楼》VAL-01~VAL-xx 一致性需求。
-- 非剧情内容：登记同一事实在多处被引用时的矛盾版本，驱动"版本归位闭环"，
-- 让"改了单边版本、忘了同步关联处"也能被提示。状态：未决 → 待裁决 → 已统一。

CREATE TABLE IF NOT EXISTS world_val_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id          UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  title             TEXT NOT NULL DEFAULT '',              -- short label, e.g. "VAL-04"
  sequence          INTEGER NOT NULL DEFAULT 0,            -- ordering in the ledger
  references_entry  TEXT NOT NULL DEFAULT '',              -- 涉及条目：哪个条目/哪一处
  conflict_desc     TEXT NOT NULL DEFAULT '',              -- 冲突点：两版本在哪个事实上打架
  version_a         TEXT NOT NULL DEFAULT '',              -- 版本 A 原样记录
  version_b         TEXT NOT NULL DEFAULT '',              -- 版本 B 原样记录
  recommendation    TEXT NOT NULL DEFAULT '',              -- 建议以哪个为准/如何统一
  status            TEXT NOT NULL DEFAULT '未决'
                    CHECK (status IN ('未决','待裁决','已统一')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_val_records_world
  ON world_val_records (world_id);

CREATE INDEX IF NOT EXISTS idx_val_records_world_seq
  ON world_val_records (world_id, sequence);

CREATE INDEX IF NOT EXISTS idx_val_records_status
  ON world_val_records (world_id, status);

COMMENT ON TABLE  world_val_records IS 'Version-contradiction ledger (一致性台账): non-story management records';
COMMENT ON COLUMN world_val_records.status IS '未决 / 待裁决 / 已统一';