# 织幕架构总览

最后更新：2026-06-26

## 1. 总体形态

织幕由一个 Fastify API 和四个前端应用组成：

```text
Cloudflare Pages             Railway fullstack                 Cloudflare Pages
getzhimu.com                 app.getzhimu.com                  play.getzhimu.com
site/ 官网                   根目录主应用 + /api               play/ 玩家端

                              PostgreSQL
                              R2 object storage
                              OTLP / alerts / metrics

Cloudflare Pages
host.getzhimu.com
host/ 主持端
```

本地端口：

| 服务 | 命令 | 默认端口 |
|---|---|---|
| API | `cd backend && npm run dev` | `4180` |
| 主应用 Vite | `npm run dev` | `4173` |
| 主应用静态 dist | `npm run start:dist` | `4173` |
| 玩家端 | `cd play && npm run dev -- --port 5174 --strictPort` | `5174` |
| 主持端 | `cd host && npm run dev` | `5175` |
| Clash 代理 | 仅 GitHub/网络命令需要 | `7890` |

## 2. 数据边界

项目从第一天使用 PostgreSQL，不维护 SQLite 模式。

核心边界是“剧本模板”和“房间运行实例”分离：

| 层 | 代表表 | 说明 |
|---|---|---|
| 剧本模板 | `worlds`, `chapters`, `role_slots`, `script_sections`, `scenes`, `clues`, `items`, `automation_rules` | 作者编辑、版本化、公开库审核 |
| 运行实例 | `rooms`, `room_members`, `player_states`, `reading_progress`, `clue_ownership`, `inventory`, `rule_executions`, `timeline_logs`, `checkpoints`, `recaps` | 每次开团独立保存进度和结局 |

权限不能依赖前端隐藏。玩家可见内容由后端根据 `room_members.role_slot_id`、解锁状态和持有关系推导。

## 3. 后端框架

后端目录：`backend/src/`

| 模块 | 职责 |
|---|---|
| `app.js` | Fastify app、CORS、安全头、限流、统一错误、metrics |
| `server.js` | 启动校验、OpenTelemetry SDK、事件总线、告警 monitor、优雅关闭 |
| `routes/` | 按领域拆分 HTTP 路由 |
| `auth.js` / `session-cookie.js` | Session、guest、HttpOnly cookie |
| `rule-engine.js` | 结构化规则执行，禁止用户 JS |
| `room-event-bus.js` | SSE + 可选 PostgreSQL NOTIFY |
| `upload-scan.js` | 上传扫描，生产 strict + webhook/ClamAV |
| `ops-routes.js` | OPS 状态、生产可信七项、告警测试 |
| `static-frontend.js` | Railway fullstack 下托管主应用 dist |

## 4. 前端框架

| 应用 | 目录 | 生产域 | 说明 |
|---|---|---|---|
| 主应用 | 根目录 `src/` | `app.getzhimu.com` | 创作者、主持过渡视图、资产、OPS |
| 玩家端 | `play/` | `play.getzhimu.com` | 加房、广场、好友、私信、局内 Tab |
| 主持端 | `host/` | `host.getzhimu.com` | 独立主持监控台 |
| 官网 | `site/` | `getzhimu.com` | 营销、公开入口、内测表单 |

目前框架风险：主应用、玩家端、主持端各有自己的 Vite 配置和组件实现，共享层主要靠 API 客户端约定与少量 shared token。后续若继续扩展，应优先抽出 `shared-ui` / `shared-api` 包，避免三端重复修 bug。

## 5. 生产可信七项

OPS 页面与 `scripts/check-production-ready.mjs` 以 `productionTrust` 为准：

1. Session cookie + revocation
2. `CSP_MODE=enforce`
3. 上传 AV：`UPLOAD_SCAN_MODE=strict` 且 webhook 或 ClamAV 已配置
4. OpenTelemetry SDK 初始化成功并导出 OTLP HTTP
5. `ALERT_WEBHOOK_URL` 已配置，可通过 `/api/ops/alerts/test` 探测
6. API rate limits 全部大于 0
7. `OPS_API_TOKEN` 已配置

Railway env 同步脚本会在缺关键生产配置时失败，不再生成弱生产配置。

## 6. 当前架构/端口问题

详见 [docs/ARCHITECTURE_PORT_AUDIT_ZH.md](./docs/ARCHITECTURE_PORT_AUDIT_ZH.md)。当前优先级最高的是：

- Pages 三站部署和验收没有进入统一 CI/CD。
- `4173` 同时用于 Vite dev 与静态 dist，容易残留进程占端口。
- 本地 `play` dev 若不加 `--strictPort` 可能自动换端口，导致 E2E 或手册不一致。
- 文档历史版本较多，所有当前标准应以 README、ARCHITECTURE、SECURITY_AND_TESTING、docs/ops 为准。
