# 织幕后端 vs 成熟运维 / SaaS 基线对标

> 对照对象：Kubernetes 健康探针、Datadog/Grafana/Sentry、Stripe 式 API、SOC2 审计型 B2B SaaS、Cloudflare/AWS 边缘安全。  
> **织幕当前阶段**：Alpha → Beta 过渡；强项在**业务域完整性**，弱项在**可观测与自动化运维**。

---

## 总览矩阵

| 能力域 | 成熟 SaaS 期望 | 织幕现状 | 评级 |
|--------|----------------|----------|------|
| 健康检查 | liveness + readiness + 依赖项 | `/health/live` + `/health/ready` + DB/池 | ✅ 达标 |
| 配置与密钥 | 密钥管理、环境分离、禁止明文入库 | `.env` + 启动 FATAL 守卫 | 🟡 可用 |
| API 契约 | OpenAPI + 入参 schema + 统一错误体 | Fastify schema + `/api/openapi.json` + `{ error, code }` | ✅ 达标 |
| 身份与权限 | RBAC、审计、最小权限 | Session + 世界/房间角色 + host_audit_log | 🟡 缺导出/UI |
| 限流与滥用 | 网关/WAF + per-IP/per-user | 生产 Fastify 限流 | 🟡 单节点 |
| 幂等与一致性 | 写操作 Idempotency-Key | `write_idempotency` + 房间级幂等 | ✅ 较好 |
| 可观测性 | Metrics + Logs + Traces + 告警 | `/metrics` + JSON 日志 + Trace ID；告警文档 | ✅ Beta 可用 |
| 事件与实时 | 多实例 fan-out、至少一次投递 | journal + SSE + Postgres NOTIFY | 🟡 Beta 可用 |
| 数据保护 | 备份、PITR、迁移门禁 | 迁移 + CI schema + [备份 Runbook](./ops/BACKUP.md) | 🟡 托管 PITR 推荐 |
| 上传安全 | 扫描、转码、隔离 | MIME + 扩展名 + webhook 扫描钩子 | 🟡 默认关闭 |
| 部署 | 容器、滚动发布、回滚 | 文档 + dist 静态；无 Helm | 🔲 缺 |
| 合规 | SOC2 审计轨迹、数据保留策略 | 部分表有 audit；无保留策略 | 🔲 缺 |

**图例**：✅ 已达 Alpha/Beta 门槛 · 🟡 有基础需加强 · 🔲 尚未开始

---

## 我们做得好的（可对外说）

1. **运行域 API 质量高** — 玩家/主持/checkpoint/restore/幂等/SSE 有 E2E 测试（**341** 项后端单测 + **15** 项 Playwright，CI 强制）。
2. **错误模型统一** — 注册表 + 前端 friendly 映射；schema 400 先于业务层。
3. **多实例 SSE 有务实方案** — journal 为真相源 + NOTIFY 扇出，不依赖 Redis 也能水平扩展 API。
4. **连接池事故已复盘** — checkpoint 快照单 client，readiness 检测池饱和。
5. **创作写 API schema 全覆盖** — `check:schemas` **61 条**门禁；规则 POST/PUT 含语义校验。

---

## 与上市运维软件比，还缺什么（按优先级）

### P0 — Beta 上线前建议有

| 缺口 | 对标产品/实践 | 建议 |
|------|---------------|------|
| **结构化指标** | Datadog、Prometheus | `/metrics`：请求延迟、5xx 率、池 waiting、SSE 连接数 |
| **集中式日志** | ELK、Loki、CloudWatch | JSON 日志 + `X-Request-Id` / `X-Trace-Id`；见 [ops/LOGGING.md](./ops/LOGGING.md) |
| **备份与恢复 Runbook** | RDS PITR、Supabase backup | [ops/BACKUP.md](./ops/BACKUP.md) + `npm run db:backup` |
| **OpenAPI 导出** | Stripe、Twilio | `GET /api/openapi.json`（开发环境 `/api/docs` UI） |
| **story-assistant 写路由 schema** | 同上 | DeepSeek / 母稿写路由已挂 schema（**43 条** `check:schemas`） |

### P1 — 生产 SaaS 常见

| 缺口 | 说明 |
|------|------|
| 告警与 On-call | PagerDuty/Opsgenie 对接 5xx、ready 失败、池饱和 | [ops/ALERTING.md](./ops/ALERTING.md) + `prometheus-alerts.yml` |
| 分布式追踪 | OpenTelemetry → Jaeger/Tempo | Trace ID 透传 + [ops/TRACING.md](./ops/TRACING.md) |
| WAF / DDoS | Cloudflare 或 API Gateway 前置 | [ops/SECURITY_EDGE.md](./ops/SECURITY_EDGE.md) |
| 密钥轮换 | 不用 `.env` 明文；Secrets Manager | [ops/SECURITY_EDGE.md](./ops/SECURITY_EDGE.md) |
| 审计日志导出 | `host_audit_log` 只读 API（运维角色） | `GET /api/ops/audit-log` + `GET /api/ops/status` + `OPS_API_TOKEN` |
| 上传病毒扫描 | ClamAV 或云扫描 webhook | `UPLOAD_SCAN_MODE=webhook` + 单测 |
| Redis 事件总线 | NOTIFY 吞吐不足时升级 | [SECURITY_EDGE.md](./ops/SECURITY_EDGE.md) |
| 远程/局域网测试 | 不仅 localhost | [REMOTE_TESTING.md](./ops/REMOTE_TESTING.md) |

### P2 — 规模化 / 合规

| 缺口 | 说明 |
|------|------|
| SLI/SLO 与错误预算 | 可用性目标、发布门禁 |
| 多区域 / DR | 主动-被动或只读副本 |
| SOC2 控制映射 | 访问审查、数据保留、变更记录 |
| 速率限制 per-user | 当前偏 per-IP/路由 |

---

## 不必盲目照搬的

- **完整 K8s 服务网格**：Alpha 阶段 Postgres NOTIFY + 2 实例 API 足够。
- **微服务拆分**：单体 Fastify + 模块化 routes 更符合当前团队规模。
- **前端框架先行**：backend schema 与搜索 API 稳定后再迁 React/Vue。

---

## 创作 API Schema 全覆盖状态（2026-06-03）

| 模块 | 写/改路由 | Schema |
|------|-----------|--------|
| `studio-routes.js` | 场景/线索/调查点/物品/版本/边 | ✅ |
| `studio-graph-routes.js` | 布局/锚点/删节点/删边 | ✅ |
| `creator-routes.js` | 角色/章节/分幕/房间/文档 | ✅ |
| `rules-routes.js` | CRUD + validate-body | ✅ |
| `content-package-routes.js` | preview/import/新世界 | ✅ |
| `story-assistant-routes.js` | DeepSeek/母稿同步 | ✅ |
| `world-routes.js` | 成员 CRUD、delete world | ✅ |

验证：`cd backend && npm run check:schemas`

---

## 相关文档

- [BACKEND_OPS.md](./BACKEND_OPS.md) — 实施路线图
- [OPS.md](./OPS.md) — 部署清单
- [PROJECT_STATUS.md](./PROJECT_STATUS.md) — 项目检查点
