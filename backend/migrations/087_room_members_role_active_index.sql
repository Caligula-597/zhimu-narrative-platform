-- migrate:no-transaction
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_members_role_active
  ON room_members(role_slot_id, room_id)
  WHERE status = 'active' AND role_slot_id IS NOT NULL;
