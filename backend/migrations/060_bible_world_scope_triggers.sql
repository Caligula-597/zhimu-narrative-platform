-- Defense in depth: bible rows must not reference entities from another world.

CREATE OR REPLACE FUNCTION bible_enforce_role_slot_world()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role_slot_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM role_slots rs WHERE rs.id = NEW.role_slot_id AND rs.world_id = NEW.world_id
     ) THEN
    RAISE EXCEPTION 'ROLE_SLOT_WORLD_MISMATCH' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION bible_enforce_core_trick_killer_world()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.killer_role_slot_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM role_slots rs WHERE rs.id = NEW.killer_role_slot_id AND rs.world_id = NEW.world_id
     ) THEN
    RAISE EXCEPTION 'ROLE_SLOT_WORLD_MISMATCH' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS world_role_archives_world_scope ON world_role_archives;
CREATE TRIGGER world_role_archives_world_scope
  BEFORE INSERT OR UPDATE ON world_role_archives
  FOR EACH ROW EXECUTE FUNCTION bible_enforce_role_slot_world();

DROP TRIGGER IF EXISTS world_core_tricks_killer_world_scope ON world_core_tricks;
CREATE TRIGGER world_core_tricks_killer_world_scope
  BEFORE INSERT OR UPDATE ON world_core_tricks
  FOR EACH ROW EXECUTE FUNCTION bible_enforce_core_trick_killer_world();
