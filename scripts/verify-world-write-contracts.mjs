#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(root, "src", "api");
const routesDir = path.join(root, "backend", "src", "routes");
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function listJsFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJsFiles(absolute);
    return entry.isFile() && entry.name.endsWith(".js") ? [absolute] : [];
  });
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function findClosingQuote(source, start, quote) {
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === quote) return index;
  }
  return -1;
}

function findClosingParen(source, openIndex) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function templateParam(expression) {
  const identifiers = String(expression).match(/[A-Za-z_$][\w$]*/g) || [];
  return identifiers.at(-1) || "param";
}

function normalizePath(routePath) {
  const templated = routePath.replace(/\$\{([^}]+)\}/g, (_, expression) => `:${templateParam(expression)}`);
  return templated
    .replace(/^\/api(?=\/)/, "")
    .replace(/:[A-Za-z_$][\w$]*/g, ":param")
    .replace(/\/+$/, "") || "/";
}

function collectFrontendWrites() {
  const calls = [];
  for (const file of listJsFiles(apiDir)) {
    const source = fs.readFileSync(file, "utf8");
    let cursor = 0;
    while ((cursor = source.indexOf("worldWrite(", cursor)) >= 0) {
      if (/function\s*$/.test(source.slice(Math.max(0, cursor - 24), cursor))) {
        cursor += "worldWrite(".length;
        continue;
      }
      const openIndex = source.indexOf("(", cursor);
      const closeIndex = findClosingParen(source, openIndex);
      if (closeIndex < 0) throw new Error(`Unclosed worldWrite call in ${file}:${lineNumber(source, cursor)}`);
      let argumentStart = openIndex + 1;
      while (/\s/.test(source[argumentStart])) argumentStart += 1;
      const quote = source[argumentStart];
      if (!['"', "'", "`"].includes(quote)) {
        throw new Error(`worldWrite path must be a literal in ${file}:${lineNumber(source, cursor)}`);
      }
      const pathEnd = findClosingQuote(source, argumentStart, quote);
      const routePath = source.slice(argumentStart + 1, pathEnd);
      const callSource = source.slice(cursor, closeIndex + 1);
      const method = callSource.match(/\bmethod\s*:\s*["'](POST|PUT|PATCH|DELETE)["']/i)?.[1]?.toUpperCase() || "PATCH";
      calls.push({
        file: path.relative(root, file).replaceAll("\\", "/"),
        line: lineNumber(source, cursor),
        method,
        path: normalizePath(routePath)
      });
      cursor = closeIndex + 1;
    }
  }
  return calls;
}

function collectBackendWrites() {
  const routes = [];
  for (const file of listJsFiles(routesDir).filter((name) => name.endsWith("-routes.js"))) {
    const source = fs.readFileSync(file, "utf8");
    const registration = /app\.(post|put|patch|delete)\(\s*(["'])([^"']+)\2/g;
    const matches = [...source.matchAll(registration)];
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const blockEnd = matches[index + 1]?.index ?? source.length;
      const block = source.slice(match.index, blockEnd);
      routes.push({
        file: path.relative(root, file).replaceAll("\\", "/"),
        line: lineNumber(source, match.index),
        method: match[1].toUpperCase(),
        path: normalizePath(match[3]),
        revisionAware: /\brunRevisionMutation\b|\bupdateWorldContent\b|\bupdateWorld\s*\(/.test(block)
      });
    }
  }
  return routes;
}

const frontendWrites = collectFrontendWrites();
const backendWrites = collectBackendWrites();
const routeIndex = new Map(backendWrites.map((route) => [`${route.method} ${route.path}`, route]));
const failures = [];

for (const call of frontendWrites) {
  if (!WRITE_METHODS.has(call.method)) continue;
  const key = `${call.method} ${call.path}`;
  const route = routeIndex.get(key);
  if (!route) {
    failures.push({ ...call, reason: "backend route not found" });
    continue;
  }
  if (!route.revisionAware) failures.push({ ...call, reason: `route is not revision-aware (${route.file}:${route.line})` });
}

if (failures.length) {
  console.error(`worldWrite contract audit failed: ${failures.length}/${frontendWrites.length}`);
  for (const failure of failures) {
    console.error(`  FAIL ${failure.file}:${failure.line} ${failure.method} ${failure.path} - ${failure.reason}`);
  }
  process.exit(1);
}

console.log(`worldWrite contract audit: ${frontendWrites.length} frontend writes mapped to revision-aware backend routes`);
