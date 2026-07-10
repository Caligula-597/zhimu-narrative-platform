-- Extend bible world-scope triggers to foreshadow beats and timeline events.

CREATE OR REPLACE FUNCTION bible_enforce_chapter_world(p_world_id uuid, p_chapter_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_chapter_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM chapters c WHERE c.id = p_chapter_id AND c.world_id = p_world_id
     ) THEN
    RAISE EXCEPTION 'CHAPTER_NOT_FOUND' USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION bible_enforce_scene_world(p_world_id uuid, p_scene_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_scene_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM scenes s WHERE s.id = p_scene_id AND s.world_id = p_world_id
     ) THEN
    RAISE EXCEPTION 'SCENE_WORLD_MISMATCH' USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION bible_enforce_clue_world(p_world_id uuid, p_clue_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_clue_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM clues c WHERE c.id = p_clue_id AND c.world_id = p_world_id
     ) THEN
    RAISE EXCEPTION 'CLUE_WORLD_MISMATCH' USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION bible_enforce_section_world(p_world_id uuid, p_section_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_section_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM script_sections ss
       JOIN role_slots rs ON rs.id = ss.role_slot_id
       WHERE ss.id = p_section_id AND rs.world_id = p_world_id
     ) THEN
    RAISE EXCEPTION 'SCRIPT_SECTION_NOT_FOUND' USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION bible_enforce_role_ids_world(p_world_id uuid, p_role_ids uuid[])
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  role_id uuid;
BEGIN
  IF p_role_ids IS NULL OR array_length(p_role_ids, 1) IS NULL THEN
    RETURN;
  END IF;
  FOREACH role_id IN ARRAY p_role_ids LOOP
    IF NOT EXISTS (
      SELECT 1 FROM role_slots rs WHERE rs.id = role_id AND rs.world_id = p_world_id
    ) THEN
      RAISE EXCEPTION 'ROLE_SLOT_WORLD_MISMATCH' USING ERRCODE = '23514';
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION bible_enforce_foreshadow_refs_world()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM bible_enforce_chapter_world(NEW.world_id, NEW.plant_chapter_id);
  PERFORM bible_enforce_chapter_world(NEW.world_id, NEW.payoff_chapter_id);
  PERFORM bible_enforce_section_world(NEW.world_id, NEW.plant_section_id);
  PERFORM bible_enforce_section_world(NEW.world_id, NEW.payoff_section_id);
  PERFORM bible_enforce_clue_world(NEW.world_id, NEW.clue_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION bible_enforce_timeline_refs_world()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM bible_enforce_chapter_world(NEW.world_id, NEW.chapter_id);
  PERFORM bible_enforce_scene_world(NEW.world_id, NEW.scene_id);
  PERFORM bible_enforce_role_ids_world(NEW.world_id, NEW.participant_role_ids);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS world_foreshadow_beats_world_scope ON world_foreshadow_beats;
CREATE TRIGGER world_foreshadow_beats_world_scope
  BEFORE INSERT OR UPDATE ON world_foreshadow_beats
  FOR EACH ROW EXECUTE FUNCTION bible_enforce_foreshadow_refs_world();

DROP TRIGGER IF EXISTS world_timeline_events_world_scope ON world_timeline_events;
CREATE TRIGGER world_timeline_events_world_scope
  BEFORE INSERT OR UPDATE ON world_timeline_events
  FOR EACH ROW EXECUTE FUNCTION bible_enforce_timeline_refs_world();
