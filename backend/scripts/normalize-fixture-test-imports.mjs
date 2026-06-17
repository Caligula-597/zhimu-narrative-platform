#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "test");

const FOGRoleFn =
  /async function fogRoleId\(\) \{[\s\S]*?\n\}\n+/g;
const brokenWorldFn =
  /async function fixtureWorldId\(\) \{\s*return fixtureWorldId;\s*\}\n+/g;
const legacyWorldFn =
  /async function fixtureWorldId\(\) \{[\s\S]*?\n\}\n+/g;

for (const name of fs.readdirSync(testDir).filter((f) => f.endsWith(".test.js"))) {
  const file = path.join(testDir, name);
  let src = fs.readFileSync(file, "utf8");
  const original = src;

  src = src.replace(FOGRoleFn, "");
  src = src.replace(brokenWorldFn, "");
  src = src.replace(legacyWorldFn, "");
  src = src.replace(/\bfogRoleId\(\)/g, "queryFixtureRoleId()");
  src = src.replace(/await queryFixtureRoleId\(\)/g, "await queryFixtureRoleId()");

  // Move misplaced imports to top (after assert)
  const imports = [...src.matchAll(/^import .+from .+;\n/gm)].map((m) => m[0]);
  if (imports.length) {
    let body = src;
    for (const imp of imports) body = body.replace(imp, "");
    const assertLine = body.match(/^import assert[^\n]*\n/)?.[0] ?? "";
    body = body.replace(/^import assert[^\n]*\n/, "");
    const uniq = [...new Set(imports)].sort().join("");
    src = assertLine + uniq + body;
  }

  const needsRoom = /\bfixtureRoomId\b/.test(src);
  const needsWorld = /\bfixtureWorldId\b/.test(src);
  const needsRole = /\bqueryFixtureRoleId\b/.test(src);

  function addImport(modulePath, symbols) {
    const line = `import { ${symbols.join(", ")} } from "${modulePath}";\n`;
    if (src.includes(modulePath)) {
      const m = src.match(new RegExp(`import \\{([^}]+)\\} from "${modulePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}";`));
      if (m) {
        const merged = [...new Set([...m[1].split(",").map((x) => x.trim()), ...symbols])];
        src = src.replace(m[0], `import { ${merged.join(", ")} } from "${modulePath}";`);
        return;
      }
    }
    src = src.replace(/^import assert[^\n]*\n/, (m) => m + line);
  }

  if (needsRoom || needsWorld) {
    addImport("./helpers/fixture-ids.js", [needsRoom && "fixtureRoomId", needsWorld && "fixtureWorldId"].filter(Boolean));
  }
  if (needsRole) addImport("./helpers/fixture-helpers.js", ["queryFixtureRoleId"]);

  src = src.replace(/\n{3,}/g, "\n\n");
  if (src !== original) fs.writeFileSync(file, src);
}

console.log("fixture cleanup pass 3");
