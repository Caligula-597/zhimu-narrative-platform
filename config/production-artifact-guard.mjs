import fs from "node:fs";
import path from "node:path";

/** Remove stale source maps that may survive incremental or Windows builds. */
export function productionArtifactGuard({ enabled, outDir, name = "production-artifact-guard" }) {
  return {
    name,
    closeBundle() {
      if (!enabled) return;
      const pending = [outDir];
      while (pending.length) {
        const current = pending.pop();
        if (!fs.existsSync(current)) continue;
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
          const target = path.join(current, entry.name);
          if (entry.isDirectory()) pending.push(target);
          else if (entry.isFile() && entry.name.endsWith(".map")) fs.unlinkSync(target);
        }
      }
    }
  };
}
