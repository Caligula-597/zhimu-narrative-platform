# 产品状态

最后更新：2026-06-26

## 总体评分

按生产级 SaaS 标准，当前项目处于“可信 Beta 末期 / 生产硬门槛落地中”：

| 维度 | 状态 |
|---|---|
| 核心业务闭环 | 已具备：创作、开房、玩家加入、阅读探索、规则推进、主持确认、存档复盘 |
| 账号与权限 | 已具备：注册/登录/游客/OAuth/session/设备管理/协作权限 |
| 玩家端 | 已具备：独立 `play/`、广场、好友/私信、局内 Tab、复盘、小游戏入口 |
| 主持端 | 主应用内已可用，独立 `host/` 已存在但还需纳入生产发布门禁 |
| OPS | 已具备：OPS 页面、生产可信七项、metrics、alert test、catalog/plaza 管理 |
| 安全 | CSP enforce、上传 AV strict、限流、HttpOnly session、schema 门禁已落地 |
| 可观测 | OpenTelemetry SDK + OTLP HTTP、Prometheus metrics、alert webhook 已接线 |
| 自动化 | 后端测试、schema、boot、UI smoke、三浏览器 Playwright 已接入 |

## 当前生产门槛

生产环境必须满足：

- `CSP_MODE=enforce`
- `UPLOAD_SCAN_MODE=strict`
- `UPLOAD_SCAN_WEBHOOK_URL` 或 `UPLOAD_SCAN_CLAMAV_HOST`
- `OTEL_ENABLED=true`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `ALERT_WEBHOOK_URL`
- `OPS_API_TOKEN`
- `METRICS_TOKEN`

`npm run railway:sync-env` 会阻断缺失配置。部署后 `npm run check:production-ready` 会阻断 `productionTrust` 未通过的发布。

## 已完成重点

| 模块 | 状态 |
|---|---|
| 公共剧本库 | 已移除旧官方示例依赖，保留当前小示例策略 |
| 小游戏闭环 | 后端房间小游戏状态、玩家端入口、主持/玩家基础测试已补 |
| 创作者封面 | 世界封面上传/选择/公开预览已接 |
| 资产页面 | 重复入口已收敛，资产聚焦内容管理 |
| OPS 产品化 | 生产可信七项、catalog/plaza/用户套餐能力进入 OPS |
| 完整审视页面 | 世界审视/发布门槛/可信状态加强 |
| 生产可信 | CSP、OTEL、alert、AV strict、跨浏览器门槛已落地 |

## 当前主要风险

| 优先级 | 风险 | 处理建议 |
|---|---|---|
| P0 | `play/host/site` Pages 部署已进入 CI/CD | 等 GitHub Cloudflare secrets 实际跑通 |
| P1 | 多前端共享层薄 | 抽 `shared-api`、`shared-ui-tokens`，减少三端重复 |
| P1 | 本地端口易混 | 增加 port doctor；文档统一 strictPort 命令 |
| P1 | 真实生产 secret 未填时无法推 env | 按 LAUNCH_ENV 补 OTLP、alert、AV webhook/ClamAV |
| P2 | 历史文档过多 | 历史文档保留，但以 README/ARCHITECTURE/ops 文档为准 |

## 验收命令

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

## 下一步

1. 配置 GitHub `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 并观察 Pages workflow 首次发布。
2. 抽取共享 API/session/error 层。
3. 补真实生产 OTLP、alert webhook、AV scanner 配置并重新推 Railway env。
