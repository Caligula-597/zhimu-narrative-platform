-- migrate:no-transaction
-- Keep target-visible player inbox reads bounded without inflating writes for
-- private actions that can never be returned through the target branch.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_private_actions_target_visible
  ON room_private_actions(room_id, target_role_slot_id, created_at DESC)
  WHERE visibility = 'actor_target_host';
