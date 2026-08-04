#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = join(root, "docs", "DOCUMENTATION_INDEX_ZH.md");
const checkOnly = process.argv.includes("--check");

const CURRENT_TRUTH = new Set([
  "README.md",
  "ARCHITECTURE.md",
  "DATABASE_SCHEMA.md",
  "SECURITY_AND_TESTING.md",
  "backend/README.md",
  "backend/docs/API_ERRORS.md",
  "docs/ARCHITECTURE_PORT_AUDIT_ZH.md",
  "docs/CODEBASE_FUNCTION_MAP_ZH.md",
  "docs/DOCUMENTATION_INDEX_ZH.md",
  "docs/DOMAIN_BOUNDARIES_ZH.md",
  "docs/FRONTEND_README_ZH.md",
  "docs/HOST_PORTAL_ZH.md",
  "docs/NONFUNCTIONAL_AUDIT_ZH.md",
  "docs/PLATFORM_MAP_ZH.md",
  "docs/PLAY_PORTAL_ZH.md",
  "docs/PRODUCT_BRAND_MAINTENANCE_HUB_ZH.md",
  "docs/PRODUCT_STATUS_ZH.md",
  "docs/PROJECT_STATUS.md",
  "docs/SSE_FAILURE_MATRIX_ZH.md",
  "docs/AUTH_FAILURE_MATRIX_ZH.md",
  "docs/UI_OVERLAY_SURFACE_AUDIT_ZH.md",
  "host/README.md",
  "play/README.md",
  "site/README.md"
]);

const ROOT_HISTORIES = new Set([
  "ALPHA_ASSESSMENT.md",
  "ALPHA_FEATURE_MATRIX.md",
  "FEATURE_CATALOG.md",
  "IMPLEMENTATION_STATUS.md",
  "RELEASE_NOTES.md",
  "design-qa.md"
]);

const sections = {
  truth: { title: "当前事实与工程入口", description: "可用于当前开发、验收和发布判断；变化时必须同步代码证据。" },
  product: { title: "产品、流程与用户指南", description: "描述产品意图、工作流和用户操作；部分页面同时包含待实现设计。" },
  proposal: { title: "方案、路线图与决策记录", description: "用于讨论和排期，不应被当成已上线承诺。" },
  operations: { title: "运维、安全与交付手册", description: "执行前仍需核对环境、密钥和平台控制台的当前状态。" },
  history: { title: "历史验收、演练与迁移记录", description: "按发生时事实保留，不用今天的数据回写过去的证据。" },
  legal: { title: "法务、软著与对外草案", description: "工程团队维护事实字段；正式对外前必须由负责人或法律顾问复核。" },
  component: { title: "组件与目录说明", description: "面向具体子应用、部署兼容层或示例目录。" }
};

