#!/usr/bin/env node
/**
 * Push backend/.env → Railway API service variables (via GraphQL).
 * Also syncs Web VITE_* and triggers redeploy.
 *
 * Token: .env.railway.setup → RAILWAY_ACCOUNT_TOKEN or RAILWAY_TOKEN
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  deployService,
  getProject,
  listProjects,
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

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function pickProductionEnv(project) {
  const envs = (project.environments?.edges ?? []).map((e) => e.node);
  return envs.find((e) => e.name === "production") ?? envs[0];
}

async function main() {
  const setup = loadSetup();
  const token = setup.RAILWAY_ACCOUNT_TOKEN?.trim() || setup.RAILWAY_TOKEN?.trim();
  if (!token) {
    console.error("railway-push-env: 缺少 RAILWAY_ACCOUNT_TOKEN（.env.railway.setup）");
    process.exit(1);
  }

  const sync = spawnSync(process.execPath, [path.join(root, "scripts", "sync-railway-env.mjs")], {
    cwd: root,
    stdio: "inherit",
    env: process.env
  });
  if (sync.status !== 0) process.exit(sync.status ?? 1);

  const railwayEnv = parseEnvFile(path.join(root, ".env.railway"));
  const keys = Object.keys(railwayEnv);
  if (!keys.length) {
    console.error("railway-push-env: .env.railway 为空");
    process.exit(1);
  }

  let projectId = setup.RAILWAY_PROJECT_ID?.trim();
  if (!projectId) {
    const projects = await listProjects(token);
    const match =
      projects.find((p) => /zhimu|narrative|getzhimu|beautiful-unity/i.test(p.name)) ?? projects[0];
    if (!match) throw new Error("找不到 Railway 项目");
    projectId = match.id;
    console.log(`[push-env] 项目: ${match.name}`);
  }

  const project = await getProject(token, projectId);
  const production = pickProductionEnv(project);
  if (!production) throw new Error("无 production environment");

  const services = (project.services?.edges ?? []).map((e) => e.node);
  const apiService =
    services.find((s) => s.id === setup.RAILWAY_API_SERVICE_ID)
    ?? services.find((s) => /zhimu|narrative|platform/i.test(s.name))
    ?? services.find((s) => s.name !== "web");
  const webService =
    services.find((s) => s.id === setup.RAILWAY_WEB_SERVICE_ID)
    ?? services.find((s) => /^web$/i.test(s.name));

  if (!apiService) throw new Error("找不到 API 服务");

  const apiPublic = (setup.API_PUBLIC_URL || "https://api.getzhimu.com").replace(/\/$/, "");

  console.log(`[push-env] API 服务 ${apiService.name} ← ${keys.length} 变量…`);
  await upsertVariables(token, {
    projectId,
    environmentId: production.id,
    serviceId: apiService.id,
    variables: railwayEnv,
    skipDeploys: true
  });

  if (webService) {
    console.log(`[push-env] Web 服务 ${webService.name} ← VITE_*…`);
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
  }

  const projectToken = setup.RAILWAY_PROJECT_TOKEN?.trim()
    ?? parseEnvFile(path.join(root, "backend", ".env")).RAILWAY_PROJECT_TOKEN?.trim();

  if (projectToken) {
    console.log("[push-env] 检测到 RAILWAY_PROJECT_TOKEN，更新 GitHub Secret…");
    const gh = spawnSync(
      "gh",
      ["secret", "set", "RAILWAY_TOKEN", "--body", projectToken, "-R", "Caligula-597/zhimu-narrative-platform"],
      {
        cwd: root,
        stdio: "inherit",
        shell: process.platform === "win32",
        env: { ...process.env, HTTP_PROXY: process.env.HTTP_PROXY || "http://127.0.0.1:7890", HTTPS_PROXY: process.env.HTTPS_PROXY || "http://127.0.0.1:7890" }
      }
    );
    if (gh.status !== 0) {
      console.warn("[push-env] GitHub Secret 更新失败 — 请手动在网页改 RAILWAY_TOKEN");
    }
  } else {
    console.warn("[push-env] 未找到 RAILWAY_PROJECT_TOKEN — GitHub Actions 仍需 Project Token");
  }

  console.log("[push-env] 触发 API 重新部署…");
  try {
    await deployService(token, { serviceId: apiService.id, environmentId: production.id });
  } catch (err) {
    console.warn("[push-env] API deploy:", err.message);
  }

  if (webService) {
    console.log("[push-env] 触发 Web 重新部署…");
    try {
      await deployService(token, { serviceId: webService.id, environmentId: production.id });
    } catch (err) {
      console.warn("[push-env] Web deploy:", err.message);
    }
  }

  console.log(`
✅ Railway 变量已推送（${keys.length} 项 → API）

API: ${apiService.id} (${apiService.name})
Web: ${webService ? `${webService.id} (${webService.name})` : "未找到"}

在 Railway 控制台查看 Deployments 是否开始构建。
`);
}

main().catch((err) => {
  console.error("[push-env] 失败:", err.message);
  process.exit(1);
});
