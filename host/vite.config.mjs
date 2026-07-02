import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "");
  const port = Number(env.VITE_HOST_DEV_PORT || 5175);
  const apiTarget = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:4180";

  return {
    root,
    publicDir: "public",
    server: {
      host: env.VITE_DEV_HOST === "false" ? false : true,
      port,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true
        }
      }
    },
    preview: {
      host: env.VITE_DEV_HOST === "false" ? false : true,
      port,
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
    },
    resolve: {
      alias: {
        shared: path.resolve(root, "../shared")
      }
    }
  };
});
