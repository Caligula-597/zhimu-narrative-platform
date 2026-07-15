import { pool } from "../db.js";
import { requireActor } from "../request-actor.js";
import { loadStudioSnapshot } from "../studio-snapshot-service.js";
import { worldIdParams } from "./schemas/world.js";

export async function registerStudioSnapshotRoutes(app) {
  app.get("/api/worlds/:worldId/studio", { schema: { params: worldIdParams } }, async (request) => {
    const actorId = requireActor(request);
    const { worldId } = request.params;
    const client = await pool.connect();
    try {
      return await loadStudioSnapshot({ worldId, actorId, client });
    } finally {
      client.release();
    }
  });
}
