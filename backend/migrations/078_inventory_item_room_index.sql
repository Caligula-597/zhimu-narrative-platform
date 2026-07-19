-- migrate:no-transaction
-- PostgreSQL does not automatically index the referencing side of a foreign key.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_item_room
  ON inventory(item_id, room_id);
