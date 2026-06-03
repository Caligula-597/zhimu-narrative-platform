import { query } from "./db.js";

export async function fetchItemInRoomWorld(client, roomId, itemId) {
  const run = client?.query ? client.query.bind(client) : query;
  const result = await run(
    `SELECT i.id, i.name, i.public_text, i.host_text, i.metadata
     FROM items i
     JOIN rooms r ON r.world_id = i.world_id
     WHERE i.id = $1 AND r.id = $2`,
    [itemId, roomId]
  );
  return result.rows[0] ?? null;
}

export async function grantItemToInventory(client, { roomId, roleSlotId, itemId, quantity = 1, source = "host_manual" }) {
  const run = client?.query ? client.query.bind(client) : query;
  const item = await fetchItemInRoomWorld(client, roomId, itemId);
  if (!item) {
    throw Object.assign(new Error("Item not found in room world"), { statusCode: 404 });
  }
  const meta = item.metadata ?? {};
  const qty = Math.max(1, Number(quantity) || 1);
  if (meta.unique) {
    const existing = await run(
      `SELECT quantity FROM inventory
       WHERE room_id = $1 AND role_slot_id = $2 AND item_id = $3 AND quantity > 0`,
      [roomId, roleSlotId, itemId]
    );
    if (existing.rowCount) {
      throw Object.assign(new Error("Player already owns this unique item"), { statusCode: 409 });
    }
  }
  await run(
    `INSERT INTO inventory (room_id, role_slot_id, item_id, quantity, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (room_id, role_slot_id, item_id)
     DO UPDATE SET quantity = inventory.quantity + EXCLUDED.quantity,
                   metadata = inventory.metadata || EXCLUDED.metadata`,
    [roomId, roleSlotId, itemId, qty, JSON.stringify({ source, grantedAt: new Date().toISOString() })]
  );
  return item;
}

export async function consumeItemIfNeeded(client, { roomId, roleSlotId, itemId }) {
  const run = client?.query ? client.query.bind(client) : query;
  const item = await fetchItemInRoomWorld(client, roomId, itemId);
  if (!item) return false;
  const meta = item.metadata ?? {};
  if (!meta.consumable) return false;
  const row = await run(
    `UPDATE inventory SET quantity = quantity - 1
     WHERE room_id = $1 AND role_slot_id = $2 AND item_id = $3 AND quantity > 0
     RETURNING quantity`,
    [roomId, roleSlotId, itemId]
  );
  if (!row.rowCount) return false;
  if (row.rows[0].quantity <= 0) {
    await run(
      `DELETE FROM inventory WHERE room_id = $1 AND role_slot_id = $2 AND item_id = $3 AND quantity <= 0`,
      [roomId, roleSlotId, itemId]
    );
  }
  return true;
}

export async function listPlayerInventory(client, roomId, roleSlotId) {
  const run = client?.query ? client.query.bind(client) : query;
  const result = await run(
    `SELECT i.id AS item_id, i.name, i.public_text, i.host_text, i.metadata,
            inv.quantity, inv.metadata AS inventory_metadata
     FROM inventory inv
     JOIN items i ON i.id = inv.item_id
     WHERE inv.room_id = $1 AND inv.role_slot_id = $2 AND inv.quantity > 0
     ORDER BY i.name`,
    [roomId, roleSlotId]
  );
  return result.rows;
}
