/**
 * Content Platform route composition root.
 *
 * Each domain owns its schemas, guards, transactions and database access;
 * this module only preserves the public registration entry point.
 */
import { registerContentPlatformInsightRoutes } from "./content-platform-insight-routes.js";
import { registerContentPlatformPrivateActionRoutes } from "./content-platform-private-action-routes.js";
import { registerContentPlatformRoleRoutes } from "./content-platform-role-routes.js";
import { registerContentPlatformRunReportRoutes } from "./content-platform-run-report-routes.js";
import { registerContentPlatformSegmentRoutes } from "./content-platform-segment-routes.js";
import { registerContentPlatformTruthRoutes } from "./content-platform-truth-routes.js";
import { registerContentPlatformVoteRoutes } from "./content-platform-vote-routes.js";

export async function registerContentPlatformRoutes(app) {
  await registerContentPlatformSegmentRoutes(app);
  await registerContentPlatformTruthRoutes(app);
  await registerContentPlatformRoleRoutes(app);
  await registerContentPlatformInsightRoutes(app);
  await registerContentPlatformVoteRoutes(app);
  await registerContentPlatformPrivateActionRoutes(app);
  await registerContentPlatformRunReportRoutes(app);
}