function gitTrackedMarkdown() {
  const result = spawnSync("git", [
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
  if (result.status !== 0) throw new Error(result.stderr || "git ls-files failed");
  return result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function classify(file) {
  const normalized = file.replaceAll("\\", "/");
  const name = normalized.split("/").at(-1);
  if (CURRENT_TRUTH.has(normalized)) return "truth";
  if (normalized.startsWith("docs/legal/") || normalized.startsWith("软著材料/")) return "legal";
  if (
    ROOT_HISTORIES.has(normalized) ||
    /(?:^|\/).*20\d{2}-\d{2}-\d{2}.*\.md$/i.test(normalized) ||
    normalized.startsWith("优化计划/0[1-8]")
  ) return "history";
  if (
    normalized.startsWith("docs/ops/") ||
    normalized.startsWith("docs/operations/") ||
    normalized === "CLOUD_SETUP_CHECKLIST.md" ||
    normalized === "docs/BACKEND_OPS.md" ||
    normalized === "docs/BACKEND_OPS_BENCHMARK.md" ||
    normalized === "docs/OPS.md"
  ) return "operations";
  if (
    normalized.startsWith("优化计划/") ||
    /(?:PLAN|ROADMAP|DRAFT|BACKLOG|VISION|GAP|DECISIONS|PRICING|SCOPE|PRINCIPLES)/i.test(name) ||
    normalized === "FRONTEND_MODULE_PLAN.md"
  ) return "proposal";
  if (/^(?:backend|play|host|site|web|e2e|examples)\//.test(normalized)) return "component";
  return "product";
}

function titleOf(file) {
  if (file === "docs/DOCUMENTATION_INDEX_ZH.md") return "织幕文档总索引";
  const source = readFileSync(join(root, file), "utf8");
  return source.match(/^#\s+(.+)$/m)?.[1]?.trim() || file.split("/").at(-1);
}

function linkFromDocs(file) {
  const normalized = file.replaceAll("\\", "/");
  if (normalized.startsWith("docs/")) return `./${normalized.slice(5)}`;
  return `../${normalized}`;
}

function render() {
  const files = gitTrackedMarkdown();
  const grouped = Object.fromEntries(Object.keys(sections).map((key) => [key, []]));
  for (const file of files) {
    grouped[classify(file)].push({ file, title: titleOf(file) });
  }

  const lines = [
    "# 织幕文档总索引",
    "",
    "最后更新：2026-07-30",
    "工程事实基线：2026-07-24；产品与品牌维护入口更新：2026-07-30",
    "",
    "> 本页由 `npm run docs:index` 从 Git 跟踪的 Markdown 生成，确保每份现有文档都有归属。它解决“去哪找”和“能否作为当前真相”两个问题，不会把历史记录改写成今天的结论。",
    "",
    "## 使用规则",
    "",
    "1. 当前代码、架构、域名、迁移和验收状态优先看“当前事实与工程入口”以及 [`GENERATED_PROJECT_STATUS.json`](./GENERATED_PROJECT_STATUS.json)。",
    "2. 带日期的演练、Alpha、迁移和验收文档是证据快照；即使数字过期，也必须保留发生时原貌。",
    "3. 标有草案、蓝图、计划、差距或 backlog 的文档表达目标，不代表已经上线。",
    "4. 法务、隐私、条款、备案和软著材料不是法律意见；对外发布前必须人工复核。",
    "5. 改文档后运行 `npm run docs:index`、`npm run status:generate` 和 `npm run check:docs`。",
    "",
    "## 当前真相读取顺序",
    "",
    "```text",
    "README → PRODUCT_BRAND_MAINTENANCE_HUB（产品与品牌）",
    "       → PROJECT_STATUS → ARCHITECTURE / PRODUCT_STATUS",
    "       → SECURITY_AND_TESTING / NONFUNCTIONAL_AUDIT",
    "       → docs/ops/README → 具体 Runbook",
    "       → GENERATED_PROJECT_STATUS.json（易漂移数字）",
    "```",
    ""
  ];

  for (const [key, meta] of Object.entries(sections)) {
    const rows = grouped[key];
    lines.push(`## ${meta.title}（${rows.length}）`, "", meta.description, "");
    lines.push("| 文档 | 路径 |", "|---|---|");
    for (const row of rows) {
      const pathLabel = row.file.replaceAll("\\", "/");
      lines.push(`| [${row.title}](${linkFromDocs(pathLabel)}) | \`${pathLabel}\` |`);
    }
    lines.push("");
  }

  lines.push(
    "## 维护责任",
    "",
    "| 变化 | 必须同步 |",
    "|---|---|",
    "| API、迁移、领域边界 | `DATABASE_SCHEMA.md`、`backend/README.md`、架构文档、生成基线 |",
    "| Creator / Host / Player / Site 入口或职责 | `README.md`、平台地图、对应端 README |",
    "| 部署、域名、环境变量、恢复流程 | `docs/ops/README.md` 与对应 Runbook |",
    "| 产品流程、页面结构、术语 | 产品总览、Creator/Host/Player 指南与蓝图状态 |",
    "| 产品定位、品牌口径、视觉与宣发 | `PRODUCT_BRAND_MAINTENANCE_HUB_ZH.md`、官网与当前宣发材料 |",
    "| 安全、SSE、登录、Trusted Types | 安全总览、专项矩阵、非功能审计 |",
    "| 实际演练或线上事故 | 新增带日期记录，不覆盖旧证据 |",
    ""
  );
  return lines.join("\n");
}

const rendered = render();
if (checkOnly) {
  const current = readFileSync(outputPath, "utf8");
  if (current !== rendered) {
    console.error("Documentation index is stale. Run: npm run docs:index");
    process.exit(1);
  }
  console.log("documentation index current");
} else {
  writeFileSync(outputPath, rendered, "utf8");
  console.log(`Generated ${relative(root, outputPath)}`);
}
