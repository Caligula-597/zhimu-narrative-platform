# 架构与端口审视

最后更新：2026-06-26

## 结论

当前核心业务框架可继续生产化：Fastify + PostgreSQL 的领域边界清楚，Railway fullstack 承载主应用和 API，玩家端/主持端/官网按 Cloudflare Pages 分域。主要风险不在“业务模型”，而在部署闭环、端口约束和多前端共享层。

## 端口表

| 端口 | 服务 | 当前状态 | 风险 |
|---|---|---|---|
| `4180` | Fastify API | `backend/src/server.js`，监听 `0.0.0.0` | 本地防火墙/旧进程会影响 Vite proxy 与 smoke |
| `4173` | 根目录 Vite dev | `config/vite.config.mjs`，`strictPort: true` | 与 `npm run start:dist` 共用端口，最容易冲突 |
| `4173` | 根目录静态 dist server | `server.js --dist` | 仅托管静态文件，不代理 `/api`，不要当完整本地生产替代 |
| `5174` | 玩家端 Vite | `play/vite.config.mjs` | 配置未写 `strictPort`，CI 已用命令行补；本地建议补参数 |
| `5175` | 主持端 Vite | `host/vite.config.mjs`，`strictPort: true` | 需要文档与链接持续指向 host 域 |
| `7890` | Clash 代理 | 只用于 GitHub/外网命令 | 不应写进应用配置 |

## 生产拓扑核对

| 域名 | 当前标准 | 仍需补齐 |
|---|---|---|
| `app.getzhimu.com` | Railway fullstack：主应用 + `/api` | 已有 deploy workflow，但部署后依赖真实 secrets 通过生产可信门槛 |
| `play.getzhimu.com` | Cloudflare Pages：`play/` | 已接入 Pages deploy workflow，需配置 Cloudflare secrets |
| `host.getzhimu.com` | Cloudflare Pages：`host/` | 已接入 Pages deploy workflow，需配置 Cloudflare secrets |
| `getzhimu.com` | Cloudflare Pages：`site/` | 已接入 Pages deploy workflow，需配置 Cloudflare secrets |

## 框架问题

### P0：Pages 三站 CI/CD 已接入，等待 secrets 验证

Railway workflow 只部署 `app.getzhimu.com`。现在新增 `.github/workflows/pages-deploy.yml`，负责 `site/play/host` 的构建、Cloudflare Pages deploy 和部署后 smoke。

仍需确认 GitHub Secrets：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### P1：多前端共享层不足

主应用、玩家端、主持端分别维护 UI、状态和路由。短期可接受，长期会导致登录态、错误展示、按钮/表单行为重复修。

建议：

- 抽出 `shared/api`：错误映射、session restore、fetch 包装。
- 抽出 `shared/ui-tokens`：颜色、spacing、按钮尺寸、表单控件标准。
- 对玩家端/主持端保留独立业务视图，不强行合并应用。

### P1：本地端口体验易混乱

`4173` 同时承担 Vite dev 和静态 dist；`play` 默认可自动换端口；旧进程残留会让测试连错服务。

建议：

- 文档统一写 `play` 本地命令为 `npm run dev -- --port 5174 --strictPort`。
- 已新增 `scripts/port-doctor.mjs` 检查 `4173/4180/5174/5175` 占用与服务类型。
- UI smoke/E2E 启动前打印实际 URL 和健康检查来源。

### P1：生产门槛已落地，但真实 secret 仍需人工配置

代码已强制 CSP enforce、OTLP、alert webhook、AV strict；但是本地 `backend/.env` 当前缺真实生产值时，`railway:sync-env` 会失败。

必须补：

- `ALERT_WEBHOOK_URL`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `UPLOAD_SCAN_WEBHOOK_URL` 或 `UPLOAD_SCAN_CLAMAV_HOST`

### P2：文档历史版本多

旧 Alpha/Beta 文档保留了当时的评估数字和待办，容易与当前标准冲突。

建议：

- 当前真相源固定为：`README.md`、`ARCHITECTURE.md`、`SECURITY_AND_TESTING.md`、`docs/PRODUCT_STATUS_ZH.md`、`docs/ops/*`。
- 历史文档顶部加“历史参考，以当前真相源为准”。

## 当前不建议改的点

- 不建议把玩家端和主持端并回主应用。三端分域对权限、首屏体验和移动端玩家体验更清楚。
- 不建议把 SSE 立刻换成 WebSocket。当前事件日志 + SSE + PostgreSQL NOTIFY 已满足运行闭环。
- 不建议绕过 Railway fullstack 改成 API/Web 双服务。当前单服务减少 CORS 和部署复杂度，适合作为主应用生产形态。
