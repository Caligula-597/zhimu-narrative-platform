import { query } from "../db.js";
import { requireActor } from "../request-actor.js";
import { sendErr } from "../api-errors.js";
import { runRevisionMutation } from "../world-revision.js";
import { fetchCreatorAnalyticsData } from "../creator-analytics-repository.js";
import { buildCreatorAnalytics } from "../creator-analytics-service.js";
import { requireWorldRole } from "./route-guards.js";
import { createQualityReportSchema, worldIdParams } from "./schemas.js";

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

export async function registerContentPlatformInsightRoutes(app) {
  app.get("/api/worlds/:worldId/creator-analytics", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    return buildCreatorAnalytics(await fetchCreatorAnalyticsData(query, worldId));
  });

  app.get("/api/worlds/:worldId/quality-reports", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const result = await query(
      `SELECT id, world_id, source, prompt_version, report, issue_count, score, created_at
       FROM world_quality_reports WHERE world_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [worldId]
    );
    return { reports: result.rows.map(toQualityReport) };
  });

  app.post("/api/worlds/:worldId/quality-reports", { schema: createQualityReportSchema }, async (request, reply) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    await requireWorldRole(actorId, worldId);
    const body = request.body ?? {};
    const issueCount = body.issueCount
      ?? (Array.isArray(body.report?.issues) ? body.report.issues.length : 0);
    return runRevisionMutation(request, reply, worldId, async (client) => {
      const result = await client.query(
        `INSERT INTO world_quality_reports
          (world_id, source, prompt_version, report, issue_count, score, created_by_user_id)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
         RETURNING id, world_id, source, prompt_version, report, issue_count, score, created_at`,
        [worldId, body.source ?? "manual", body.promptVersion ?? null,
          JSON.stringify(body.report ?? {}), issueCount, body.score ?? null, actorId]
      );
      return { report: toQualityReport(result.rows[0]) };
    }, { sendErr, statusCode: 201 });
  });
}
