-- 用户自备 LLM API（OpenAI 兼容 / DeepSeek 等），平台池仅作兜底

CREATE TABLE IF NOT EXISTS user_llm_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '默认连接',
  provider text NOT NULL DEFAULT 'openai_compatible',
  base_url text NOT NULL,
  model text NOT NULL,
  api_key_ciphertext text NOT NULL,
  api_key_hint text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_llm_connections_provider_check
    CHECK (provider IN ('deepseek', 'openai_compatible', 'openai')),
  CONSTRAINT user_llm_connections_name_unique UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS user_llm_connections_user_active_idx
  ON user_llm_connections (user_id, is_active DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS user_llm_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  routing_mode text NOT NULL DEFAULT 'prefer_own',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_llm_preferences_routing_check
    CHECK (routing_mode IN ('prefer_own', 'own_only', 'platform_only'))
);

ALTER TABLE user_llm_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_llm_preferences ENABLE ROW LEVEL SECURITY;
