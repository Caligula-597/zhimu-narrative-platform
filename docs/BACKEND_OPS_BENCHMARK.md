# 后端运维基准

最后更新：2026-06-26

## 当前基准

| 能力 | 当前状态 |
|---|---|
| API 框架 | Fastify 5，按领域拆路由 |
| 数据库 | PostgreSQL，迁移脚本 + schema/boot 检查 |
| 认证 | Session、HttpOnly cookie、OAuth、guest |
| 权限 | world/room/capability guard |
| 实时 | SSE + room event journal + 可选 PostgreSQL NOTIFY |
| 上传 | R2 signed upload + AV strict |
| 观测 | metrics + OTLP + alert webhook |
| 部署 | Railway fullstack |
| 测试 | 后端测试数量以 `npm run check:tests` 为准；E2E 以 `npx playwright test --list` 为准 |

## 与生产 SaaS 的差距

| 优先级 | 差距 | 建议 |
|---|---|---|
| P0 | Pages 三站缺统一 CI/CD | 新增 Cloudflare Pages deploy workflow |
| P1 | 多前端共享层不足 | 抽 shared API/session/error/tokens |
| P1 | 端口诊断缺工具 | 新增 port doctor |
| P2 | runbook 演练不足 | 演练 DB/R2/OTLP/alert 故障 |

## 不建议立即做

- 不急于将 SSE 换成 WebSocket。
- 不急于拆 Railway API/Web 双服务。
- 不急于引 Redis，除非 PostgreSQL NOTIFY 出现明确瓶颈。
