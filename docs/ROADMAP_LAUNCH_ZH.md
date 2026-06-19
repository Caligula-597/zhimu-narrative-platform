# 上市路线图（后端优先 · 分 Part 推进）

> 官方示例：创作者上传并通过审核的模板剧本（`OFFICIAL_EXAMPLE_WORLD_ID`）。  
> **商业上线任务分级**见 [LAUNCH_PRIORITIES_ZH.md](./LAUNCH_PRIORITIES_ZH.md)（P0–P3，与 Part 编号互补）。

## 工程标准

- **拆分**：业务逻辑放 `backend/src/*.js`，路由按域分文件（如 `ops-catalog-routes.js`），禁止单文件堆叠 unrelated 功能。
- **测试**：每个 Part 新增/变更 API 必须有 `backend/test/*.test.js`；合并前 `npm run verify:changed`。
- **安全**：后端改动触发 `npm audit --audit-level=high`；Ops 路由统一 `OPS_API_TOKEN`。
- **推送**：verify 通过后自动 commit + `npm run git:push`（不含 `.env`）。

## Part 进度

| Part | 名称 | 后端状态 | 说明 |
|------|------|----------|------|
| 0 | 边界冻结 | 文档 | 定位、三用户、不做什么 |
| 1 | 权限与成员元数据 | **完成** | `membership-labels.js`、中文 403、`GET /worlds` enrich |
| 2 | 官方示例 + 首次路径 | **部分完成** | `OFFICIAL_EXAMPLE_WORLD_ID`、`/api/platform/official-example`、onboarding strip；见 P0-01～03 |
| 3 | 创作者闭环 | **完成** | 向导 bootstrap、模板库、发布前检查、公开库就绪门槛 |
| 4 | 主持工作流 | 待做 | 事件上下文 payload |
| 5 | 运营审核 | **完成** | `GET/POST /api/ops/catalog/reviews/*` |
| 6 | 官网内测 | **完成** | 内测申请、Ops 审批、`GET /api/platform/site` 整站 bootstrap |
| 7 | 法务运维 | 待做 | 监控、上线 checklist |
| 8 | 玩家端 | **大部分完成** | 独立 `play/` 子域（5174）；广场/好友/私信/游戏内 SSE；P0-04～05 移动与错误态待收口 |

## Part 5 · Ops 公开库审核 API

环境变量：`OPS_API_TOKEN`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ops/catalog/reviews?limit=&offset=` | 待审列表 |
| POST | `/api/ops/catalog/reviews/:worldId/approve` | 通过上架 |
| POST | `/api/ops/catalog/reviews/:worldId/reject` | body: `{ "note": "拒审说明" }` |

请求头：`x-ops-token: <OPS_API_TOKEN>`

CLI：`node backend/scripts/approve-catalog-world.mjs <worldId>`（需 pending 状态）

详见 [ops/CATALOG_REVIEW.md](./ops/CATALOG_REVIEW.md)。

## Part 2 · 官方示例 API

环境变量：`OFFICIAL_EXAMPLE_WORLD_ID`（公开库已上架剧本的 UUID）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/platform/official-example` | 示例是否可用、7 分钟路径步骤、worldId |
| POST | `/api/platform/official-example/join` | 一键加入官方示例（等同 catalog/join） |

生产示例：在 Railway / Supabase 环境变量中设置你的模板剧本 ID（如已通过审核的「123」）。

## Part 3 · 发布前检查与导入说明

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/worlds/:worldId/publish-readiness` | 结构化检查项 + `readyForPlaytest` / `readyForCatalog` |
| GET | `/api/worlds/:worldId/creator-checks` | 兼容旧前端；含 `checks` + `summary` |
| GET | `/api/platform/import-guide` | 导入格式、模式、会/不会生成什么 |
| GET | `/api/platform/world-templates` | 内置剧本骨架模板列表 |
| POST | `/api/worlds/wizard/bootstrap` | 向导一键创建：世界+角色+分幕+规则+测试房 |
| POST | `/api/worlds/from-template/:templateId` | 从模板创建世界（可覆盖 name/summary 等） |

公开库申请（`POST /api/worlds/:id/catalog/request`）会在提交前校验 `readyForCatalog`；未通过时返回 `CATALOG_READINESS_BLOCKED` 及缺失项列表。

## Part 6 · 官网内测申请

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/platform/beta` | 表单配置、角色选项、`acceptingApplications` |
| POST | `/api/platform/beta/apply` | 提交内测申请（限流 5 次/小时/IP） |

Ops 审核见 [ops/BETA_APPLICATIONS.md](./ops/BETA_APPLICATIONS.md)。官网代码约定目录：`site/`（同仓子项目，待宣发开工）。

## Part 6 · 官网 bootstrap API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/platform/site` | 整站 bootstrap：链接、内测、官方示例、公开库预览 |
| GET | `/api/platform/catalog-preview` | 公开库预览（无需登录） |
| GET | `/api/platform/beta` | 内测表单配置 |
| POST | `/api/platform/beta/apply` | 提交内测申请 |
