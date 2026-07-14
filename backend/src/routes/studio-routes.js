import { registerStudioInvestigationRoutes } from "./studio-investigation-routes.js";
import { registerStudioItemRoutes } from "./studio-item-routes.js";
import { registerStudioSceneClueRoutes } from "./studio-scene-clue-routes.js";
import { registerStudioSnapshotRoutes } from "./studio-snapshot-routes.js";
import { registerStudioStoryEdgeRoutes } from "./studio-story-edge-routes.js";
import { registerStudioVersionRoutes } from "./studio-version-routes.js";

export async function registerStudioRoutes(app) {
  await registerStudioSceneClueRoutes(app);
  await registerStudioInvestigationRoutes(app);
  await registerStudioItemRoutes(app);
  await registerStudioSnapshotRoutes(app);
  await registerStudioVersionRoutes(app);
  await registerStudioStoryEdgeRoutes(app);
}
