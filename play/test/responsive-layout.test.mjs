import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("story tab stacks after the desktop grid rule on mobile", () => {
  const styles = readFileSync(path.join(root, "src", "styles.css"), "utf8");
  const desktopGrid = styles.indexOf("grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);");
  const mobileGrid = styles.lastIndexOf("grid-template-columns: 1fr;");

  assert.ok(desktopGrid >= 0, "desktop story grid rule should exist");
  assert.ok(mobileGrid > desktopGrid, "mobile story grid must follow the desktop rule in the cascade");
  assert.match(
    styles.slice(desktopGrid),
    /@media \(max-width: 860px\) \{[\s\S]*?\.story-tab-layout \{\s*grid-template-columns: 1fr;[\s\S]*?\.role-story-card \{\s*position: static;/
  );
});
