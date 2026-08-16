import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.join(repoRoot, "examples", "pending-review", "下班以前");
const readJson = async (relativePath) => JSON.parse(await readFile(path.join(packageRoot, relativePath), "utf8"));

const ACT_HEADING = /^## (第一幕|第二幕|第三幕|第四幕)：[^\n]+$/gm;
const ACT_KEY = { 第一幕: "act1", 第二幕: "act2", 第三幕: "act3", 第四幕: "act4" };

export function splitRoleBook(markdown) {
  const text = String(markdown || "").replace(/\r\n?/g, "\n");
  const matches = [...text.matchAll(ACT_HEADING)];
  if (matches.length !== 4) throw new Error(`角色本需包含四幕，实际 ${matches.length} 幕`);
  const openingStart = text.indexOf("## 开场");
  const opening = openingStart >= 0 ? text.slice(openingStart, matches[0].index).trim() : "";
  const result = {};
  for (const [index, match] of matches.entries()) {
    const start = match.index;
    const end = matches[index + 1]?.index ?? text.length;
    let body = text.slice(start, end).trim();
    if (index === 0 && opening) body = `${opening}\n\n${body}`;
    result[ACT_KEY[match[1]]] = {
      title: match[0].replace(/^##\s*/, ""),
      body,
      tasks: [],
      closingHook: ""
    };
  }
  return result;
}

export async function buildBeforeClockoutSession() {
  const [setup, truthBible, characterArchives, infoMatrix, hostLayer] = await Promise.all([
    readJson("layers/01-setup.json"),
    readJson("layers/02-truth-bible.json"),
    readJson("layers/03-character-archives.json"),
    readJson("layers/04-info-matrix.json"),
    readJson("layers/05-host-runbooks.json")
  ]);
  const roleFiles = (await readdir(path.join(packageRoot, "roles"))).filter((name) => name.endsWith(".md")).sort();
  const scripts = {};
  for (const [index, role] of characterArchives.roles.entries()) {
    const roleFile = roleFiles.find((name) => name.startsWith(`R${index + 1}-`));
    if (!roleFile) throw new Error(`缺少 ${role.key} 的角色本`);
    scripts[role.key] = splitRoleBook(await readFile(path.join(packageRoot, "roles", roleFile), "utf8"));
  }
  return {
    ...setup,
    truthBible,
    characterArchives,
    infoMatrix,
    hostRunbooks: hostLayer.runbooks,
    scripts,
    locks: { setup: true, truth: true, characters: true, matrix: true, host: true, scripts: true },
    activeLayer: "evaluate"
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const session = await buildBeforeClockoutSession();
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex >= 0 && process.argv[outputIndex + 1]) {
    const outputPath = path.resolve(process.cwd(), process.argv[outputIndex + 1]);
    await writeFile(outputPath, `${JSON.stringify(session, null, 2)}\n`, "utf8");
    process.stdout.write(`${outputPath}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(session, null, 2)}\n`);
  }
}
