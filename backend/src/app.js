import Fastify from "fastify";
import cors from "@fastify/cors";
import { resolveSession } from "./auth.js";
import { resolveRequestActor } from "./request-actor.js";
import { registerAuthRoutes } from "./routes/auth-routes.js";
import { registerSystemRoutes } from "./routes/system-routes.js";
import { registerRoutes } from "./routes.js";

export async function createApp(options = {}) {
  const app = Fastify({ logger: options.logger ?? true });
  const allowDemoUserHeader = options.allowDemoUserHeader ?? process.env.ALLOW_DEMO_USER_HEADER === "true";
  await app.register(cors, {
    origin: options.corsOrigin ?? true,
    methods: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"]
  });
  app.addHook("preHandler", async (request) => {
    await resolveRequestActor(request, { resolveSession, allowDemoUserHeader });
  });
  await registerSystemRoutes(app);
  await registerAuthRoutes(app);
  await registerRoutes(app);
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    reply.code(error.statusCode ?? 500).send({ error: error.message });
  });
  return app;
}
