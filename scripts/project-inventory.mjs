#!/usr/bin/env node

/**
 * 织幕工作区盘点器。
 *
 * 统计口径：默认排除依赖、构建产物、Git 元数据和浏览器测试产物；
 * `--include-noise` 可用于把这些目录纳入文件数量对照，但不会改变语义分类。
 * 输出 JSON，便于文档、审计和后续 CI 使用。
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const includeNoise = process.argv.includes("--include-noise");
const excluded = new Set([
  ".git",
  "node_modules",
  "dist",
  "captures",
  "test-results",
  ".wrangler",
  ".cache"
]);
const codeExtensions = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".sh", ".ps1",
  ".css", ".html", ".sql"
]);
const textExtensions = new Set([
  ...codeExtensions, ".json", ".md", ".txt", ".yml", ".yaml", ".toml",
  ".xml", ".conf", ".example", ".fullstack", ".drawio"
]);
const binaryDocumentExtensions = new Set([".pdf", ".doc", ".docx"]);
const assetExtensions = new Set([
  ".jpg", ".jpeg", ".png", ".svg", ".webp", ".gif", ".mp3", ".wav", ".zip",
  ".exe", ".traineddata", ".pyc"
]);
const testPattern = /(^|[\\/_.-])(test|tests|spec|e2e|fixture|fixtures|benchmark|playtest|results?)([\\/_.-]|$)/i;
const directionPattern = /(机制|设计|计划|路线|方向|架构|流程|拆解|审计|报告|母本|候选|提案|生产|管线|说明书|分析|平衡|测试|复刻|strategy|roadmap|design|architecture|workflow|audit|report|guide|checklist|scope)/i;
const generatedPattern = /(^|[\\/_.-])(generated|output|outputs|snapshot|export|exported|coverage|trace)([\\/_.-]|$)/i;
const logPattern = /(^|[\\/_.-])(log|logs|trace|traces)([\\/_.-]|$)|\\.(log|trace)$/i;

function walk(directory, result = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!includeNoise && excluded.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, result);
    else if (entry.isFile()) result.push(absolute);
  }
  return result;
}

function extension(file) {
  const value = path.extname(file).toLowerCase();
  return value || "[no-extension]";
}

function isLikelyText(file, ext) {
  if (textExtensions.has(ext)) return true;
  if (binaryDocumentExtensions.has(ext) || assetExtensions.has(ext)) return false;
  return path.basename(file).toLowerCase().includes("readme") || ext === ".development" || ext === ".staging" || ext === ".setup" || ext === ".railway";
}

function lineCount(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.includes(0)) return 0;
  return buffer.toString("utf8").split(/\r?\n/).length - (buffer.length ? 0 : 1);
}

function add(map, key, value) {
  const item = map[key] || { files: 0, lines: 0, bytes: 0 };
  item.files += 1;
  item.lines += value.lines;
  item.bytes += value.bytes;
  map[key] = item;
}

const files = walk(ROOT);
const byExtension = {};
const byTopLevel = {};
const byClass = {};
let totalTextLines = 0;
let codeLines = 0;
let executableLikeLines = 0;

for (const file of files) {
  const relative = path.relative(ROOT, file).replaceAll(path.sep, "/");
  const ext = extension(file);
  const stat = fs.statSync(file);
  const readable = isLikelyText(file, ext);
  const lines = readable ? lineCount(file) : 0;
  const value = { lines, bytes: stat.size };
  const topLevel = relative.split("/")[0] || "[root]";
  const lower = relative.toLowerCase();
  let classification = "other";
  if (assetExtensions.has(ext)) classification = "assets";
  else if (binaryDocumentExtensions.has(ext)) classification = "binaryDocs";
  else if (logPattern.test(lower)) classification = "logsGenerated";
  else if (generatedPattern.test(lower)) classification = "logsGenerated";
  else if (testPattern.test(lower)) classification = "tests";
  else if (ext === ".json" || lower.includes("data-") || lower.includes("/案例/") || lower.includes("/fixtures/")) classification = "configData";
  else if (readable && directionPattern.test(lower) && [".md", ".txt", ".drawio", ".json"].includes(ext)) classification = "directionDocs";
  else if (readable && [".md", ".txt", ".drawio", ".json"].includes(ext)) classification = "technicalDocs";
  else if (codeExtensions.has(ext)) classification = "code";
  add(byExtension, ext, value);
  add(byTopLevel, topLevel, value);
  add(byClass, classification, value);
  if (readable) totalTextLines += lines;
  if (codeExtensions.has(ext)) {
    executableLikeLines += lines;
    if (classification === "code") codeLines += lines;
  }
}

const sort = (map) => Object.fromEntries(Object.entries(map).sort((a, b) => b[1].files - a[1].files));
const output = {
  generatedAt: new Date().toISOString(),
  root: ROOT,
  includeNoise,
  excluded: includeNoise ? [] : [...excluded],
  totals: {
    files: files.length,
    totalTextLines,
    executableLikeLines,
    nonTestCodeLines: codeLines
  },
  byClass: sort(byClass),
  byExtension: sort(byExtension),
  byTopLevel: sort(byTopLevel)
};
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
