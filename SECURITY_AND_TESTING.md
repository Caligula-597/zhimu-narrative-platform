# 安全与测试收口

最后更新：2026-06-26

## 当前安全基线

| 类别 | 当前状态 |
|---|---|
| Demo header | 生产禁止 `ALLOW_DEMO_USER_HEADER=true`，启动校验会拒绝 |
| Session | HttpOnly cookie + session revocation；Bearer token 仍兼容测试与 E2E |
| CORS | 由 `CORS_ORIGIN`、`PLAY_SITE_ORIGIN`、`HOST_SITE_ORIGIN`、`MARKETING_SITE_ORIGIN` 推导 |
| CSP | 生产 env 强制 `CSP_MODE=enforce`；不再以 report-only 作为生产标准 |
| 上传 | MIME/扩展名策略 + `UPLOAD_SCAN_MODE=strict` + webhook 或 ClamAV |
| Observability | OpenTelemetry Node SDK + OTLP HTTP exporter；Prometheus `/metrics`；alert webhook |
| OPS | `/api/ops/*` 需要 `OPS_API_TOKEN`；`/metrics` 建议设置 `METRICS_TOKEN` |
| Rate limit | auth/read/write/upload/AI 独立限流 |
| Schema | 写路由必须有 Fastify JSON schema；`npm run check:schemas` 动态扫描 |

## 生产可信门槛

部署后必须通过：

```powershell
npm run check:production-ready
npm run monitoring:smoke -- --alerts
```

`check:production-ready` 会检查 `/api/health/ready`，并用 `OPS_API_TOKEN` 拉 `/api/ops/status` 的 `productionTrust`：

1. Session cookies + revocation
2. CSP enforcement
3. Upload malware scan
4. OpenTelemetry export
5. Alert webhook
6. API rate limits
7. OPS token gate

缺任一项即失败。

## 自动化测试矩阵

以后数字以命令输出为准，不再手工维护“绝对总数”。当前本地统计：

| 命令 | 用途 |
|---|---|
| `cd backend && npm run check` | 后端模块语法、路径、依赖图 |
| `cd backend && npm run check:schemas` | 写路由 schema 门禁 |
| `cd backend && npm run check:boot` | 启动配置、数据库 schema、模块图 |
| `cd backend && npm run check:tests` | 后端测试数量下限 |
| `cd backend && npm test` | 后端单元/集成测试 |
| `npm run check:modules` | 前端模块加载 |
| `npm run build` | 根目录主应用构建 |
| `node scripts/ui-smoke.js` | 前端源级/UI smoke |
| `npm run test:play` | 玩家端构建和单测 |
| `npm run test:host` | 主持端构建和单测 |
| `npm run test:e2e` | Playwright 端到端，默认三浏览器 |

Playwright 当前按 `chromium,firefox,webkit` 生成项目：

```powershell
npx playwright test --list
```

如本地临时只跑 Chromium：

```powershell
$env:PLAYWRIGHT_BROWSERS="chromium"
npm run test:e2e
```

## CI / CD

`.github/workflows/ci.yml`：

- 安装 Chromium、Firefox、WebKit。
- 构建前端、迁移/seed、后端全套检查。
- 启动 `4180` API、`4173` 主应用、`5174` 玩家端后跑 smoke/E2E。

`.github/workflows/railway-deploy.yml`：

- 部署 Railway fullstack。
- 部署后执行 `check:production-ready`。
- 执行 `monitoring:smoke -- --alerts`，验证 metrics 和告警 webhook。

缺口：`site/play/host` 的 Cloudflare Pages 发布和 smoke 还没有进入统一 GitHub Actions。详见 [架构与端口审视](./docs/ARCHITECTURE_PORT_AUDIT_ZH.md)。

## 本地端口注意

| 端口 | 用途 |
|---|---|
| `4180` | API |
| `4173` | 主应用 Vite 或静态 dist |
| `5174` | 玩家端 |
| `5175` | 主持端 |

`4173` 同时被 Vite 和 `server.js --dist` 使用，跑测试前确认没有旧进程残留。
