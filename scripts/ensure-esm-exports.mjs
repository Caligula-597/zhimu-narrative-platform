/**
 * Append `export {}` to legacy window.* modules so Vite can import them as ES modules.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const files = [
  "config.js",
  "src/dom.js",
  "src/state.js",
  "src/utils/user-messages.js",
  "src/utils/wizard-automation-templates.js",
  "src/api/client.js",
  "rule-visual.js",
  "src/utils/format.js",
  "src/components/emptyState.js",
  "src/components/toast.js",
  "src/components/modal.js",
  "src/components/creator-guide.js",
  "src/views/overview.js",
  "src/views/writer.js",
  "src/views/studio.js",
  "src/views/assets.js",
  "src/views/rules.js",
  "src/views/director.js",
  "src/views/player.js",
  "src/views/archive.js",
  "src/views/settings.js",
  "src/views/account.js",
  "src/runtime/wizard.js",
  "src/runtime/auth-world.js",
  "src/runtime/livekit-voice.js",
  "src/runtime/data.js",
  "src/runtime/actions.js",
  "app.js"
];

let changed = 0;
for (const rel of files) {
  const filePath = path.join(root, rel);
  if (!fs.existsSync(filePath)) {
    console.error(`missing ${rel}`);
    process.exit(1);
  }
  let content = fs.readFileSync(filePath, "utf8");
  if (/\bexport\s/m.test(content)) continue;
  content = `${content.replace(/\s*$/, "")}\nexport {};\n`;
  fs.writeFileSync(filePath, content);
  changed += 1;
  console.log(`+ export {}  ${rel}`);
}
console.log(changed ? `Updated ${changed} files` : "All files already have ESM exports");
