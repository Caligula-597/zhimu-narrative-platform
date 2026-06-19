import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
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
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_API_PROXY || "http://127.0.0.1:4180",
        changeOrigin: true
      }
    }
  }
});
