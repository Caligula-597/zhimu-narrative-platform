import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveStaticRoot() {
  const configured = process.env.STATIC_ROOT?.trim();
  if (configured) return path.resolve(configured);
  return path.resolve(__dirname, "..", "public", "dist");
}

/** Production: serve Vite dist/ from same origin (/api stays on Fastify). */
export async function registerStaticFrontend(app) {
  if (process.env.SERVE_STATIC !== "true" && process.env.SERVE_STATIC !== "1") return;

  const root = resolveStaticRoot();
  const indexHtml = path.join(root, "index.html");
  if (!fs.existsSync(indexHtml)) {
    app.log.warn({ root }, "SERVE_STATIC set but index.html missing — skipping static");
    return;
  }

  await app.register(fastifyStatic, {
    root,
    prefix: "/",
    decorateReply: true,
    wildcard: true
  });

  app.setNotFoundHandler((request, reply) => {
    const url = request.url.split("?")[0];
    if (request.method === "GET" && !url.startsWith("/api")) {
      return reply.sendFile("index.html", root);
    }
    reply.code(404).send({ error: "Route not found", code: "NOT_FOUND" });
  });

  app.log.info({ root }, "Static frontend enabled");
}
