import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../src/app.js";
import { pool, query } from "../src/db.js";
import { lockWorldEditor } from "../src/repositories/content-platform-access-repository.js";
import { lockWorldTruthClaim } from "../src/repositories/content-platform-truth-repository.js";
import { hostUserId } from "./helpers/fixture-ids.js";

async function createTruthWorld(label) {
  const result = await query(
    `INSERT INTO worlds (owner_user_id, name, summary)
     VALUES ($1, $2, '') RETURNING id`,
    [hostUserId, `${label}-${randomUUID()}`]
  );
  const worldId = result.rows[0].id;
  await query(
    `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [worldId, hostUserId]
  );
  return worldId;
}

test("truth claims reject whitespace and normalize persisted text", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await createTruthWorld("truth-text");
  context.after(() => query(`DELETE FROM worlds WHERE id = $1`, [worldId]));
  const url = `/api/worlds/${worldId}/truth-claims`;
  const headers = { "x-user-id": hostUserId };

  const emptyTitle = await app.inject({
    method: "POST",
    url,
    headers,
    payload: { title: "   ", claim: "content" }
  });
  assert.equal(emptyTitle.statusCode, 400, emptyTitle.body);
  assert.equal(emptyTitle.json().code, "TITLE_EMPTY");

  const emptyClaim = await app.inject({
    method: "POST",
    url,
    headers,
    payload: { title: "title", claim: "   " }
  });
  assert.equal(emptyClaim.statusCode, 400, emptyClaim.body);
  assert.equal(emptyClaim.json().code, "TRUTH_CLAIM_EMPTY");

  const created = await app.inject({
    method: "POST",
    url,
    headers,
    payload: {
      claimKey: "  core-truth  ",
      title: "  Core truth  ",
      claim: "  The locked room was staged.  ",
      revealStage: "  finale  "
    }
  });
  assert.equal(created.statusCode, 201, created.body);
  assert.equal(created.json().claim.claim_key, "core-truth");
  assert.equal(created.json().claim.title, "Core truth");
  assert.equal(created.json().claim.claim, "The locked room was staged.");
  assert.equal(created.json().claim.reveal_stage, "finale");

  const cleared = await app.inject({
    method: "PATCH",
    url: `${url}/${created.json().claim.id}`,
    headers,
    payload: { claimKey: null, revealStage: null }
  });
  assert.equal(cleared.statusCode, 200, cleared.body);
  assert.equal(cleared.json().claim.claim_key, null);
  assert.equal(cleared.json().claim.reveal_stage, null);

  const emptyPatch = await app.inject({
    method: "PATCH",
    url: `${url}/${created.json().claim.id}`,
    headers,
    payload: {}
  });
  assert.equal(emptyPatch.statusCode, 400, emptyPatch.body);
});

test("duplicate claim keys return a typed conflict without revision drift", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await createTruthWorld("truth-key");
  context.after(() => query(`DELETE FROM worlds WHERE id = $1`, [worldId]));
  const request = (claimKey) => app.inject({
    method: "POST",
    url: `/api/worlds/${worldId}/truth-claims`,
    headers: { "x-user-id": hostUserId },
    payload: { claimKey, title: "Unique key", claim: "Canonical fact" }
  });

  const first = await request("  unique-key  ");
  assert.equal(first.statusCode, 201, first.body);
  const revisionBefore = await query(`SELECT content_revision FROM worlds WHERE id = $1`, [worldId]);
  const duplicate = await request("unique-key");
  assert.equal(duplicate.statusCode, 409, duplicate.body);
  assert.equal(duplicate.json().code, "TRUTH_CLAIM_KEY_CONFLICT");
  const revisionAfter = await query(`SELECT content_revision FROM worlds WHERE id = $1`, [worldId]);
  assert.equal(revisionAfter.rows[0].content_revision, revisionBefore.rows[0].content_revision);
  const count = await query(
    `SELECT COUNT(*)::int AS count FROM world_truth_claims WHERE world_id = $1 AND claim_key = $2`,
    [worldId, "unique-key"]
  );
  assert.equal(count.rows[0].count, 1);
});

test("truth claim mutations cannot cross world boundaries", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const localWorldId = await createTruthWorld("truth-local");
  const foreignWorldId = await createTruthWorld("truth-foreign");
  context.after(() => query(`DELETE FROM worlds WHERE id = ANY($1::uuid[])`, [[localWorldId, foreignWorldId]]));
  const foreign = await query(
    `INSERT INTO world_truth_claims (world_id, title, claim)
     VALUES ($1, 'foreign-title', 'foreign-claim') RETURNING id`,
    [foreignWorldId]
  );
  const revisionBefore = await query(`SELECT content_revision FROM worlds WHERE id = $1`, [localWorldId]);

  for (const method of ["PATCH", "DELETE"]) {
    const response = await app.inject({
      method,
      url: `/api/worlds/${localWorldId}/truth-claims/${foreign.rows[0].id}`,
      headers: { "x-user-id": hostUserId },
      ...(method === "PATCH" ? { payload: { title: "must-not-save" } } : {})
    });
    assert.equal(response.statusCode, 404, response.body);
    assert.equal(response.json().code, "TRUTH_CLAIM_NOT_FOUND");
  }

  const stored = await query(`SELECT title FROM world_truth_claims WHERE id = $1`, [foreign.rows[0].id]);
  assert.equal(stored.rows[0].title, "foreign-title");
  const revisionAfter = await query(`SELECT content_revision FROM worlds WHERE id = $1`, [localWorldId]);
  assert.equal(revisionAfter.rows[0].content_revision, revisionBefore.rows[0].content_revision);
});

test("referenced truth claims cannot leave dangling segment references", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: true });
  context.after(() => app.close());
  const worldId = await createTruthWorld("truth-reference");
  context.after(() => query(`DELETE FROM worlds WHERE id = $1`, [worldId]));
  const claim = await query(
    `INSERT INTO world_truth_claims (world_id, title, claim)
     VALUES ($1, 'referenced-title', 'referenced-claim') RETURNING id`,
    [worldId]
  );
  const segment = await query(
    `INSERT INTO world_segments (world_id, segment_key, title)
     VALUES ($1, $2, 'reference-segment') RETURNING id`,
    [worldId, `truth-ref-${randomUUID()}`]
  );
  await query(
    `INSERT INTO world_segment_refs (segment_id, ref_type, ref_id)
     VALUES ($1, 'truth_claim', $2)`,
    [segment.rows[0].id, claim.rows[0].id]
  );
  const revisionBefore = await query(`SELECT content_revision FROM worlds WHERE id = $1`, [worldId]);

  const response = await app.inject({
    method: "DELETE",
    url: `/api/worlds/${worldId}/truth-claims/${claim.rows[0].id}`,
    headers: { "x-user-id": hostUserId }
  });
  assert.equal(response.statusCode, 409, response.body);
  assert.equal(response.json().code, "TRUTH_CLAIM_REFERENCED");
  assert.equal(response.json().details.references.segments, 1);
  const [claimStored, refStored, revisionAfter] = await Promise.all([
    query(`SELECT 1 FROM world_truth_claims WHERE id = $1`, [claim.rows[0].id]),
    query(`SELECT 1 FROM world_segment_refs WHERE segment_id = $1 AND ref_id = $2`, [segment.rows[0].id, claim.rows[0].id]),
    query(`SELECT content_revision FROM worlds WHERE id = $1`, [worldId])
  ]);
  assert.equal(claimStored.rowCount, 1);
  assert.equal(refStored.rowCount, 1);
  assert.equal(revisionAfter.rows[0].content_revision, revisionBefore.rows[0].content_revision);
});

test("truth claim row locks serialize destructive mutations", async (context) => {
  const worldId = await createTruthWorld("truth-lock");
  context.after(() => query(`DELETE FROM worlds WHERE id = $1`, [worldId]));
  const claim = await query(
    `INSERT INTO world_truth_claims (world_id, title, claim)
     VALUES ($1, 'lock-title', 'lock-claim') RETURNING id`,
    [worldId]
  );
  const locker = await pool.connect();
  const contender = await pool.connect();
  try {
    await locker.query("BEGIN");
    const locked = await lockWorldTruthClaim(locker, { worldId, claimId: claim.rows[0].id });
    assert.equal(locked.id, claim.rows[0].id);
    await contender.query(`SET lock_timeout = '100ms'`);
    await assert.rejects(
      contender.query(`DELETE FROM world_truth_claims WHERE id = $1`, [claim.rows[0].id]),
      (error) => error.code === "55P03"
    );
  } finally {
    await locker.query("ROLLBACK").catch(() => {});
    await contender.query("RESET lock_timeout").catch(() => {});
    locker.release();
    contender.release();
  }
});

test("content platform world lock serializes reference validation and truth deletion", async (context) => {
  const worldId = await createTruthWorld("truth-world-lock");
  context.after(() => query(`DELETE FROM worlds WHERE id = $1`, [worldId]));
  const locker = await pool.connect();
  const contender = await pool.connect();
  try {
    await locker.query("BEGIN");
    assert.equal(await lockWorldEditor(locker, { worldId, actorId: hostUserId }), "owner");
    await contender.query(`SET lock_timeout = '100ms'`);
    await assert.rejects(
      contender.query(`SELECT id FROM worlds WHERE id = $1 FOR UPDATE`, [worldId]),
      (error) => error.code === "55P03"
    );
    await assert.rejects(
      contender.query(
        `DELETE FROM world_members WHERE world_id = $1 AND user_id = $2`,
        [worldId, hostUserId]
      ),
      (error) => error.code === "55P03"
    );
  } finally {
    await locker.query("ROLLBACK").catch(() => {});
    await contender.query("RESET lock_timeout").catch(() => {});
    locker.release();
    contender.release();
  }
});
