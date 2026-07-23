import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { productionArtifactGuard } from "../config/production-artifact-guard.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  root: ".",
  publicDir: "public",
  plugins: [productionArtifactGuard({
    enabled: mode === "production",
    outDir: path.join(root, "dist"),
    name: "zhimu-play-production-artifact-guard"
  })],
  resolve: {
    alias: {
      shared: path.resolve(root, "../shared")
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/livekit-client") || id.includes("node_modules/@livekit")) {
            return "livekit-vendor";
          }
        }
      }
    }
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_API_PROXY || "http://127.0.0.1:4180",
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_API_PROXY || "http://127.0.0.1:4180",
        changeOrigin: true
      }
    }
  }
}));
