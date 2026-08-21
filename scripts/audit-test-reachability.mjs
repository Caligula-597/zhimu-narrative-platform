#!/usr/bin/env node
/** Fail when tests have no runner entry or test-only support files are abandoned. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const excludedDirectories = new Set([
  ".git",
  ".vite",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
  "案例",
  "软著材料"
]);
const testFilePattern = /\.(?:test|spec)\.(?:c?js|mjs|tsx?)$/u;
const textFilePattern = /\.(?:c?js|mjs|json|tsx?)$/u;
const retiredTestMarkers = [
  "deepseek-pipeline",
  "full-mystery",
  "matrix-pipeline",
  "original-showcase",
  "pipeline-matrix",
  "pipeline-wizard",
  "src/views/player.js",
  "story-assistant-matrix",
  "story-spine",
  "twelve-lights",
  "writer-player-preview"
];

const normalize = (value) => value.split(path.sep).join("/");
const relative = (value) => normalize(path.relative(root, value));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const readJson = (file) => JSON.parse(read(file));

function walk(directory = root, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, output);
    else output.push(relative(absolute));
  }
  return output;
}

function under(file, directory) {
  return file === directory || file.startsWith(`${directory}/`);
}

function packageTestCommand(packageFile) {
  const scripts = readJson(packageFile).scripts || {};
  return { scripts, text: Object.values(scripts).join("\n") };
}

const allFiles = walk();
const testFiles = allFiles.filter((file) => testFilePattern.test(file)).sort();
const rootPackage = packageTestCommand("package.json");
const packageCommands = new Map([
  ["backend", packageTestCommand("backend/package.json")],
  ["host", packageTestCommand("host/package.json")],
  ["play", packageTestCommand("play/package.json")],
  ["site", packageTestCommand("site/package.json")]
]);
const workflowText = allFiles
  .filter((file) => under(file, ".github") && /\.(?:ya?ml|json)$/u.test(file))
  .map(read)
  .join("\n");
const rootRegistrationText = `${rootPackage.text}\n${workflowText}`;
const playwrightConfigs = allFiles.filter((file) => (
  /(?:^|\/)playwright(?:\.[^/]+)?\.config\.(?:js|mjs)$/u.test(file)
));
const playwrightSources = playwrightConfigs.map((file) => ({ file, source: read(file) }));
const defaultPlaywrightSource = fs.existsSync(path.join(root, "playwright.config.js"))
  ? read("playwright.config.js")
  : "";
const defaultPlaywrightEnabled = Object.values(rootPackage.scripts).some((command) => (
  /(?:^|\s)playwright\s+test(?:\s|$)/u.test(command) && !/--config(?:=|\s)/u.test(command)
));
const defaultIgnoredSpecs = new Set(
  [...defaultPlaywrightSource.matchAll(/"\*\*\/([A-Za-z0-9-]+\.spec\.js)"/gu)]
    .map((match) => match[1])
);
const configuredTestMatchers = playwrightSources.flatMap(({ file, source }) => {
  const matchers = [];
  for (const match of source.matchAll(/testMatch\s*:\s*\/((?:\\.|[^/])+)\/([dgimsuvy]*)/gu)) {
    try {
      matchers.push({ file, pattern: new RegExp(match[1], match[2].replace(/[gy]/gu, "")) });
    } catch {
      // A malformed matcher is already caught when Playwright loads its config.
    }
  }
  return matchers;
});

function isRootScriptTestRegistered(file) {
  if (path.dirname(file) === "scripts" && /\.test\.mjs$/u.test(file) && rootPackage.text.includes("scripts/*.test.mjs")) {
    return true;
  }
  return rootRegistrationText.includes(file) || rootRegistrationText.includes(path.basename(file));
}

function isPackageTestRegistered(file, packageName) {
  const packageInfo = packageCommands.get(packageName);
  const fromPackage = file.slice(packageName.length + 1);
  if (packageInfo.text.includes(fromPackage) || packageInfo.text.includes(path.basename(file))) return true;
  const extension = path.extname(file);
  const expectedGlob = `test/*.test${extension}`;
  return path.dirname(fromPackage) === "test" && packageInfo.text.includes(expectedGlob);
}

function isE2eRegistered(file) {
  const basename = path.basename(file);
  if (defaultPlaywrightEnabled && !defaultIgnoredSpecs.has(basename)) return true;
  if (rootRegistrationText.includes(file) || rootRegistrationText.includes(basename)) return true;
  if (playwrightSources.some(({ source }) => source.includes(basename))) return true;
  return configuredTestMatchers.some(({ pattern }) => pattern.test(basename));
}

function registrationKind(file) {
  if (under(file, "scripts") && /\.test\.(?:c?js|mjs|tsx?)$/u.test(file)) {
    return isRootScriptTestRegistered(file) ? "root-script" : "";
  }
  for (const packageName of packageCommands.keys()) {
    if (under(file, `${packageName}/test`)) {
      return isPackageTestRegistered(file, packageName) ? `${packageName}-test` : "";
    }
  }
  if (under(file, "e2e") && /\.spec\.(?:c?js|mjs|tsx?)$/u.test(file)) {
    return isE2eRegistered(file) ? "playwright" : "";
  }
  return "";
}

const registeredTests = new Map(testFiles.map((file) => [file, registrationKind(file)]));
const failures = [];
for (const [file, kind] of registeredTests) {
  if (!kind) failures.push(`unregistered test entry: ${file}`);
}

const supportDirectories = ["backend/test", "e2e", "host/test", "play/test", "site/test"];
const supportFiles = new Set(allFiles.filter((file) => {
  if (testFilePattern.test(file) || /(?:^|\/)README\.md$/iu.test(file)) return false;
  return supportDirectories.some((directory) => under(file, directory)) || under(file, "scripts/fixtures");
}));

function existingFile(candidate) {
  const possibilities = [
    candidate,
    `${candidate}.js`,
    `${candidate}.mjs`,
    `${candidate}.json`,
    path.join(candidate, "index.js"),
    path.join(candidate, "index.mjs")
  ];
  return possibilities.find((file) => fs.existsSync(file) && fs.statSync(file).isFile()) || "";
}

function packageRootFor(file) {
  const packageName = [...packageCommands.keys()].find((name) => under(file, name));
  return packageName ? path.join(root, packageName) : root;
}

function resolveLiteral(from, literal) {
  const cleaned = literal.split(/[?#]/u)[0];
  if (!cleaned || /^(?:[a-z]+:|#|\/)/iu.test(cleaned) || cleaned.includes("${")) return "";
  const fromAbsolute = path.join(root, from);
  const bases = cleaned.startsWith(".")
    ? [path.dirname(fromAbsolute)]
    : [root, packageRootFor(from), path.dirname(fromAbsolute)];
  for (const base of bases) {
    const found = existingFile(path.resolve(base, cleaned));
    if (!found) continue;
    const resolved = relative(found);
    if (!resolved.startsWith("../")) return resolved;
  }
  return "";
}

function stringLiterals(source) {
  return [...source.matchAll(/["'`]([^"'`\r\n]+)["'`]/gu)].map((match) => match[1]);
}

function localImports(source) {
  const patterns = [
    /\bfrom\s*["']([^"']+)["']/gu,
    /\bimport\s*["']([^"']+)["']/gu,
    /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/gu
  ];
  const codePositions = new Uint8Array(source.length);
  let state = "code";
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (state === "code") {
      codePositions[index] = 1;
      if (character === "'" || character === '"' || character === "`") state = character;
      else if (character === "/" && next === "/") state = "line-comment";
      else if (character === "/" && next === "*") state = "block-comment";
      continue;
    }
    if (state === "line-comment" && character === "\n") state = "code";
    else if (state === "block-comment" && character === "*" && next === "/") {
      index += 1;
      state = "code";
    } else if ((state === "'" || state === '"' || state === "`") && character === "\\") {
      index += 1;
    } else if (character === state) {
      state = "code";
    }
  }
  return patterns.flatMap((pattern) => (
    [...source.matchAll(pattern)]
      .filter((match) => codePositions[match.index])
      .map((match) => match[1])
  ));
}

function localUrlReferences(source) {
  return [...source.matchAll(/new\s+URL\s*\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)/gu)]
    .map((match) => match[1]);
}

const reachableSupport = new Set();
const pending = [...registeredTests.entries()].filter(([, kind]) => kind).map(([file]) => file);
for (const runnerSupport of ["backend/test/hooks.mjs", "e2e/global-setup.mjs"]) {
  if (!supportFiles.has(runnerSupport)) continue;
  const registrations = `${rootRegistrationText}\n${[...packageCommands.values()].map(({ text }) => text).join("\n")}\n${playwrightSources.map(({ source }) => source).join("\n")}`;
  if (registrations.includes(runnerSupport) || registrations.includes(`./${runnerSupport.slice(runnerSupport.indexOf("/") + 1)}`)) {
    reachableSupport.add(runnerSupport);
    pending.push(runnerSupport);
  }
}

const inspected = new Set();
while (pending.length) {
  const file = pending.pop();
  if (inspected.has(file) || !textFilePattern.test(file)) continue;
  inspected.add(file);
  const source = read(file);
  for (const literal of stringLiterals(source)) {
    const resolved = resolveLiteral(file, literal);
    if (!resolved || !supportFiles.has(resolved) || reachableSupport.has(resolved)) continue;
    reachableSupport.add(resolved);
    pending.push(resolved);
  }
}

for (const file of [...supportFiles].sort()) {
  if (!reachableSupport.has(file)) failures.push(`unreachable test support file: ${file}`);
}

for (const file of [...testFiles, ...supportFiles].sort()) {
  if (!textFilePattern.test(file)) continue;
  const source = read(file);
  for (const specifier of localImports(source)) {
    if (!specifier.startsWith(".")) continue;
    if (!resolveLiteral(file, specifier)) failures.push(`broken local test import: ${file} -> ${specifier}`);
  }
  for (const reference of localUrlReferences(source)) {
    if (!reference.startsWith(".")) continue;
    if (!resolveLiteral(file, reference)) failures.push(`broken local test file reference: ${file} -> ${reference}`);
  }
  const lowerSource = source.toLowerCase();
  for (const marker of retiredTestMarkers) {
    if (lowerSource.includes(marker)) failures.push(`retired feature marker "${marker}" remains in ${file}`);
  }
}

if (failures.length) {
  const uniqueFailures = [...new Set(failures)];
  console.error(`test reachability failed (${uniqueFailures.length}):`);
  uniqueFailures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log(
  `test reachability passed: ${testFiles.length} registered entries; ${reachableSupport.size}/${supportFiles.size} support files reachable`
);
