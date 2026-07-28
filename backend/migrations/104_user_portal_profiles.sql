CREATE TABLE user_portal_profiles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  portal text NOT NULL CHECK (portal IN ('creator', 'host', 'player')),
  display_name text NOT NULL,
  avatar_object_key text,
  avatar_content_type text,
  name_changed_at timestamptz,
  avatar_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, portal),
  CONSTRAINT user_portal_profiles_display_name_check CHECK (
    display_name = btrim(display_name)
    AND char_length(display_name) BETWEEN 2 AND 24
  ),
  CONSTRAINT user_portal_profiles_avatar_pair_check CHECK (
    (avatar_object_key IS NULL AND avatar_content_type IS NULL)
    OR (avatar_object_key IS NOT NULL AND avatar_content_type IN ('image/jpeg', 'image/png', 'image/webp'))
  )
);

CREATE UNIQUE INDEX user_portal_profiles_portal_display_name_unique
  ON user_portal_profiles (portal, lower(display_name));

CREATE TABLE portal_profile_avatar_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  portal text NOT NULL CHECK (portal IN ('creator', 'host', 'player')),
  object_key text NOT NULL UNIQUE,
  expected_content_type text NOT NULL CHECK (
    expected_content_type IN ('image/jpeg', 'image/png', 'image/webp')
  ),
  expected_byte_size bigint NOT NULL CHECK (
    expected_byte_size > 0 AND expected_byte_size <= 2097152
  ),
  original_filename text NOT NULL,
  status text NOT NULL DEFAULT 'created' CHECK (
    status IN ('created', 'confirmed', 'cancelled')
  ),
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX portal_profile_avatar_uploads_user_status_idx
  ON portal_profile_avatar_uploads (user_id, portal, status, expires_at);

WITH profile_candidates AS (
  SELECT
    users.id AS user_id,
    portal.portal,
    left(CASE
      WHEN char_length(regexp_replace(btrim(users.display_name), '[[:space:]]+', ' ', 'g')) >= 2
        THEN regexp_replace(btrim(users.display_name), '[[:space:]]+', ' ', 'g')
      ELSE '用户-' || left(replace(users.id::text, '-', ''), 8)
    END, 24) AS base_name,
    users.created_at
  FROM users
  CROSS JOIN (VALUES ('creator'), ('host'), ('player')) AS portal(portal)
),
ranked_profiles AS (
  SELECT
    profile_candidates.*,
    row_number() OVER (
      PARTITION BY portal, lower(base_name)
      ORDER BY created_at, user_id
    ) AS duplicate_sequence
  FROM profile_candidates
)
INSERT INTO user_portal_profiles (user_id, portal, display_name)
SELECT
  user_id,
  portal,
  CASE
    WHEN duplicate_sequence = 1 THEN base_name
    ELSE left(base_name, 15) || '-' || left(replace(user_id::text, '-', ''), 8)
  END
FROM ranked_profiles;

CREATE OR REPLACE FUNCTION initialize_user_portal_profiles()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_portal text;
  base_name text;
  candidate_name text;
BEGIN
  base_name := left(CASE
    WHEN char_length(regexp_replace(btrim(NEW.display_name), '[[:space:]]+', ' ', 'g')) >= 2
      THEN regexp_replace(btrim(NEW.display_name), '[[:space:]]+', ' ', 'g')
    ELSE '用户-' || left(replace(NEW.id::text, '-', ''), 8)
  END, 24);

  FOREACH target_portal IN ARRAY ARRAY['creator', 'host', 'player'] LOOP
    candidate_name := base_name;
    BEGIN
      INSERT INTO user_portal_profiles (user_id, portal, display_name)
      VALUES (NEW.id, target_portal, candidate_name);
    EXCEPTION WHEN unique_violation THEN
      candidate_name := left(base_name, 15) || '-' || left(replace(NEW.id::text, '-', ''), 8);
      INSERT INTO user_portal_profiles (user_id, portal, display_name)
      VALUES (NEW.id, target_portal, candidate_name);
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER users_initialize_portal_profiles
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION initialize_user_portal_profiles();

ALTER TABLE user_portal_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_profile_avatar_uploads ENABLE ROW LEVEL SECURITY;
