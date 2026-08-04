#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const includeSecurity = process.argv.includes("--security");
const startedAt = new Date();
const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
const outputDir = path.join(root, "artifacts", "periodic-checks");
const npmCommand = process.env.npm_execpath ? process.execPath : "npm";
const npmPrefixArgs = process.env.npm_execpath ? [process.env.npm_execpath] : [];

function git(...args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

const checks = [
  { name: "documentation-consistency", command: npmCommand, args: [...npmPrefixArgs, "run", "check:docs"], cwd: root },
  { name: "source-encoding", command: npmCommand, args: [...npmPrefixArgs, "run", "check:source-encoding"], cwd: root },
  { name: "innerhtml-budget", command: npmCommand, args: [...npmPrefixArgs, "run", "audit:innerhtml"], cwd: root },
  { name: "contract-drift", command: npmCommand, args: [...npmPrefixArgs, "run", "check:contracts"], cwd: root },
  { name: "world-write-contracts", command: npmCommand, args: [...npmPrefixArgs, "run", "check:world-writes"], cwd: root },
  { name: "domain-boundaries", command: npmCommand, args: [...npmPrefixArgs, "run", "check:architecture"], cwd: root },
  { name: "style-boundaries", command: npmCommand, args: [...npmPrefixArgs, "run", "check:style-boundaries"], cwd: root },
  { name: "nonfunctional-guardrails", command: npmCommand, args: [...npmPrefixArgs, "run", "audit:nonfunctional"], cwd: root },
  { name: "pages-installability", command: npmCommand, args: [...npmPrefixArgs, "run", "check:pages-installability"], cwd: root },
  { name: "bundle-budgets", command: npmCommand, args: [...npmPrefixArgs, "run", "check:bundle-budgets"], cwd: root },
  { name: "sse-fault-matrix", command: npmCommand, args: [...npmPrefixArgs, "run", "test:sse-matrix"], cwd: root },
  { name: "auth-failure-matrix", command: npmCommand, args: [...npmPrefixArgs, "run", "test:auth-matrix"], cwd: root },
  { name: "performance-tools", command: npmCommand, args: [...npmPrefixArgs, "run", "test:performance-tools"], cwd: root },
  { name: "release-gates", command: npmCommand, args: [...npmPrefixArgs, "run", "test:release-gates"], cwd: root },
  { name: "trusted-types-contract", command: npmCommand, args: [...npmPrefixArgs, "run", "test:trusted-types"], cwd: root },
  {
    name: "code-diff-whitespace",
    command: "git",
    args: ["diff", "--check", "--", "backend", "src", "host", "play", "shared", "scripts", "e2e", ".github", "package.json"],
    cwd: root
  }
];

if (includeSecurity) {
  for (const directory of [".", "backend", "host", "play", "site"]) {
    checks.push({
      name: `npm-audit-${directory === "." ? "root" : directory}`,
      command: npmCommand,
      args: [...npmPrefixArgs, "audit", "--audit-level=high", "--omit=dev"],
      cwd: path.join(root, directory)
    });
  }
}

const results = [];
for (const check of checks) {
  const checkStarted = Date.now();
  const result = spawnSync(check.command, check.args, {
    cwd: check.cwd,
    encoding: "utf8",
    env: process.env
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  results.push({
    name: check.name,
    status: result.status === 0 ? "passed" : "failed",
    exitCode: result.status ?? 1,
    durationMs: Date.now() - checkStarted,
    output: output.slice(-8000)
  });
  process.stdout.write(`${result.status === 0 ? "PASS" : "FAIL"} ${check.name}\n`);
}

const finishedAt = new Date();
const report = {
  schemaVersion: 1,
  profile: includeSecurity ? "quick-security" : "quick",
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  durationMs: finishedAt.getTime() - startedAt.getTime(),
  repository: {
    branch: git("branch", "--show-current"),
    commit: git("rev-parse", "HEAD"),
    dirtyFiles: git("status", "--short").split(/\r?\n/).filter(Boolean).length
  },
  summary: {
    passed: results.filter((item) => item.status === "passed").length,
    failed: results.filter((item) => item.status === "failed").length
  },
  results
};

fs.mkdirSync(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, `${stamp}.json`);
const markdownPath = path.join(outputDir, `${stamp}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
fs.writeFileSync(markdownPath, [
  "# 织幕定期快速审计",
  "",
  `- 时间：${report.startedAt}`,
  `- 配置：${report.profile}`,
  `- 分支 / 提交：${report.repository.branch} / ${report.repository.commit}`,
  `- 工作区变更文件：${report.repository.dirtyFiles}`,
  `- 结果：${report.summary.passed} 通过，${report.summary.failed} 失败`,
  `- 耗时：${(report.durationMs / 1000).toFixed(1)} 秒`,
  "",
  "| 检查 | 结果 | 耗时 |",
  "| --- | --- | ---: |",
  ...results.map((item) => `| ${item.name} | ${item.status === "passed" ? "通过" : "失败"} | ${(item.durationMs / 1000).toFixed(1)}s |`),
  "",
  "完整命令输出保存在同名 JSON 文件中。",
  ""
].join("\n"), "utf8");

console.log(`periodic audit log: ${path.relative(root, markdownPath)}`);
if (report.summary.failed > 0) process.exitCode = 1;
