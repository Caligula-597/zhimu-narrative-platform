import { pool, query, transaction } from "../db.js";
import { throwErr } from "../api-errors.js";
import { validateDeepseekProposal } from "../deepseek.js";
import { seedPlayerTasksFromArchives } from "../player-tasks.js";
import { seedWorldSegmentsFromPipeline, syncWorldSegmentsFromChapters } from "../world-segments-seed.js";
import { seedBibleFromPipeline } from "../creator-bible.js";
import { resolveClueKind } from "../clue-kind.js";
import { cleanText } from "../prompts/shared.js";


async function nextRoleSlotSequence(client, worldId) {
  const row = await client.query(
    `SELECT COALESCE(MAX(sequence), 0)::int AS max_seq FROM role_slots WHERE world_id = $1`,
    [worldId]
  );
  return row.rows[0].max_seq + 1;
}

async function ensureCharacterScript(client, roleSlotId, roleName) {
  const script = await client.query(
    `SELECT id FROM character_scripts WHERE role_slot_id = $1 ORDER BY created_at LIMIT 1`,
    [roleSlotId]
  );
  if (script.rowCount) return script.rows[0].id;
  const created = await client.query(
    `INSERT INTO character_scripts (role_slot_id, title) VALUES ($1,$2) RETURNING id`,
    [roleSlotId, `${roleName} · 私人剧本`]
  );
  return created.rows[0].id;
}

/** Resolve pipeline/mystery role by deepseekRoleKey; create at next free sequence if missing. */
async function resolveOrCreateDeepseekRoleSlot(client, worldId, role, roleIndex) {
  const roleKey = role.key || `pipeline-role-${roleIndex}`;
  const existingRole = await client.query(
    `SELECT id FROM role_slots
     WHERE world_id = $1 AND settings->>'deepseekRoleKey' = $2
     LIMIT 1`,
    [worldId, roleKey]
  );
  if (existingRole.rowCount) {
    const roleSlotId = existingRole.rows[0].id;
    await ensureCharacterScript(client, roleSlotId, role.name || roleKey);
    return { roleSlotId, roleKey };
  }

  const nextSequence = await nextRoleSlotSequence(client, worldId);
  const createdRole = await client.query(
    `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence, settings)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`,
    [
      worldId,
      role.name,
      role.publicProfile || "",
      role.privateProfile || "",
      nextSequence,
      JSON.stringify({ deepseekRoleKey: roleKey })
    ]
  );
  const roleSlotId = createdRole.rows[0].id;
  await ensureCharacterScript(client, roleSlotId, role.name || roleKey);
  return { roleSlotId, roleKey };
}

function rethrowPipelineImportDbError(error) {
  if (error?.code === "23505") {
    throwErr("CONFLICT", "上传与现有角色或编排数据冲突，请刷新创作中心后重试");
  }
  throw error;
}

function normalizeDeepseekImportRoles(rawRoles, fallbackPrefix = "pipeline-role") {
  if (!Array.isArray(rawRoles) || !rawRoles.length) throwErr("DEEPSEEK_PACKAGE_REQUIRED");
  const seen = new Set();
  return rawRoles.slice(0, 24).map((role, index) => {
    const source = role && typeof role === "object" ? role : {};
    let key = cleanText(source.key, 80) || `${fallbackPrefix}-${index + 1}`;
    if (seen.has(key)) key = `${key}-${index + 1}`;
    seen.add(key);
    const sections = Array.isArray(source.sections)
      ? source.sections.slice(0, 24).map((section, sectionIndex) => ({
          chapterKey: cleanText(section?.chapterKey, 80),
          title: cleanText(section?.title, 200) || `Section ${sectionIndex + 1}`,
          body: cleanText(section?.body, 120000)
        }))
      : [];
    return {
      ...source,
      key,
      name: cleanText(source.name, 120) || `Role ${index + 1}`,
      publicProfile: cleanText(source.publicProfile, 4000),
      privateProfile: cleanText(source.privateProfile, 8000),
      sections
    };
  });
}

