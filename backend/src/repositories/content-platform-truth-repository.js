import { query } from "../db.js";

export async function listWorldTruthClaims(worldId) {
  const result = await query(
    `SELECT *
     FROM world_truth_claims
     WHERE world_id = $1
     ORDER BY created_at DESC`,
    [worldId]
  );
  return result.rows;
}

export async function createWorldTruthClaim(client, { worldId, body }) {
  const result = await client.query(
    `INSERT INTO world_truth_claims
       (world_id, claim_key, title, claim, reveal_stage, confidence, evidence,
        contradictions, role_visibility, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb)
     RETURNING *`,
    [
      worldId,
      body.claimKey,
      body.title,
      body.claim,
      body.revealStage,
      body.confidence,
      JSON.stringify(body.evidence),
      JSON.stringify(body.contradictions),
      JSON.stringify(body.roleVisibility),
      JSON.stringify(body.metadata)
    ]
  );
  return result.rows[0];
}

export async function lockWorldTruthClaim(client, { worldId, claimId }) {
  const result = await client.query(
    `SELECT *
     FROM world_truth_claims
     WHERE id = $1 AND world_id = $2
     FOR UPDATE`,
    [claimId, worldId]
  );
  return result.rows[0] ?? null;
}

export async function updateWorldTruthClaim(client, { worldId, claimId, body }) {
  const result = await client.query(
    `UPDATE world_truth_claims
     SET claim_key = CASE WHEN $3::boolean THEN $4 ELSE claim_key END,
         title = COALESCE($5, title),
         claim = COALESCE($6, claim),
         reveal_stage = CASE WHEN $7::boolean THEN $8 ELSE reveal_stage END,
         confidence = COALESCE($9, confidence),
         evidence = COALESCE($10::jsonb, evidence),
         contradictions = COALESCE($11::jsonb, contradictions),
         role_visibility = COALESCE($12::jsonb, role_visibility),
         metadata = COALESCE($13::jsonb, metadata),
         updated_at = now()
     WHERE id = $1 AND world_id = $2
     RETURNING *`,
    [
      claimId,
      worldId,
      body.hasClaimKey,
      body.claimKey,
      body.title ?? null,
      body.claim ?? null,
      body.hasRevealStage,
      body.revealStage,
      body.confidence ?? null,
      body.evidence === undefined ? null : JSON.stringify(body.evidence),
      body.contradictions === undefined ? null : JSON.stringify(body.contradictions),
      body.roleVisibility === undefined ? null : JSON.stringify(body.roleVisibility),
      body.metadata === undefined ? null : JSON.stringify(body.metadata)
    ]
  );
  return result.rows[0] ?? null;
}

export async function readTruthClaimReferenceCounts(client, { worldId, claimId }) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS segments
     FROM world_segment_refs segment_ref
     JOIN world_segments segment ON segment.id = segment_ref.segment_id
     WHERE segment.world_id = $1
       AND segment_ref.ref_type = 'truth_claim'
       AND segment_ref.ref_id = $2`,
    [worldId, claimId]
  );
  return { segments: Number(result.rows[0]?.segments ?? 0) };
}

export async function deleteWorldTruthClaim(client, { worldId, claimId }) {
  const result = await client.query(
    `DELETE FROM world_truth_claims
     WHERE id = $1 AND world_id = $2
     RETURNING id`,
    [claimId, worldId]
  );
  return result.rowCount > 0;
}
