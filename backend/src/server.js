import Fastify from "fastify";
import cors from "@fastify/cors";
import "dotenv/config";
import { pool } from "./db.js";
import { registerRoutes } from "./routes.js";
import { resolveSession } from "./auth.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true, methods: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"] });
app.addHook("preHandler", async (request) => {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return;
  const userId = await resolveSession(authorization.slice(7));
  if (userId && !request.headers["x-user-id"]) request.headers["x-user-id"] = userId;
});
await registerRoutes(app);

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  reply.code(error.statusCode ?? 500).send({ error: error.message });
});

const port = Number(process.env.PORT ?? 4180);
try {
  await app.listen({ host: "0.0.0.0", port });
} catch (error) {
  app.log.error(error);
  await pool.end();
  process.exitCode = 1;
}
