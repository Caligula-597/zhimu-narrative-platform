import { query, transaction } from "../db.js";
import { sendErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { parseCreatorDocument } from "../document-parser.js";
import { parseDocumentPayloadBase64 } from "../section-content.js";
import { importPdfPagesToRoleScript, importImageFileToRoleSection } from "../document-page-import.js";
import { requireWorldRole } from "./route-guards.js";
import { ROOMS_VISIBLE_TO_ACTOR_SQL } from "./world-helpers.js";
import { setRoomPublicListing } from "../public-room-listing.js";
import {
  worldIdParams,
  parseDocumentSchema,
  importDocumentSchema,
  importDocumentPagesSchema,
  createRoleSchema,
  updateRoleSchema,
  deleteRoleSchema,
  createChapterSchema,
  updateChapterSchema,
  createSectionSchema,
  updateSectionSchema,
  deleteSectionSchema,
  createRoomSchema,
  updateRoomListingSchema
} from "./schemas.js";

export async function registerCreatorRoutes(app) {
  app.post("/api/worlds/:worldId/documents/parse", { schema: parseDocumentSchema }, async (request) => {
    const actorId = requireActor(request);
    await requireWorldRole(actorId, request.params.worldId);
    return parseCreatorDocument(request.body ?? {});
  });

  app.post("/api/worlds/:worldId/documents/import", { schema: importDocumentSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { target = "manuscript", roleSlotId = null, document } = request.body ?? {};
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
    if (!role.rowCount) return sendErr(reply, "ROLE_SLOT_IMPORT_REQUIRED");
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

  app.post("/api/worlds/:worldId/documents/import-pages", { schema: importDocumentPagesSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = request.body ?? {};
    const roleSlotId = body.roleSlotId;
    if (!roleSlotId) return sendErr(reply, "ROLE_SLOT_IMPORT_REQUIRED");

    const contentBase64 = parseDocumentPayloadBase64(body);
    const buffer = Buffer.from(String(contentBase64 ?? ""), "base64");
    const filename = String(body.filename ?? "import.png");
    const extension = filename.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
    const layout = body.layout === "one_section_per_page" ? "one_section_per_page" : "single_section";
    const publicationStatus = ["draft", "testing", "published"].includes(body.publicationStatus)
      ? body.publicationStatus
      : "draft";

    let result;
    if (extension === ".pdf") {
      result = await importPdfPagesToRoleScript({
        worldId,
        actorId,
        roleSlotId,
        filename,
        buffer,
        title: body.title,
        publicationStatus,
        layout
      });
    } else if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension)) {
      result = await importImageFileToRoleSection({
        worldId,
        actorId,
        roleSlotId,
        filename,
        buffer,
        contentType: body.contentType || "image/jpeg",
        title: body.title,
        publicationStatus
      });
    } else {
      return sendErr(reply, "DOCUMENT_TYPE_UNSUPPORTED");
    }

    return reply.code(201).send({
      target: "role_script_pages",
      skipped: result.skipped,
      pageCount: result.pageCount,
      sections: result.sections,
      layout: result.layout ?? "single_section"
    });
  });

  app.post("/api/worlds/:worldId/roles", { schema: createRoleSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicProfile = "", privateProfile = "", sequence } = request.body ?? {};
    const result = await query(
      `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [worldId, name, publicProfile, privateProfile, sequence]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.put("/api/worlds/:worldId/roles/:roleSlotId", { schema: updateRoleSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { name, publicProfile = "", privateProfile = "", sequence } = request.body ?? {};
    const result = await query(
      `UPDATE role_slots
       SET name = $1, public_profile = $2, private_profile = $3, sequence = $4
       WHERE id = $5 AND world_id = $6 RETURNING *`,
      [name, publicProfile, privateProfile, sequence, roleSlotId, worldId]
    );
    if (!result.rowCount) return sendErr(reply, "ROLE_SLOT_NOT_FOUND");
    return result.rows[0];
  });

  app.delete("/api/worlds/:worldId/roles/:roleSlotId", { schema: deleteRoleSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await query(`DELETE FROM role_slots WHERE id = $1 AND world_id = $2 RETURNING id`, [roleSlotId, worldId]);
    if (!result.rowCount) return sendErr(reply, "ROLE_SLOT_NOT_FOUND");
    return { ok: true };
  });

  app.post("/api/worlds/:worldId/chapters", { schema: createChapterSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { title, summary = "", sequence } = request.body ?? {};
    const result = await query(
      `INSERT INTO chapters (world_id, title, summary, sequence)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [worldId, title, summary, sequence]
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.put("/api/worlds/:worldId/chapters/:chapterId", { schema: updateChapterSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, chapterId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { title, summary = "", publicationStatus = "draft", unlockRules = {}, metadata = {} } = request.body ?? {};
    const current = await query(`SELECT metadata FROM chapters WHERE id = $1 AND world_id = $2`, [chapterId, worldId]);
    if (!current.rowCount) return sendErr(reply, "CHAPTER_NOT_FOUND");
    const mergedMeta = { ...(current.rows[0].metadata ?? {}), ...metadata };
    const result = await query(
      `UPDATE chapters SET title = $1, summary = $2, publication_status = $3, unlock_rules = $4::jsonb,
              metadata = $5::jsonb, updated_at = now()
       WHERE id = $6 AND world_id = $7 RETURNING *`,
      [title, summary, publicationStatus, JSON.stringify(unlockRules), JSON.stringify(mergedMeta), chapterId, worldId]
    );
    if (!result.rowCount) return sendErr(reply, "CHAPTER_NOT_FOUND");
    return result.rows[0];
  });

  app.post("/api/worlds/:worldId/roles/:roleSlotId/sections", { schema: createSectionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { title, body, sequence, chapterId = null, publicationStatus = "draft" } = request.body ?? {};
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

  app.put("/api/worlds/:worldId/roles/:roleSlotId/sections/:sectionId", { schema: updateSectionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId, sectionId } = request.params;
    await requireWorldRole(actorId, worldId);
    const { title, body, chapterId = null, publicationStatus = "draft" } = request.body ?? {};
    const result = await query(
      `UPDATE script_sections ss SET title = $1, body = $2, chapter_id = $3, publication_status = $4, updated_at = now()
       FROM role_slots rs
       WHERE ss.id = $5 AND ss.role_slot_id = $6 AND rs.id = ss.role_slot_id AND rs.world_id = $7
       RETURNING ss.*`,
      [title, body, chapterId || null, publicationStatus, sectionId, roleSlotId, worldId]
    );
    if (!result.rowCount) return sendErr(reply, "SCRIPT_SECTION_NOT_FOUND");
    return result.rows[0];
  });

  app.delete("/api/worlds/:worldId/roles/:roleSlotId/sections/:sectionId", { schema: deleteSectionSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roleSlotId, sectionId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await query(
      `DELETE FROM script_sections ss USING role_slots rs
       WHERE ss.id = $1 AND ss.role_slot_id = $2 AND rs.id = ss.role_slot_id AND rs.world_id = $3
       RETURNING ss.id`,
      [sectionId, roleSlotId, worldId]
    );
    if (!result.rowCount) return sendErr(reply, "SCRIPT_SECTION_NOT_FOUND");
    return { ok: true };
  });

  app.post("/api/worlds/:worldId/rooms", { schema: createRoomSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor", "host"]);
    const { name, inviteCode, publicListing = false } = request.body ?? {};
    const room = await transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status, public_listing)
         VALUES ($1, $2, $3, $4, 'testing', $5) RETURNING *`,
        [worldId, actorId, name, inviteCode, Boolean(publicListing)]
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

  app.patch("/api/worlds/:worldId/rooms/:roomId/listing", { schema: updateRoomListingSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, roomId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor", "host"]);
    const { publicListing } = request.body ?? {};
    try {
      const room = await setRoomPublicListing({ actorId, worldId, roomId, publicListing });
      return room;
    } catch (error) {
      if (error.code === "ROOM_NOT_FOUND") return sendErr(reply, "ROOM_NOT_FOUND");
      throw error;
    }
  });

  app.get("/api/worlds/:worldId/rooms", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId, ["owner", "editor", "host"]);
    const result = await query(
      `SELECT r.id, r.name, r.invite_code, r.status, r.public_listing, r.created_at, r.host_user_id,
              COUNT(rm.user_id)::int AS member_count,
              (r.host_user_id = $2) AS is_mine
       FROM rooms r
       LEFT JOIN room_members rm ON rm.room_id = r.id AND rm.status = 'active'
       WHERE r.world_id = $1 AND ${ROOMS_VISIBLE_TO_ACTOR_SQL}
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      [worldId, actorId]
    );
    return result.rows;
  });
}
