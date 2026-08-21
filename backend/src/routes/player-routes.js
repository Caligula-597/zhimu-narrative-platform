import { registerPlayerAccessRoutes } from "./player-access-routes.js";
import { registerPlayerProgressRoutes } from "./player-progress-routes.js";
import { registerPlayerExplorationRoutes } from "./player-exploration-routes.js";
import { registerPlayerItemActionRoutes } from "./item-action-routes.js";
import { registerPlayerRoomRelationshipRoutes } from "./room-relationship-routes.js";

export async function registerPlayerRoutes(app) {
  await registerPlayerAccessRoutes(app);
  await registerPlayerProgressRoutes(app);
  await registerPlayerExplorationRoutes(app);
  await registerPlayerItemActionRoutes(app);
  await registerPlayerRoomRelationshipRoutes(app);
}
