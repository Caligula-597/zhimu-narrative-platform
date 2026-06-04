import { defineConfig, loadEnv } from "vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
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
    },
    closeBundle() {
      const out = path.join(root, "dist", "docs");
      if (!fs.existsSync(docsRoot)) return;
      fs.mkdirSync(out, { recursive: true });
      for (const name of fs.readdirSync(docsRoot)) {
        if (name.endsWith(".md")) {
          fs.copyFileSync(path.join(docsRoot, name), path.join(out, name));
        }
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "");
  const apiTarget = env.VITE_API_PROXY_TARGET || "http://localhost:4180";

  return {
    root,
    publicDir: false,
    plugins: [docsStaticPlugin()],
    server: {
      port: Number(env.VITE_DEV_PORT || 4173),
      strictPort: true,
      host: env.VITE_DEV_HOST === "false" ? false : true,
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
      sourcemap: true
      // No manualChunks: views/runtime/livekit-voice attach to window.* at load time
      // and must follow config.js → dom.js → state.js (splitting caused staging white screen).
    }
  };
});
