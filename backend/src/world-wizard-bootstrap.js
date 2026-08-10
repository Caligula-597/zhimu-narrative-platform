import { transaction } from "./db.js";
import { throwErr } from "./api-errors.js";
import { assertCapability } from "./capabilities.js";
import { admitWorldCreation } from "./quota-guards.js";
import { resolveClueKind } from "./clue-kind.js";
import { syncWorldSegmentsFromChapters } from "./world-segments-seed.js";
import { buildWizardAutomationRules } from "./wizard-automation-templates.js";
import { generateRoomInviteCode } from "./room-invite-code.js";
import { normalizeNarrativeSettings } from "../../shared/narrative-profile.js";
import { normalizeCombatantStats, normalizeTabletopSystem } from "../../shared/tabletop-system.js";

function normalizeRoles(roles) {
  if (!Array.isArray(roles) || !roles.length) {
    throwErr("WIZARD_BOOTSTRAP_INVALID", "至少需要一个角色席位");
  }
  return roles.map((role, index) => ({
    name: String(role.name || `角色 ${index + 1}`).trim(),
    publicProfile: String(role.publicProfile || "").trim(),
    privateProfile: String(role.privateProfile || "").trim(),
    goal: String(role.goal || "").trim(),
    scriptBody: String(role.scriptBody || "").trim(),
    sectionTitle: String(role.sectionTitle || "").trim(),
    sectionBody: String(role.sectionBody || "").trim(),
    stats: normalizeCombatantStats(role.stats),
    sequence: role.sequence ?? index + 1
  }));
}

