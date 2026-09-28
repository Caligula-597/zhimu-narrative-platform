-- Remove storage owned by the retired from-zero creation and world-fact pipelines.
-- IF EXISTS keeps fresh installations safe after the historical migration was removed.
DROP TABLE IF EXISTS world_project_story_states;

UPDATE worlds
SET settings = COALESCE(settings, '{}'::jsonb) - 'worldEngine'
WHERE settings ? 'worldEngine';
