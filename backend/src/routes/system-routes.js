import { query } from "../db.js";

export async function registerSystemRoutes(app) {
  app.get("/api/health", async () => {
    const result = await query("SELECT now() AS database_time");
    return { ok: true, databaseTime: result.rows[0].database_time };
  });
}
