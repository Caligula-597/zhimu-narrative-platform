# 织幕优化计划

最后更新：2026-07-02

本目录是基于 2026-06-28 完整代码通读 + 主应用 dev 预览（`http://localhost:4173/`）得出的产品、架构、代码、性能、安全、宣传六位一体优化计划；2026-06-30 同步当前执行进度。

> 原则：**不动业务行为、不改数据库真相源、不引入重型框架**。所有改动都向项目已有的最佳实践（`play/`、`host/` 的真 ES Modules 模式）对齐，而不是另起炉灶。

## 阅读顺序

| 文件 | 内容 | 适合谁看 |
|---|---|---|
| [01-现状评估.md](./01-现状评估.md) | 架构、代码写法、运行加载、安全四维现状打分与问题清单 | 工程 / 架构 |
| [02-优化方案.md](./02-优化方案.md) | 分维度的具体优化方案（架构 / 性能 / 安全 / UI-UX / 后端 / 工程化） | 工程 / 架构 |
| [03-产品与宣传.md](./03-产品与宣传.md) | 产品定位、官网文案、创意提案、Beta onboarding、定价策略 | 产品 / 运营 / 市场 |
| [04-执行路线图.md](./04-执行路线图.md) | P0 / P1 / P2 优先级、里程碑、验收命令、风险 | 所有角色 |
| [05-主应用迁移设计.md](./05-主应用迁移设计.md) | A1 模块化迁移的详细设计与桥接策略 | 工程 / 架构 |
| [06-A1A2A4整合设计.md](./06-A1A2A4整合设计.md) | A1 收尾 + A2 状态分片 + A4 共享层整合推进 | 工程 / 架构 |
| [06-上市与运维准备路线图.md](./06-上市与运维准备路线图.md) | 上市门槛、阶段规划、运维与商业化准备 | 产品 / 运维 / 管理 |

## 一句话结论

织幕目前是**「可信 Beta 末期、产品闭环已具备、但主应用前端背着历史包袱」**的状态。

- **后端**：健康，路由按领域拆分，安全门禁扎实，知识块/内容检索已超前于前端。
- **三端前端**（`play/` `host/` `site/`）：已迁移到真 ES Modules，结构清晰。
- **主应用**（根 `src/`）：`api/client.js` 已按领域拆分为 `src/api/*.js`，`src/state/` 已拆为 8 个领域 shard + `createStore`；**Phase 4 状态分片迁移已全部完成**（所有消费者直接 import shard，`app.js` 已迁移，根 `state.js` 已删除）；`window.zhimuViews` 旧桥已移除，`window.zhimuRuntime` 已通过 `runtime-facade` 收口，三大 window 桥（zhimuViews/zhimuRuntime/zhimuDom）已全部清除，替换为 view-registry.js 和 runtime-facade.js；zhimuWorkspace / zhimuRuntimeStore / zhimuFormat / zhimuUi / zhimuModal / zhimuUiSemantics 小桥已完成迁移，下一批拆分处理 zhimuStatus 与 zhimuUserMessages。
- **共享层**：`shared/tokens.css`、`shared/security.js`、`shared/api-error.js`、`shared/sse.js`、`shared/components/collapse.js` 已落地；三端 Vite alias 已配置；`shared/api-fetch`、`shared/session-token`、`shared/url-validators` 与更多 shared components 后续按收益推进。
- **官网与宣传**：内容完整但偏功能罗列，缺故事化与案例化；创意提案 HTML 与官网未对齐。

**最高优先级**：把主应用向 `play/host` 的模块化模式对齐，同时抽出 `shared-api` / `shared-security` 共享层，一举消除三端重复 + 主应用架构债。

## 不在本计划范围内的事

- 不替换 Fastify / PostgreSQL / Vite 技术栈。
- 不引入 React/Vue/Svelte 等框架（项目已确立"原生 ES Modules + 命令式 render"路线，本计划尊重这一选择）。
- 不引入 Redux/Zustand/Pinia 等状态库（用轻量分片 store 即可）。
- 不改业务语义、不改数据库 schema、不改 API 契约。
- 不动 `创意提案-织幕/`、`docs/`、`.github/`、`deploy/` 等非代码目录的现存文件（仅在本计划文件夹内新增内容）。
