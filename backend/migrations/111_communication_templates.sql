-- P2-02: public statements reuse the durable private-action workflow while
-- widening only its authored action/visibility contracts.
ALTER TABLE room_private_actions
  DROP CONSTRAINT IF EXISTS room_private_actions_action_type_check;

ALTER TABLE room_private_actions
  ADD CONSTRAINT room_private_actions_action_type_check
  CHECK (action_type IN (
    'ask_host', 'secret_action', 'trade', 'promise', 'accusation_note', 'public_statement'
  ));

ALTER TABLE room_private_actions
  DROP CONSTRAINT IF EXISTS room_private_actions_visibility_check;

ALTER TABLE room_private_actions
  ADD CONSTRAINT room_private_actions_visibility_check
  CHECK (visibility IN ('actor_host', 'actor_target_host', 'host_only', 'postgame', 'public'));

CREATE INDEX IF NOT EXISTS room_private_actions_public_idx
  ON room_private_actions(room_id, created_at DESC)
  WHERE visibility = 'public';
