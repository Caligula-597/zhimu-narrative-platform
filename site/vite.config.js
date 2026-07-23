import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { productionArtifactGuard } from "../config/production-artifact-guard.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  root,
  publicDir: "public",
  plugins: [productionArtifactGuard({
    enabled: mode === "production",
    outDir: path.join(root, "dist"),
    name: "zhimu-site-production-artifact-guard"
  })],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(root, "index.html"),
        pricingCommercial: path.resolve(root, "pricing-commercial.html")
      }
    }
  }
}));
