export async function configureItemActionTransaction(client) {
  await client.query("SELECT set_config('lock_timeout', '3000ms', true), set_config('statement_timeout', '10000ms', true)");
}

export async function lockInventoryItem(client, { roomId, roleSlotId, itemId }) {
  const result = await client.query(
    `SELECT item.id, item.name, item.metadata, inventory.quantity
     FROM inventory
     JOIN items item ON item.id = inventory.item_id
     JOIN rooms room ON room.id = inventory.room_id AND room.world_id = item.world_id
     WHERE inventory.room_id = $1 AND inventory.role_slot_id = $2
       AND inventory.item_id = $3 AND inventory.quantity > 0
     FOR UPDATE OF inventory`,
    [roomId, roleSlotId, itemId],
  );
  return result.rows[0] ?? null;
}

export async function consumeInventoryItem(client, { roomId, roleSlotId, itemId, quantity }) {
  if (!quantity) return true;
  const result = await client.query(
    `UPDATE inventory SET quantity = quantity - $4
     WHERE room_id = $1 AND role_slot_id = $2 AND item_id = $3 AND quantity >= $4
     RETURNING quantity`,
    [roomId, roleSlotId, itemId, quantity],
  );
  if (!result.rowCount) return false;
  if (Number(result.rows[0].quantity) === 0) {
    await client.query(
      `DELETE FROM inventory WHERE room_id = $1 AND role_slot_id = $2 AND item_id = $3 AND quantity = 0`,
      [roomId, roleSlotId, itemId],
    );
  }
  return true;
}

export async function itemActionTargetExists(client, { roomId, targetType, targetId }) {
  if (targetType === "none") return true;
  if (targetType === "role") {
    const result = await client.query(
      `SELECT 1 FROM room_members WHERE room_id = $1 AND role_slot_id = $2 AND status = 'active'`,
      [roomId, targetId],
    );
    return result.rowCount > 0;
  }
  return false;
}
