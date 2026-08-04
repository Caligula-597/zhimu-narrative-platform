# 架构与端口审视

最后更新：2026-07-24

## 结论

当前核心业务框架可继续生产化：Fastify + PostgreSQL 的领域边界清楚，Railway fullstack 承载主应用和 API，玩家端/主持端/官网按 Cloudflare Pages 分域。Pages 三站、共享 API/Auth/SSE transport、入口拆分和生产安全门禁均已落地。全部路由模块的直接数据库调用债务已由历史 143 个递减到 0，并由架构门禁禁止回升；模块数量以 [`GENERATED_PROJECT_STATUS.json`](./GENERATED_PROJECT_STATUS.json) 为准，当前主要风险已转为领域服务内部质量，以及真实容量、恢复和回滚证据。

## 端口表

| 端口 | 服务 | 当前状态 | 风险 |
|---|---|---|---|
| `4180` | Fastify API | `backend/src/server.js`，监听 `0.0.0.0` | 本地防火墙/旧进程会影响 Vite proxy 与 smoke |
| `4173` | 根目录 Vite dev | `config/vite.config.mjs`，`strictPort: true` | 与 `npm run start:dist` 共用端口，最容易冲突 |
| `4173` | 根目录静态 dist server | `server.js --dist` | 仅托管静态文件，不代理 `/api`，不要当完整本地生产替代 |
| `5174` | 玩家端 Vite | `play/vite.config.mjs`，`strictPort: true` | 固定端口，冲突时直接失败，避免误连其它服务 |
| `5175` | 主持端 Vite | `host/vite.config.mjs`，`strictPort: true` | 需要文档与链接持续指向 host 域 |
| `7890` | Clash 代理 | 只用于 GitHub/外网命令 | 不应写进应用配置 |

## 生产拓扑核对

| 域名 | 当前标准 | 仍需补齐 |
|---|---|---|
| `app.getzhimu.com` | Railway fullstack：主应用 + `/api` | deploy workflow + productionTrust；发布后仍需 smoke |
| `play.getzhimu.com` | Cloudflare Pages：`play/` | workflow 与预览部署已验证 |
| `host.getzhimu.com` | Cloudflare Pages：`host/` | workflow 与预览部署已验证 |
| `getzhimu.com` | Cloudflare Pages：`site/` | workflow 与预览部署已验证；官网 CSP/Trusted Types 已强制 |

## 框架问题

### 已完成：Pages 三站 CI/CD 与安装门禁

`.github/workflows/production-release.yml` 负责 `site/play/host` 的不可变预览构建、Cloudflare Pages promote 和部署后 smoke；`check:pages-installability` 使用 Cloudflare 对应 npm 版本验证三份 lockfile，防止本机缓存掩盖安装漂移。

### 已完成 transport 收口，UI 继续按收益复用

A1/A2 已完成主应用三大桥清除与状态分片。Creator、Host、Player 现在共用 `api-client`、`api-fetch`、session/auth state、SSE client/lifecycle、错误映射、toast、安全 DOM、trace 与 web-vitals；登录态、401、游标和断线恢复不再维护三份。各端业务视图和布局保持独立，这是产品角色边界，不是未迁移完成。

建议：

- 不新增端内认证/SSE transport；横切能力必须先进入 `shared/`。
- 继续统一 tokens、状态语义和可复用控件，但不强行合并玩家/主持业务视图。
- 对玩家端/主持端保留独立业务视图，不强行合并应用。
- 剩余 `zhimuFormat`/`zhimuUi`/`zhimuModal` 等小桥按模块继续收口。

### P1：本地端口体验易混乱

`4173` 同时承担 Vite dev 和静态 dist；`play` 默认可自动换端口；旧进程残留会让测试连错服务。

建议：

- 文档统一写 `play` 本地命令为 `npm run dev -- --port 5174 --strictPort`。
- 已新增 `scripts/port-doctor.mjs` 检查 `4173/4180/5174/5175` 占用与服务类型。
- UI smoke/E2E 启动前打印实际 URL 和健康检查来源。

### P1：生产门槛已落地，真实运行证据继续补齐

代码已强制 CSP enforce、OTLP、alert webhook、AV strict；缺少真实值时 `railway:sync-env` 会失败。productionTrust 已有生产验证，当前不能由静态配置替代的是 staging 容量、镜像回滚、R2 恢复和实际 RPO/RTO。

### 已处理：文档历史版本多

旧 Alpha/Beta 文档保留了当时的评估数字和待办，容易与当前标准冲突。

当前已经建立 [`DOCUMENTATION_INDEX_ZH.md`](./DOCUMENTATION_INDEX_ZH.md)，把全部 Markdown 分为当前事实、产品说明、方案、运维、历史和法务材料；`npm run check:docs` 校验索引、相对链接和生成事实基线。历史记录不再通过改写旧证据来“同步”。

## 当前不建议改的点

- 不建议把玩家端和主持端并回主应用。三端分域对权限、首屏体验和移动端玩家体验更清楚。
- 不建议把 SSE 立刻换成 WebSocket。当前事件日志 + SSE + PostgreSQL NOTIFY 已满足运行闭环。
- 不建议绕过 Railway fullstack 改成 API/Web 双服务。当前单服务减少 CORS 和部署复杂度，适合作为主应用生产形态。
