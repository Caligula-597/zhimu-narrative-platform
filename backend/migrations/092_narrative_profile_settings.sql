-- Backfill the canonical narrative product profile for worlds created before
-- the Creator / Host / Player dual-mode contract was introduced.
--
-- Existing settings remain intact. Only worlds without narrativeProfile are
-- updated, so the migration is idempotent and cannot overwrite a newer profile.

WITH legacy AS (
  SELECT
    id,
    COALESCE(settings, '{}'::jsonb) AS settings,
    CASE
      WHEN settings->>'worldMode' IN ('scripted', 'campaign', 'hybrid') THEN settings->>'worldMode'
      ELSE NULL
    END AS legacy_world_mode,
    CASE
      WHEN settings->>'creationType' IN ('murder_mystery', 'tabletop_rpg', 'interactive_story')
        THEN settings->>'creationType'
      WHEN settings->>'worldMode' = 'campaign' THEN 'tabletop_rpg'
      ELSE 'murder_mystery'
    END AS creation_type
  FROM worlds
), normalized AS (
  SELECT
    id,
    settings,
    creation_type,
    CASE
      WHEN legacy_world_mode IN ('campaign', 'hybrid') THEN 'campaign'
      WHEN legacy_world_mode = 'scripted' THEN 'single_session'
      WHEN creation_type = 'tabletop_rpg' THEN 'campaign'
      ELSE 'single_session'
    END AS run_format,
    CASE
      WHEN legacy_world_mode = 'campaign' THEN 'mixed'
      WHEN legacy_world_mode IN ('scripted', 'hybrid') THEN 'fixed'
      WHEN creation_type = 'tabletop_rpg' THEN 'mixed'
      ELSE 'fixed'
    END AS role_mode
  FROM legacy
)
UPDATE worlds AS world
SET settings = normalized.settings || jsonb_build_object(
  'creationType', normalized.creation_type,
  'worldMode', CASE
    WHEN normalized.creation_type = 'tabletop_rpg' THEN 'campaign'
    WHEN normalized.run_format = 'campaign' THEN 'hybrid'
    ELSE 'scripted'
  END,
  'narrativeProfile', jsonb_build_object(
    'version', 1,
    'creationType', normalized.creation_type,
    'runFormat', normalized.run_format,
    'roleMode', normalized.role_mode,
    'ruleset', jsonb_build_object(
      'mode', CASE WHEN normalized.creation_type = 'tabletop_rpg' THEN 'system_neutral' ELSE 'none' END,
      'key', '',
      'diceNotation', ''
    )
  )
)
FROM normalized
WHERE world.id = normalized.id
  AND NOT (normalized.settings ? 'narrativeProfile');
