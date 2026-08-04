# 织幕

最后更新：2026-07-30
工程事实基线：2026-07-24；产品与品牌维护入口更新：2026-07-30

织幕是面向线上长线剧本杀与跑团的创作、主持和玩家协作平台。PostgreSQL 是业务数据真相源，Fastify 提供统一 `/api`，Creator、Host、Player 与官网分别按使用角色部署。

## 从这里开始

- [全部文档与生命周期](./docs/DOCUMENTATION_INDEX_ZH.md)
- [产品与品牌维护总控台](./docs/PRODUCT_BRAND_MAINTENANCE_HUB_ZH.md)
- [当前项目状态](./docs/PROJECT_STATUS.md)
- [架构总览](./ARCHITECTURE.md)
- [完整产品功能与创作流程](./docs/PRODUCT_FUNCTION_OVERVIEW_DETAILED_ZH.md)
- [安全与测试](./SECURITY_AND_TESTING.md)
- [运维文档索引](./docs/ops/README.md)
- [机器生成的当前指标](./docs/GENERATED_PROJECT_STATUS.json)

文档中的数字以生成基线和实际命令输出为准。带日期的 Alpha、演练、迁移和验收记录是历史证据，不代表当前实现；蓝图、草案、计划和 backlog 不代表已经上线。

## 产品与部署边界

| 表面 | 目录 | 本地地址 | 生产地址 | 职责 |
|---|---|---|---|---|
| Creator | 根目录、`src/`、`frontend/` | `http://localhost:4173` | `https://app.getzhimu.com` | 创作、内容管理、发布准备、资产与账号 |
| Host | `host/` | `http://localhost:5175` | `https://host.getzhimu.com` | 唯一现场主持控制台 |
| Player | `play/` | `http://localhost:5174` | `https://play.getzhimu.com` | 加房、阅读、调查、线索、互动与复盘 |
| Site | `site/` | 由 Vite 分配 | `https://getzhimu.com` | 官网、产品介绍与公开入口 |
| API | `backend/` | `http://localhost:4180` | `https://app.getzhimu.com/api` | 身份、权限、内容、运行态、SSE 与运维接口 |

Creator 中的旧 Director 副本已经退役；兼容导航只能跳转到 Host，不能重新在 Creator 内实现第二套主持台。Creator、Host、Player 共享认证、错误转换、SSE lifecycle、游标、安全 DOM、trace 与 web-vitals，业务视图保持角色独立。

## 技术基线

| 领域 | 当前标准 |
|---|---|
| 运行时 | Node `24.13.x`；根与各 workspace 的 `engines` 一致 |
| 后端 | Fastify 5 + PostgreSQL 17；无 SQLite 兼容层 |
| 前端 | Vite 8 + 原生 ES Modules |
| 数据迁移 | `backend/migrations/`；当前基线见生成状态文件 |
| 对象存储 | Cloudflare R2 抽象；上传生产模式要求恶意文件扫描 |
| 实时同步 | 持久 journal/outbox + SSE + PostgreSQL LISTEN/NOTIFY + poll 补偿 |
| 安全 | 后端权限判断、HttpOnly session、CSP/Trusted Types、分桶限流、SSRF 防护 |
| 可观测 | health/readiness、metrics、OpenTelemetry、告警 webhook、结构化审计 |

当前路由层直接数据库调用点为 0。路由、schema、迁移与测试等易变化数量不在本页重复维护，统一以 [`GENERATED_PROJECT_STATUS.json`](./docs/GENERATED_PROJECT_STATUS.json) 为准。

## 本地启动

先安装 Node 24.13.x、PostgreSQL 17 与各 workspace 依赖。

```powershell
docker compose up -d postgres

cd backend
Copy-Item .env.example .env
npm ci
npm run bootstrap:local
npm run dev

cd ..
npm ci
npm run dev

cd play
npm ci
npm run dev

cd ../host
npm ci
npm run dev
```

根目录 Creator 与 Host/Player 的 `/api` 在开发模式下代理到 `4180`。`npm run start:dist` 只托管 Creator 静态产物，不代理 API，不能当作完整本地生产环境。端口混乱时运行：

```powershell
npm run port:doctor
```

## 改动后的最小验证

```powershell
npm run status:generate
npm run docs:index
npm run check:docs
npm run verify:changed
```

按改动领域追加：

```powershell
npm run check:architecture
npm run check:contracts
npm run check:world-writes
npm run check:ui-interactions
npm run test:auth-matrix
npm run test:sse-matrix
npm run test:trusted-types
npm run test:play
npm run test:host
```

完整发布候选使用隔离数据库、恢复演练、关键浏览器流程和性能证据，见 [发布恢复与回滚流程](./docs/operations/RELEASE_ROLLBACK_ZH.md)。本地静态或 Windows 结果不能替代 Ubuntu + PostgreSQL 17、真实 Bearer、托管平台回滚和 R2 恢复证据。

## 生产发布

| 域名 | 托管 |
|---|---|
| `app.getzhimu.com` | Railway fullstack（Creator + API） |
| `play.getzhimu.com` | Cloudflare Pages |
| `host.getzhimu.com` | Cloudflare Pages |
| `getzhimu.com` | Cloudflare Pages |

生产环境变量、DNS、监控、备份与回滚从 [运维索引](./docs/ops/README.md) 进入。不要从历史部署文档复制配置。

当前自动化发布入口是 `.github/workflows/production-release.yml`，数据库备份入口是 `.github/workflows/production-backup.yml`。工作流文件存在不代表当前提交已经执行通过；若暂时跳过 Actions，必须按运维文档保留直接部署 URL、烟雾测试和回滚证据。

## 当前不能省略的风险

1. GitHub Release Acceptance 的最新完整成功工件仍需取得；不能用快速矩阵代替。
2. Player 真实 Bearer 多账号 P95/P99、SSE 大并发和托管数据库容量需要在 staging 定期采样。
3. Railway 应用镜像回滚、R2 对象恢复与实际 RPO/RTO 仍需要平台级演练。
4. 商业试点可以人工陪跑，但 SLA、客户成功、订单/开通记录、案例证据和合规复核尚未达到规模化承诺标准。
5. 后端下一阶段不再机械拆 route，而是审计 service/repository 的查询往返、索引、连接池占用、锁顺序与事务边界。
