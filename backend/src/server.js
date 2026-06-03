import "dotenv/config";
import { pool } from "./db.js";
import { createApp } from "./app.js";

const app = await createApp();
const port = Number(process.env.PORT ?? 4180);
try {
  await app.listen({ host: "0.0.0.0", port });
} catch (error) {
  app.log.error(error);
  await pool.end();
  process.exitCode = 1;
}
