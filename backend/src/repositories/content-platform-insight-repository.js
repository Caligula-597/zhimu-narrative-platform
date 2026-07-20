import { query } from "../db.js";

function toQualityReport(row) {
  return {
    id: row.id,
    worldId: row.world_id,
    source: row.source,
    promptVersion: row.prompt_version,
    report: row.report ?? {},
    issueCount: row.issue_count,
    score: row.score,
    createdAt: row.created_at
  };
}

export async function listWorldQualityReports(worldId) {
  const result = await query(
    `SELECT id, world_id, source, prompt_version, report, issue_count, score, created_at
     FROM world_quality_reports
     WHERE world_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [worldId]
  );
  return result.rows.map(toQualityReport);
}

export async function insertWorldQualityReport(client, {
  worldId,
  actorId,
  source,
  promptVersion,
  report,
  issueCount,
  score
}) {
  const result = await client.query(
    `INSERT INTO world_quality_reports
      (world_id, source, prompt_version, report, issue_count, score, created_by_user_id)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
     RETURNING id, world_id, source, prompt_version, report, issue_count, score, created_at`,
    [
      worldId,
      source,
      promptVersion,
      JSON.stringify(report),
      issueCount,
      score,
      actorId
    ]
  );
  return toQualityReport(result.rows[0]);
}