function normalizePipelineSection(section, fallbackTitle) {
  if (!section || typeof section !== "object") return null;
  const body = cleanText(section.body, 120000);
  if (!body) return null;
  return {
    title: cleanText(section.title, 200) || fallbackTitle,
    body
  };
}
export async function importDeepseekProposalWithClient(client, worldId, rawProposal) {
  const proposal = validateDeepseekProposal(rawProposal);
  const chapterIds = new Map();
  const sceneIds = new Map();
  const clueIds = new Map();
  const pointIds = new Map();
  const sourceTag = "deepseek_proposal";

  async function findExistingId(table, proposalKey) {
    const row = await client.query(
      `SELECT id FROM ${table}
       WHERE world_id = $1 AND metadata->>'proposalKey' = $2 AND metadata->>'source' = $3
       LIMIT 1`,
      [worldId, proposalKey, sourceTag]
    );
    return row.rowCount ? row.rows[0].id : null;
  }

  async function resolveChapterId(chapterKey, chapter) {
    const fromScene = await client.query(
      `SELECT chapter_id FROM scenes
       WHERE world_id = $1 AND metadata->>'chapterKey' = $2
       LIMIT 1`,
      [worldId, chapterKey]
    );
    if (fromScene.rowCount) return fromScene.rows[0].chapter_id;

    const fromTitle = await client.query(
      `SELECT c.id FROM chapters c
       WHERE c.world_id = $1 AND c.title = $2
         AND EXISTS (
           SELECT 1 FROM scenes s
           WHERE s.chapter_id = c.id AND s.metadata->>'source' = $3
         )
       ORDER BY c.sequence
       LIMIT 1`,
      [worldId, chapter.title, sourceTag]
    );
    return fromTitle.rowCount ? fromTitle.rows[0].id : null;
  }

  const sequence = await client.query(`SELECT COALESCE(MAX(sequence), 0)::int AS value FROM chapters WHERE world_id = $1`, [worldId]);
  let nextSequence = sequence.rows[0].value;
  for (const [index, chapter] of proposal.chapters.entries()) {
    const existingId = await resolveChapterId(chapter.key, chapter);
    if (existingId) {
      chapterIds.set(chapter.key, existingId);
      if (chapter.metadata && Object.keys(chapter.metadata).length) {
        await client.query(
          `UPDATE chapters SET metadata = metadata || $1::jsonb WHERE id = $2`,
          [
            JSON.stringify({ source: sourceTag, proposalKey: chapter.key, ...chapter.metadata }),
            existingId
          ]
        );
      }
      continue;
    }
    nextSequence += 1;
    const chapterMetadata = {
      source: sourceTag,
      proposalKey: chapter.key,
      ...(chapter.metadata || {})
    };
    const created = await client.query(
      `INSERT INTO chapters (world_id, title, summary, sequence, metadata)
       VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING id`,
      [worldId, chapter.title, chapter.summary ?? "", nextSequence, JSON.stringify(chapterMetadata)]
    );
    chapterIds.set(chapter.key, created.rows[0].id);
  }

  for (const clue of proposal.clues) {
    const existingId = await findExistingId("clues", clue.key);
    if (existingId) {
      clueIds.set(clue.key, existingId);
      continue;
    }
    const clueMeta = { source: sourceTag, proposalKey: clue.key, ...(clue.metadata || {}) };
    const created = await client.query(
      `INSERT INTO clues (world_id, name, public_text, host_text, visibility, clue_kind, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id`,
      [
        worldId,
        clue.name,
        clue.publicText ?? clue.description ?? "",
        clue.hostText ?? "",
        clue.visibility === "public" ? "public" : clue.visibility === "host" ? "host" : "role",
        resolveClueKind(clue),
        JSON.stringify(clueMeta)
      ]
    );
    clueIds.set(clue.key, created.rows[0].id);
  }

  for (const scene of proposal.scenes) {
    const existingId = await findExistingId("scenes", scene.key);
    if (existingId) {
      sceneIds.set(scene.key, existingId);
      continue;
    }
    const created = await client.query(
      `INSERT INTO scenes (world_id, chapter_id, name, public_text, host_text, metadata)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`,
      [
        worldId,
        chapterIds.get(scene.chapterKey),
        scene.name,
        scene.publicText ?? "",
        scene.hostText ?? "",
        JSON.stringify({
          source: sourceTag,
          proposalKey: scene.key,
          chapterKey: scene.chapterKey,
          ...(scene.metadata || {})
        })
      ]
    );
    sceneIds.set(scene.key, created.rows[0].id);
  }

  for (const point of proposal.investigationPoints) {
    const existingId = await findExistingId("investigation_points", point.key);
    if (existingId) {
      pointIds.set(point.key, existingId);
      continue;
    }
    const created = await client.query(
      `INSERT INTO investigation_points (world_id, scene_id, name, description, result_text, clue_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id`,
      [
        worldId,
        sceneIds.get(point.sceneKey),
        point.name,
        point.description ?? "",
        point.resultText ?? "",
        point.clueKey ? clueIds.get(point.clueKey) : null,
        JSON.stringify({ source: sourceTag, proposalKey: point.key })
      ]
    );
    pointIds.set(point.key, created.rows[0].id);
  }

  const ids = { scene: sceneIds, clue: clueIds, investigation_point: pointIds };
  let edgeCount = 0;
  for (const edge of proposal.edges) {
    const fromId = ids[edge.fromType]?.get(edge.fromKey);
    const toId = ids[edge.toType]?.get(edge.toKey);
    if (!fromId || !toId) continue;
    await client.query(
      `INSERT INTO story_graph_edges (world_id, from_type, from_id, to_type, to_id, relation_type, label)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (world_id, from_type, from_id, to_type, to_id, relation_type) DO NOTHING`,
      [worldId, edge.fromType, fromId, edge.toType, toId, edge.relationType, `DeepSeek 提案 · ${edge.label ?? ""}`]
    );
    edgeCount += 1;
  }
  return {
    chapterIds,
    sceneIds,
    clueIds,
    pointIds,
    summary: {
      chapters: chapterIds.size,
      scenes: sceneIds.size,
      clues: clueIds.size,
      investigationPoints: pointIds.size,
      edges: edgeCount
    }
  };
}

