import { query } from "../db.js";

const REVIEW_SELECT = `
  SELECT review.id, review.world_id, review.parent_id, review.target_type, review.target_id,
         review.target_label, review.anchor, review.kind, review.status, review.severity,
         review.title, review.body, review.suggested_patch, review.impact_scope,
         review.created_by_user_id, COALESCE((
           SELECT profile.display_name FROM user_portal_profiles profile
           WHERE profile.user_id = creator.id AND profile.portal = 'creator'
         ), creator.display_name, '已删除成员') AS created_by_name,
         review.resolved_by_user_id, COALESCE((
           SELECT profile.display_name FROM user_portal_profiles profile
           WHERE profile.user_id = resolver.id AND profile.portal = 'creator'
         ), resolver.display_name) AS resolved_by_name,
         review.created_at, review.updated_at, review.resolved_at
  FROM creator_review_threads review
  LEFT JOIN users creator ON creator.id = review.created_by_user_id
  LEFT JOIN users resolver ON resolver.id = review.resolved_by_user_id`;

export async function configureCreatorReviewTransaction(client) {
  await client.query(
    `SELECT set_config('lock_timeout', '3000ms', true),
            set_config('statement_timeout', '30000ms', true)`
  );
}

export async function loadCreatorReviewAccess(client, { worldId, actorId, lock = false }) {
  const result = await client.query(
    `SELECT member.role
     FROM worlds world
     JOIN world_members member ON member.world_id = world.id AND member.user_id = $2
     WHERE world.id = $1
     ${lock ? "FOR KEY SHARE OF world FOR SHARE OF member" : ""}`,
    [worldId, actorId]
  );
  return result.rows[0]?.role ?? null;
}

export async function listCreatorReviews({ worldId, status, targetType, limit = 100, client = null }) {
  const run = client ? client.query.bind(client) : query;
  const result = await run(
    `WITH roots AS MATERIALIZED (
       SELECT root.id,
              row_number() OVER (
                ORDER BY CASE root.severity WHEN 'blocking' THEN 1 WHEN 'major' THEN 2 WHEN 'minor' THEN 3 ELSE 4 END,
                         root.updated_at DESC
              ) AS root_order
       FROM creator_review_threads root
       WHERE root.world_id = $1
         AND root.parent_id IS NULL
         AND ($2::text IS NULL OR root.status = $2)
         AND ($3::text IS NULL OR root.target_type = $3)
       ORDER BY CASE root.severity WHEN 'blocking' THEN 1 WHEN 'major' THEN 2 WHEN 'minor' THEN 3 ELSE 4 END,
                root.updated_at DESC
       LIMIT $4
     ), selected AS MATERIALIZED (
       SELECT root.id, root.root_order, 0::bigint AS reply_order
       FROM roots root
       UNION ALL
       SELECT reply.id, root.root_order, reply.reply_order
       FROM roots root
       JOIN LATERAL (
         SELECT recent.id,
                row_number() OVER (ORDER BY recent.created_at) AS reply_order
         FROM (
           SELECT child.id, child.created_at
           FROM creator_review_threads child
           WHERE child.world_id = $1 AND child.parent_id = root.id
           ORDER BY child.created_at DESC
           LIMIT 50
         ) recent
       ) reply ON true
     )
     ${REVIEW_SELECT}
     JOIN selected ON selected.id = review.id
     ORDER BY selected.root_order, review.parent_id IS NOT NULL, selected.reply_order`,
    [worldId, status || null, targetType || null, limit]
  );
  return result.rows;
}

export async function findCreatorReview(client, { worldId, reviewId, lock = false }) {
  const result = await client.query(
    `${REVIEW_SELECT}
     WHERE review.world_id = $1 AND review.id = $2
     ${lock ? "FOR UPDATE OF review" : ""}`,
    [worldId, reviewId]
  );
  return result.rows[0] ?? null;
}

