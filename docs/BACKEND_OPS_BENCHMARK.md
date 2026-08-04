# 后端运维基准

最后更新：2026-07-24

## 当前基准

| 能力 | 当前状态 |
|---|---|
| API 框架 | Fastify 5，按领域拆路由 |
| 数据库 | PostgreSQL，迁移脚本 + schema/boot 检查 |
| 认证 | Session、HttpOnly cookie、OAuth、guest |
| 权限 | world/room/capability guard |
| 实时 | SSE + journal/outbox + PostgreSQL NOTIFY；replay/live 受众投影、账号游标、慢消费者与重认证上限 |
| 上传 | R2 signed upload + AV strict |
| 观测 | metrics + OTLP + alert webhook |
| 部署 | Railway fullstack |
| 测试 | `audit:periodic` 当前 15 项（含文档一致性）；SSE/Auth/Trusted Types/发布证据专项矩阵；长验收独立产出 JSON 工件 |

## 与生产 SaaS 的差距

| 优先级 | 差距 | 建议 |
|---|---|---|
| P0 | 真实容量与恢复承诺不足 | staging Bearer P95/P99、镜像回滚、R2 恢复、实际 RPO/RTO |
| 已完成 | 全部路由模块直连 DB 为 0 | 架构门禁固定为 0；模块数量见生成基线，后续审计 service/repository 内部查询效率与事务边界 |
| 已完成 | Player supplemental 连接峰值过高 | social/session 分别收敛为单 SQL，连同 tasks 峰值约 3 个连接；章节附件按请求批量读取 |
| P1 | 业务 UI 仍有端间重复 | transport 已统一；只抽高复用控件，不合并角色视图 |
| P2 | 官网公共 fetch 未进入认证 transport | 保持独立，但纳入超时、CSP 和错误边界审计 |

## 不建议立即做

- 不急于将 SSE 换成 WebSocket。
- 不急于拆 Railway API/Web 双服务。
- 不急于引 Redis，除非 PostgreSQL NOTIFY 出现明确瓶颈。