/** Create per-role reading_completed → unlock next act rules after matrix pipeline import. */
export async function materializePipelineReadingUnlockRules(client, worldId, options = {}) {
  const matrixMode = options.matrixMode || "honkaku";
  const betweenActMode = matrixMode === "henkaku" ? "automatic" : "host_confirm";
  const { rows } = await client.query(
    `SELECT ss.id, ss.sequence, ss.metadata->>'chapterKey' AS chapter_key,
            ss.metadata->>'roleKey' AS role_key, ss.role_slot_id,
            rs.name AS role_name, rs.sequence AS role_sequence
     FROM script_sections ss
     JOIN role_slots rs ON rs.id = ss.role_slot_id
     WHERE rs.world_id = $1
       AND ss.metadata->>'chapterKey' IS NOT NULL
     ORDER BY rs.sequence, ss.sequence`,
    [worldId]
  );
  const byRole = new Map();
  for (const row of rows) {
    const key = row.role_key || row.role_slot_id;
    if (!byRole.has(key)) byRole.set(key, []);
    byRole.get(key).push(row);
  }
  const existingRules = await client.query(
    `SELECT name FROM automation_rules WHERE world_id = $1 AND room_id IS NULL`,
    [worldId]
  );
  const existingRuleNames = new Set(existingRules.rows.map((row) => row.name));
  let rulesCreated = 0;
  for (const sections of byRole.values()) {
    sections.sort((a, b) => Number(a.sequence) - Number(b.sequence));
    for (let i = 0; i < sections.length - 1; i++) {
      const from = sections[i];
      const to = sections[i + 1];
      const fromAct = from.chapter_key || `幕${from.sequence}`;
      const toAct = to.chapter_key || `幕${to.sequence}`;
      const ruleName = `${from.role_name} · ${fromAct} 读完 → ${toAct}`;
      if (existingRuleNames.has(ruleName)) continue;
      await client.query(
        `INSERT INTO automation_rules (world_id, name, mode, priority, enabled, conditions, actions)
         VALUES ($1, $2, $3, $4, true, $5::jsonb, $6::jsonb)`,
        [
          worldId,
          ruleName,
          betweenActMode,
          10 + Number(from.role_sequence || 1) * 10 + Number(from.sequence || i + 1),
          JSON.stringify({
            all: [
              {
                type: "reading_completed",
                roleSlotId: from.role_slot_id,
                scriptSectionId: from.id
              }
            ]
          }),
          JSON.stringify([
            { type: "unlock_script_section", scriptSectionId: to.id },
            {
              type: "timeline_log",
              message: `${from.role_name} 完成 ${fromAct} 阅读；主持确认后开放 ${toAct}。`
            }
          ])
        ]
      );
      existingRuleNames.add(ruleName);
      rulesCreated += 1;
    }
  }
  return { rulesCreated, ruleMode: betweenActMode };
}

