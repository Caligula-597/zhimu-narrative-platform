import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const useDist = process.argv.includes("--dist");
const root = useDist ? path.join(__dirname, "dist") : __dirname;
const port = Number(process.env.FRONTEND_PORT ?? 4173);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  const file = path.join(root, normalized);
  if (!file.startsWith(root)) return null;
  return file;
}

http
  .createServer((req, res) => {
    const target = req.url === "/" ? "/index.html" : req.url ?? "/";
    const file = safePath(target === "/" ? "/index.html" : target);
    if (!file) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(port, () => {
    console.log(`织幕已启动：http://localhost:${port} (${useDist ? "dist" : "source"})`);
  });
