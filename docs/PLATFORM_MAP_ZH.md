# 织幕 · 平台总览与前后端对照

> **本文档**：产品模块规划 + 后端能力 + 前端入口 + API 客户端方法的一页式索引。  
> **更新**：2026-06-18 · 测试 **341** 项 · 迁移 **033**  
> **系统设计**：[DESIGN_ZH.md](./DESIGN_ZH.md) · **维护约定**：新 API 或新视图时同步更新 §3 对照表

---

## 1. 产品模块（用户旅程）

```
账号 / 身份 ──► 选剧本（世界）──► 创作 ──► 编排 ──► 规则 ──► 开平行房 ──► 运行（主持/玩家）──► 存档/复盘
     │              │                │        │       │          │                    │
  游客/OAuth     剧本库/协作      创作者台   剧情编排  自动化    邀请码 join          checkpoint + recap
  设备/session   成员/邀请        资产/AI    线索图谱  幂等执行   SSE 实时           跨房 restore
```

| 模块 | 用户价值 | 前端入口 | 后端域 |
|------|----------|----------|--------|
| **身份** | 登录、游客、OAuth、多设备 | 头像 → 账号与会话 | `auth-routes` · `capabilities` |
| **世界** | 剧本 CRUD、协作、公开库 | 侧栏剧本切换 · 世界设置 | `world-routes` |
| **创作** | 角色/章节/分幕、版本、文档 | 创作者工作台 `writer` | `creator-routes` |
| **编排** | 场景/线索/调查/图谱 | 剧情编排 `studio` · 线索 `clues` | `studio-routes` · `studio-graph-routes` |
| **规则** | 自动/主持确认/手动 | 自动化规则 `rules` | `rules-routes` · `rule-engine` |
| **运行房** | 平行房、invite、进度隔离 | 总览 · 平行房 · 主持台 · 玩家 · **play/** | `player-routes` · `host-routes` |
| **实时** | SSE 事件、语音 | 主持台/玩家自动连接 | `room-events-routes` · `voice-routes` |
| **存档** | 快照、分域回滚 | 主持台 · 存档视图 `archive` | `checkpoint-routes` |
| **复盘** | 结构化报告 | `archive` | `recap-routes` |
| **资产** | R2 上传、回收站 | 内容资产 `assets` | `asset-routes` |
| **AI** | DeepSeek 提案/流水线 | 创作者台 · Pipeline 向导 | `story-assistant-routes` |
| **导入导出** | 内容包 JSON | 创作者台 | `content-package-routes` |

**账号 vs 世界设置（勿混）**

| 页面 | 路径/入口 | 内容 |
|------|-----------|------|
| **账号设置** | 侧栏 **账号设置** `account` | 套餐配额、OAuth 诊断、设备、退出 |
| **账号与会话（快捷）** | 右上角 **头像** → `openAccountPanel()` | 与账号设置相同能力的弹窗入口 |
| **世界设置** | 侧栏 **世界设置** `settings` | 世界名/简介、剧本库公开、运行房选项、删剧本 |

---

## 2. 部署架构（当前）

| 层 | 方案 | 说明 |
|----|------|------|
| **应用** | Railway **单服务** fullstack | `deploy/Dockerfile.fullstack`：Fastify 同域 `/api` + 静态前端 |
| **数据库** | Supabase Postgres | `DATABASE_URL` pooler |
| **对象存储** | Cloudflare R2 | 资产签名上传 |
| **DNS** | Cloudflare | 营销 `getzhimu.com`（Pages）+ 应用 `app.getzhimu.com`（Railway） |

**剧本与示例**：平台能力与世界 ID 解耦。CI 用固定测试桩 UUID；生产官方示例用 `OFFICIAL_EXAMPLE_WORLD_ID`。详见 [WORLDS_AND_FIXTURES_ZH.md](./WORLDS_AND_FIXTURES_ZH.md)、[FRONTEND_README_ZH.md](./FRONTEND_README_ZH.md)。
| **邮件** | Resend | 验证/重置密码 |

详见 [ops/DEPLOY.md](./ops/DEPLOY.md) · [ops/MANUAL_SETUP_CHECKLIST.md](./ops/MANUAL_SETUP_CHECKLIST.md)

---

## 3. 后端 ↔ 前端对照表

图例：**视图** = 主要 UI；**client** = `src/api/client.js` · `zhimuApi.*`；**状态** = ✅ 已接 · 🟡 部分 · 🔲 无 UI

### 3.1 身份与账号

| 后端 API | client 方法 | 前端入口 | 状态 |
|----------|-------------|----------|------|
| `POST /auth/register` | `register` | 登录弹窗 · 注册 | ✅ |
| `POST /auth/login` | `login` | 登录弹窗 | ✅ |
| `POST /auth/guest` | `createGuest` | join 前 `ensurePlayerSession` | ✅ |
| `POST /auth/upgrade` | `upgradeGuest` | 账号面板 · 游客升级 | ✅ |
| `GET /auth/me` | `me` | `auth-session.js` 头像 | ✅ |
| `GET /auth/sessions` | `listSessions` | 账号面板 · 设备列表 | ✅ |
| `DELETE /auth/sessions/:id` | `revokeSession` | 账号面板 | ✅ |
| `POST /auth/logout-all` | `logoutAllDevices` | 账号面板 | ✅ |
| `POST /auth/logout` | `logout` | 账号面板 | ✅ |
| `GET /auth/config` | `getAuthConfig` | OAuth 按钮 · OAuth 诊断 | ✅ |
| `POST /auth/oauth/*/start-url` | `oauthStartUrl` | 登录/账号 · OAuth | ✅ |
| `POST /auth/oauth/complete` | `completeOAuth` | `app.js` ?oauth_code= | ✅ |
| `POST /auth/forgot-password` | `requestPasswordReset` | 忘记密码 | ✅ |
| `POST /auth/reset-password` | `resetPassword` | ?reset= | ✅ |
| `POST /auth/verify-email` | `verifyEmail` | ?verify= | ✅ |
| `POST /auth/resend-verification` | `resendVerification` | 验证待办弹窗 | ✅ |
| `POST /worlds/invites/accept` | `acceptWorldInvite` | `app.js` ?invite= · 账号设置 | ✅ |
| `GET /account/entitlements` | `getAccountEntitlements` | 账号设置 · 头像弹窗配额 | ✅ |
| `GET /account/plans` | — | 公开套餐列表 | 🟡 |
| `GET /storage/usage` | `getStorageUsage` | 账号设置 · 资产页 | ✅ |

权限门槛：`backend/src/capabilities.js` · 详 [IDENTITY_AND_PERMISSIONS.md](./IDENTITY_AND_PERMISSIONS.md)

### 3.2 世界与协作

| 后端 API | client 方法 | 前端 | 状态 |
|----------|-------------|------|------|
| `GET/POST /worlds` | `getWorlds` · `createWorld` | 剧本库 · 向导 | ✅ |
| `GET/PATCH/DELETE /worlds/:id` | `getWorld` · `patchWorld` · `deleteWorld` | 世界设置 | ✅ |
| `GET /worlds/catalog` | `getWorldCatalog` | 公开剧本库 | ✅ |
| `PATCH /worlds/:id/catalog` | `patchWorldCatalog` | 世界设置 · 公开开关 | ✅ |
| `POST /worlds/:id/catalog/join` | `joinWorldCatalog` | 剧本库 · 体验 | ✅ |
| `GET/POST/PUT/DELETE .../members` | `getWorldMembers` 等 | 创作者台 · 协作 | ✅ |
| `POST/DELETE .../invites/:id` | `resendWorldInvite` · `revokeWorldInvite` | 协作弹窗 | ✅ |
| pending invites + 邮件 | `addWorldMember` | Resend 邀请邮件 | ✅ |
| `GET .../logs` | `getWorldLogs` | 创作者台 · 运行日志 | ✅ |
| `GET .../host-audit-log` | `getWorldHostAuditLog` | 世界设置 · 审计 | ✅ |
| `GET .../search` | `searchWorld` | 全局搜索 | ✅ |

### 3.3 创作与编排

| 后端 API | client 方法 | 视图 | 状态 |
|----------|-------------|------|------|
| roles/chapters/sections CRUD | `createRole` … | `writer` | ✅ |
| `GET .../creator-checks` | `getCreatorChecks` | 创作者台 · 发布检查 | ✅ |
| content-versions | `createContentVersion` … | 创作者台 · 版本 | ✅ |
| documents parse/import | `parseDocument` … | 文档导入弹窗 | ✅ |
| `GET .../studio` | `getStudio` | `studio` · `clues` | ✅ |
| scenes/clues/items/points | `createScene` … | `studio` | ✅ |
| story-edges / layout / nodes | `createStoryEdge` … | 剧情流程图 | ✅ |
| story-manuscript | `getStoryManuscript` … | 创作者台 · 母稿 | ✅ |
| story-assistant / deepseek/* | `proposeWithDeepseek` … | AI 助手 · Pipeline | ✅ |

### 3.4 规则

| 后端 API | client | 视图 | 状态 |
|----------|--------|------|------|
| rules CRUD + validate | `getRules` … | `rules` | ✅ |
| `GET .../rules/preview` | `previewRoomRules` | 主持台 | ✅ |
| `POST .../rules/:id/trigger` | `triggerManualRule` | 主持台 | ✅ |

### 3.5 运行房 · 玩家

| 后端 API | client | 视图 | 状态 |
|----------|--------|------|------|
| `GET /rooms/invite/:code` | `getRoomInvite` | join 弹窗 | ✅ |
| `POST /rooms/join` | `joinRoom` | join 弹窗 | ✅ |
| `GET .../player-home` | `getPlayerHome` | `player` · **play game** | ✅ |
| section complete | `completeSection` | `player` · **play sections** | ✅ |
| exploration / investigate | `getExploration` · `investigate` | `player` · **play explore** | ✅ |
| clues read/share/note | `readClue` … | `player` · 线索页 · **play clues** | ✅ |
| notebook | `addNotebookEntry` | `player` · **play reader** | ✅ |
| player-home `hostConfirm` | — | `player` · **play** 等待横幅 | ✅ |

### 3.6 主持

| 后端 API | client | 视图 | 状态 |
|----------|--------|------|------|
| host/players · detail | `getHostPlayers` … | `director` | ✅ |
| host-events batch/execute/delay | `getHostEvents` … | `director` | ✅ |
| `POST .../host/nudge-waiting` | `hostNudgeWaiting` | `director` 提醒模态 | ✅ |
| grant clue/item · unlock | `hostGrantClue` … | `director` | ✅ |
| clue-matrix · notes | `getHostClueMatrix` … | `director` | ✅ |
| audit-log | `getHostAuditLog` | `director` | ✅ |
| PATCH room settings | `patchRoomSettings` | 世界设置 | ✅ |

### 3.7 存档 · 复盘 · 实时 · 资产

| 后端 API | client | 视图 | 状态 |
|----------|--------|------|------|
| checkpoints CRUD/restore | `getCheckpoints` … | `director` · `archive` | ✅ |
| recaps | `getRecaps` … | `archive` · **play recap tab** | ✅ |
| SSE `/events/stream` | `streamRoomEvents` | `runtime/room-events.js` · **play/room-events.js** | ✅ |
| voice-rooms / LiveKit | `createVoiceRoom` … | `player` · 语音 | 🟡 需 LiveKit env |
| assets upload/list | `uploadAsset` … | `assets` | ✅ |
| `GET /storage/usage` | `getStorageUsage` | 账号设置 · 资产页 | ✅ |
| content-package import/export | `exportContentPackage` … | `writer` | ✅ |

### 3.8 系统 / 运维（无产品 UI）

| 后端 | 用途 |
|------|------|
| `GET /health/*` | 探活 |
| `GET /metrics` | Prometheus |
| `GET /api/ops/*` | 运维令牌 |
| `GET /api/openapi.json` | OpenAPI |

### 3.9 玩家端（`play/` · play.getzhimu.com）

| 模块 | 路径 | 说明 |
|------|------|------|
| 入房 | `views/join.js` · `?join=` | 邀请码向导 |
| 局内 | `views/game.js` | Tab：概览/语音/分幕/探索/线索/背包/复盘 |
| 局部 SSE | `runtime/patch-game.js` | 更新 tab/侧栏/横幅，保留滚动 |
| 路由 | `runtime/url.js` | `view` / `tab` / `reset` / `verify` |
| 社区 | `views/plaza.js` · `social.js` | 广场/好友/私信（需验证邮箱） |
| API | `play/src/api.js` | 与主应用同 `/api` 源 |

详 [play/README.md](../play/README.md) · [DESIGN_ZH.md §6.3](./DESIGN_ZH.md#63-玩家端playgetzhimucom)

---

## 4. 前端结构（主应用）

```
src/
  api/client.js          ← 全部 REST + SSE（对照 §3）
  runtime/
    auth-world.js        ← 登录/账号面板/join/剧本库
    auth-session.js      ← 头像/登录横幅
    data.js              ← 云端加载 + SSE 分发
    actions.js           ← data-action 路由
  views/
    account.js           ← 账号设置（配额/OAuth/设备）
    overview.js          ← 总览
    writer.js            ← 创作者
    studio.js / clues.js ← 编排
    rules.js             ← 规则
    director.js          ← 主持
    player.js            ← 玩家
    archive.js           ← 存档复盘
    assets.js            ← 资产
    settings.js          ← 世界设置（非账号）
  utils/user-messages.js ← API 错误中文
```

构建：`config/vite.config.mjs` · 生产由 Fastify `SERVE_STATIC=true` 托管 `dist/`。

---

## 5. 后端结构

```
backend/src/
  routes/           ← HTTP 路由（按域拆分，见 §3）
  capabilities.js   ← 账号能力门槛
  plans.js          ← 套餐配额（free/creator/studio/beta）
  quota-guards.js   ← 配额触顶统一校验 + details
  internal-accounts.js ← 内测账号域名/邮箱提权
  oauth-diagnostics.js ← OAuth 生产回调诊断
  world-collaboration.js ← 协作者邀请 + 邮件
  oauth-service.js  ← OAuth 流程
  world-invites.js  ← 邀请 token / 接受
  rule-engine.js    ← 规则执行
  room-event-bus.js ← SSE 扇出
  auth.js           ← Session/游客
migrations/         ← 001–023
test/*.test.js      ← **341** 项（94 文件）
scripts/
  identity-smoke.mjs
  migrate.js
deploy/Dockerfile.fullstack   ← 生产唯一镜像
```

---

## 6. 文档索引

| 文档 | 用途 |
|------|------|
| **本文 PLATFORM_MAP_ZH.md** | 总览 + 前后端对照 |
| [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) | 功能完成度 |
| [IDENTITY_AND_PERMISSIONS.md](./IDENTITY_AND_PERMISSIONS.md) | 身份权限设计 |
| [PRODUCT_STATUS_ZH.md](./PRODUCT_STATUS_ZH.md) | 中文产品现状 |
| [FEATURE_CATALOG.md](../FEATURE_CATALOG.md) | 功能细节目录 |
| [ops/DEPLOY.md](./ops/DEPLOY.md) | 部署 |
| [ops/MANUAL_SETUP_CHECKLIST.md](./ops/MANUAL_SETUP_CHECKLIST.md) | 上线清单 |
| [BACKEND_OPS.md](./BACKEND_OPS.md) | 后端运维路线 |
| [backend/docs/API_ERRORS.md](../backend/docs/API_ERRORS.md) | 错误码 |

---

## 7. 过时 / 待清理清单

| 项 | 状态 | 建议 |
|----|------|------|
| `web/Dockerfile` · `web/railway.json` | ⚠️ 双服务方案已弃用 | 保留作参考或下版删除；生产用 `deploy/Dockerfile.fullstack` |
| [ops/RAILWAY_WEB.md](./ops/RAILWAY_WEB.md) | ⚠️ 过时 | 已标 DEPRECATED，见 DEPLOY |
| `npm run railway:deploy:web` | ⚠️ 过时 | 改用 `railway:deploy`（单服务） |
| `api.getzhimu.com` 双域文档 | ⚠️ 过时 | 现 **分域**：`app.` 应用 + 根域 Pages |
| Cloudflare Pages | ✅ 营销站 | `site/` → `getzhimu.com`；勿再写「已移除」 |
| `COLLABORATOR_NOT_REGISTERED` 错误码 | 🟡 行为已变 | 现返回 `201 pendingInvite`；错误码保留兼容 |
| `GET .../members` 返回数组 | 🟡 已变 object | client 已兼容 `{ members, pendingInvites }` |
| 侧栏「世界设置」无账号块 | ✅ 已补 | 侧栏 **账号设置** + 世界设置内跳转 |
| `CLOUD_SETUP_CHECKLIST.md`（根目录） | 🟡 与 ops 重复 | 指向 MANUAL_SETUP_CHECKLIST |
| `ALPHA_*` · 旧评估文档 | 📦 归档 | 历史参考，非当前真相 |
| `createGuest` client 方法 | ✅ 已补 | 2026-06-07 修复 |

---

## 8. 下一步（产品，非部署）

| 优先级 | 项 |
|--------|-----|
| P1 | Stripe / 支付宝订阅（后端 webhook 已有，前端结账待做） |
| P2 | ~~邀请邮件 HTML 模板品牌化~~ | ✅ 2026-06 已与官网视觉统一 |
| P3 | 多节点 SSE（Redis）/ 完整 OTel SDK |

---

*生成说明：与 `IMPLEMENTATION_STATUS.md` 互补——本文侧重「在哪用、怎么对应」；实现细节与测试仍以 IMPLEMENTATION_STATUS 为准。*