export async function importDeepseekProposal(worldId, rawProposal) {
  return transaction(async (client) => (await importDeepseekProposalWithClient(client, worldId, rawProposal)).summary);
}

export async function importDeepseekMysteryPackageWithClient(client, worldId, mystery) {
  const graph = await importDeepseekProposalWithClient(client, worldId, mystery.proposal);
  const packageData = mystery.package && typeof mystery.package === "object" ? mystery.package : {};
  const roles = normalizeDeepseekImportRoles(packageData.roles, "mystery-role");
  let sectionCount = 0;
  for (const [roleIndex, role] of roles.entries()) {
    const { roleSlotId, roleKey } = await resolveOrCreateDeepseekRoleSlot(client, worldId, role, roleIndex);
    const scriptId = await ensureCharacterScript(client, roleSlotId, role.name || roleKey);
    if (!scriptId) continue;
    for (const [sectionIndex, section] of role.sections.entries()) {
      const chapterKey = section.chapterKey;
      if (!chapterKey || !graph.chapterIds.has(chapterKey) || !section.body) continue;
      const existingSection = await client.query(
        `SELECT id FROM script_sections
         WHERE role_slot_id = $1 AND metadata->>'chapterKey' = $2 AND metadata->>'roleKey' = $3
         LIMIT 1`,
        [roleSlotId, chapterKey, roleKey]
      );
      if (existingSection.rowCount) continue;
      await client.query(
        `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,'testing',$7::jsonb)`,
        [
          scriptId,
          roleSlotId,
          graph.chapterIds.get(chapterKey),
          section.title,
          section.body,
          sectionIndex + 1,
          JSON.stringify({ source: "deepseek_mystery_package", chapterKey, roleKey })
        ]
      );
      sectionCount += 1;
    }
  }
  await client.query(
    `UPDATE worlds SET name = COALESCE($1, name), summary = COALESCE($2, summary), updated_at = now() WHERE id = $3`,
    [cleanText(packageData.title, 120) || null, cleanText(packageData.summary, 4000) || null, worldId]
  );
  const overallManuscript = cleanText(packageData.overallManuscript, 500000);
  await client.query(
    `INSERT INTO story_manuscripts (world_id, body, last_sync_direction)
     VALUES ($1,$2,'manual')
     ON CONFLICT (world_id) DO UPDATE SET body = EXCLUDED.body, last_sync_direction = EXCLUDED.last_sync_direction, updated_at = now()`,
    [worldId, overallManuscript]
  );
  return { ...graph.summary, roles: roles.length, sections: sectionCount, manuscriptCharacters: overallManuscript.length };
}

export async function importDeepseekMysteryPackage(worldId, mystery) {
  try {
    return await transaction((client) => importDeepseekMysteryPackageWithClient(client, worldId, mystery));
  } catch (error) {
    rethrowPipelineImportDbError(error);
  }
}

export { syncWorldSegmentsFromChapters } from "../world-segments-seed.js";

