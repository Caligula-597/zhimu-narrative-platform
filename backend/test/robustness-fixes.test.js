import assert from "node:assert/strict";
import { fixtureRoomId, fixtureWorldId } from "./helpers/fixture-ids.js";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { buildRoomCheckpointSnapshot } from "../src/checkpoint-snapshot.js";
import { executeHostEventById } from "../src/routes/host-event-actions.js";

const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";



const sampleProposal = {
  title: "Dedup probe",
  logline: "probe",
  chapters: [{ key: "ch-dedup", title: "Dedup章", summary: "s", sequence: 1 }],
  scenes: [{ key: "sc-dedup", chapterKey: "ch-dedup", name: "Dedup场景", publicText: "p", hostText: "h" }],
  investigationPoints: [{ key: "pt-dedup", sceneKey: "sc-dedup", name: "点", description: "d", resultText: "r", clueKey: "cl-dedup" }],
  clues: [{ key: "cl-dedup", name: "Dedup线索", publicText: "p", hostText: "h" }],
  edges: [{ fromType: "scene", fromKey: "sc-dedup", toType: "investigation_point", toKey: "pt-dedup", relationType: "extension", label: "e" }],
  suggestions: []
};

test("deepseek proposal import is idempotent by proposalKey", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const created = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId },
    payload: { name: `Import dedup ${Date.now()}`, summary: "test" }
  });
  assert.equal(created.statusCode, 201);
  const worldId = created.json().id;
  context.after(async () => {
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  });

  const first = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/story-assistant/deepseek/import`,
    headers: { "x-user-id": hostUserId },
    payload: { proposal: sampleProposal }
  });
  assert.equal(first.statusCode, 201, first.body);

  const countAfterFirst = await query(`SELECT count(*)::int AS n FROM clues WHERE world_id = $1 AND metadata->>'proposalKey' = 'cl-dedup'`, [worldId]);
  assert.equal(countAfterFirst.rows[0].n, 1);

  const second = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/story-assistant/deepseek/import`,
    headers: { "x-user-id": hostUserId },
    payload: { proposal: sampleProposal }
  });
  assert.equal(second.statusCode, 201, second.body);

  const countAfterSecond = await query(`SELECT count(*)::int AS n FROM clues WHERE world_id = $1 AND metadata->>'proposalKey' = 'cl-dedup'`, [worldId]);
  assert.equal(countAfterSecond.rows[0].n, 1, "second import must not duplicate clues");

  const chapters = await query(`SELECT count(*)::int AS n FROM chapters WHERE world_id = $1 AND title = 'Dedup章'`, [worldId]);
  assert.equal(chapters.rows[0].n, 1, "second import must not duplicate chapters");
});

test("pipeline import after structure import reuses graph entities", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const created = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId },
    payload: { name: `Pipeline dedup ${Date.now()}`, summary: "test" }
  });
  const worldId = created.json().id;
  context.after(async () => {
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  });

  await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/story-assistant/deepseek/import`,
    headers: { "x-user-id": hostUserId },
    payload: { proposal: sampleProposal }
  });

  const pipeline = {
    proposal: sampleProposal,
    roleMatrix: {
      roles: [{
        key: "role-dedup",
        name: "Dedup角色",
        publicProfile: "公开",
        privateProfile: "秘密",
        chapterKnowledge: [{ chapterKey: "ch-dedup", knows: "k", mustHide: "h", canDiscuss: "c" }]
      }],
      crossChecks: [],
      suggestions: []
    },
    sections: {
      "role-dedup": {
        "ch-dedup": { title: "Dedup分幕", body: "中".repeat(260) }
      }
    }
  };

  await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/story-assistant/deepseek/pipeline/import`,
    headers: { "x-user-id": hostUserId },
    payload: { pipeline }
  });

  const clueCount = await query(`SELECT count(*)::int AS n FROM clues WHERE world_id = $1 AND metadata->>'proposalKey' = 'cl-dedup'`, [worldId]);
  assert.equal(clueCount.rows[0].n, 1);
  const roleCount = await query(`SELECT count(*)::int AS n FROM role_slots WHERE world_id = $1 AND settings->>'deepseekRoleKey' = 'role-dedup'`, [worldId]);
  assert.equal(roleCount.rows[0].n, 1);
});

