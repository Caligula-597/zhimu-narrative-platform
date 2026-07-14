import { query } from "../db.js";
import { sendErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { parseCreatorDocument } from "../document-parser.js";
import { parseDocumentPayloadBase64 } from "../section-content.js";
import { importPdfPagesToRoleScript, importImageFileToRoleSection, renderPdfPageBuffers } from "../document-page-import.js";
import { runRevisionMutation } from "../world-revision.js";
import { requireWorldRole } from "./route-guards.js";
import { importDocumentPagesSchema, importDocumentSchema, parseDocumentSchema } from "./schemas/creator-document.js";

export async function registerCreatorDocumentRoutes(app) {
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
      return runRevisionMutation(request, reply, worldId, async (client) => {
        await client.query(
          `INSERT INTO story_manuscripts (world_id, body, last_sync_direction, updated_by_user_id)
           VALUES ($1,$2,'manual',$3) ON CONFLICT (world_id) DO UPDATE
           SET body = EXCLUDED.body, last_sync_direction = 'manual', updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = now()`,
          [worldId, document.text, actorId]
        );
        return { target, sections: document.sections.length };
      }, { sendErr, statusCode: 201 });
    }
    const role = await query(`SELECT id FROM role_slots WHERE id = $1 AND world_id = $2`, [roleSlotId, worldId]);
    if (!role.rowCount) return sendErr(reply, "ROLE_SLOT_IMPORT_REQUIRED");
    return runRevisionMutation(request, reply, worldId, async (client) => {
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
      const max = await client.query(
        `SELECT COALESCE(MAX(sequence),0)::int AS value FROM script_sections WHERE character_script_id = $1`,
        [scriptId]
      );
      for (const [index, section] of document.sections.entries()) {
        await client.query(
          `INSERT INTO script_sections (character_script_id, role_slot_id, title, body, sequence, publication_status, metadata)
           VALUES ($1,$2,$3,$4,$5,'draft',$6::jsonb)`,
          [scriptId, roleSlotId, section.title, section.body, max.rows[0].value + index + 1, JSON.stringify({ source: "document_import", filename: document.filename })]
        );
      }
      return { target: "role_script", sections: document.sections.length };
    }, { sendErr, statusCode: 201 });
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

    if (extension === ".pdf") {
      const renderedPages = await renderPdfPageBuffers(buffer);
      return runRevisionMutation(request, reply, worldId, async (client) => {
        const result = await importPdfPagesToRoleScript({
          worldId,
          actorId,
          roleSlotId,
          filename,
          buffer,
          title: body.title,
          publicationStatus,
          layout,
          renderedPages,
          client
        });
        return {
          target: "role_script_pages",
          skipped: result.skipped,
          pageCount: result.pageCount,
          sections: result.sections,
          layout: result.layout ?? "single_section"
        };
      }, { sendErr, statusCode: 201 });
    }
    if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension)) {
      return runRevisionMutation(request, reply, worldId, async (client) => {
        const result = await importImageFileToRoleSection({
          worldId,
          actorId,
          roleSlotId,
          filename,
          buffer,
          contentType: body.contentType || "image/jpeg",
          title: body.title,
          publicationStatus,
          client
        });
        return {
          target: "role_script_pages",
          skipped: result.skipped,
          pageCount: result.pageCount,
          sections: result.sections,
          layout: result.layout ?? "single_section"
        };
      }, { sendErr, statusCode: 201 });
    }
    return sendErr(reply, "DOCUMENT_TYPE_UNSUPPORTED");
  });
}
