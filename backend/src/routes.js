import { registerWorldRoutes } from "./routes/world-routes.js";
import { registerCheckpointRoutes } from "./routes/checkpoint-routes.js";
import { registerRecapRoutes } from "./routes/recap-routes.js";
import { registerRoomEventsRoutes } from "./routes/room-events-routes.js";
import { registerHostRoutes } from "./routes/host-routes.js";
import { registerPlayerRoutes } from "./routes/player-routes.js";
import { registerVoiceRoutes } from "./routes/voice-routes.js";
import { registerAssetRoutes } from "./routes/asset-routes.js";
import { registerAccountRoutes } from "./routes/account-routes.js";
import { registerPhysicalTokenRoutes } from "./routes/physical-token-routes.js";
import { registerSearchRoutes } from "./routes/search-routes.js";
import { registerFeedbackRoutes } from "./routes/feedback-routes.js";
import { registerBatchBRoutes } from "./routes/batch-b-routes.js";
import { registerRuntimeProjectionRoutes } from "./routes/runtime-projection-routes.js";
import { registerMurderMysteryProductRoutes } from "./routes/products/murder-mystery-routes.js";
import { registerTabletopRpgProductRoutes } from "./routes/products/tabletop-rpg-routes.js";
import { registerBoardGameProductRoutes } from "./routes/products/board-game-routes.js";

export async function registerRoutes(app) {
  await registerWorldRoutes(app);
  await app.register(registerMurderMysteryProductRoutes);
  await app.register(registerTabletopRpgProductRoutes);
  await app.register(registerBoardGameProductRoutes);
  await registerSearchRoutes(app);
  await registerHostRoutes(app);
  await registerCheckpointRoutes(app);
  await registerRecapRoutes(app);
  await registerRoomEventsRoutes(app);
  await registerRuntimeProjectionRoutes(app);
  await registerPlayerRoutes(app);
  await registerVoiceRoutes(app);
  await registerAssetRoutes(app);
  await registerAccountRoutes(app);
  await registerPhysicalTokenRoutes(app);
  await registerFeedbackRoutes(app);
  await registerBatchBRoutes(app);
}
