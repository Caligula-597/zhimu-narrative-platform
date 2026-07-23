# 织幕

织幕是面向线上长线剧本杀 / 跑团的自动化叙事与运营平台。项目采用 PostgreSQL + Fastify 作为唯一后端真相源，前端分为创作者主应用、玩家端、主持端与官网，并通过同一组 `/api` 能力运行。

## 当前生产标准

| 类别 | 当前标准 |
|---|---|
| 后端 | `backend/` Fastify 5 + PostgreSQL；生产只用真实数据库，不提供 SQLite 兼容模式 |
| 主应用 | 根目录 Vite 应用，生产由 Railway fullstack 镜像同域托管 |
| 玩家端 | `play/` Vite 应用，本地 `5174`，生产目标 `play.getzhimu.com` |
| 主持端 | `host/` Vite 应用，本地 `5175`，生产目标 `host.getzhimu.com` |
| 官网 | `site/` Vite 应用，生产目标 `getzhimu.com` |
| 生产门槛 | CSP enforce、真实 OTLP、告警 webhook、上传 AV strict + webhook/ClamAV、OPS token、metrics token |
| 自动化 | 14 项定期快审；领域契约/SSE/Auth/Trusted Types 门禁；隔离 DB ×3 + 关键 E2E + 性能/恢复证据工作流 |

关键文档：

- [架构总览](./ARCHITECTURE.md)
- [架构与端口审视](./docs/ARCHITECTURE_PORT_AUDIT_ZH.md)
- [安全与测试](./SECURITY_AND_TESTING.md)
- [产品状态](./docs/PRODUCT_STATUS_ZH.md)
- [分域部署](./docs/ops/SPLIT_DOMAINS.md)
- [生产环境变量](./docs/ops/LAUNCH_ENV.md)
- [监控告警](./docs/ops/MONITORING_SETUP.md)
- [上传 AV strict](./docs/ops/UPLOAD_SCAN.md)

## 本地启动

```powershell
cd backend
npm run dev                 # API: http://localhost:4180

cd ..
npm run dev                 # 主应用: http://localhost:4173, /api 代理到 4180

cd play
npm run dev -- --port 5174 --strictPort

cd ../host
npm run dev                 # 主持端: http://localhost:5175
```

注意：`node server.js --dist` 只是根目录静态 dist 托管，默认也用 `4173`，不代理 `/api`。要测完整产品流，优先使用 Vite dev 或生产 fullstack。

## 生产部署

当前生产拓扑是分域：

| 域名 | 托管 | 内容 |
|---|---|---|
| `app.getzhimu.com` | Railway fullstack | 主应用 + `/api` |
| `play.getzhimu.com` | Cloudflare Pages | 玩家端 |
| `host.getzhimu.com` | Cloudflare Pages | 主持端 |
| `getzhimu.com` | Cloudflare Pages | 官网 |

Railway env 生成入口：

```powershell
npm run railway:sync-env
```

现在该命令会强制检查生产门槛。缺少 `ALERT_WEBHOOK_URL`、`OTEL_EXPORTER_OTLP_ENDPOINT`、`UPLOAD_SCAN_WEBHOOK_URL` 或 `UPLOAD_SCAN_CLAMAV_HOST` 时会直接失败。

## 验证

常用验证：

```powershell
cd backend
npm run check
npm run check:schemas
npm run check:boot
npm test

cd ..
npm run check:modules
npm run build
npm run test:e2e
npm run check:production-ready
npm run monitoring:smoke -- --alerts
npm run audit:periodic
npm run test:sse-matrix
npm run test:auth-matrix
npm run test:trusted-types
npm run test:release-gates
```

Playwright 默认按 `chromium,firefox,webkit` 跑。临时缩小矩阵：

```powershell
$env:PLAYWRIGHT_BROWSERS="chromium"
npm run test:e2e
```

## 仍需关注的架构问题

1. 后端 69 个路由模块的直接数据库调用点已经归零并由门禁禁止回升；下一阶段审计 service/repository 内部查询往返、索引、连接池占用和事务边界。
2. Creator/Host/Player 已统一认证、错误、游标和 SSE lifecycle，但 UI 组件与业务视图仍有合理重复，应按复用收益继续收敛。
3. 本地端口较多，`4173` 最容易与 Vite dev / dist server 冲突；使用 `npm run port:doctor` 排查。
4. 真正未完成的是运行证据：staging 真实 Bearer P95/P99、应用镜像回滚、R2 恢复和实际 RPO/RTO。

## 新增发布与诊断

Cloudflare Pages 三站已接入 `.github/workflows/production-release.yml`。本地可先跑：

```powershell
npm run pages:smoke
npm run port:doctor
```
