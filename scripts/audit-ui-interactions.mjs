#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "src");

function listJavaScriptFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(filePath);
    return entry.isFile() && entry.name.endsWith(".js") ? [filePath] : [];
  });
}

function relative(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function collectMatches(files, expression, valueIndex = 1) {
  const matches = [];
  for (const filePath of files) {
    const source = fs.readFileSync(filePath, "utf8");
    for (const match of source.matchAll(expression)) {
      matches.push({ value: match[valueIndex], file: relative(filePath) });
    }
  }
  return matches;
}

function findObjectBody(source, startIndex) {
  const openIndex = source.indexOf("{", startIndex);
  if (openIndex < 0) return "";
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex + 1, index);
    }
  }
  return "";
}

function registeredViewMethods(files) {
  const registry = new Map();
  for (const filePath of files) {
    const source = fs.readFileSync(filePath, "utf8");
    const registerExpression = /registerView\(\s*["']([^"']+)["']\s*,\s*([A-Za-z_$][\w$]*|\{)/g;
    for (const match of source.matchAll(registerExpression)) {
      const namespace = match[1];
      const argument = match[2];
      let body = "";
      if (argument === "{") {
        body = findObjectBody(source, match.index + match[0].lastIndexOf("{"));
      } else {
        const declaration = new RegExp(`(?:export\\s+)?const\\s+${argument}\\s*=\\s*\\{`, "g");
        const declarationMatch = declaration.exec(source);
        if (declarationMatch) body = findObjectBody(source, declarationMatch.index);
      }
      const methods = new Set();
      for (const property of body.matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*(?=[:,]|$)/g)) {
        methods.add(property[1]);
      }
      registry.set(namespace, { methods, file: relative(filePath) });
    }
  }
  return registry;
}

export function auditUiInteractions() {
  const files = listJavaScriptFiles(sourceRoot);
  const actionHandlerFiles = files.filter((filePath) => /^src\/runtime\/actions(?:-[^/]+)?\.js$/.test(relative(filePath)));
  const renderedActions = collectMatches(files, /data-action\s*=\s*["']([^"'${}<>\s]+)["']/g);
  const handledActions = new Set([
    ...collectMatches(actionHandlerFiles, /\bcase\s+["']([^"']+)["']\s*:/g).map(({ value }) => value),
    ...collectMatches(actionHandlerFiles, /\baction\s*===?\s*["']([^"']+)["']/g).map(({ value }) => value)
  ]);
  const unhandledActions = renderedActions.filter(({ value }) => !handledActions.has(value));

  const registry = registeredViewMethods(files);
  const viewCalls = collectMatches(files, /callView\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/g, 1);
  const missingViewMethods = [];
  for (const filePath of files) {
    const source = fs.readFileSync(filePath, "utf8");
    for (const match of source.matchAll(/callView\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/g)) {
      const namespace = match[1];
      const method = match[2];
      const registered = registry.get(namespace);
      if (!registered?.methods.has(method)) {
        missingViewMethods.push({ namespace, method, file: relative(filePath), registeredIn: registered?.file || "未注册" });
      }
    }
  }

  const indexPath = path.join(root, "index.html");
  const navigationSources = [
    ...files.map((filePath) => ({ filePath, source: fs.readFileSync(filePath, "utf8") })),
    { filePath: indexPath, source: fs.readFileSync(indexPath, "utf8") }
  ];
  const navigationTargets = [];
  for (const { filePath, source } of navigationSources) {
    for (const match of source.matchAll(/data-(?:go|view)\s*=\s*["']([^"'${}<>\s]+)["']/g)) {
      navigationTargets.push({ value: match[1], file: relative(filePath) });
    }
  }
  const resolverSource = fs.readFileSync(path.join(sourceRoot, "bootstrap", "view-resolver.js"), "utf8");
  const metaDeclaration = resolverSource.indexOf("const viewMeta");
  const viewMetaKeys = new Set();
  for (const match of findObjectBody(resolverSource, metaDeclaration).matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*:/g)) {
    viewMetaKeys.add(match[1]);
  }
  const resolvedViews = new Set([...resolverSource.matchAll(/case\s+["']([^"']+)["']\s*:/g)].map((match) => match[1]));
  const specialNavigationTargets = new Set(["assets", "director", "player"]);
  const unknownNavigationTargets = navigationTargets.filter(
    ({ value }) => !viewMetaKeys.has(value) && !specialNavigationTargets.has(value)
  );
  const unresolvedViews = [...viewMetaKeys].filter((view) => !resolvedViews.has(view));

  return {
    files: files.length,
    renderedActions,
    handledActions,
    viewCalls,
    unhandledActions,
    missingViewMethods,
    navigationTargets,
    unknownNavigationTargets,
    unresolvedViews
  };
}

export function printUiInteractionAudit(result) {
  if (result.unhandledActions.length) {
    console.error("发现没有全局处理器的 data-action：");
    for (const item of result.unhandledActions) console.error(`- ${item.value} (${item.file})`);
  }
  if (result.missingViewMethods.length) {
    console.error("发现 callView 指向未注册的方法：");
    for (const item of result.missingViewMethods) {
      console.error(`- ${item.namespace}.${item.method} (${item.file}；视图注册：${item.registeredIn})`);
    }
  }
  if (result.unknownNavigationTargets.length) {
    console.error("发现指向未知页面的导航控件：");
    for (const item of result.unknownNavigationTargets) console.error(`- ${item.value} (${item.file})`);
  }
  if (result.unresolvedViews.length) {
    console.error(`发现没有渲染解析器的页面：${result.unresolvedViews.join(", ")}`);
  }
  const failures = result.unhandledActions.length
    + result.missingViewMethods.length
    + result.unknownNavigationTargets.length
    + result.unresolvedViews.length;
  const uniqueActions = new Set(result.renderedActions.map(({ value }) => value)).size;
  console.log(
    `UI 交互契约：${result.files} 个源码文件，${uniqueActions} 个可见 action，${result.viewCalls.length} 个 view 调用，${result.navigationTargets.length} 个导航入口，${failures} 个断链。`
  );
  return failures;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const failures = printUiInteractionAudit(auditUiInteractions());
  if (failures) process.exitCode = 1;
}
