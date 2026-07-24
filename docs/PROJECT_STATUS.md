# 项目状态

最后更新：2026-07-24

事实基线：`main` / 文档更新开始时提交 `9b39783`。易变化数字见 [`GENERATED_PROJECT_STATUS.json`](./GENERATED_PROJECT_STATUS.json)，文档归属见 [文档总索引](./DOCUMENTATION_INDEX_ZH.md)。

## 一句话结论

织幕已经达到可由小规模真实团队试用、需要人工支持的可信 Beta；核心产品闭环与主要工程边界已成立，但仍不能把“本地静态门禁通过”表述为“大规模商用 SaaS 已完成”。发布候选缺少同一提交上的官方全流程成功工件，真实容量、平台回滚、R2 恢复、RPO/RTO 与商业交付体系仍是上线风险。

## 当前系统边界

| 领域 | 当前事实 |
|---|---|
| 产品表面 | Creator、Host、Player、Site 四端；Host 是唯一现场控制台 |
| 后端 | Fastify 5 + PostgreSQL 17；业务表只由迁移管理 |
| 数据迁移 | 94 个迁移，最新为 `094_room_release_binding` |
| 路由结构 | 70 个 `*-routes.js` 模块；路由层直接数据库调用点为 0 |
| Schema | 原 2200+ 行聚合文件拆为 32 个领域 schema；`routes/schemas.js` 仅兼容导出 |
| 大入口 | `world-helpers.js` 6 行、`player-routes.js` 8 行；Creator/Host/Player 启动入口只做编排 |
| Transport | Creator/Host/Player 共用 API、session/auth、错误、SSE lifecycle、游标、toast 与安全 DOM |
| 同步模型 | journal/outbox 持久化，SSE 实时推送，LISTEN/NOTIFY 唤醒，poll 补偿 |
| 内容版本 | 创作态发布为不可变 world release；运行房绑定 release，避免创作更新污染进行中的房间 |
| 安全 HTML | 产品不直接写 `innerHTML`；共享安全 sink 受 Trusted Types/CSP 门禁约束 |

## 本次文档批次已核对的证据

以下只代表 2026-07-24 文档批次实际执行的快速检查，不冒充完整发布验收：

| 检查 | 结果 |
|---|---|
| `npm run check:architecture` | 70 个路由模块，0 个路由层直接 DB 点，通过 |
| `npm run check:contracts` | 31 种 room event、8 种 platform event、9 个错误码，消费方完整 |
| `npm run check:world-writes` | 69 个前端写调用映射到 revision-aware 后端路由 |
| `npm run check:ui-interactions` | 220 个可见 action、248 个 view 调用、40 个导航入口，0 断链 |
| `npm run status:generate` | 生成迁移、路由、schema、入口行数和测试声明基线 |
| `npm run check:docs` | 目标为所有跟踪 Markdown 编码、标题、相对链接、索引与基线一致 |

测试声明数量用于发现测试被意外删除，不表示这些测试在本次文档批次运行过。运行通过与否必须以对应命令的退出码和工件为准。

## 最近运行与部署事实

- 2026-07-24，Creator 中重复的 Director 控制台已退役，Host 保持唯一现场控制台；相关共享、Host、Trusted Types、模块加载和源级交互门禁通过。
- Creator 与 Host 的生产构建和部署已在上一批次完成，`app.getzhimu.com` 与 `host.getzhimu.com` 已返回新产物。
- 本次文档更新没有运行 Playwright，也不会把未执行的浏览器视觉/交互验收写成通过。
- GitHub Actions 没有为上一提交产生新运行；2026-07-16 的失败运行只作为历史基线，不能替代当前提交的官方证据。

## 已完成的主要工程迁移

1. `world-helpers.js`、`player-routes.js` 和聚合 schema 已按领域拆分。
2. 路由层数据库调用已全部迁入 repository/service，并由零容忍门禁防回升。
3. Creator/Host/Player 的 API、认证、错误、游标和 SSE 生命周期已统一到 `shared/`。
4. Player、Host 与 Creator 大入口已拆为启动、会话、路由、同步和视图控制器。
5. Writer/Host/Site 的 HTML sink 已收敛到安全 DOM，Trusted Types/CSP 有专项检查。
6. 三端 SSE 已覆盖 replay/live 受众投影、账号隔离游标、重复/乱序、慢消费者和 poll 补偿。
7. 登录状态已覆盖多标签、并发 401、迟到旧 401、Cookie/Bearer 恢复和凭证尝试失败。
8. 数据库已引入事件 outbox、语音生命周期/索引、审稿工作流、叙事档案、world release 与 room release binding。

## 当前必须保留的风险

| 优先级 | 风险 | 完成标准 |
|---|---|---|
| P0 | 缺少当前提交的官方 Release Acceptance 成功工件 | Ubuntu + PostgreSQL 17 上隔离 DB ×3、关键浏览器流程、性能与恢复全部完成并上传工件 |
| P0 | 平台级恢复证据不足 | Railway 镜像回滚、R2 对象抽样恢复、实际 RPO/RTO 记录 |
| P0 | 真实容量未知 | staging 真实 Bearer、多账号、20/50/100 并发下 Player P95/P99、错误率、连接池与 SSE 指标 |
| P1 | service/repository 内部性能债务 | 高频路径查询计划、往返次数、连接池占用、索引和事务/锁顺序有可重复基准 |
| P1 | 浏览器真实交互可能回归 | Creator、Host、Player 关键流程在受支持浏览器做人工或自动验收，截图/日志可追溯 |
| P1 | 商业交付体系仍偏人工 | SLA、订单与开通记录、客户联系人、交付包、支持升级和退出/导出流程固化 |
| P1 | 合规文本仍是草案 | 隐私、条款、版权、删除/导出、备案/适龄字段经负责人和法律复核 |

## 下一步顺序

1. 完成本次文档门禁并提交，确保所有文档都有生命周期和可验证事实入口。
2. 在不混入功能改动的提交上跑快速代码门禁，确认文档工具没有影响构建。
3. 条件允许时取得 GitHub Release Acceptance 的完整成功工件。
4. 在 staging 采集真实 Bearer 多账号性能与 SSE 容量证据。
5. 完成 Railway/R2 恢复演练并记录实际 RPO/RTO。
6. 后端从“文件拆分”转入高频 service/repository 的查询与事务质量优化。

## 验收入口

快速变更：

```powershell
npm run status:generate
npm run docs:index
npm run check:docs
npm run verify:changed
```

发布候选与恢复流程：

- [安全与测试](../SECURITY_AND_TESTING.md)
- [非功能性审计](./NONFUNCTIONAL_AUDIT_ZH.md)
- [发布恢复与回滚](./operations/RELEASE_ROLLBACK_ZH.md)
- [运维文档索引](./ops/README.md)
