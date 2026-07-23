import fs from "node:fs";
import path from "node:path";

function resolveSafeOutputDirectory(outDir) {
  const resolved = path.resolve(String(outDir || ""));
  const parsed = path.parse(resolved);
  if (resolved === parsed.root || path.basename(resolved).toLowerCase() !== "dist") {
    throw new Error(`Refusing to clean unsafe production output directory: ${resolved}`);
  }
  return resolved;
}

function purgeStaleGeneratedAssets(outDir, bundle) {
  const target = resolveSafeOutputDirectory(outDir);
  const assetRoot = path.join(target, "assets");
  if (!fs.existsSync(assetRoot)) return;

  const emitted = new Set(Object.keys(bundle || {}).map((name) => name.replaceAll("\\", "/")));
  const pending = [assetRoot];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(file);
        continue;
      }
      if (!entry.isFile() || !/-[A-Za-z0-9_-]{8,}\.(?:css|js)$/.test(entry.name)) continue;
      const relative = path.relative(target, file).replaceAll("\\", "/");
      if (!emitted.has(relative)) fs.unlinkSync(file);
    }
  }
}

/** Produce a clean release directory and remove source maps from production output. */
export function productionArtifactGuard({ enabled, outDir, name = "production-artifact-guard" }) {
  return {
    name,
    buildStart() {
      if (!enabled) return;
      const target = resolveSafeOutputDirectory(outDir);
      fs.rmSync(target, { recursive: true, force: true });
      fs.mkdirSync(target, { recursive: true });
    },
    writeBundle(_options, bundle) {
      if (!enabled) return;
      purgeStaleGeneratedAssets(outDir, bundle);
    },
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
