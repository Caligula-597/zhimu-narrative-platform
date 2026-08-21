-- Parallel material booklets: diaries, catalogs, manuals — first-class bible objects.
-- Not clues; clues remain what players receive in-room. Booklets are authoring containers.

CREATE TABLE IF NOT EXISTS world_material_booklets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'diary'
    CHECK (kind IN ('diary', 'catalog', 'manual', 'prop_book', 'other')),
  title text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  owner_role_slot_id uuid REFERENCES role_slots(id) ON DELETE SET NULL,
  phase_label text NOT NULL DEFAULT '',
  chapter_id uuid REFERENCES chapters(id) ON DELETE SET NULL,
  visibility text NOT NULL DEFAULT 'host_only'
    CHECK (visibility IN ('host_only', 'owner_role', 'shared_roles', 'public_table')),
  pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  linked_clue_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  linked_role_slot_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  sequence integer NOT NULL DEFAULT 1 CHECK (sequence > 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS world_material_booklets_world_seq_idx
  ON world_material_booklets (world_id, sequence, created_at);

CREATE INDEX IF NOT EXISTS world_material_booklets_owner_idx
  ON world_material_booklets (world_id, owner_role_slot_id);

COMMENT ON TABLE world_material_booklets IS
  'Parallel material booklets (diary/catalog/manual). Separate from clues; link by ID.';
