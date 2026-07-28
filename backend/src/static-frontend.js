import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import { staticCacheControl } from "./static-cache-policy.js";

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

export function resolveFileWithinRoot(root, relPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(String(relPath || ""));
  } catch {
    return null;
  }
  const normalized = decoded.replace(/^[/\\]+/, "");
  if (!normalized || normalized.includes("\0")) return null;
  const file = path.resolve(root, normalized);
  const relative = path.relative(root, file);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return file;
}

function readDocFile(docsRoot, relPath) {
  const file = resolveFileWithinRoot(docsRoot, relPath);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
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
  const maintenance = process.env.MAINTENANCE_MODE === "true" || process.env.MAINTENANCE_MODE === "1";
  const maintenancePage = path.join(root, "errors", "503.html");

  app.addHook("onSend", async (request, reply, payload) => {
    const url = request.url.split("?")[0];
    if (
      (request.method === "GET" || request.method === "HEAD")
      && !url.startsWith("/api")
      && !url.startsWith("/metrics")
    ) {
      reply.header("cache-control", staticCacheControl(url, reply.statusCode));
    }
    return payload;
  });

  app.addHook("onRequest", async (request, reply) => {
    const url = request.url.split("?")[0];
    if (!maintenance || url.startsWith("/api") || url.startsWith("/metrics")) return;
    if (request.method !== "GET" && request.method !== "HEAD") return;
    if (url.startsWith("/errors/")) return;
    if (fs.existsSync(maintenancePage)) {
      return reply.code(503).type("text/html; charset=utf-8").send(fs.readFileSync(maintenancePage, "utf8"));
    }
  });

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
      const notFoundPage = path.join(root, "errors", "404.html");
      if (url.startsWith("/errors/")) {
        const page = resolveFileWithinRoot(root, url);
        if (page && fs.existsSync(page) && fs.statSync(page).isFile()) {
          const code = url.includes("503") ? 503 : 404;
          return reply.code(code).type("text/html; charset=utf-8").send(fs.readFileSync(page, "utf8"));
        }
      }
      const staticFile = resolveFileWithinRoot(root, url);
      if (path.extname(url) && staticFile && fs.existsSync(staticFile) && fs.statSync(staticFile).isFile()) {
        return reply.sendFile(path.relative(root, staticFile).replace(/\\/g, "/"), root);
      }
      if (path.extname(url)) {
        if (fs.existsSync(notFoundPage)) {
          return reply.code(404).type("text/html; charset=utf-8").send(fs.readFileSync(notFoundPage, "utf8"));
        }
        return reply.code(404).send({
          error: "Static asset not found",
          code: "NOT_FOUND"
        });
      }
      return reply.sendFile("index.html", root);
    }
    reply.code(404).send({ error: "Route not found", code: "NOT_FOUND" });
  });

  app.log.info({ root, docsRoot }, "Static frontend enabled");
}