export async function insertCreatorReview(client, {
  worldId,
  actorId,
  parentId = null,
  targetType,
  targetId = null,
  targetLabel = "",
  anchor = {},
  kind = "comment",
  severity = "note",
  title = "",
  body,
  suggestedPatch = {},
  impactScope = {}
}) {
  const result = await client.query(
    `INSERT INTO creator_review_threads
       (world_id, parent_id, target_type, target_id, target_label, anchor,
        kind, severity, title, body, suggested_patch, impact_scope, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13)
     RETURNING id`,
    [
      worldId,
      parentId,
      targetType,
      targetId,
      targetLabel,
      JSON.stringify(anchor),
      kind,
      severity,
      title,
      body,
      JSON.stringify(suggestedPatch),
      JSON.stringify(impactScope),
      actorId
    ]
  );
  return findCreatorReview(client, { worldId, reviewId: result.rows[0].id });
}

export async function touchCreatorReview(client, { worldId, reviewId }) {
  await client.query(
    `UPDATE creator_review_threads SET updated_at = now() WHERE world_id = $1 AND id = $2`,
    [worldId, reviewId]
  );
}

export async function updateCreatorReview(client, {
  worldId,
  reviewId,
  actorId,
  title,
  body,
  kind,
  severity,
  status,
  suggestedPatch
}) {
  const resolved = status === "resolved" || status === "dismissed";
  await client.query(
    `UPDATE creator_review_threads
     SET title = $3,
         body = $4,
         kind = $5,
         severity = $6,
         status = $7,
         suggested_patch = $8::jsonb,
         resolved_by_user_id = CASE
           WHEN NOT $9 THEN NULL
           WHEN status IS DISTINCT FROM $7 THEN $10::uuid
           ELSE resolved_by_user_id
         END,
         resolved_at = CASE
           WHEN NOT $9 THEN NULL
           WHEN status IS DISTINCT FROM $7 THEN now()
           ELSE resolved_at
         END,
         updated_at = now()
     WHERE world_id = $1 AND id = $2`,
    [worldId, reviewId, title, body, kind, severity, status, JSON.stringify(suggestedPatch), resolved, actorId]
  );
  return findCreatorReview(client, { worldId, reviewId });
}

export async function targetBelongsToWorld(client, { worldId, targetType, targetId }) {
  if (["world", "manuscript"].includes(targetType)) return targetId == null;
  const checks = {
    role: ["role_slots", "world_id"],
    chapter: ["chapters", "world_id"],
    scene: ["scenes", "world_id"],
    clue: ["clues", "world_id"],
    rule: ["automation_rules", "world_id"],
    truth_claim: ["world_truth_claims", "world_id"],
    segment: ["world_segments", "world_id"]
  };
  if (targetType === "script_section") {
    const result = await client.query(
      `SELECT 1 FROM script_sections section
       JOIN role_slots role ON role.id = section.role_slot_id
       WHERE section.id = $1 AND role.world_id = $2
       FOR KEY SHARE OF section`,
      [targetId, worldId]
    );
    return result.rowCount > 0;
  }
  const pair = checks[targetType];
  if (!pair) return false;
  const [table, worldColumn] = pair;
  const result = await client.query(
    `SELECT 1 FROM ${table} WHERE id = $1 AND ${worldColumn} = $2 FOR KEY SHARE`,
    [targetId, worldId]
  );
  return result.rowCount > 0;
}

