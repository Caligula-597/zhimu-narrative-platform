import { query } from "../db.js";
import { requireActor } from "../request-actor.js";
import { sendErr, throwErr } from "../api-errors.js";
import { runRevisionMutation } from "../world-revision.js";
import { requireWorldRole } from "./route-guards.js";
import { createItemSchema, deleteItemSchema, patchItemSchema } from "./schemas/creator-studio.js";

export async function registerStudioItemRoutes(app) {
  app.post("/api/worlds/:worldId/items", { schema: createItemSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicText = "", hostText = "", unique = false, consumable = false, assetId = null, metadata = {} } = request.body ?? {};
    const itemMeta = { ...metadata, unique: Boolean(unique), consumable: Boolean(consumable), assetId: assetId || null };
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const result = await client.query(
        `INSERT INTO items (world_id, name, public_text, host_text, metadata)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         RETURNING id, name, public_text, host_text, metadata, created_at`,
        [worldId, name.trim(), publicText, hostText, JSON.stringify(itemMeta)]
      );
      return result.rows[0];
    }, { sendErr, statusCode: 201 });
  });

  app.patch("/api/worlds/:worldId/items/:itemId", { schema: patchItemSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, itemId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicText, hostText, unique, consumable, assetId, metadata = {} } = request.body ?? {};
    if (name !== undefined && !String(name).trim()) return sendErr(reply, "NAME_EMPTY");
    const current = await query(`SELECT metadata FROM items WHERE id = $1 AND world_id = $2`, [itemId, worldId]);
    if (!current.rowCount) return sendErr(reply, "ITEM_NOT_FOUND");
    const mergedMeta = {
      ...(current.rows[0].metadata ?? {}), ...metadata,
      ...(unique !== undefined ? { unique: Boolean(unique) } : {}),
      ...(consumable !== undefined ? { consumable: Boolean(consumable) } : {}),
      ...(assetId !== undefined ? { assetId: assetId || null } : {})
    };
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const updated = await client.query(
        `UPDATE items
         SET name = COALESCE($3, name), public_text = COALESCE($4, public_text),
             host_text = COALESCE($5, host_text), metadata = $6::jsonb
         WHERE id = $1 AND world_id = $2
         RETURNING id, name, public_text, host_text, metadata, created_at`,
        [itemId, worldId, name?.trim() ?? null, publicText ?? null, hostText ?? null, JSON.stringify(mergedMeta)]
      );
      if (!updated.rowCount) throwErr("ITEM_NOT_FOUND");
      return updated.rows[0];
    }, { sendErr });
  });

  app.delete("/api/worlds/:worldId/items/:itemId", { schema: deleteItemSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, itemId } = request.params;
    await requireWorldRole(actorId, worldId);
    const refs = await query(
      `SELECT COUNT(*)::int AS count FROM investigation_points WHERE world_id = $1 AND required_item_id = $2`,
      [worldId, itemId]
    );
    if (refs.rows[0].count > 0) return sendErr(reply, "ITEM_REFERENCED");
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const result = await client.query(`DELETE FROM items WHERE id = $1 AND world_id = $2 RETURNING id`, [itemId, worldId]);
      if (!result.rowCount) throwErr("ITEM_NOT_FOUND");
      return { ok: true };
    }, { sendErr });
  });
}
