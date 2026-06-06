#!/usr/bin/env node
/**
 * One-shot Railway setup: Web service + env vars + GitHub secret hints.
 *
 * 1. Copy .env.railway.setup.example → .env.railway.setup
 * 2. Paste RAILWAY_TOKEN (https://railway.com/account/tokens)
 * 3. npm run railway:bootstrap
 *
 * Requires: Node 18+ with fetch. Does NOT need Railway CLI installed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createService,
  deployService,
  getProject,
  listProjects,
  listServices,
  updateServiceInstance,
  upsertVariables
} from "./railway-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const setupPath = path.join(root, ".env.railway.setup");

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

function pickService(services, { id, nameHint, excludeId }) {
  const list = (services?.edges ?? []).map((e) => e.node).filter((s) => s.id !== excludeId);
  if (id) {
    const found = list.find((s) => s.id === id);
    if (found) return found;
  }
  if (nameHint) {
    const hint = nameHint.toLowerCase();
    const byName = list.find((s) => s.name.toLowerCase().includes(hint));
    if (byName) return byName;
  }
  return null;
}

async function main() {
  const env = loadSetup();
  const token = env.RAILWAY_ACCOUNT_TOKEN?.trim() || env.RAILWAY_TOKEN?.trim();
  if (!token) {
    console.error(`
缺少 RAILWAY_ACCOUNT_TOKEN 或 RAILWAY_TOKEN。

1. Account Token：https://railway.com/account/tokens → Create Token
2. 复制 .env.railway.setup.example → .env.railway.setup
3. 填入 RAILWAY_ACCOUNT_TOKEN=...（或 RAILWAY_TOKEN=...）
4. npm run railway:bootstrap

GitHub Actions 另需 Project Token，见 docs/ops/MANUAL_SETUP_CHECKLIST.md
`);
    process.exit(1);
  }

  let projectId = env.RAILWAY_PROJECT_ID?.trim();
  if (!projectId) {
    const projects = await listProjects(token);
    if (!projects.length) {
      throw new Error("账号下没有 Railway 项目");
    }
    const match =
      projects.find((p) => /zhimu|narrative|getzhimu/i.test(p.name))
      ?? projects.find((p) => /beautiful-unity|production/i.test(p.name))
      ?? projects[0];
    projectId = match.id;
    console.log(`[bootstrap] 使用项目: ${match.name} (${projectId})`);
    if (projects.length > 1) {
      console.log("[bootstrap] 其他项目:", projects.filter((p) => p.id !== projectId).map((p) => p.name).join(", "));
    }
  }

  const project = await getProject(token, projectId);
  const production = pickProductionEnv(project);
  if (!production) throw new Error("项目没有 environment");

  const allServices = await listServices(token, projectId);
  console.log("[bootstrap] 项目内服务:", allServices.map((s) => `${s.name} (${s.id})`).join(", ") || "(无)");

  const webByName = allServices.find((s) => /^web$/i.test(s.name));
  const serviceEdges = { edges: allServices.map((s) => ({ node: s })) };

  let apiService = pickService(serviceEdges, {
    id: env.RAILWAY_API_SERVICE_ID,
    nameHint: env.RAILWAY_API_SERVICE_NAME || "zhimu",
    excludeId: webByName?.id
  });
  if (!apiService) {
    apiService = pickService(serviceEdges, { nameHint: "narrative", excludeId: webByName?.id })
      ?? pickService(serviceEdges, { nameHint: "api", excludeId: webByName?.id })
      ?? allServices.find((s) => s.id !== webByName?.id)
      ?? null;
  }
  if (!apiService) {
    throw new Error("找不到 API 服务 — 在 .env.railway.setup 设置 RAILWAY_API_SERVICE_ID");
  }

  let webService = webByName
    ?? pickService(serviceEdges, {
      id: env.RAILWAY_WEB_SERVICE_ID,
      nameHint: env.RAILWAY_WEB_SERVICE_NAME || "web",
      excludeId: apiService.id
    });

  if (!webService) {
    console.log("[bootstrap] 创建 Web 服务…");
    try {
      webService = await createService(token, projectId, env.RAILWAY_WEB_SERVICE_NAME || "web", production.id);
    } catch (err) {
      if (!/already exists/i.test(err.message)) throw err;
      console.log("[bootstrap] Web 服务已存在，重新加载…");
      const refreshed = await listServices(token, projectId);
      webService = pickService({ edges: refreshed.map((s) => ({ node: s })) }, {
        id: env.RAILWAY_WEB_SERVICE_ID,
        nameHint: env.RAILWAY_WEB_SERVICE_NAME || "web",
        excludeId: apiService.id
      });
      if (!webService) throw new Error("Web 服务已存在但无法找到 — 请设置 RAILWAY_WEB_SERVICE_ID");
    }
  }

  const publicUrl = (env.APP_PUBLIC_URL || "https://getzhimu.com").replace(/\/$/, "");
  const apiPublic = (env.API_PUBLIC_URL || "https://api.getzhimu.com").replace(/\/$/, "");

  console.log("[bootstrap] 配置 Web 服务构建 (web/Dockerfile)…");
  const buildInputs = [
    { source: { dockerfilePath: "web/Dockerfile" } },
    { dockerfilePath: "web/Dockerfile" }
  ];
  let buildConfigured = false;
  for (const input of buildInputs) {
    try {
      await updateServiceInstance(token, {
        serviceId: webService.id,
        environmentId: production.id,
        input
      });
      buildConfigured = true;
      break;
    } catch (err) {
      console.warn(`[bootstrap] build config retry: ${err.message}`);
    }
  }
  if (!buildConfigured) {
    console.warn("[bootstrap] 无法在 API 中设置 dockerfilePath — GitHub Actions `railway up` 仍会使用 web/Dockerfile");
  }

  console.log("[bootstrap] 写入 Web 构建变量…");
  await upsertVariables(token, {
    projectId,
    environmentId: production.id,
    serviceId: webService.id,
    variables: {
      VITE_API_BASE: `${apiPublic}/api`,
      VITE_REQUIRE_AUTH: "true",
      VITE_DEMO_MODE: "false"
    },
    skipDeploys: true
  });

  console.log("[bootstrap] 更新 API CORS / 公网 URL…");
  await upsertVariables(token, {
    projectId,
    environmentId: production.id,
    serviceId: apiService.id,
    variables: {
      APP_PUBLIC_URL: publicUrl,
      CORS_ORIGIN: publicUrl
    },
    skipDeploys: true
  });

  if (env.RAILWAY_DEPLOY !== "false") {
    console.log("[bootstrap] 触发 Web 部署…");
    try {
      await deployService(token, { serviceId: webService.id, environmentId: production.id });
    } catch (err) {
      console.warn("[bootstrap] Web 部署触发失败（可稍后 push 或 Actions 部署）:", err.message);
    }
  }

  console.log(`
✅ Railway 配置完成

GitHub Secrets（Settings → Secrets → Actions）请确认已有：

  RAILWAY_TOKEN              = GitHub Secret：必须用 **Project Token**（见 MANUAL_SETUP_CHECKLIST.md）
  RAILWAY_SERVICE_ID         = ${apiService.id}   ← API
  RAILWAY_WEB_SERVICE_ID     = ${webService.id}   ← Web（新建/已存在）
  RAILWAY_PUBLIC_URL         = ${apiPublic}       ← 可选，健康检查用

本地文件 .env.railway.setup 已 gitignore，勿提交。

下一步：
  1. git push origin main  → GitHub Actions 自动部署 API + Web
  2. Railway Web 服务 → Networking → 绑定 getzhimu.com
  3. Cloudflare DNS: getzhimu.com CNAME → Railway Web 域名（停用 Pages）
  4. 删除或停用 Cloudflare Pages 项目

API 服务 ID: ${apiService.id} (${apiService.name})
Web 服务 ID: ${webService.id} (${webService.name})
`);
}

main().catch((err) => {
  console.error("[bootstrap] 失败:", err.message);
  process.exit(1);
});