export async function importDeepseekPipelinePackageWithClient(client, worldId, pipeline) {
  const proposal = validateDeepseekProposal(pipeline.proposal);
  const roles = normalizeDeepseekImportRoles(pipeline.roleMatrix?.roles || pipeline.package?.roles, "pipeline-role");
  const sectionsMap = pipeline.sections && typeof pipeline.sections === "object" ? pipeline.sections : {};
  {
      const graph = await importDeepseekProposalWithClient(client, worldId, proposal);
      let sectionCount = 0;
      const roleKeyToSlotId = new Map();
      for (const [roleIndex, role] of roles.entries()) {
        const { roleSlotId, roleKey } = await resolveOrCreateDeepseekRoleSlot(client, worldId, role, roleIndex);
        roleKeyToSlotId.set(roleKey, roleSlotId);
        if (role.key) roleKeyToSlotId.set(role.key, roleSlotId);
        const scriptId = await ensureCharacterScript(client, roleSlotId, role.name || roleKey);
        if (!scriptId) continue;

        const roleSections = sectionsMap[role.key] || sectionsMap[roleKey] || {};
        const fromPackage = role.sections || [];
        for (const [sectionIndex, chapter] of proposal.chapters.entries()) {
          const fallbackTitle = `${chapter.title} · ${role.name}`;
          const mapped = normalizePipelineSection(roleSections[chapter.key], fallbackTitle);
          const packaged = normalizePipelineSection(fromPackage.find((item) => item.chapterKey === chapter.key), fallbackTitle);
          const sectionPayload = mapped || packaged;
          if (!sectionPayload || !graph.chapterIds.has(chapter.key)) continue;
          const body = sectionPayload.body;

          const existingSection = await client.query(
            `SELECT id FROM script_sections
             WHERE role_slot_id = $1 AND metadata->>'chapterKey' = $2 AND metadata->>'roleKey' = $3
             LIMIT 1`,
            [roleSlotId, chapter.key, roleKey]
          );
          if (existingSection.rowCount) continue;

          await client.query(
            `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status, metadata)
             VALUES ($1,$2,$3,$4,$5,$6,'testing',$7::jsonb)`,
            [
              scriptId,
              roleSlotId,
              graph.chapterIds.get(chapter.key),
              mapped?.title || packaged?.title || `${chapter.title} · ${role.name}`,
              body,
              sectionIndex + 1,
              JSON.stringify({ source: "deepseek_pipeline", chapterKey: chapter.key, roleKey })
            ]
          );
          sectionCount += 1;
        }
      }
      const synopsis = pipeline.synopsis || pipeline.package;
      if (synopsis?.title || synopsis?.summary) {
        await client.query(
          `UPDATE worlds SET name = COALESCE($1, name), summary = COALESCE($2, summary), updated_at = now() WHERE id = $3`,
          [cleanText(synopsis.title, 120) || null, cleanText(synopsis.summary, 4000) || null, worldId]
        );
      }
      const manuscript = cleanText(synopsis?.overallManuscript, 500000);
      if (manuscript) {
        await client.query(
          `INSERT INTO story_manuscripts (world_id, body, last_sync_direction)
           VALUES ($1,$2,'manual')
           ON CONFLICT (world_id) DO UPDATE SET body = EXCLUDED.body, last_sync_direction = EXCLUDED.last_sync_direction, updated_at = now()`,
          [worldId, manuscript]
        );
      }
      const matrixSync =
        proposal.matrixSync ||
        pipeline.matrixSync ||
        (pipeline.infoMatrix
          ? {
              matrixMode: pipeline.setting?.matrixMode || "honkaku",
              publicEnvironmentByAct: pipeline.infoMatrix.publicEnvironmentByAct || {},
              entityUnlockSchedule: proposal.entityUnlockSchedule || {},
              mechanicalTriggers: pipeline.infoMatrix.mechanicalTriggers || []
            }
          : null);
      if (matrixSync && typeof matrixSync === "object") {
        await client.query(
          `UPDATE worlds SET settings = COALESCE(settings, '{}'::jsonb) || $1::jsonb, updated_at = now() WHERE id = $2`,
          [JSON.stringify({ matrixSync }), worldId]
        );
      }
      const unlockRules = await materializePipelineReadingUnlockRules(client, worldId, {
        matrixMode: pipeline.setting?.matrixMode || matrixSync?.matrixMode || "honkaku"
      });
      let playerTasksSeeded = 0;
      if (pipeline.characterArchives?.roles?.length) {
        playerTasksSeeded = await seedPlayerTasksFromArchives(
          client,
          worldId,
          pipeline.characterArchives,
          roleKeyToSlotId
        );
      }
      const segmentsSeeded = await seedWorldSegmentsFromPipeline(client, worldId, pipeline, graph);
      const bibleSeeded = await seedBibleFromPipeline(client, worldId, pipeline, roleKeyToSlotId);
      return {
        ...graph.summary,
        roles: roles.length,
        sections: sectionCount,
        manuscriptCharacters: manuscript?.length || 0,
        matrixSyncStored: Boolean(matrixSync),
        unlockRulesCreated: unlockRules.rulesCreated,
        unlockRuleMode: unlockRules.ruleMode,
        playerTasksSeeded,
        segmentsSeeded,
        bibleSeeded
      };
  }
}

export async function importDeepseekPipelinePackage(worldId, pipeline) {
  try {
    return await transaction((client) => importDeepseekPipelinePackageWithClient(client, worldId, pipeline));
  } catch (error) {
    rethrowPipelineImportDbError(error);
  }
}
