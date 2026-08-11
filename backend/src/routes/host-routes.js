import { registerHostCommunicationRoutes } from "./host-communication-routes.js";
import { registerHostContentActionRoutes } from "./host-content-action-routes.js";
import { registerHostEventRoutes } from "./host-event-routes.js";
import { registerHostGameControlRoutes } from "./host-game-control-routes.js";
import { registerHostMonitorRoutes } from "./host-monitor-routes.js";
import { registerHostMechanismRuntimeRoutes } from "./host-mechanism-runtime-routes.js";
import { registerHostPlayerManagementRoutes } from "./host-player-management-routes.js";
import { registerHostItemActionRoutes } from "./item-action-routes.js";
import { registerHostRoomRelationshipRoutes } from "./room-relationship-routes.js";

export async function registerHostRoutes(app) {
  await registerHostEventRoutes(app);
  await registerHostMonitorRoutes(app);
  await registerHostPlayerManagementRoutes(app);
  await registerHostGameControlRoutes(app);
  await registerHostContentActionRoutes(app);
  await registerHostMechanismRuntimeRoutes(app);
  await registerHostCommunicationRoutes(app);
  await registerHostItemActionRoutes(app);
  await registerHostRoomRelationshipRoutes(app);
}
