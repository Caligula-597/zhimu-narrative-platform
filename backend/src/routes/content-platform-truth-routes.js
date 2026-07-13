import { query } from "../db.js";
import { sendErr, throwErr } from "../api-errors.js";
import { requireActor } from "../request-actor.js";
import { runRevisionMutation } from "../world-revision.js";
import { requireWorldReader, requireWorldRole } from "./route-guards.js";
import {
  createTruthClaimSchema, patchTruthClaimSchema, truthClaimIdParams, worldIdParams
} from "./schemas.js";

export async function registerContentPlatformTruthRoutes(app) {
  app.get("/api/worlds/:worldId/truth-claims", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldReader(actorId, worldId);
    const result = await query(
      `SELECT * FROM world_truth_claims WHERE world_id = $1 ORDER BY created_at DESC`,
      [worldId]
    );
    return { claims: result.rows };
  });

  app.post("/api/worlds/:worldId/truth-claims", { schema: createTruthClaimSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = request.body ?? {};
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const result = await client.query(
        `INSERT INTO world_truth_claims
          (world_id, claim_key, title, claim, reveal_stage, confidence, evidence, contradictions, role_visibility, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb)
         RETURNING *`,
        [worldId, body.claimKey ?? null, body.title, body.claim, body.revealStage ?? null,
          body.confidence ?? "canon", JSON.stringify(body.evidence ?? []),
          JSON.stringify(body.contradictions ?? []), JSON.stringify(body.roleVisibility ?? {}),
          JSON.stringify(body.metadata ?? {})]
      );
      return { claim: result.rows[0] };
    }, { sendErr, statusCode: 201 });
  });

  app.patch("/api/worlds/:worldId/truth-claims/:claimId", { schema: patchTruthClaimSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, claimId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = request.body ?? {};
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const result = await client.query(
        `UPDATE world_truth_claims SET
           claim_key = COALESCE($3, claim_key), title = COALESCE($4, title),
           claim = COALESCE($5, claim), reveal_stage = COALESCE($6, reveal_stage),
           confidence = COALESCE($7, confidence), evidence = COALESCE($8::jsonb, evidence),
           contradictions = COALESCE($9::jsonb, contradictions),
           role_visibility = COALESCE($10::jsonb, role_visibility),
           metadata = COALESCE($11::jsonb, metadata), updated_at = now()
         WHERE id = $1 AND world_id = $2 RETURNING *`,
        [claimId, worldId, body.claimKey, body.title, body.claim, body.revealStage,
          body.confidence, body.evidence != null ? JSON.stringify(body.evidence) : null,
          body.contradictions != null ? JSON.stringify(body.contradictions) : null,
          body.roleVisibility != null ? JSON.stringify(body.roleVisibility) : null,
          body.metadata != null ? JSON.stringify(body.metadata) : null]
      );
      if (!result.rowCount) throwErr("NOT_FOUND");
      return { claim: result.rows[0] };
    }, { sendErr });
  });

  app.delete("/api/worlds/:worldId/truth-claims/:claimId", { schema: { params: truthClaimIdParams } }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId, claimId } = request.params;
    await requireWorldRole(actorId, worldId);
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const result = await client.query(
        `DELETE FROM world_truth_claims WHERE id = $1 AND world_id = $2 RETURNING id`,
        [claimId, worldId]
      );
      if (!result.rowCount) throwErr("NOT_FOUND");
      return { ok: true };
    }, { sendErr });
  });
}
