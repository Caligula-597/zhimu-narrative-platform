#!/usr/bin/env node
/**
 * One-shot Railway setup: single fullstack service (API + frontend).
 *
 * 1. Copy .env.railway.setup.example → .env.railway.setup
 * 2. Paste RAILWAY_ACCOUNT_TOKEN (https://railway.com/account/tokens)
 * 3. npm run railway:bootstrap
 *
 * Requires: Node 18+ with fetch. Does NOT need Railway CLI installed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  deployService,
  getProject,
  listProjects,
  updateServiceInstance,
  upsertVariables
} from "./railway-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const setupPath = path.join(root, ".env.railway.setup");
const FULLSTACK_DOCKERFILE = "deploy/Dockerfile.fullstack";

function loadSetup() {
  const env = { ...process.env };
  if (fs.existsSync(setupPath)) {
    for (const line of fs.readFileSync(setupPath, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!env[k]) env[k] = v;
    }
  }
  return env;
}

function pickProductionEnv(project) {
  const envs = (project.environments?.edges ?? []).map((e) => e.node);
  return envs.find((e) => e.name === "production") ?? envs[0];
}

function pickService(services, { id, nameHint, excludeNames = [] }) {
  const list = (services?.edges ?? [])
    .map((e) => e.node)
    .filter((s) => !excludeNames.some((n) => new RegExp(`^${n}$`, "i").test(s.name)));
  if (id) {
    const found = list.find((s) => s.id === id);
    if (found) return found;
  }
  if (nameHint) {
    const hint = nameHint.toLowerCase();
    const byName = list.find((s) => s.name.toLowerCase().includes(hint));
    if (byName) return byName;
  }
  return list[0] ?? null;
}

async function main() {
  const env = loadSetup();
  const token = env.RAILWAY_ACCOUNT_TOKEN?.trim() || env.RAILWAY_TOKEN?.trim();
  if (!token) {
    console.error(`
缺少 RAILWAY_ACCOUNT_TOKEN 或 RAILWAY_TOKEN。

1. Account Token：https://railway.com/account/tokens → Create Token
2. 复制 .env.railway.setup.example → .env.railway.setup
3. 填入 RAILWAY_ACCOUNT_TOKEN=...
4. npm run railway:bootstrap

免费版通常没有 Project Token；部署走 Railway 连 GitHub 或本机 railway login。
`);
    process.exit(1);
  }

  let projectId = env.RAILWAY_PROJECT_ID?.trim();
  if (!projectId) {
    const projects = await listProjects(token);
    if (!projects.length) throw new Error("账号下没有 Railway 项目");
    const match =
      projects.find((p) => /zhimu|narrative|getzhimu/i.test(p.name))
      ?? projects.find((p) => /beautiful-unity|production/i.test(p.name))
      ?? projects[0];
    projectId = match.id;
    console.log(`[bootstrap] 使用项目: ${match.name} (${projectId})`);
  }

  const project = await getProject(token, projectId);
  const production = pickProductionEnv(project);
  if (!production) throw new Error("项目没有 environment");

  const serviceEdges = project.services;
  const webService = (serviceEdges?.edges ?? []).map((e) => e.node).find((s) => /^web$/i.test(s.name));

  const apiService = pickService(serviceEdges, {
    id: env.RAILWAY_API_SERVICE_ID || env.RAILWAY_SERVICE_ID,
    nameHint: env.RAILWAY_API_SERVICE_NAME || "zhimu",
    excludeNames: ["web"]
  });
  if (!apiService) throw new Error("找不到 API 服务 — 在 .env.railway.setup 设置 RAILWAY_API_SERVICE_ID");

  const publicUrl = (env.APP_PUBLIC_URL || "https://app.getzhimu.com").replace(/\/$/, "");

  console.log(`[bootstrap] 配置 fullstack 构建 (${FULLSTACK_DOCKERFILE})…`);
  try {
    await updateServiceInstance(token, {
      serviceId: apiService.id,
      environmentId: production.id,
      input: { dockerfilePath: FULLSTACK_DOCKERFILE }
    });
  } catch (err) {
    console.warn(`[bootstrap] API 设置 dockerfilePath 失败: ${err.message}`);
    console.warn("  请在 Railway → Settings → Build 手动确认：Root Directory 留空，Dockerfile = deploy/Dockerfile.fullstack");
  }

  console.log("[bootstrap] 同步并推送环境变量…");
  const { spawnSync } = await import("node:child_process");
  const sync = spawnSync(process.execPath, [path.join(root, "scripts", "sync-railway-env.mjs")], {
    cwd: root,
    stdio: "inherit"
  });
  if (sync.status !== 0) process.exit(sync.status ?? 1);

  const railwayEnvPath = path.join(root, ".env.railway");
  const railwayEnv = {};
  for (const line of fs.readFileSync(railwayEnvPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    railwayEnv[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^"|"$/g, "");
  }

  await upsertVariables(token, {
    projectId,
    environmentId: production.id,
    serviceId: apiService.id,
    variables: {
      ...railwayEnv,
      APP_PUBLIC_URL: publicUrl,
      CORS_ORIGIN: publicUrl,
      SERVE_STATIC: "true",
      STATIC_ROOT: "/app/public/dist"
    },
    skipDeploys: true
  });

  if (env.RAILWAY_DEPLOY !== "false") {
    console.log("[bootstrap] 触发 fullstack 部署…");
    try {
      await deployService(token, { serviceId: apiService.id, environmentId: production.id });
    } catch (err) {
      console.warn("[bootstrap] 部署触发失败:", err.message);
    }
  }

  console.log(`
✅ Railway fullstack 配置完成

服务: ${apiService.name} (${apiService.id})
公网: ${publicUrl}
镜像: ${FULLSTACK_DOCKERFILE}（API + 前端同域）

${webService ? `⚠️  检测到多余 web 服务 (${webService.name}) — 请在 Railway 删除以省 Hobby 额度` : ""}

你必须在 Railway 控制台确认（API 无法改 Root Directory 时）：
  1. zhimu-narrative-platform → Settings → Build
     - Root Directory：**留空**（不要填 backend）
     - Dockerfile：**deploy/Dockerfile.fullstack**
  2. Networking → Custom Domain：**app.getzhimu.com**（应用域，非营销根域）
  3. 等 Deployments 构建完成（日志应有 npm run build + Static frontend enabled）
  4. Cloudflare Pages 绑定 getzhimu.com → site/ 营销站（见 docs/ops/SPLIT_DOMAINS.md）

验收：
  https://app.getzhimu.com/api/health/ready → "ready": true
  https://app.getzhimu.com/ → 织幕应用（HTML）
  https://getzhimu.com/ → 营销官网（HTML）
  npm run monitoring:smoke

GitHub Actions 部署（可选，需 Project Token）见 docs/ops/MANUAL_SETUP_CHECKLIST.md
`);
}

main().catch((err) => {
  console.error("[bootstrap] 失败:", err.message);
  process.exit(1);
});
