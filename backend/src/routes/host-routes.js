import { registerHostCommunicationRoutes } from "./host-communication-routes.js";
import { registerHostContentActionRoutes } from "./host-content-action-routes.js";
import { registerHostEventRoutes } from "./host-event-routes.js";
import { registerHostGameControlRoutes } from "./host-game-control-routes.js";
import { registerHostMonitorRoutes } from "./host-monitor-routes.js";
import { registerHostPlayerManagementRoutes } from "./host-player-management-routes.js";

export async function registerHostRoutes(app) {
  await registerHostEventRoutes(app);
  await registerHostMonitorRoutes(app);
  await registerHostPlayerManagementRoutes(app);
  await registerHostGameControlRoutes(app);
  await registerHostContentActionRoutes(app);
  await registerHostCommunicationRoutes(app);
}
