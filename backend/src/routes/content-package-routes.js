import { transaction } from "../db.js";
import { requireActor } from "../request-actor.js";
import { requireWorldRole } from "./route-guards.js";
import { buildWorldSnapshot } from "./world-helpers.js";

export async function registerContentPackageRoutes(app) {
  app.get("/api/worlds/:worldId/content-package", async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return { format: "zhimu-world-package", version: 1, exportedAt: new Date().toISOString(), data: await buildWorldSnapshot(worldId) };
  });

  app.post("/api/worlds/:worldId/content-package/import", async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const payload = request.body?.data ?? request.body;
    if (!payload || !Array.isArray(payload.roles) || !Array.isArray(payload.chapters)) {
      return reply.code(400).send({ error: "A valid Zhimu JSON content package is required" });
    }
    const counts = await transaction(async (client) => {
      const chapterIds = new Map(), roleIds = new Map(), sectionIds = new Map(), sceneIds = new Map(), clueIds = new Map(), pointIds = new Map();
      for (const chapter of payload.chapters) {
        const result = await client.query(`INSERT INTO chapters (world_id, title, summary, sequence, publication_status, unlock_rules) VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`, [worldId, chapter.title, chapter.summary ?? "", chapter.sequence ?? chapterIds.size + 1, chapter.publication_status ?? "draft", JSON.stringify(chapter.unlock_rules ?? {})]);
        chapterIds.set(chapter.id, result.rows[0].id);
      }
      for (const role of payload.roles) {
        const result = await client.query(`INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [worldId, role.name, role.public_profile ?? "", role.private_profile ?? "", role.sequence ?? roleIds.size + 1]);
        roleIds.set(role.id, result.rows[0].id);
      }
      for (const section of payload.sections ?? []) {
        const roleId = roleIds.get(section.role_slot_id); if (!roleId) continue;
        const script = await client.query(`INSERT INTO character_scripts (role_slot_id, title) SELECT $1, '角色私人剧本' WHERE NOT EXISTS (SELECT 1 FROM character_scripts WHERE role_slot_id = $1) RETURNING id`, [roleId]);
        const scriptId = script.rows[0]?.id ?? (await client.query(`SELECT id FROM character_scripts WHERE role_slot_id = $1 ORDER BY created_at LIMIT 1`, [roleId])).rows[0].id;
        const result = await client.query(`INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [scriptId, roleId, chapterIds.get(section.chapter_id) ?? null, section.title, section.body, section.sequence ?? 1, section.publication_status ?? "draft"]);
        sectionIds.set(section.id, result.rows[0].id);
      }
      for (const scene of payload.scenes ?? []) {
        const result = await client.query(`INSERT INTO scenes (world_id, chapter_id, name, public_text, host_text, metadata) VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`, [worldId, chapterIds.get(scene.chapter_id) ?? null, scene.name, scene.public_text ?? "", scene.host_text ?? "", JSON.stringify(scene.metadata ?? {})]);
        sceneIds.set(scene.id, result.rows[0].id);
      }
      for (const clue of payload.clues ?? []) {
        const result = await client.query(`INSERT INTO clues (world_id, name, public_text, host_text, visibility, metadata) VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`, [worldId, clue.name, clue.public_text ?? "", clue.host_text ?? "", clue.visibility ?? "role", JSON.stringify(clue.metadata ?? {})]);
        clueIds.set(clue.id, result.rows[0].id);
      }
      for (const point of payload.investigationPoints ?? []) {
        const sceneId = sceneIds.get(point.scene_id); if (!sceneId) continue;
        const result = await client.query(`INSERT INTO investigation_points (world_id, scene_id, name, description, interaction_text, result_text, clue_id, sequence, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING id`, [worldId, sceneId, point.name, point.description ?? "", point.interaction_text ?? "", point.result_text ?? "", clueIds.get(point.clue_id) ?? null, point.sequence ?? 0, JSON.stringify(point.metadata ?? {})]);
        pointIds.set(point.id, result.rows[0].id);
      }
      for (const edge of payload.edges ?? []) {
        const maps = { scene: sceneIds, clue: clueIds, investigation_point: pointIds };
        const fromId = maps[edge.from_type]?.get(edge.from_id), toId = maps[edge.to_type]?.get(edge.to_id);
        if (fromId && toId) await client.query(`INSERT INTO story_graph_edges (world_id, from_type, from_id, to_type, to_id, relation_type, label) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [worldId, edge.from_type, fromId, edge.to_type, toId, edge.relation_type ?? "mainline", edge.label ?? ""]);
      }
      const remapRuleValue = (value) => {
        if (Array.isArray(value)) return value.map(remapRuleValue);
        if (!value || typeof value !== "object") return value;
        const next = { ...value };
        if (next.roleSlotId) next.roleSlotId = roleIds.get(next.roleSlotId) ?? next.roleSlotId;
        if (next.scriptSectionId) next.scriptSectionId = sectionIds.get(next.scriptSectionId) ?? next.scriptSectionId;
        if (next.sceneId) next.sceneId = sceneIds.get(next.sceneId) ?? next.sceneId;
        if (next.clueId) next.clueId = clueIds.get(next.clueId) ?? next.clueId;
        if (next.investigationPointId) next.investigationPointId = pointIds.get(next.investigationPointId) ?? next.investigationPointId;
        return Object.fromEntries(Object.entries(next).map(([key, item]) => [key, remapRuleValue(item)]));
      };
      for (const rule of payload.rules ?? []) {
        await client.query(`INSERT INTO automation_rules (world_id, name, mode, priority, enabled, conditions, actions) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`, [worldId, rule.name, rule.mode ?? "automatic", rule.priority ?? 100, rule.enabled !== false, JSON.stringify(remapRuleValue(rule.conditions ?? { all: [] })), JSON.stringify(remapRuleValue(rule.actions ?? []))]);
      }
      return { chapters: chapterIds.size, roles: roleIds.size, sections: payload.sections?.length ?? 0, scenes: sceneIds.size, clues: clueIds.size, points: pointIds.size, rules: payload.rules?.length ?? 0 };
    });
    return reply.code(201).send({ ok: true, imported: counts });
  });

}
