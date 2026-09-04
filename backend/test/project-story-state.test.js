import assert from "node:assert/strict";
import test from "node:test";
import {
  STORY_MECHANISM_CONTRACT_VERSION,
  normalizeProjectStoryState,
} from "../../shared/story-mechanism-contracts.js";
import {
  createInitialProjectStoryState,
  generateStoryMechanism,
  acceptStoryBlock,
  editStorySlot,
  lockStorySlot,
} from "../../shared/story-mechanism-engine.js";

/**
 * Fake client mirroring saveProjectStoryState SQL semantics without Postgres.
 * Keeps the persistence contract covered when production DB is blocked for tests.
 */
function createMemoryStore() {
  const byWorld = new Map();
  return {
    async query(sql, params = []) {
      const text = String(sql);
      if (/SELECT id FROM worlds/.test(text)) {
        return { rows: [{ id: params[0] }] };
      }
      if (/SELECT state FROM world_project_story_states/.test(text) && !/RETURNING/.test(text)) {
        const row = byWorld.get(params[0]);
        return { rows: row ? [{ state: row.state }] : [] };
      }
      if (/INSERT INTO world_project_story_states/.test(text)) {
        const [worldId, schemaVersion, stateJson] = params;
        const state = typeof stateJson === "string" ? JSON.parse(stateJson) : stateJson;
        const updated_at = new Date();
        byWorld.set(worldId, { state, schema_version: schemaVersion, updated_at });
        return {
          rows: [{ state, schema_version: schemaVersion, updated_at }],
        };
      }
      throw new Error(`unexpected sql: ${text.slice(0, 80)}`);
    },
    dump(worldId) {
      return byWorld.get(worldId) || null;
    },
  };
}

async function saveLikeService(client, worldId, rawState, actorId) {
  const world = await client.query(`SELECT id FROM worlds WHERE id = $1`, [worldId]);
  if (!world.rows[0]) throw Object.assign(new Error("WORLD_NOT_FOUND"), { code: "WORLD_NOT_FOUND" });
  const previous = await client.query(
    `SELECT state FROM world_project_story_states WHERE world_id = $1`,
    [worldId],
  );
  const prevRevision = Number(previous.rows[0]?.state?.revision) || 0;
  const incoming = normalizeProjectStoryState({ ...rawState, projectId: worldId });
  const nextRevision = Math.max(prevRevision, Number(incoming.revision) || 0) + 1;
  const updatedAt = new Date().toISOString();
  const state = normalizeProjectStoryState({
    ...incoming,
    projectId: worldId,
    revision: nextRevision,
    updatedAt,
  });
  const result = await client.query(
    `INSERT INTO world_project_story_states
       (world_id, schema_version, state, updated_by_user_id)
     VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (world_id) DO UPDATE
     SET schema_version = EXCLUDED.schema_version,
         state = EXCLUDED.state,
         updated_by_user_id = EXCLUDED.updated_by_user_id,
         updated_at = now()
     RETURNING state, schema_version, updated_at`,
    [worldId, STORY_MECHANISM_CONTRACT_VERSION, JSON.stringify(state), actorId || null],
  );
  const row = result.rows[0];
  return {
    state: normalizeProjectStoryState({
      ...row.state,
      projectId: worldId,
      updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
    }),
    exists: true,
    schemaVersion: row.schema_version,
    updatedAt: row.updated_at,
  };
}

test("service-shaped save：reload 保留 accept/lock/edit；A/B 隔离；revision 单调", async () => {
  const store = createMemoryStore();
  const worldA = "11111111-1111-1111-1111-111111111111";
  const worldB = "22222222-2222-2222-2222-222222222222";

  let state = createInitialProjectStoryState(worldA);
  state = generateStoryMechanism({
    templateId: "M01-FRAMING",
    projectStoryState: state,
    preferredVariantId: "V02",
  });
  const blockId = state.mechanismBlocks[0].id;
  state = editStorySlot(state, blockId, "plantedEvidence", "持久化证物");
  state = lockStorySlot(state, blockId, "plantedEvidence", true);
  state = acceptStoryBlock(state, blockId);

  const saved1 = await saveLikeService(store, worldA, state, "actor");
  assert.ok(saved1.state.revision >= 1);
  assert.equal(saved1.state.mechanismBlocks[0].plotBindings.plantedEvidence, "持久化证物");
  assert.ok(saved1.state.mechanismBlocks[0].lockedSlots.includes("plantedEvidence"));

  const dump = store.dump(worldA);
  const reloaded = normalizeProjectStoryState({
    ...dump.state,
    projectId: worldA,
  });
  assert.equal(reloaded.mechanismBlocks.length, 1);
  assert.equal(reloaded.mechanismBlocks[0].status, "USER_ACCEPTED");

  const saved2 = await saveLikeService(store, worldA, reloaded, "actor");
  assert.ok(saved2.state.revision > saved1.state.revision);

  assert.equal(store.dump(worldB), null);
  const initB = createInitialProjectStoryState(worldB);
  assert.equal(initB.mechanismBlocks.length, 0);
});
