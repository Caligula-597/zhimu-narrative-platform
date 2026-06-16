# 上市路线图（后端优先 · 分 Part 推进）

> 官方示例：创作者上传并通过审核的模板剧本（非雾港）。玩家独立端（Part 8）后置。

## 工程标准

- **拆分**：业务逻辑放 `backend/src/*.js`，路由按域分文件（如 `ops-catalog-routes.js`），禁止单文件堆叠 unrelated 功能。
- **测试**：每个 Part 新增/变更 API 必须有 `backend/test/*.test.js`；合并前 `npm run verify:changed`。
- **安全**：后端改动触发 `npm audit --audit-level=high`；Ops 路由统一 `OPS_API_TOKEN`。
- **推送**：verify 通过后自动 commit + `npm run git:push`（不含 `.env`）。

## Part 进度

| Part | 名称 | 后端状态 | 说明 |
|------|------|----------|------|
| 0 | 边界冻结 | 文档 | 定位、三用户、不做什么 |
| 1 | 权限与成员元数据 | **进行中** | `membership-labels.js`、中文 403、`GET /worlds`  enrich |
| 2 | 官方示例 + 首次路径 | 待做 | 示例 worldId 配置、catalog join |
| 3 | 创作者闭环 | 待做 | 发布前检查 API |
| 4 | 主持工作流 | 待做 | 事件上下文 payload |
| 5 | 运营审核 | **部分完成** | `GET/POST /api/ops/catalog/reviews/*` |
| 6 | 官网内测 | 待做 | 内测申请 API |
| 7 | 法务运维 | 待做 | 监控、上线 checklist |
| 8 | 玩家端 A/B | 后置 | `/play` 或独立子域 |

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