test("second host event execute returns already resolved", async (context) => {
  const role = await query(`SELECT id FROM role_slots WHERE world_id = $1 ORDER BY sequence LIMIT 1`, [fixtureWorldId]);
  const clue = await query(`SELECT id FROM clues WHERE world_id = $1 ORDER BY created_at LIMIT 1`, [fixtureWorldId]);
  assert.ok(role.rowCount && clue.rowCount);

  const inserted = await query(
    `INSERT INTO pending_host_events (room_id, event_key, title, description, actions, status)
     VALUES ($1, $2, 'double execute probe', '', $3::jsonb, 'pending')
     RETURNING id`,
    [
      fixtureRoomId,
      `double-exec-${Date.now()}`,
      JSON.stringify([{ type: "grant_clue", roleSlotId: role.rows[0].id, clueId: clue.rows[0].id, source: "test" }])
    ]
  );
  const eventId = inserted.rows[0].id;

  const first = await executeHostEventById(fixtureRoomId, hostUserId, eventId);
  assert.equal(first.ok, true);

  const second = await executeHostEventById(fixtureRoomId, hostUserId, eventId);
  assert.equal(second.ok, false);
  assert.equal(second.code, "HOST_EVENT_ALREADY_RESOLVED");

  const status = await query(`SELECT status FROM pending_host_events WHERE id = $1`, [eventId]);
  assert.equal(status.rows[0].status, "executed");
});

test("content package import skips duplicate importKey", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const created = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId },
    payload: { name: `Package dedup ${Date.now()}`, summary: "test" }
  });
  const worldId = created.json().id;
  context.after(async () => {
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  });

  const payload = {
    format: "zhimu-world-package",
    version: 1,
    data: {
      meta: { importKey: `test-key-${Date.now()}` },
      chapters: [{ id: "ch-1", title: "第一章", summary: "", sequence: 1 }],
      roles: [{ id: "role-1", name: "角色A", public_profile: "", private_profile: "", sequence: 1 }],
      sections: [],
      scenes: [{ id: "sc-1", chapter_id: "ch-1", name: "场景", public_text: "", host_text: "" }],
      clues: [],
      investigationPoints: [],
      edges: [],
      rules: []
    }
  };

  const first = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/content-package/import`,
    headers: { "x-user-id": hostUserId },
    payload
  });
  assert.equal(first.statusCode, 201, first.body);

  const second = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/content-package/import`,
    headers: { "x-user-id": hostUserId },
    payload
  });
  assert.equal(second.statusCode, 201, second.body);
  assert.equal(second.json().deduplicated, true);

  const sceneCount = await query(`SELECT count(*)::int AS n FROM scenes WHERE world_id = $1`, [worldId]);
  assert.equal(sceneCount.rows[0].n, 1);
});

