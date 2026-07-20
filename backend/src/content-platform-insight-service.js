import { sendErr } from "./api-errors.js";
import { assertContentPlatformEditor } from "./content-platform-access-service.js";
import { getCreatorAnalyticsData } from "./creator-analytics-repository.js";
import { buildCreatorAnalytics } from "./creator-analytics-service.js";
import { configureContentPlatformTransaction } from "./repositories/content-platform-access-repository.js";
import {
  insertWorldQualityReport,
  listWorldQualityReports
} from "./repositories/content-platform-insight-repository.js";
import { runRevisionMutation } from "./world-revision.js";

export async function getWorldCreatorAnalytics(worldId) {
  return buildCreatorAnalytics(await getCreatorAnalyticsData(worldId));
}

export async function getWorldQualityReports(worldId) {
  return { reports: await listWorldQualityReports(worldId) };
}

export function resolveQualityIssueCount(body = {}) {
  return body.issueCount
    ?? (Array.isArray(body.report?.issues) ? body.report.issues.length : 0);
}

export function createWorldQualityReport({ request, reply, actorId, worldId, body }) {
  const report = body.report ?? {};
  const issueCount = resolveQualityIssueCount(body);
  return runRevisionMutation(request, reply, worldId, async (client) => {
    await assertContentPlatformEditor(client, { worldId, actorId });
    return {
      report: await insertWorldQualityReport(client, {
        worldId,
        actorId,
        source: body.source ?? "manual",
        promptVersion: body.promptVersion ?? null,
        report,
        issueCount,
        score: body.score ?? null
      })
    };
  }, {
    sendErr,
    statusCode: 201,
    configureClient: configureContentPlatformTransaction
  });
}
