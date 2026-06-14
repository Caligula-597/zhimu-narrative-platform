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

function resolveDocsRoot(staticRoot) {
  const fromDist = path.join(staticRoot, "docs");
  if (fs.existsSync(fromDist)) return fromDist;
  return path.resolve(__dirname, "..", "..", "docs");
}

function readDocFile(docsRoot, relPath) {
  const normalized = decodeURIComponent(String(relPath || "")).replace(/^\//, "");
  if (!normalized || normalized.includes("..")) return null;
  const file = path.join(docsRoot, normalized);
  if (!file.startsWith(docsRoot) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  return file;
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

  const docsRoot = resolveDocsRoot(root);

  app.get("/docs/*", async (request, reply) => {
    const file = readDocFile(docsRoot, request.params["*"]);
    if (!file) {
      return reply.code(404).send({ error: "Doc not found", code: "NOT_FOUND" });
    }
    return reply.type("text/markdown; charset=utf-8").send(fs.readFileSync(file, "utf8"));
  });

  await app.register(fastifyStatic, {
    root,
    prefix: "/",
    decorateReply: true,
    wildcard: true
  });

  app.setNotFoundHandler((request, reply) => {
    const url = request.url.split("?")[0];
    if (url.startsWith("/docs/")) {
      return reply.code(404).send({ error: "Doc not found", code: "NOT_FOUND" });
    }
    if (request.method === "GET" && !url.startsWith("/api")) {
      return reply.sendFile("index.html", root);
    }
    reply.code(404).send({ error: "Route not found", code: "NOT_FOUND" });
  });

  app.log.info({ root, docsRoot }, "Static frontend enabled");
}