export async function bootstrapWorldFromWizard(actorId, payload) {
  await assertCapability(actorId, "world.create");
  const name = String(payload?.name || "").trim();
  if (!name) throwErr("WIZARD_BOOTSTRAP_INVALID", "请填写世界名称");

  const summary = String(payload?.summary || "").trim();
  const settings = payload?.settings && typeof payload.settings === "object" ? payload.settings : {};
  const chapterInput = payload?.chapter && typeof payload.chapter === "object" ? payload.chapter : {};
  const chapterTitle = String(chapterInput.title || "序章").trim();
  const chapterSummary = String(chapterInput.summary ?? summary).trim();
  const roles = normalizeRoles(payload?.roles);
  const automationTemplates =
    payload?.automationTemplates && typeof payload.automationTemplates === "object"
      ? payload.automationTemplates
      : settings.automationTemplates ?? {};
  const createTestRoom = payload?.createTestRoom !== false;
  const roomName = String(payload?.roomName || `${name} · 测试房`).trim();
  const includeStarterGraph = Boolean(payload?.includeStarterGraph);
  const sectionDefaults =
    payload?.sectionDefaults && typeof payload.sectionDefaults === "object" ? payload.sectionDefaults : {};
  const defaultSectionTitle = String(sectionDefaults.title || "角色序章").trim();
  const defaultSectionBody = String(sectionDefaults.body || "").trim();
  const publicationStatus = ["draft", "testing", "published"].includes(payload?.sectionPublicationStatus)
    ? payload.sectionPublicationStatus
    : "testing";

  const mergedSettings = normalizeNarrativeSettings({
    ...settings,
    contentSource: settings.contentSource || "template",
    automationTemplates
  });
  if (mergedSettings.narrativeProfile?.creationType === "tabletop_rpg") {
    const tabletopSystem = normalizeTabletopSystem(mergedSettings.tabletopSystem);
    tabletopSystem.players = roles.map((role, index) => ({
      id: `pc-${index + 1}`,
      name: role.name,
      role: "玩家角色",
      notes: role.goal,
      conditions: [],
      ...role.stats,
      hp: role.stats.maxHp
    }));
    tabletopSystem.player = tabletopSystem.players[0];
    mergedSettings.tabletopSystem = normalizeTabletopSystem(tabletopSystem);
  }

  return transaction(async (client) => {
    await admitWorldCreation(client, actorId);
    const worldResult = await client.query(
      `INSERT INTO worlds (owner_user_id, name, summary, settings) VALUES ($1, $2, $3, $4::jsonb) RETURNING *`,
      [actorId, name, summary, JSON.stringify(mergedSettings)]
    );
    const world = worldResult.rows[0];
    const worldId = world.id;

    await client.query(`INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`, [
      worldId,
      actorId
    ]);

    const chapterResult = await client.query(
      `INSERT INTO chapters (world_id, title, summary, sequence, metadata) VALUES ($1, $2, $3, 1, $4::jsonb) RETURNING *`,
      [worldId, chapterTitle, chapterSummary, JSON.stringify({ proposalKey: "ch1", source: "wizard_bootstrap" })]
    );
    const chapter = chapterResult.rows[0];

    const createdRoles = [];
    for (const roleDraft of roles) {
      const roleResult = await client.query(
        `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence, settings)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING *`,
        [
          worldId,
          roleDraft.name,
          roleDraft.publicProfile,
          roleDraft.privateProfile,
          roleDraft.sequence,
          JSON.stringify({ combatStats: roleDraft.stats })
        ]
      );
      const role = roleResult.rows[0];

      const scriptResult = await client.query(
        `INSERT INTO character_scripts (role_slot_id, title) VALUES ($1, '角色私人剧本') RETURNING id`,
        [role.id]
      );
      const scriptId = scriptResult.rows[0].id;

      const sectionTitle = roleDraft.sectionTitle || defaultSectionTitle;
      const sectionBody =
        roleDraft.scriptBody ||
        [roleDraft.privateProfile, roleDraft.sectionBody || defaultSectionBody].filter(Boolean).join("\n\n") ||
        defaultSectionBody ||
        "待补充正文。";

      const sectionResult = await client.query(
        `INSERT INTO script_sections (character_script_id, role_slot_id, chapter_id, title, body, sequence, publication_status, metadata)
         VALUES ($1, $2, $3, $4, $5, 1, $6, $7::jsonb) RETURNING *`,
        [
          scriptId,
          role.id,
          chapter.id,
          sectionTitle,
          sectionBody,
          publicationStatus,
          JSON.stringify({ segmentKey: "ch1", source: "wizard_bootstrap" })
        ]
      );

      createdRoles.push({
        id: role.id,
        name: role.name,
        sectionId: sectionResult.rows[0].id
      });
    }

    let starterGraph = null;
    if (includeStarterGraph) {
      const sceneResult = await client.query(
        `INSERT INTO scenes (world_id, chapter_id, name, public_text, host_text, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING *`,
        [
          worldId,
          chapter.id,
          "起始场景",
          "众人抵达现场，可以自由调查周遭环境。",
          "主持可在本场景安排搜证轮次或自由讨论。",
          JSON.stringify({ source: "wizard_bootstrap" })
        ]
      );
      const scene = sceneResult.rows[0];

      const clueResult = await client.query(
        `INSERT INTO clues (world_id, name, public_text, host_text, visibility, clue_kind, metadata)
         VALUES ($1, $2, $3, $4, 'public', $5, $6::jsonb) RETURNING *`,
        [
          worldId,
          "关键线索",
          "一份值得深入调查的发现。",
          "可在创作台调整线索文本与可见性。",
          resolveClueKind({ importance: "key" }),
          JSON.stringify({ source: "wizard_bootstrap" })
        ]
      );
      const clue = clueResult.rows[0];

      const pointResult = await client.query(
        `INSERT INTO investigation_points
          (world_id, scene_id, name, description, interaction_text, result_text, clue_id, sequence, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8::jsonb) RETURNING *`,
        [
          worldId,
          scene.id,
          "调查起点",
          "从这里开始搜证。",
          "仔细搜索该区域。",
          "你发现了一条重要线索。",
          clue.id,
          JSON.stringify({ source: "wizard_bootstrap" })
        ]
      );

      starterGraph = {
        scene: { id: scene.id, name: scene.name },
        clue: { id: clue.id, name: clue.name },
        investigationPoint: { id: pointResult.rows[0].id, name: pointResult.rows[0].name }
      };
    }

    const templateRules = buildWizardAutomationRules({
      roles: createdRoles,
      templates: automationTemplates
    });

    const createdRules = [];
    for (const ruleBody of templateRules) {
      const ruleResult = await client.query(
        `INSERT INTO automation_rules (world_id, room_id, name, mode, priority, enabled, conditions, actions)
         VALUES ($1, NULL, $2, $3, $4, $5, $6::jsonb, $7::jsonb) RETURNING id, name, enabled`,
        [
          worldId,
          ruleBody.name,
          ruleBody.mode,
          ruleBody.priority,
          ruleBody.enabled,
          JSON.stringify(ruleBody.conditions),
          JSON.stringify(ruleBody.actions)
        ]
      );
      createdRules.push(ruleResult.rows[0]);
    }

    let room = null;
    if (createTestRoom) {
      await syncWorldSegmentsFromChapters(client, worldId);
      const clueGrant = starterGraph?.clue?.id
        ? [{ clueId: starterGraph.clue.id, when: "搜证后", roleKey: "" }]
        : [];
      await client.query(
        `UPDATE world_segments
         SET operations = $3::jsonb, updated_at = now()
         WHERE world_id = $1 AND segment_key = $2`,
        [
          worldId,
          "ch1",
          JSON.stringify({
            flow: "向导测试房：阅读分幕后进入起始场景搜证。",
            hostTruth: "本幕为向导生成的默认主持信息，可在 Segment 工作台补充。",
            clueGrants: clueGrant
          })
        ]
      );
      const inviteCode = generateRoomInviteCode("TEST");
      const roomResult = await client.query(
        `INSERT INTO rooms (world_id, host_user_id, name, invite_code, status)
         VALUES ($1, $2, $3, $4, 'testing') RETURNING *`,
        [worldId, actorId, roomName, inviteCode]
      );
      room = roomResult.rows[0];
      await client.query(`INSERT INTO room_members (room_id, user_id, member_type) VALUES ($1, $2, 'host')`, [
        room.id,
        actorId
      ]);
      await client.query(
        `INSERT INTO voice_rooms (room_id, name, room_type, created_by_user_id)
         VALUES ($1, '公共讨论房', 'public', $2)`,
        [room.id, actorId]
      );
    }

    return {
      world,
      chapter,
      roles: createdRoles,
      rules: createdRules,
      rulesCreated: createdRules.filter((rule) => rule.enabled).length,
      room,
      starterGraph,
      inviteCode: room?.invite_code ?? null
    };
  });
}
