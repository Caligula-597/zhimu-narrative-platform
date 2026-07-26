-- User-facing AI is BYOK-only by default. The platform key remains available
-- to explicitly separated system jobs, but is not part of the user routing pool.

ALTER TABLE user_llm_connections
  DROP CONSTRAINT IF EXISTS user_llm_connections_provider_check;

ALTER TABLE user_llm_connections
  ADD CONSTRAINT user_llm_connections_provider_check
  CHECK (
    provider IN (
      'deepseek',
      'openai',
      'openrouter',
      'qwen',
      'zhipu',
      'siliconflow',
      'openai_compatible'
    )
  );

ALTER TABLE user_llm_preferences
  ALTER COLUMN routing_mode SET DEFAULT 'own_only';

UPDATE user_llm_preferences
SET routing_mode = 'own_only',
    updated_at = now()
WHERE routing_mode <> 'own_only';
