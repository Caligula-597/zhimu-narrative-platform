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
| 自动化 | 后端模块/schema/boot/单测；UI smoke；Playwright Chromium/Firefox/WebKit 矩阵 |

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
```

Playwright 默认按 `chromium,firefox,webkit` 跑。临时缩小矩阵：

```powershell
$env:PLAYWRIGHT_BROWSERS="chromium"
npm run test:e2e
```

## 仍需关注的架构问题

1. Railway workflow 只覆盖 `app.getzhimu.com`，`site/play/host` 的 Pages 部署还没有纳入同一条 GitHub Actions 发布门禁。
2. 本地端口较多，`4173` 最容易与 Vite dev / dist server 冲突。
3. `play` 默认 Vite 配置没有写死 `strictPort`，CI 命令已补 `--strictPort`，本地也建议显式加。
4. 三个前端应用共享 API，但 UI 组件与设计 token 仍有重复，后续应抽出共享包或明确复制边界。
