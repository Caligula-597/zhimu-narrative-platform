import { registerWorldReadinessRoutes } from "../world-readiness-routes.js";
import { registerCreatorRoutes } from "../creator-routes.js";
import { registerScriptBundleRoutes } from "../script-bundle-routes.js";
import { registerRulesRoutes } from "../rules-routes.js";
import { registerContentPackageRoutes } from "../content-package-routes.js";
import { registerStudioRoutes } from "../studio-routes.js";
import { registerStoryManuscriptRoutes } from "../story-manuscript-routes.js";
import { registerProjectStoryStateRoutes } from "../project-story-state-routes.js";
import { registerPlayableProjectRoutes } from "../playable-project-routes.js";
import { registerStoryAssistantRoutes } from "../story-assistant-routes.js";
import { registerStudioGraphRoutes } from "../studio-graph-routes.js";
import { registerContentPlatformRoutes } from "../content-platform-routes.js";
import { registerCreatorBibleRoutes } from "../creator-bible-routes.js";
import { registerCreatorBootstrapRoutes } from "../creator-bootstrap-routes.js";
import { createWorldProductPreHandler } from "../route-guards.js";

export async function registerMurderMysteryProductRoutes(app) {
  app.addHook("preHandler", createWorldProductPreHandler("murder_mystery"));
  await registerWorldReadinessRoutes(app);
  await registerCreatorRoutes(app);
  await registerScriptBundleRoutes(app);
  await registerRulesRoutes(app);
  await registerContentPackageRoutes(app);
  await registerStudioRoutes(app);
  await registerStoryManuscriptRoutes(app);
  await registerProjectStoryStateRoutes(app);
  await registerPlayableProjectRoutes(app);
  await registerStoryAssistantRoutes(app);
  await registerStudioGraphRoutes(app);
  await registerContentPlatformRoutes(app);
  await registerCreatorBibleRoutes(app);
  await registerCreatorBootstrapRoutes(app);
}
