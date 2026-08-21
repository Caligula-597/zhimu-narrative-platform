#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const git = spawnSync("git", [
  "-c",
  "core.quotepath=false",
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
  "--",
  "*.md"
], {
  cwd: root,
  encoding: "utf8"
});
if (git.status !== 0) {
  console.error(git.stderr || "Unable to list tracked Markdown files.");
  process.exit(1);
}

const files = git.stdout
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((relativePath) => existsSync(join(root, relativePath)))
  .sort();
const errors = [];
const linkPattern = /!?\[[^\]]*]\(([^)\n]+)\)/g;

function normalizeTarget(raw) {
  let target = raw.trim();
  if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);
  const optionalTitle = target.match(/^(\S+)\s+(?:"[^"]*"|'[^']*')$/);
  if (optionalTitle) target = optionalTitle[1];
  return target;
}

for (const relativePath of files) {
  const absolutePath = join(root, relativePath);
  const source = readFileSync(absolutePath, "utf8");
  if (source.includes("\uFFFD")) {
    errors.push(`${relativePath}: contains Unicode replacement characters`);
  }
  if (!/^#\s+\S/m.test(source)) {
    errors.push(`${relativePath}: missing level-one heading`);
  }

  for (const match of source.matchAll(linkPattern)) {
    const target = normalizeTarget(match[1]);
    if (
      !target ||
      target.startsWith("#") ||
      /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(target)
    ) {
      continue;
    }
    const withoutFragment = target.split("#")[0].split("?")[0];
    let decoded = withoutFragment;
    try {
      decoded = decodeURIComponent(withoutFragment);
    } catch {
      errors.push(`${relativePath}: invalid URL encoding in link ${target}`);
      continue;
    }
    const linkedPath = resolve(dirname(absolutePath), decoded);
    if (!existsSync(linkedPath)) {
      errors.push(`${relativePath}: missing relative link target ${target}`);
    }
  }
}

const rootReadme = readFileSync(join(root, "README.md"), "utf8");
if (!rootReadme.includes("docs/DOCUMENTATION_INDEX_ZH.md")) {
  errors.push("README.md: must link to docs/DOCUMENTATION_INDEX_ZH.md");
}

const statusCheck = spawnSync(
  process.execPath,
  ["scripts/generate-project-status.mjs", "--check"],
  { cwd: root, encoding: "utf8" }
);
if (statusCheck.status !== 0) {
  errors.push((statusCheck.stderr || statusCheck.stdout).trim());
}

const indexCheck = spawnSync(
  process.execPath,
  ["scripts/generate-documentation-index.mjs", "--check"],
  { cwd: root, encoding: "utf8" }
);
if (indexCheck.status !== 0) {
  errors.push((indexCheck.stderr || indexCheck.stdout).trim());
}

if (errors.length) {
  console.error(`documentation errors (${errors.length}):`);
  errors.forEach((error) => console.error(`  - ${error}`));
  process.exit(1);
}

console.log(
  `documentation audit passed: ${files.length} existing Markdown files, relative links resolved`
);
