# 项目状态

最后更新：2026-07-16
事实基线：`agent/nonfunctional-hardening` / `c72209b`

## 当前真相源

- [产品状态](./PRODUCT_STATUS_ZH.md)：产品阶段、评分和剩余业务风险。
- [非功能性审计](./NONFUNCTIONAL_AUDIT_ZH.md)：性能、安全、SSE、认证和发布门禁。
- [架构总览](../ARCHITECTURE.md) 与 [领域边界](./DOMAIN_BOUNDARIES_ZH.md)：模块边界和数据库调用债务。
- [安全与测试](../SECURITY_AND_TESTING.md)：安全基线与验收命令。
- [发布与回滚](./operations/RELEASE_ROLLBACK_ZH.md)：隔离验证、恢复证据和部署回滚。
- [运维索引](./ops/README.md)：生产配置、监控、备份和应急手册。

带具体日期的 Alpha/L1/演练文档是当时证据，不随当前代码重写；若与本页冲突，以本页和上述真相源为准。

## 当前结论

| 领域 | 当前状态 |
|---|---|
| 阶段 | 可信 Beta；本次发布候选被长验收阻断，修复并完整通过前不进入新的公开 Beta 放量 |
| 核心闭环 | 创作、导入、开房、玩家阅读/调查、主持推进、规则、线索、存档、复盘和反馈均有真实链路 |
| 后端拆分 | `world-helpers.js` 已收敛为 6 行兼容 barrel；`player-routes.js` 为 9 行注册器；原 2200+ 行 schema 已拆成 14 个领域 schema 文件 |
| 前端拆分 | `play/src/main.js` 412 行、`host/src/main.js` 89 行；启动、会话、路由、同步和视图控制已分模块，主应用视图按需加载 |
| 三端 transport | Creator/Host/Player 共用 `shared/api-client`、session/auth、SSE lifecycle、错误映射和游标规则；业务视图仍保持独立 |
| SSE | replay/live 服务端受众投影、账号隔离游标、重复/乱序处理、轮询回退、慢消费者上限和最长 5 分钟重认证已落地 |
| 登录状态 | 多标签同步、并发 401、旧请求覆盖新登录、Cookie/Bearer 恢复和凭证尝试失败专项门禁已落地 |
| HTML 安全 | 产品代码原生 `innerHTML` 为 0；唯一写入点是 `shared/safe-dom.js`；App 与官网均有 CSP/Trusted Types 门禁 |
| 数据库安全 | 测试写入与破坏性演练分别受独立开关保护，生产形态/未知远程库默认拒绝；Supabase 只读核验为 67 已应用、0 待应用 |
| 快速验收 | `npm run audit:periodic` 当前 14/14；SSE 39/39、Auth 22/22、Trusted Types 23/23、发布门禁工具 5/5 |
| 架构债务 | 68 个路由模块、143 个路由层直接数据库调用点；递减门禁禁止回升 |
| 长验收 | GitHub `Release Acceptance` 运行 `29477387204` **失败**：隔离测试第 1/3 轮为 712 tests、701 pass、8 fail、3 skipped；E2E/性能/恢复均未执行 |

## 常用短验收

```powershell
npm run audit:periodic
npm run check:modules
npm run check:architecture
npm run check:contracts
npm run check:world-writes
npm run test:sse-matrix
npm run test:auth-matrix
npm run test:trusted-types
npm run test:release-gates
```

## 发布候选长验收

手动工作流 `.github/workflows/release-acceptance.yml` 依次执行：

1. 三次隔离数据库 unit/integration 验证，并生成 `artifacts/release/verify-full-repeat.json`。
2. Creator/Host/Player 关键 Playwright E2E。
3. Player 首页 localhost 路由/数据库 P95/P99 基线；该结果不冒充真实 staging Bearer 容量证据。
4. `pg_dump -> isolated restore` 与 N-1 → latest 前向迁移演练，并生成恢复证据。

本轮实际结果（提交 `c72209b`）：

| 项 | 结果 |
|---|---|
| 隔离 unit/integration | 第 1/3 轮失败：712 tests、701 pass、8 fail、3 skipped |
| 失败类别 | 幂等错误码契约 1；官方示例角色权限 1；AI/导入/世界 revision 5；新事件表 RLS 覆盖 1 |
| 后续步骤 | Creator/Host/Player E2E、Player 性能和恢复演练全部 skipped，不能形成通过证据 |
| 清理 | 隔离库删除后 cleanup 仍访问 `users`，产生 `relation \"users\" does not exist` 二次失败 |
| 工件 | `verify-full-repeat.json` 正确记录 `completedRuns=1`、`passedRuns=0`、`status=failed`，证明防假通过门禁有效 |

## 当前必须保留的风险

1. Release Acceptance 的 8 个测试失败与 cleanup 二次错误是当前发布阻断；在完整 `verify ×3` 通过前，不能进入后续 E2E/性能/恢复证据阶段。
2. staging 真实 Bearer、多玩家、同区域数据库的 Player P95/P99 证据尚未完成；本地到远程 Supabase 的旧基线不能作为发布通过。
3. 应用镜像回滚、R2 对象恢复和实际 RPO/RTO 仍需要平台级演练；数据库脚本不能替代这些证据。
4. 143 个路由层数据库调用点仍需按 checkpoint、voice、player access/progress、host content action 的顺序递减。
5. 官网 pilot 案例、订单/开通/发票、SLA 和客户成功流程仍是商业试点短板。
6. 官网公开 bootstrap/申请请求仍是独立公共 transport，尚未纳入三端认证 transport；应继续保持超时和 CSP 边界审计。

## 下一步顺序

1. 修复 8 个隔离测试失败与 cleanup 二次错误，先定向回归，再重跑 Release Acceptance 直到隔离 DB ×3 全通过。
2. 让同一次长验收继续跑完关键 E2E、localhost 性能和 pg_dump/迁移恢复工件。
3. 在 staging 用多个真实账号跑 20/50/100 并发 Player P95/P99。
4. 完成部署平台镜像回滚与 R2 恢复抽样，记录实际 RPO/RTO。
5. 继续递减后端直接数据库调用点，并用真实 pilot 补官网信任与商业交付证据。
