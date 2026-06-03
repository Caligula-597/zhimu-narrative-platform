import { query, transaction } from "../db.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";

export async function registerCreatorRoutes(app) {
  app.post("/api/worlds/:worldId/documents/parse", async (request) => {
    const actorId = requireActor(request);
    await requireWorldRole(actorId, request.params.worldId);
    return parseCreatorDocument(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/documents/import", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { target = "manuscript", roleSlotId = null, document } = request.body ?? {};
    if (!document?.text || !Array.isArray(document.sections)) return reply.code(400).send({ error: "Parsed document is required" });
    if (target === "manuscript") {
      await query(
        `INSERT INTO story_manuscripts (world_id, body, last_sync_direction, updated_by_user_id)
         VALUES ($1,$2,'manual',$3) ON CONFLICT (world_id) DO UPDATE
         SET body = EXCLUDED.body, last_sync_direction = 'manual', updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = now()`,
        [worldId, document.text, actorId]
      );
      return reply.code(201).send({ target, sections: document.sections.length });
    }
    const role = await query(`SELECT id FROM role_slots WHERE id = $1 AND world_id = $2`, [roleSlotId, worldId]);
    if (!role.rowCount) return reply.code(400).send({ error: "Valid roleSlotId is required for role script import" });
    const imported = await transaction(async (client) => {
      const script = await client.query(`INSERT INTO character_scripts (role_slot_id, title) SELECT $1, '角色私人剧本' WHERE NOT EXISTS (SELECT 1 FROM character_scripts WHERE role_slot_id = $1) RETURNING id`, [roleSlotId]);
      const scriptId = script.rows[0]?.id ?? (await client.query(`SELECT id FROM character_scripts WHERE role_slot_id = $1 ORDER BY created_at LIMIT 1`, [roleSlotId])).rows[0].id;
      const max = await client.query(`SELECT COALESCE(MAX(sequence),0)::int AS value FROM script_sections WHERE character_script_id = $1`, [scriptId]);
      for (const [index, section] of document.sections.entries()) {
        await client.query(
          `INSERT INTO script_sections (character_script_id, role_slot_id, title, body, sequence, publication_status, metadata)
           VALUES ($1,$2,$3,$4,$5,'draft',$6::jsonb)`,
          [scriptId, roleSlotId, section.title, section.body, max.rows[0].value + index + 1, JSON.stringify({ source: "document_import", filename: document.filename })]
        );
      }
      return document.sections.length;
    });
    return reply.code(201).send({ target: "role_script", sections: imported });
  });

  app.post("/api/worlds/:worldId/roles", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicProfile = "", privateProfile = "", sequence } = request.body ?? {};
    if (!name || !sequence) return reply.code(400).send({ error: "name and sequence are required" });
    const result = await query(
      `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [worldId, name, publicProfile, privateProfile, sequence]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.put("/api/worlds/:worldId/roles/:roleSlotId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicProfile = "", privateProfile = "", sequence } = request.body ?? {};
    if (!name || !sequence) return reply.code(400).send({ error: "name and sequence are required" });
    const result = await query(
      `UPDATE role_slots
       SET name = $1, public_profile = $2, private_profile = $3, sequence = $4
       WHERE id = $5 AND world_id = $6 RETURNING *`,
      [name, publicProfile, privateProfile, sequence, roleSlotId, worldId]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "Role slot not found" });
    return result.rows[0];
  });

  app.delete("/api/worlds/:worldId/roles/:roleSlotId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await query(`DELETE FROM role_slots WHERE id = $1 AND world_id = $2 RETURNING id`, [roleSlotId, worldId]);
    if (!result.rowCount) return reply.code(404).send({ error: "Role slot not found" });
    return { ok: true };
  });

  app.post("/api/worlds/:worldId/chapters", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { title, summary = "", sequence } = request.body ?? {};
    if (!title || !sequence) return reply.code(400).send({ error: "title and sequence are required" });
    const result = await query(
      `INSERT INTO chapters (world_id, title, summary, sequence)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [worldId, title, summary, sequence]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.put("/api/worlds/:worldId/chapters/:chapterId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, chapterId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { title, summary = "", publicationStatus = "draft", unlockRules = {} } = request.body ?? {};
    if (!title) return reply.code(400).send({ error: "title is required" });
    if (!["draft", "testing", "published"].includes(publicationStatus)) return reply.code(400).send({ error: "Unsupported publicationStatus" });
    const result = await query(
      `UPDATE chapters SET title = $1, summary = $2, publication_status = $3, unlock_rules = $4::jsonb, updated_at = now()
       WHERE id = $5 AND world_id = $6 RETURNING *`,
      [title, summary, publicationStatus, JSON.stringify(unlockRules), chapterId, worldId]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "Chapter not found" });
    return result.rows[0];
  });

  app.post("/api/worlds/:worldId/roles/:roleSlotId/sections", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { title, body, sequence, chapterId = null, publicationStatus = "draft" } = request.body ?? {};
    if (!title || !body || !sequence) return reply.code(400).send({ error: "title, body and sequence are required" });
    if (!["draft", "testing", "published"].includes(publicationStatus)) return reply.code(400).send({ error: "Unsupported publicationStatus" });
    const section = await transaction(async (client) => {
      const script = await client.query(
        `INSERT INTO character_scripts (role_slot_id, title)
         SELECT $1, '角色私人剧本'
         WHERE NOT EXISTS (SELECT 1 FROM character_scripts WHERE role_slot_id = $1)
         RETURNING id`,
        [roleSlotId]
      );
      const scriptId = script.rows[0]?.id ?? (
        await client.query(`SELECT id FROM character_scripts WHERE role_slot_id = $1 ORDER BY created_at LIMIT 1`, [roleSlotId])
      ).rows[0].id;
      const result = await client.query(
        `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [scriptId, roleSlotId, chapterId, title, body, sequence, publicationStatus]
      );
      return result.rows[0];
    });
    return reply.code(201).send(section);
  });

  app.put("/api/worlds/:worldId/roles/:roleSlotId/sections/:sectionId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId, sectionId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { title, body, chapterId = null, publicationStatus = "draft" } = request.body ?? {};
    if (!title || !body) return reply.code(400).send({ error: "title and body are required" });
    if (!["draft", "testing", "published"].includes(publicationStatus)) return reply.code(400).send({ error: "Unsupported publicationStatus" });
    const result = await query(
      `UPDATE script_sections ss SET title = $1, body = $2, chapter_id = $3, publication_status = $4, updated_at = now()
       FROM role_slots rs
       WHERE ss.id = $5 AND ss.role_slot_id = $6 AND rs.id = ss.role_slot_id AND rs.world_id = $7
       RETURNING ss.*`,
      [title, body, chapterId || null, publicationStatus, sectionId, roleSlotId, worldId]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "Script section not found" });
    return result.rows[0];
  });

  app.delete("/api/worlds/:worldId/roles/:roleSlotId/sections/:sectionId", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId, sectionId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await query(
      `DELETE FROM script_sections ss USING role_slots rs
       WHERE ss.id = $1 AND ss.role_slot_id = $2 AND rs.id = ss.role_slot_id AND rs.world_id = $3
       RETURNING ss.id`,
      [sectionId, roleSlotId, worldId]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "Script section not found" });
    return { ok: true };
  });

  app.post("/api/worlds/:worldId/rooms", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor", "host"]);
    const { name, inviteCode } = request.body ?? {};
    if (!name || !inviteCode) return reply.code(400).send({ error: "name and inviteCode are required" });
    const room = await transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
         VALUES ($1, $2, $3, $4, 'testing') RETURNING *`,
        [worldId, actorId, name, inviteCode]
      );
      await client.query(
        `INSERT INTO room_members (room_id, user_id, member_type) VALUES ($1, $2, 'host')`,
        [result.rows[0].id, actorId]
      );
      await client.query(
        `INSERT INTO voice_rooms (room_id, name, room_type, created_by_user_id)
         VALUES ($1, '公共讨论房', 'public', $2)`,
        [result.rows[0].id, actorId]
      );
      return result.rows[0];
    });
    return reply.code(201).send(room);
  });

  app.get("/api/worlds/:worldId/rooms", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor", "host"]);
    const result = await query(
      `SELECT r.id, r.name, r.invite_code, r.status, r.created_at,
              COUNT(rm.user_id)::int AS member_count
       FROM rooms r
       LEFT JOIN room_members rm ON rm.room_id = r.id AND rm.status = 'active'
       WHERE r.world_id = $1
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      [worldId]
    );
    return result.rows;
  });

}
