import { defineConfig, loadEnv } from "vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { productionArtifactGuard } from "./production-artifact-guard.mjs";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(configDir, "..");
const docsRoot = path.join(root, "docs");

/** Dev + build: serve /docs/*.md from repo docs/ folder. */
function docsStaticPlugin() {
  return {
    name: "zhimu-docs-static",
    configureServer(server) {
      server.middlewares.use("/docs", (req, res, next) => {
        const rel = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\//, "");
        if (!rel || rel.includes("..")) {
          next();
          return;
        }
        const file = path.join(docsRoot, rel);
        if (!file.startsWith(docsRoot) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          next();
          return;
        }
        res.setHeader("Content-Type", "text/markdown; charset=utf-8");
        fs.createReadStream(file).pipe(res);
      });
      server.middlewares.use("/errors", (req, res, next) => {
        const rel = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\//, "");
        const base = path.join(root, "error-pages");
        if (!rel || rel.includes("..")) {
          next();
          return;
        }
        const file = path.join(base, rel);
        if (!file.startsWith(base) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          next();
          return;
        }
        const code = rel.includes("503") ? 503 : 200;
        res.statusCode = code;
        if (file.endsWith(".css")) res.setHeader("Content-Type", "text/css; charset=utf-8");
        else res.setHeader("Content-Type", "text/html; charset=utf-8");
        fs.createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      const outDir = path.join(root, "dist");
      const out = path.join(outDir, "docs");
      if (fs.existsSync(docsRoot)) {
        fs.mkdirSync(out, { recursive: true });
        for (const name of fs.readdirSync(docsRoot)) {
          if (name.endsWith(".md")) {
            fs.copyFileSync(path.join(docsRoot, name), path.join(out, name));
          }
        }
      }
      const errorPagesDir = path.join(root, "error-pages");
      const errorOut = path.join(outDir, "errors");
      if (fs.existsSync(errorPagesDir)) {
        fs.mkdirSync(errorOut, { recursive: true });
        for (const name of fs.readdirSync(errorPagesDir)) {
          fs.copyFileSync(path.join(errorPagesDir, name), path.join(errorOut, name));
        }
      }
      fs.writeFileSync(path.join(outDir, "_redirects"), "/* /index.html 200\n");
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "");
  const apiTarget = env.VITE_API_PROXY_TARGET || "http://localhost:4180";

  return {
    root,
    publicDir: false,
    plugins: [docsStaticPlugin(), productionArtifactGuard({
      enabled: mode === "production",
      outDir: path.join(root, "dist"),
      name: "zhimu-production-artifact-guard"
    })],
    server: {
      port: Number(env.VITE_DEV_PORT || 4173),
      strictPort: true,
      host: env.VITE_DEV_HOST === "false" ? false : true,
      headers: {
        "X-Robots-Tag": "noindex, nofollow, noarchive"
      },
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true
        }
      }
    },
    preview: {
      port: Number(env.VITE_DEV_PORT || 4173),
      strictPort: true,
      headers: {
        "X-Robots-Tag": "noindex, nofollow, noarchive"
      },
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true
        }
      }
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: mode !== "production"
    },
    resolve: {
      alias: {
        shared: path.resolve(root, "shared")
      }
    }
  };
});
