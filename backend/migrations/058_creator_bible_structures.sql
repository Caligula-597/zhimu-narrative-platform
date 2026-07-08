-- Creator bible structural objects (058): core trick, role archives, foreshadow, case timeline, clue kind.

CREATE TABLE IF NOT EXISTS world_core_tricks (
  world_id uuid PRIMARY KEY REFERENCES worlds(id) ON DELETE CASCADE,
  summary text NOT NULL DEFAULT '',
  killer_role_slot_id uuid REFERENCES role_slots(id) ON DELETE SET NULL,
  method text NOT NULL DEFAULT '',
  motive text NOT NULL DEFAULT '',
  victim text NOT NULL DEFAULT '',
  host_notes text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS world_role_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  role_slot_id uuid NOT NULL REFERENCES role_slots(id) ON DELETE CASCADE,
  public_identity text NOT NULL DEFAULT '',
  hidden_identity text NOT NULL DEFAULT '',
  external_goal text NOT NULL DEFAULT '',
  internal_need text NOT NULL DEFAULT '',
  secret text NOT NULL DEFAULT '',
  action_line text NOT NULL DEFAULT '',
  inner_conflict text NOT NULL DEFAULT '',
  voice_hints text NOT NULL DEFAULT '',
  arc jsonb NOT NULL DEFAULT '{}'::jsonb,
  lies jsonb NOT NULL DEFAULT '[]'::jsonb,
  act_tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_slot_id)
);

CREATE INDEX IF NOT EXISTS world_role_archives_world_idx
  ON world_role_archives(world_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS world_foreshadow_beats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  plant_summary text NOT NULL DEFAULT '',
  surface_meaning text NOT NULL DEFAULT '',
  true_meaning text NOT NULL DEFAULT '',
  payoff_summary text NOT NULL DEFAULT '',
  sequence integer NOT NULL DEFAULT 1 CHECK (sequence > 0),
  plant_chapter_id uuid REFERENCES chapters(id) ON DELETE SET NULL,
  payoff_chapter_id uuid REFERENCES chapters(id) ON DELETE SET NULL,
  plant_section_id uuid REFERENCES script_sections(id) ON DELETE SET NULL,
  payoff_section_id uuid REFERENCES script_sections(id) ON DELETE SET NULL,
  clue_id uuid REFERENCES clues(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS world_foreshadow_beats_world_seq_idx
  ON world_foreshadow_beats(world_id, sequence, created_at);

CREATE TABLE IF NOT EXISTS world_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  time_label text NOT NULL DEFAULT '',
  event_summary text NOT NULL DEFAULT '',
  sequence integer NOT NULL DEFAULT 1 CHECK (sequence > 0),
  chapter_id uuid REFERENCES chapters(id) ON DELETE SET NULL,
  scene_id uuid REFERENCES scenes(id) ON DELETE SET NULL,
  participant_role_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  alibi_notes text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS world_timeline_events_world_seq_idx
  ON world_timeline_events(world_id, sequence, created_at);

ALTER TABLE clues
  ADD COLUMN IF NOT EXISTS clue_kind text NOT NULL DEFAULT 'general';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clues_clue_kind_check'
  ) THEN
    ALTER TABLE clues ADD CONSTRAINT clues_clue_kind_check
      CHECK (clue_kind IN ('general', 'deep', 'verify', 'misdirect', 'emotion', 'mechanic'));
  END IF;
END $$;