test("pipeline import allocates next role sequence when world already has roles", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const created = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId },
    payload: { name: `Pipeline seq ${Date.now()}`, summary: "test" }
  });
  assert.equal(created.statusCode, 201);
  const worldId = created.json().id;
  context.after(async () => {
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  });

  await query(
    `INSERT INTO role_slots (world_id, name, public_profile, private_profile, sequence, settings)
     VALUES ($1, '已有角色', '', '', 1, '{}'::jsonb)`,
    [worldId]
  );

  const pipeline = {
    proposal: {
      title: "Seq probe",
      logline: "probe",
      chapters: [{ key: "ch-seq", title: "序章", summary: "s" }],
      scenes: [{ key: "sc-seq", chapterKey: "ch-seq", name: "场景", publicText: "p" }],
      investigationPoints: [],
      clues: [],
      edges: []
    },
    roleMatrix: {
      roles: [{ key: "role-seq", name: "新角色", publicProfile: "p", privateProfile: "s" }]
    },
    sections: {
      "role-seq": { "ch-seq": { title: "分幕", body: "中".repeat(260) } }
    }
  };

  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/story-assistant/deepseek/pipeline/import`,
    headers: { "x-user-id": hostUserId },
    payload: { pipeline }
  });
  assert.equal(response.statusCode, 201, response.body);

  const seqRow = await query(
    `SELECT sequence FROM role_slots WHERE world_id = $1 AND settings->>'deepseekRoleKey' = 'role-seq'`,
    [worldId]
  );
  assert.equal(seqRow.rows[0].sequence, 2);
});

test("pipeline import normalizes unsafe AI role and proposal fields", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());

  const created = await app.inject({
    method: "POST",
    url: "/api/worlds",
    headers: { "x-user-id": hostUserId },
    payload: { name: `Pipeline normalize ${Date.now()}`, summary: "test" }
  });
  assert.equal(created.statusCode, 201);
  const worldId = created.json().id;
  context.after(async () => {
    await query(`DELETE FROM worlds WHERE id = $1`, [worldId]);
  });

  const longSummary = "s".repeat(5000);
  const response = await app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/story-assistant/deepseek/pipeline/import`,
    headers: { "x-user-id": hostUserId },
    payload: {
      pipeline: {
        proposal: {
          title: "Normalize probe",
          logline: "probe",
          chapters: [{ key: "ch-normalize", title: "", summary: longSummary }],
          scenes: [{ key: "sc-normalize", chapterKey: "ch-normalize", name: "", publicText: "scene" }],
          investigationPoints: [{ key: "pt-normalize", sceneKey: "sc-normalize", name: "", clueKey: "cl-normalize" }],
          clues: [{ key: "cl-normalize", name: "", publicText: "clue", visibility: "everyone" }],
          edges: []
        },
        roleMatrix: {
          roles: [{ name: "", publicProfile: " public ".repeat(1000), privateProfile: " private ".repeat(2000) }]
        },
        sections: {
          "pipeline-role-1": {
            "ch-normalize": { title: "", body: "body".repeat(100) }
          }
        },
        synopsis: { summary: "synopsis".repeat(1000), overallManuscript: "manuscript" }
      }
    }
  });
  assert.equal(response.statusCode, 201, response.body);

  const role = await query(
    `SELECT name, public_profile, private_profile FROM role_slots WHERE world_id = $1 AND settings->>'deepseekRoleKey' = 'pipeline-role-1'`,
    [worldId]
  );
  assert.equal(role.rowCount, 1);
  assert.equal(role.rows[0].name, "Role 1");
  assert.ok(role.rows[0].public_profile.length <= 4000);
  assert.ok(role.rows[0].private_profile.length <= 8000);

  const clue = await query(`SELECT name, visibility FROM clues WHERE world_id = $1 AND metadata->>'proposalKey' = 'cl-normalize'`, [worldId]);
  assert.equal(clue.rowCount, 1);
  assert.equal(clue.rows[0].name, "Clue 1");
  assert.equal(clue.rows[0].visibility, "role");

  const chapter = await query(`SELECT title, length(summary) AS summary_len FROM chapters WHERE world_id = $1 AND metadata->>'proposalKey' = 'ch-normalize'`, [worldId]);
  assert.equal(chapter.rows[0].title, "Chapter 1");
  assert.equal(Number(chapter.rows[0].summary_len), 2000);
});

test("buildRoomCheckpointSnapshot returns schema v2 without pg client overlap", async () => {
  const snapshot = await buildRoomCheckpointSnapshot(fixtureRoomId);
  assert.ok(snapshot);
  assert.equal(snapshot.schemaVersion, 2);
  assert.ok(Array.isArray(snapshot.players));
  assert.ok(Array.isArray(snapshot.clueOwnership));
});
