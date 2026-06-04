import { registerWorldRoutes } from "./routes/world-routes.js";
import { registerCreatorRoutes } from "./routes/creator-routes.js";
import { registerRulesRoutes } from "./routes/rules-routes.js";
import { registerContentPackageRoutes } from "./routes/content-package-routes.js";
import { registerStudioRoutes } from "./routes/studio-routes.js";
import { registerStoryAssistantRoutes } from "./routes/story-assistant-routes.js";
import { registerStudioGraphRoutes } from "./routes/studio-graph-routes.js";
import { registerCheckpointRoutes } from "./routes/checkpoint-routes.js";
import { registerRecapRoutes } from "./routes/recap-routes.js";
import { registerRoomEventsRoutes } from "./routes/room-events-routes.js";
import { registerHostRoutes } from "./routes/host-routes.js";
import { registerPlayerRoutes } from "./routes/player-routes.js";
import { registerVoiceRoutes } from "./routes/voice-routes.js";
import { registerAssetRoutes } from "./routes/asset-routes.js";
import { registerSearchRoutes } from "./routes/search-routes.js";

export async function registerRoutes(app) {
  await registerWorldRoutes(app);
  await registerCreatorRoutes(app);
  await registerRulesRoutes(app);
  await registerContentPackageRoutes(app);
  await registerStudioRoutes(app);
  await registerStoryAssistantRoutes(app);
  await registerStudioGraphRoutes(app);
  await registerSearchRoutes(app);
  await registerHostRoutes(app);
  await registerCheckpointRoutes(app);
  await registerRecapRoutes(app);
  await registerRoomEventsRoutes(app);
  await registerPlayerRoutes(app);
  await registerVoiceRoutes(app);
  await registerAssetRoutes(app);
}