export async function calculateCreatorReviewImpact(client, { worldId, targetType, targetId }) {
  if (["world", "manuscript"].includes(targetType)) {
    const result = await client.query(
      `SELECT
         (SELECT COUNT(*)::int FROM role_slots WHERE world_id = $1) AS roles,
         (SELECT COUNT(*)::int FROM chapters WHERE world_id = $1) AS chapters,
         (SELECT COUNT(*)::int FROM script_sections section JOIN role_slots role ON role.id = section.role_slot_id WHERE role.world_id = $1) AS sections,
         (SELECT COUNT(*)::int FROM scenes WHERE world_id = $1) AS scenes,
         (SELECT COUNT(*)::int FROM clues WHERE world_id = $1) AS clues,
         (SELECT COUNT(*)::int FROM automation_rules WHERE world_id = $1) AS rules`,
      [worldId]
    );
    return { scope: "world", counts: result.rows[0] };
  }
  const queries = {
    role: `SELECT
      (SELECT COUNT(*)::int FROM script_sections WHERE role_slot_id = $2) AS sections,
      (SELECT COUNT(*)::int FROM world_role_relationships WHERE world_id = $1 AND (from_role_slot_id = $2 OR to_role_slot_id = $2)) AS relationships,
      (SELECT COUNT(*)::int FROM world_role_archives WHERE world_id = $1 AND role_slot_id = $2) AS archives`,
    chapter: `SELECT
      (SELECT COUNT(*)::int FROM script_sections section JOIN role_slots role ON role.id = section.role_slot_id WHERE role.world_id = $1 AND section.chapter_id = $2) AS sections,
      (SELECT COUNT(*)::int FROM scenes WHERE world_id = $1 AND chapter_id = $2) AS scenes,
      (SELECT COUNT(*)::int FROM world_segments WHERE world_id = $1 AND chapter_id = $2) AS segments`,
    script_section: `SELECT COUNT(*)::int AS segment_refs FROM world_segment_refs ref JOIN world_segments segment ON segment.id = ref.segment_id WHERE segment.world_id = $1 AND ref.ref_type = 'script_section' AND ref.ref_id = $2`,
    scene: `SELECT
      (SELECT COUNT(*)::int FROM investigation_points point JOIN scenes scene ON scene.id = point.scene_id WHERE scene.world_id = $1 AND point.scene_id = $2) AS investigation_points,
      (SELECT COUNT(*)::int FROM world_segment_refs ref JOIN world_segments segment ON segment.id = ref.segment_id WHERE segment.world_id = $1 AND ref.ref_type = 'scene' AND ref.ref_id = $2) AS segment_refs`,
    clue: `SELECT
      (SELECT COUNT(*)::int FROM investigation_points point JOIN clues clue ON clue.id = point.clue_id WHERE clue.world_id = $1 AND point.clue_id = $2) AS investigation_points,
      (SELECT COUNT(*)::int FROM world_segment_refs ref JOIN world_segments segment ON segment.id = ref.segment_id WHERE segment.world_id = $1 AND ref.ref_type = 'clue' AND ref.ref_id = $2) AS segment_refs,
      (SELECT COUNT(*)::int FROM automation_rules WHERE world_id = $1 AND (conditions::text LIKE '%' || $2::text || '%' OR actions::text LIKE '%' || $2::text || '%')) AS rules`,
    rule: `SELECT COUNT(*)::int AS executions FROM rule_executions execution JOIN automation_rules rule ON rule.id = execution.rule_id WHERE rule.world_id = $1 AND rule.id = $2`,
    truth_claim: `SELECT COUNT(*)::int AS segment_refs FROM world_segment_refs ref JOIN world_segments segment ON segment.id = ref.segment_id WHERE segment.world_id = $1 AND ref.ref_type = 'truth_claim' AND ref.ref_id = $2`,
    segment: `SELECT COUNT(*)::int AS references FROM world_segment_refs ref JOIN world_segments segment ON segment.id = ref.segment_id WHERE segment.world_id = $1 AND segment.id = $2`
  };
  const sql = queries[targetType];
  if (!sql) return { scope: targetType, counts: {} };
  const result = await client.query(sql, [worldId, targetId]);
  return { scope: targetType, counts: result.rows[0] || {} };
}

export async function loadContentVersionSnapshot(client, { worldId, versionId }) {
  const result = await client.query(
    `SELECT id, label, snapshot, created_at
     FROM content_versions
     WHERE world_id = $1 AND id = $2`,
    [worldId, versionId]
  );
  return result.rows[0] ?? null;
}
