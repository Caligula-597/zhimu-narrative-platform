#!/usr/bin/env node

/** Static coverage audit for backend routes, frontend API calls and Creator views. */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceExt = /\.(?:js|mjs|ts|tsx|jsx|css)$/;

function walk(directory, output = []) {
  if (!fs.existsSync(directory)) return output;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", "dist", ".wrangler", ".git", "captures"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, output);
    else if (entry.isFile() && sourceExt.test(entry.name)) output.push(absolute);
  }
  return output;
}

const rel = (file) => path.relative(root, file).replaceAll(path.sep, "/");
const read = (file) => fs.readFileSync(file, "utf8");
const normalizeRoute = (value) => String(value)
  .replace(/\$\{[^}]+\}/g, ":param")
  .replace(/^\/api(?=\/|$)/, "")
  .replace(/[?#].*$/, "")
  .replace(/\/+/g, "/")
  .replace(/\/$/, "") || "/";

function localImport(from, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = path.resolve(path.dirname(from), specifier);
  for (const candidate of [base, `${base}.js`, `${base}.mjs`, `${base}.ts`, path.join(base, "index.js")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function reachableFiles(entries, files) {
  const fileSet = new Set(files);
  const dependencies = new Map();
  for (const file of files) {
    const deps = [];
    for (const match of read(file).matchAll(/(?:import\s+(?:[^'";]*?\s+from\s+)?|export\s+[^'";]*?\s+from\s+|import\s*\(|require\s*\()\s*["']([^"']+)["']/g)) {
      const dependency = localImport(file, match[1]);
      if (dependency && fileSet.has(dependency)) deps.push(dependency);
    }
    dependencies.set(file, deps);
  }
  const seen = new Set();
  const queue = entries.filter((entry) => fileSet.has(entry));
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    queue.push(...(dependencies.get(file) || []));
  }
  return seen;
}

function extractBackendRoutes(file) {
  const source = read(file);
  const rows = [];
  for (const match of source.matchAll(/\bapp\.(get|post|put|patch|delete|head)\s*\(\s*(["'`])([\s\S]*?)\2/g)) {
    const rawPath = match[3];
    if (!rawPath.includes("/api/")) continue;
    rows.push({ method: match[1].toUpperCase(), path: normalizeRoute(rawPath), file: rel(file) });
  }
  return rows;
}

function extractFrontendRoutes(file) {
  const source = read(file);
  const rows = [];
  for (const match of source.matchAll(/(["'`])(\/[^"'`\r\n]*)\1/g)) {
    if (/^\/(?:\/|[.#])/.test(match[2])) continue;
    rows.push({ path: normalizeRoute(match[2]), file: rel(file) });
  }
  return rows;
}

const backendFiles = walk(path.join(root, "backend", "src"), []).filter((file) => file.endsWith(".js"));
const routeFiles = backendFiles.filter((file) => file.includes(`${path.sep}routes${path.sep}`) && file.endsWith("-routes.js"));
const backendReachable = reachableFiles([
  path.join(root, "backend", "src", "server.js"),
  path.join(root, "backend", "src", "app.js")
], backendFiles);
const unreachableRouteFiles = routeFiles.filter((file) => !backendReachable.has(file)).map(rel).sort();
const backendRoutes = routeFiles.flatMap(extractBackendRoutes);

const frontendFiles = [
  ...walk(path.join(root, "src"), []),
  ...walk(path.join(root, "host", "src"), []),
  ...walk(path.join(root, "play", "src"), [])
].filter((file) => file.endsWith(".js"));
const frontendRoutes = frontendFiles.flatMap(extractFrontendRoutes);
const frontendPathSet = new Set(frontendRoutes.map((row) => row.path));
const routeCoverage = backendRoutes.map((row) => ({
  ...row,
  referencedByFrontend: frontendPathSet.has(row.path)
}));

const creatorIndex = read(path.join(root, "src", "api", "index.js"));
const creatorApiMethods = [];
for (const block of creatorIndex.matchAll(/export\s*\{([\s\S]*?)\}\s*from/g)) {
  for (const line of block[1].split(",")) {
    const name = line.trim().split(/\s+as\s+/)[0].replace(/\/\*.*?\*\//g, "").trim();
    if (/^[A-Za-z_$][\w$]*$/.test(name)) creatorApiMethods.push(name);
  }
}
const creatorConsumers = walk(path.join(root, "src"), [])
  .filter((file) => file.endsWith(".js") && !file.startsWith(path.join(root, "src", "api")));
const creatorConsumerSource = creatorConsumers.map(read).join("\n");
const creatorApiUsage = [...new Set(creatorApiMethods)].map((method) => ({
  method,
  used: new RegExp(`(?:zhimuApi|api)\\.${method}\\s*\\(`).test(creatorConsumerSource),
  likelyRefs: [...creatorConsumerSource.matchAll(new RegExp(`\\b${method}\\s*\\(`, "g"))].length
}));

const allCreatorViews = fs.readdirSync(path.join(root, "src", "views"))
  .filter((name) => name.endsWith(".js"));
const creatorGraphFiles = [
  ...walk(path.join(root, "src"), []),
  path.join(root, "app.js"),
  path.join(root, "frontend", "main.js"),
  path.join(root, "config.js")
].filter((file) => fs.existsSync(file) && sourceExt.test(file));
const creatorReachable = reachableFiles([
  path.join(root, "app.js"),
  path.join(root, "frontend", "main.js")
], creatorGraphFiles);
const viewsNotReachable = allCreatorViews
  .filter((name) => !creatorReachable.has(path.join(root, "src", "views", name)))
  .sort();

const result = {
  generatedAt: new Date().toISOString(),
  backend: {
    routeFiles: routeFiles.length,
    routeDeclarations: backendRoutes.length,
    unreachableRouteFiles,
    routesWithoutStaticFrontendReference: routeCoverage.filter((row) => !row.referencedByFrontend)
  },
  frontend: {
    routeReferences: frontendRoutes.length,
    creatorApiMethods: [...new Set(creatorApiMethods)].length,
    creatorApiMethodsWithoutNamespaceUse: creatorApiUsage.filter((row) => !row.used),
    creatorViews: allCreatorViews.length,
    viewsNotReachable
  },
  notes: [
    "静态路径匹配不能替代运行时 tracing；模板字符串、动态代理和仅 Host/Player 使用的接口需要人工复核。",
    "route 文件不可达表示没有从 server/app 依赖图进入生产入口，不等于数据库迁移或历史试验材料可以直接删除。",
    "未出现在 product manifest 的 Creator view 需要确认是暂存、共享入口遗漏，还是废弃文件。"
  ]
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
