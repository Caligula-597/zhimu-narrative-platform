import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { hostUserId } from "./helpers/fixture-ids.js";
import { buildWizardAutomationRules, countEnabledTemplates } from "../src/wizard-automation-templates.js";
import { listWorldTemplates, buildBootstrapPayloadFromTemplate } from "../src/world-templates.js";

test("wizard automation templates build rules from role section ids", () => {
  const rules = buildWizardAutomationRules({
    roles: [{ id: "role-1", name: "记者", sectionId: "section-1" }],
    templates: { reading: true, chapter: true, clue: false, hint: false }
  });
  assert.equal(rules.length, 2);
  assert.ok(rules.every((rule) => rule.conditions.all[0].roleSlotId === "role-1"));
  assert.equal(countEnabledTemplates({ reading: true, clue: false, chapter: true, hint: false }), 2);
});

test("world templates expose three built-in skeletons", () => {
  const templates = listWorldTemplates();
  assert.equal(templates.length, 3);
  assert.ok(templates.some((item) => item.id === "classic-script"));
  const payload = buildBootstrapPayloadFromTemplate("classic-script", { name: "自定义名" });
  assert.equal(payload.name, "自定义名");
  assert.ok(payload.roles.length >= 4);
  assert.equal(payload.includeStarterGraph, true);
  assert.equal(payload.settings.narrativeProfile.creationType, "murder_mystery");
  assert.equal(payload.settings.narrativeProfile.runFormat, "single_session");
});

test("GET /api/platform/world-templates lists templates", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/api/platform/world-templates" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.ok(Array.isArray(body.templates));
  assert.ok(body.templates.length >= 3);
});

test("POST /api/worlds/wizard/bootstrap creates world in one transaction", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const suffix = `${Date.now()}`;
  const response = await app.inject({
    method: "POST",
    url: "/api/worlds/wizard/bootstrap",
    headers: { "x-user-id": hostUserId },
    payload: {
      name: `向导闭环 ${suffix}`,
      summary: "bootstrap fixture",
      settings: {
        worldMode: "scripted",
        contentSource: "template",
        narrativeProfile: { creationType: "tabletop_rpg" },
        tabletopSystem: { dice: { count: 2, sides: 8, modifier: 1, defaultTarget: 12 } }
      },
      chapter: { title: "序章", summary: "fixture chapter" },
      sectionDefaults: { title: "角色序章", body: "正文内容足够用于测试。" },
      roles: [
        { name: "甲", publicProfile: "公开", privateProfile: "秘密", stats: { maxHp: 18, attack: 4 } },
        { name: "乙", publicProfile: "公开", privateProfile: "秘密", stats: { maxHp: 12, defense: 5 } }
      ],
      automationTemplates: { reading: true, chapter: true, clue: false, hint: false },
      includeStarterGraph: true,
      createTestRoom: true
    }
  });
  assert.equal(response.statusCode, 201, response.body);
  const body = response.json();
  assert.ok(body.world?.id);
  assert.ok(body.chapter?.id);
  assert.equal(body.roles.length, 2);
  assert.ok(body.room?.invite_code);
  assert.ok(body.starterGraph?.scene?.id);
  assert.ok(body.rulesCreated >= 1);
  assert.equal(body.world.settings.tabletopSystem.players.length, 2);
  assert.equal(body.world.settings.tabletopSystem.players[0].name, "甲");
  assert.equal(body.world.settings.tabletopSystem.players[0].maxHp, 18);
  assert.equal(body.world.settings.tabletopSystem.dice.sides, 8);

  context.after(async () => {
    const worldId = body.world.id;
    await query(`DELETE FROM rooms WHERE world_id = $1`, [worldId]);
    await query(`DELETE FROM automation_rules WHERE world_id = $1`, [worldId]);
    await query(`DELETE FROM investigation_points WHERE world_id = $1`, [worldId]);
    await query(`DELETE FROM clues WHERE world_id = $1`, [worldId]);
    await query(`DELETE FROM scenes WHERE world_id = $1`, [worldId]);
    await query(`DELETE FROM script_sections WHERE role_slot_id IN (SELECT id FROM role_slots WHERE world_id = $1)`, [
      worldId
    ]);
    await query(`DELETE FROM character_scripts WHERE role_slot_id IN (SELECT id FROM role_slots WHERE world_id = $1)`, [
      worldId
    ]);
    await query(`DELETE FROM role_slots WHERE world_id = $1`, [worldId]);
    await query(`DELETE FROM chapters WHERE world_id = $1`, [worldId]);
    await query(`DELETE FROM world_members WHERE world_id = $1`, [worldId]);
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  });

  const readiness = await app.inject({
    method: "GET",
    url: `/api/worlds/${body.world.id}/publish-readiness`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(readiness.statusCode, 200);
  assert.equal(readiness.json().summary.readyForPlaytest, true);
});

test("POST /api/worlds/from-template/:id applies built-in template", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const suffix = `${Date.now()}`;
  const response = await app.inject({
    method: "POST",
    url: "/api/worlds/from-template/campaign-lite",
    headers: { "x-user-id": hostUserId },
    payload: { name: `模板跑团 ${suffix}` }
  });
  assert.equal(response.statusCode, 201, response.body);
  const body = response.json();
  assert.equal(body.templateId, "campaign-lite");
  assert.equal(body.roles.length, 3);
  assert.equal(body.starterGraph, null);
  assert.equal(body.world.settings.narrativeProfile.creationType, "tabletop_rpg");
  assert.equal(body.world.settings.narrativeProfile.runFormat, "campaign");

  context.after(async () => {
    const worldId = body.world.id;
    await query(`DELETE FROM rooms WHERE world_id = $1`, [worldId]);
    await query(`DELETE FROM automation_rules WHERE world_id = $1`, [worldId]);
    await query(`DELETE FROM script_sections WHERE role_slot_id IN (SELECT id FROM role_slots WHERE world_id = $1)`, [
      worldId
    ]);
    await query(`DELETE FROM character_scripts WHERE role_slot_id IN (SELECT id FROM role_slots WHERE world_id = $1)`, [
      worldId
    ]);
    await query(`DELETE FROM role_slots WHERE world_id = $1`, [worldId]);
    await query(`DELETE FROM chapters WHERE world_id = $1`, [worldId]);
    await query(`DELETE FROM world_members WHERE world_id = $1`, [worldId]);
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  });
});

test("POST /api/worlds/from-template/:id rejects unknown template", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/api/worlds/from-template/not-a-template",
    headers: { "x-user-id": hostUserId },
    payload: {}
  });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().code, "WORLD_TEMPLATE_NOT_FOUND");
});
