import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const useDist = process.argv.includes("--dist");
const root = useDist ? path.join(__dirname, "dist") : __dirname;
const docsRoot = fs.existsSync(path.join(root, "docs"))
  ? path.join(root, "docs")
  : path.join(__dirname, "docs");
const port = Number(process.env.PORT ?? process.env.FRONTEND_PORT ?? 4173);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

function safePath(urlPath, base = root) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  const file = path.join(base, normalized);
  if (!file.startsWith(base)) return null;
  return file;
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mime[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}

http
  .createServer((req, res) => {
    const urlPath = (req.url ?? "/").split("?")[0];
    const target = urlPath === "/" ? "/index.html" : urlPath;
    if (target.startsWith("/docs/")) {
      const docFile = safePath(target.slice("/docs/".length), docsRoot);
      if (!docFile) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      fs.stat(docFile, (err, st) => {
        if (!err && st.isFile()) sendFile(res, docFile);
        else {
          res.writeHead(404);
          res.end("Not found");
        }
      });
      return;
    }
    const file = safePath(target === "/" ? "/index.html" : target);
    if (!file) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    fs.stat(file, (err, st) => {
      if (!err && st.isFile()) {
        sendFile(res, file);
        return;
      }
      if (useDist && req.method === "GET" && !path.extname(file)) {
        sendFile(res, path.join(root, "index.html"));
        return;
      }
      sendFile(res, file);
    });
  })
  .listen(port, () => {
    console.log(`织幕已启动：http://localhost:${port} (${useDist ? "dist" : "source"})`);
  });
