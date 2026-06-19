# 织幕 · 产品功能与工程现状（中文总览）

> **用途**：给团队/新成员的一份「做到哪了、能用什么、不能用什么、怎么验」的**单一长文**。  
> **更新**：2026-06-18  
> **阶段**：Alpha → **Beta 过渡**（可内测，**非**生产级 SaaS）  
> **验收基准**：[SECURITY_AND_TESTING.md](../SECURITY_AND_TESTING.md) · **系统设计**：[DESIGN_ZH.md](./DESIGN_ZH.md)  
> **更细的逐项说明**：[FEATURE_CATALOG.md](../FEATURE_CATALOG.md) · **实现/缺口表**：[IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) · **交接检查点**：[PROJECT_STATUS.md](./PROJECT_STATUS.md)

---

## 目录

1. [一句话结论](#1-一句话结论)
2. [整体能力地图](#2-整体能力地图)
3. [后端：能做什么 / 不能做什么](#3-后端能做什么--不能做什么)
4. [前端：视图与健壮性](#4-前端视图与健壮性)
5. [测试体系（分层说明）](#5-测试体系分层说明)
6. [安全、运维与部署](#6-安全运维与部署)
7. [已知局限与路线图](#7-已知局限与路线图)
8. [本地启动与验收命令](#8-本地启动与验收命令)
9. [文档索引与维护约定](#9-文档索引与维护约定)

---

## 1. 一句话结论

**织幕**是面向线上长线剧本杀的自动化叙事引擎：创作者在云端写世界、编排剧情、配规则；玩家入房阅读、探索、收线索；主持台监控进度、确认事件、手动干预；数据落在 **PostgreSQL** 与 **Cloudflare R2**。

当前状态：**核心运行链路已真实可用**（任意创作者剧本 + 官方示例「小示例」均已验证），前后端主 API 已对齐，**341** 项后端测试 + **61** 条 schema 门禁 + smoke/E2E 可复验。主持—玩家联动（hostConfirm、nudge、play 复盘/SSE 局部刷新）已落地。Beta-1～4 与 **身份底座**（游客/OAuth/邮箱验证/配额/协作者邀请）已落地。**内测期免费、无充值入口**（见 [BETA_SCOPE_ZH.md](./BETA_SCOPE_ZH.md)）；Stripe 订阅等商业化能力**正式对外后再做**。

**架构原则**：功能不绑定单一剧本；见 [WORLDS_AND_FIXTURES_ZH.md](./WORLDS_AND_FIXTURES_ZH.md)。

---

## 2. 整体能力地图

| 领域 | 成熟度 | 说明 |
|------|--------|------|
| 世界/成员/平行房 | ✅ 内测可用 | 协作权限、运行日志、配额 |
| 创作（角色/分幕/编排/规则） | ✅ | 图谱 CRUD、母稿同步、内容包去重导入 |
| 运行态（阅读/探索/规则/SSE） | ✅ | 自动+主持确认+手动触发 |
| 主持台 | ✅ | 玩家表、干预、待确认、SSE |
| 存档/复盘/checkpoint restore | ✅ | scoped 回滚、跨平行房 |
| 资产 R2 | ✅ | 上传/列表/下载/回收站 |
| 全局搜索 | ✅ | `GET /worlds/:id/search` + 顶栏 UI |
| DeepSeek AI | 🟡 | 需 `DEEPSEEK_API_KEY` |
| LiveKit 语音 | ✅ | Token API + 前端连接/麦克风状态与重试 |
| 实体卡 / NFC | ❌ | 仅占位 |
| 生产 SaaS（Stripe/AV 扫描） | 🟡 | 内测免费、无前端结账；OAuth/配额 ✅；Stripe **搁置至商业化** |

**参考：测试与官方示例**

| 名称 | 说明 |
|------|------|
| CI 测试桩（勿破坏） | `TEST-FIXTURE-DEMO` · 世界 `11111111-…0001` · **非公开库** |
| 官方示例（生产） | 环境变量 `OFFICIAL_EXAMPLE_WORLD_ID` → 当前 **小示例** |
| 创作者体验 | [CREATOR_GUIDE.md](./CREATOR_GUIDE.md) 首次 3 分钟流程 |

---

## 3. 后端：能做什么 / 不能做什么

### 3.1 认证与世界

| 能力 | 状态 | 局限 |
|------|------|------|
| 注册 / 登录 / Bearer Session | ✅ | 找回密码（Resend）；**邮箱验证**（可选强制）；**OAuth** Google/GitHub |
| 游客 / 多设备 Session | ✅ | `POST /auth/guest`；设备列表与下线 |
| 套餐与配额 | ✅ | `free/creator/studio/beta`；`GET /account/entitlements` |
| 世界 CRUD、PATCH、成员角色 | ✅ | **协作者邮件邀请** + `?invite=` 接受 |
| 平行运行房、邀请码 | ✅ | 房间无合并对比视图 |
| 世界运行日志 timeline | ✅ | 无导出 |
| 全文搜索 | ✅ | 迁移 014；顶栏搜索 + **图谱/线索页跳转高亮** |
| 归档世界列表 API | ✅ | 前端可选展示 |

**调试**：本地 `ALLOW_DEMO_USER_HEADER=true` 可用固定 `x-user-id`；**生产开启会 FATAL 拒绝启动**。

### 3.2 创作与编排

| 能力 | 状态 | 局限 |
|------|------|------|
| 角色 / 章节 / 分幕 CRUD | ✅ | 玩家接口过滤草稿 |
| Studio 场景/线索/调查点/边/布局 | ✅ | |
| 剧情助手（本地启发式） | ✅ | 非 LLM |
| DeepSeek 五步创作向导（立项→逐章→逐角色→评判→同步编排） | 🟡 | 需 `DEEPSEEK_API_KEY`；见 [AI_PIPELINE_UI_ZH.md](./AI_PIPELINE_UI_ZH.md) |
| DOCX/TXT/MD 导入 | ✅ | 复杂排版可能分段不准 |
| 内容包 JSON 导入导出 | ✅ | JSON **追加**并重映射 ID；**importKey / packageSourceId 去重** | 不含二进制附件 |
| 创作版本 restore | ✅ | **仅**章节+分幕正文与发布状态 |
| 母稿 ↔ 编排同步 | ✅ | 不覆盖私人剧本 |
| 跑团/混合向导 | 🟡 | UI 有选项，实质仍剧本杀写库 |

**产品边界**：改模板**不自动**改已开运行房 → 用 **checkpoint restore** 回滚运行态。

### 3.3 规则与运行态

| 能力 | 状态 | 局限 |
|------|------|------|
| 规则 CRUD + `validateRuleBody` | ✅ | JSON 引擎，无可视化流程图执行 |
| 条件 / 动作 / 预览 / 手动触发 | ✅ | |
| 规则幂等、待确认 execute/dismiss | ✅ | |
| 玩家 join、阅读完成、调查、线索、背包 | ✅ | |
| 主持手动干预全套 | ✅ | |
| checkpoint + **scoped restore**（9 域） | ✅ | `timelineLogs` 默认不回滚 |
| 跨平行房 restore | ✅ | |
| recap 复盘 | ✅ | 无 AI 总结 |
| SSE + journal + `Last-Event-ID` | ✅ | |
| 多实例 SSE | ✅ | `ROOM_EVENTS_BUS=postgres` |
| 写操作 Idempotency-Key | ✅ | 10 条关键 POST |
| 线索私享指定玩家 | ✅ | `POST .../clues/:id/share-roles` + 玩家端公共/私享分区 |
| 主持延迟调度 UI | ✅ | `delay_until` + 主持台延迟弹窗 + 30s 到期唤醒 |

### 3.4 资产、语音、运维 API

| 能力 | 状态 | 局限 |
|------|------|------|
| R2 上传/确认/下载 URL | ✅ | 扫描 stub 模式；失败可 quarantine |
| 软删除 + 14 天 purge | ✅ | **回收站 UI 可恢复**（`?recycled=1` + restore API） |
| LiveKit Token | 🟡 | 无 env → 503 |
| 语音房文字 + 成员隔离 | ✅ | |
| `/health/live` `/health/ready` `/metrics` | ✅ | |
| OpenAPI、ops API、审计表 | ✅ | 主持台 **审计卡片** + ops token API |
| 生产限流 | ✅ | auth/write/read + **upload/AI 独立桶**；SSE 除外 |

### 3.5 有 API、无产品 UI

- `GET /api/ops/*`（运维 token）

---

## 4. 前端：视图与健壮性

**工程**：Vite 6 构建；`frontend/main.js` + `src/api/client.js`（`zhimuApi`）；仍用 `window.*` 全局（去全局化留 Beta 后）。

| 视图 | 数据诚实 | 主要能力 | 缺口 |
|------|----------|----------|------|
| 世界总览 | ✅ API/空状态 | 日志、进度、资产统计 | 部分块需手动刷新 |
| 剧本创作 writer | ✅ | 分幕 MD、版本、导入、**AI 剧本创作**（五步向导） | 实体卡占位 |
| 剧情编排 studio | ✅ | 图谱 CRUD、侧栏 PATCH | — |
| **线索管理 clues** | ✅ | 独立列表/搜索/编辑、**单条删除 + 勾选批量删除**（引用提示）、跳转编排 | 场景/调查点仍主要在编排台 |
| 内容资产 assets | ✅ | 上传/删/下载、kind Tab、搜索 | 「新建内容」占位 |
| 自动化规则 rules | ✅ | JSON + 可视化双 Tab | — |
| 主持台 director | ✅ | 玩家表、SSE、预览/触发、存档、**主持审计** | — |
| 玩家 player | ✅ | 阅读/探索/线索/笔记、**LiveKit 语音** | 依赖 env |
| 存档 archive | ✅ | checkpoint、scoped restore、recap | — |
| 设置 settings | ✅ | 世界 PATCH、旁听开关 | 实体卡占位 |
| 顶栏搜索 | ✅ | 调 search API + **跳转高亮** | — |

### 4.1 健壮性机制

| 机制 | 说明 |
|------|------|
| `friendlyApiError` + `user-messages.js` | 常见 `code` 中文说明 |
| SSE + 轮询回退 | 连接时停 15s 轮询 |
| Idempotency-Key | 写操作自动带头 |
| P0-1 数据诚实 | 已移除假玩家/假日志/假资产卡片 |
| UI smoke 局限 | **不执行浏览器内 JS**；语法靠 `check:modules` |
| XSS | 依赖 `escapeHtml` + `studioSelect`/`studioField` 转义；modal 与编排节点已加固；**非正式渗透审计** |
| 导入幂等 | AI 提案 `proposalKey`、pipeline 与 structure 去重、内容包 `importKey` | 无浏览器 E2E 覆盖组合路径 |
| 主持事件并发 | `FOR UPDATE` + 409 `HOST_EVENT_ALREADY_RESOLVED` | 极端并发仍依赖 DB 事务 |

### 4.2 内测构建

- `VITE_REQUIRE_AUTH=1 npm run build` — 正式登录路径
- 见 [ops/REMOTE_TESTING.md](./ops/REMOTE_TESTING.md)

---

## 5. 测试体系（分层说明）

**当前验收数字**（2026-06-18，与 [SECURITY_AND_TESTING.md](../SECURITY_AND_TESTING.md) 一致）：

| 门禁 | 数量 |
|------|------|
| `backend npm test` | **341** |
| `npm run check:schemas` | **61** 条路由 |
| `npm run test:smoke` | **18** |
| `node scripts/ui-smoke.js` | **44** |
| `npm run test:format-helpers` | **5** |
| `npm run test:modal-helpers` | **2** |
| `npm run check:modules` | **51** |
| `npm run test:play` | **12** |
| `npm run test:e2e` | **7** |

### 5.1 后端单元/集成（`backend npm test`）

- Node test runner，`--test-concurrency=1`（防 PG 池耗尽）。
- 约 **94** 个 `*.test.js` 文件，覆盖：认证（含 **找回密码**）、规则引擎、主持台（含 **nudge**）、player-home **hostConfirm**、checkpoint/restore E2E、线索私享、物品、SSE/NOTIFY/journal、资产策略、ops 健康、beta-gates、**register-ip-limit**、**rate-limit**、**upload-scan**、world-search 等。
- **需要**：`DATABASE_URL` + 已 migrate。

### 5.2 Schema 门禁（`check:schemas`）

- **61** 条写/改/SSE 路由必须有 Fastify JSON Schema（含 `host/nudge-waiting`、`auth/forgot-password`、`share-roles`、`host-events/:id/delay`、assets restore）。
- 规则 POST/PUT 另有语义校验 `validateRuleBody`。

### 5.3 数量与启动门禁

- `check:tests`：测试数 ≥ 100（`verify-test-count.mjs`）。
- `check:boot`：DB + 启动链。
- `check:modules`（根）：**51** 个脚本按 Vite 顺序可加载。

### 5.4 API Smoke（`test:smoke`，18 项）

- 需 `localhost:4180` + `bootstrap:local`（测试桩 seed）。
- 真实 HTTP，覆盖 health、studio、rules、player-home、checkpoint restore、recap、livekit-token 等。

### 5.5 UI Smoke（44 项）

- 读源码 + 可选 HTTP；验证模块链、接线、数据诚实不变量。
- **不能**替代 Playwright 点击流。

### 5.5b 前端纯函数测试

- `npm run test:format-helpers`（5）— `escapeHtml`、审计文案等。
- `npm run test:modal-helpers`（2）— `studioField` / `studioOptionsHtml` XSS 与选中值。

### 5.6 浏览器 E2E

- 旧「单剧本 Playwright 路线」已移除；功能验收依赖后端集成测试 + API/UI smoke。
- 可选：`npx playwright test`（`e2e/` 目录，当前无强制 spec）。

### 5.7 一键全链路

```powershell
npm run verify:full:fresh
```

含 migrate/seed、后端单测、API/UI smoke（需 DB；建议 4173+4180 已起）。

### 5.8 CI

`.github/workflows/ci.yml`：push `main` 跑 migrate/seed、backend test、format/modal helpers、前端 build、API/UI smoke（无 Playwright 强制门禁）。

---

## 6. 安全、运维与部署

| 项 | 状态 |
|----|------|
| 生产禁止 demo header 启动 | ✅ |
| HTTP 安全头、CORS、Request ID | ✅ |
| 上传 MIME + 扩展名黑名单 | ✅ |
| 生产读写/auth 限流 | ✅ |
| Postgres NOTIFY 多实例 SSE | ✅ |
| Docker 预发栈 | ✅ 见 [ops/STAGING.md](./ops/STAGING.md)（本机需 Docker/虚拟化） |
| 上传病毒扫描 / OTel SDK | 🟡 **`builtin` 魔数 + webhook/clamav/strict**；`ALERT_WEBHOOK` readiness 告警；完整 OTLP 待做 |

详见 [SECURITY_AND_TESTING.md](../SECURITY_AND_TESTING.md)、[BACKEND_OPS.md](./BACKEND_OPS.md)、[OPS.md](./OPS.md)。

---

## 7. 已知局限与路线图

### 7.1 不建议现在做的假设

- 把本项目当多租户公开 SaaS（缺 Stripe 计费、AV、完整监控）。
- 在多台 API 上只靠 memory SSE（应设 `ROOM_EVENTS_BUS=postgres`）。
- 生产环境开启 `ALLOW_DEMO_USER_HEADER`。

### 7.2 建议下一步（产品/工程）

1. 本机或 VPS 跑通 Docker 预发（[STAGING.md](./ops/STAGING.md)）；`.env.staging` 同步 Resend / LiveKit / R2 / DeepSeek Key，`APP_PUBLIC_URL` 与访问端口一致。
2. 内测包：`VITE_REQUIRE_AUTH=1` 构建 + [REMOTE_TESTING.md](./ops/REMOTE_TESTING.md)；范围见 [BETA_SCOPE_ZH.md](./BETA_SCOPE_ZH.md)。
3. **商业化后再做**：Stripe 订阅 webhook、前端结账 UI（当前刻意不提供充值入口）。
4. 工程向：实体卡/NFC 验签、生产级上传 AV（`builtin`/`clamav`/`strict` 已就绪）、OpenTelemetry SDK、可选 Redis 总线。
5. 正式静态错误页（`/errors/*`）与 MAINTENANCE_MODE 503 已提供；应用内 outage 页在 API 不可达时显示。

---

## 8. 本地启动与验收命令

```powershell
# 终端 1
cd backend
Copy-Item .env.example .env   # 本地 Demo: ALLOW_DEMO_USER_HEADER=true
npm run dev                   # :4180

# 终端 2（项目根）
npm run dev                   # :4173，/api 代理 4180
```

**收工前自检**：

```powershell
npm run verify:full:fresh
# 或分步
cd backend && npm run check:schemas && npm test && npm run test:smoke
cd .. && npm run check:modules && npm run build
```

---

## 9. 文档索引与维护约定

| 文档 | 何时看 |
|------|--------|
| **本文** `docs/PRODUCT_STATUS_ZH.md` | 功能总览、交接、对外说明草稿 |
| [PROJECT_STATUS.md](./PROJECT_STATUS.md) | 休息检查点、当前数字表 |
| [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) | 前后端未接通、风险、幂等表 |
| [FEATURE_CATALOG.md](../FEATURE_CATALOG.md) | 逐项功能 + **变更历史**（历史章节数字可能滞后） |
| [ALPHA_FEATURE_MATRIX.md](../ALPHA_FEATURE_MATRIX.md) | 真实/演示/待接入速查 |
| [SECURITY_AND_TESTING.md](../SECURITY_AND_TESTING.md) | 安全项 + 测试文件列表 |
| [RELEASE_NOTES.md](../RELEASE_NOTES.md) | 版本增量摘要 |
| [WORLDS_AND_FIXTURES_ZH.md](./WORLDS_AND_FIXTURES_ZH.md) | **测试桩 vs 官方示例、功能解耦原则** |
| [FRONTEND_README_ZH.md](./FRONTEND_README_ZH.md) | 前端模块、数据边界、构建 |
| [PLATFORM_MAP_ZH.md](./PLATFORM_MAP_ZH.md) | 前后端 API ↔ UI 对照 |
| [PROMPT_ENGINEERING.md](./PROMPT_ENGINEERING.md) | DeepSeek 分层 API 与 prompt |
| [BETA_SCOPE_ZH.md](./BETA_SCOPE_ZH.md) | 内测免费范围、无付费入口、配额人工扩容 |

**维护约定**：改验收数字时，同步更新 **PROJECT_STATUS §2**、**SECURITY_AND_TESTING 整体验收表**、**本文 §5 表**；`FEATURE_CATALOG` 工程总表（§3 前「工程与测试」）与历史 § 内快照数字可保留「当时」语义，但勿与 PROJECT_STATUS 矛盾。

---

*织幕 · 产品现状文档 · 与仓库 `main` 同步维护*
