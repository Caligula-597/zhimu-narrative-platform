#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_SCAN_BYTES = 2 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set([
  ".cjs", ".css", ".env", ".example", ".html", ".js", ".json", ".jsx",
  ".md", ".mjs", ".ps1", ".sh", ".toml", ".ts", ".tsx", ".yaml", ".yml"
]);

const PREFIXES = [
  ".github/", "backend/src/", "backend/scripts/", "backend/test/", "config/",
  "e2e/", "host/src/", "host/test/", "play/src/", "play/test/", "scripts/",
  "shared/", "site/", "src/"
];
const ROOT_FILES = new Set([
  "config.js", "docker-compose.staging.yml", "docker-compose.yml", "Dockerfile",
  "index.html", "package.json", "server.js", "wrangler.toml"
]);

const KNOWN_SECRET_PATTERNS = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/gu],
  ["openai-compatible-key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/gu],
  ["github-token", /\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/gu],
  ["slack-token", /\bxox[baprs]-[A-Za-z0-9-]{24,}\b/gu],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{30,}\b/gu],
  ["aws-access-key", /\bAKIA[0-9A-Z]{16}\b/gu],
  ["resend-api-key", /\bre_[A-Za-z0-9]{24,}\b/gu]
];

const LITERAL_SECRET_RE = /(?:\b(?:const|let|var)\s+|\bprocess\.env\.)([A-Z][A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)[A-Z0-9_]*)\s*=\s*["'`]([^"'`\r\n]{12,})["'`]/gu;
const DATABASE_CREDENTIAL_RE = /\bpostgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@[^\s/]+/giu;
const SAFE_LITERAL_HINT = /(?:example|placeholder|replace[-_ ]?me|test[-_ ]?only|dummy|fake|sample|your[-_ ]|changeme|not[-_ ]?configured|must[-_ ]?not[-_ ]?be[-_ ]?used|^x+$|^\*+$|\$\{)/iu;

function lineNumber(text, index) {
  let lines = 1;
  for (let offset = 0; offset < index; offset += 1) {
    if (text.charCodeAt(offset) === 10) lines += 1;
  }
  return lines;
}

function pushMatches(findings, text, detector, pattern) {
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    findings.push({ detector, line: lineNumber(text, match.index ?? 0) });
  }
  pattern.lastIndex = 0;
}

export function scanTextForSecrets(text, { includeGeneric = true } = {}) {
  const findings = [];
  for (const [detector, pattern] of KNOWN_SECRET_PATTERNS) {
    pushMatches(findings, text, detector, pattern);
  }
  if (!includeGeneric) return findings;

  LITERAL_SECRET_RE.lastIndex = 0;
  for (const match of text.matchAll(LITERAL_SECRET_RE)) {
    const variableName = match[1] || "";
    const value = match[2] || "";
    if (variableName.startsWith("DUMMY_") || SAFE_LITERAL_HINT.test(value)) continue;
    findings.push({ detector: `literal-${variableName.toLowerCase()}`, line: lineNumber(text, match.index ?? 0) });
  }
  LITERAL_SECRET_RE.lastIndex = 0;
  DATABASE_CREDENTIAL_RE.lastIndex = 0;
  for (const match of text.matchAll(DATABASE_CREDENTIAL_RE)) {
    const value = match[0] || "";
    if (/replace_me|\$\{|@(?:localhost|127\.0\.0\.1|\[?::1\]?|postgres)(?::|\/|$)/iu.test(value)) continue;
    findings.push({ detector: "database-url-with-password", line: lineNumber(text, match.index ?? 0) });
  }
  DATABASE_CREDENTIAL_RE.lastIndex = 0;
  return findings;
}

function normalizedPath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\//u, "");
}

function inSecurityScope(relativePath) {
  if (ROOT_FILES.has(relativePath)) return true;
  if (/^(?:Dockerfile|docker-compose[^/]*\.ya?ml|\.env(?:\..*)?\.example)$/iu.test(relativePath)) return true;
  return PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

function isTextCandidate(relativePath) {
  if (/package-lock\.json$|pnpm-lock\.yaml$|yarn\.lock$/iu.test(relativePath)) return false;
  const basename = path.basename(relativePath);
  return basename.startsWith(".env") || TEXT_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
}

function repositoryFiles() {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
  );
  if (result.status !== 0) throw new Error(result.stderr || "git ls-files failed");
  return result.stdout.split("\0").map(normalizedPath).filter(Boolean);
}

function readTextFileWithinBudget(absolutePath) {
  let descriptor;
  try {
    descriptor = fs.openSync(absolutePath, "r");
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.size > MAX_SCAN_BYTES) return null;
    return fs.readFileSync(descriptor, "utf8");
  } catch {
    return null;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

export function auditRepositorySecrets() {
  const findings = [];
  let scanned = 0;
  for (const relativePath of repositoryFiles()) {
    if (!inSecurityScope(relativePath) || !isTextCandidate(relativePath)) continue;
    const absolutePath = path.join(root, relativePath);
    const text = readTextFileWithinBudget(absolutePath);
    if (text === null) continue;
    if (text.includes("\0")) continue;
    scanned += 1;
    const isTestFile = /(?:^|\/)(?:test|tests|fixtures)(?:\/|$)|\.test\.[^.]+$/u.test(relativePath);
    for (const finding of scanTextForSecrets(text, { includeGeneric: !isTestFile })) {
      findings.push({ path: relativePath, ...finding });
    }
  }
  return { scanned, findings };
}

function main() {
  const result = auditRepositorySecrets();
  if (result.findings.length) {
    console.error(`secret exposure audit failed: ${result.findings.length} suspected credential(s)`);
    for (const finding of result.findings) {
      console.error(`  ${finding.path}:${finding.line}  ${finding.detector}`);
    }
    console.error("Move credentials to environment variables, revoke exposed values, then rerun this check.");
    process.exit(1);
  }
  console.log(`secret exposure audit: OK (${result.scanned} repository text files)`);
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (entry === import.meta.url) main();
