# 织幕架构总览

最后更新：2026-07-16

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
| `routes/schemas/` | 14 个领域 schema；`routes/schemas.js` 只做兼容导出 |
| `repositories/` / `services/` | 查询、事务和领域服务边界；复杂新路由不得继续堆进 route |
| `auth.js` / `session-cookie.js` | Session、guest、HttpOnly cookie |
| `rule-engine.js` | 结构化规则执行，禁止用户 JS |
| `room-event-bus.js` / `postgres-event-listener.js` | SSE + PostgreSQL NOTIFY 多实例事件总线与重连 |
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

Creator、Player、Host、Site 均使用 Vite 8。Creator/Host/Player 已共用 `shared/api-client.js`、session/auth、错误映射、SSE client/lifecycle、游标、toast、安全 DOM、trace 和 web-vitals；认证、401、断线恢复不再维护三份。业务视图继续按角色独立，UI 只在复用收益明确时抽取。

已完成的大入口收敛：`world-helpers.js` 为 6 行兼容 barrel，`player-routes.js` 为 9 行注册器，原 2200+ 行 schema 已拆为 14 个领域文件，`play/src/main.js` 为 412 行启动编排入口。当前结构债务不是“大文件尚未拆”，而是 68 个路由模块仍有 143 个路由层直接数据库调用点；`npm run check:architecture` 作为单调递减门禁。

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

- Pages 三站部署、预览和 lockfile installability 已进入 CI/CD；本轮发布候选长验收在第 1/3 轮隔离测试失败，修复后还需补齐 E2E、性能、恢复和真实环境证据。
- `4173` 同时用于 Vite dev 与静态 dist，容易残留进程占端口。
- staging 真实 Bearer P95/P99、应用镜像回滚、R2 恢复和实际 RPO/RTO 尚不能由代码门禁替代。
- 文档历史版本较多，所有当前标准应以 `docs/PROJECT_STATUS.md`、README、ARCHITECTURE、SECURITY_AND_TESTING、docs/ops 为准。
