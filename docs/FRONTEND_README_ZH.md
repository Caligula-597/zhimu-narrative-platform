# 前端说明

最后更新：2026-07-24

## 应用拆分

| 应用 | 目录 | 本地端口 | 生产域 |
|---|---|---|---|
| 主应用 | 根目录 `src/` | `4173` | `app.getzhimu.com` |
| 玩家端 | `play/` | `5174` | `play.getzhimu.com` |
| 主持端 | `host/` | `5175` | `host.getzhimu.com` |
| 官网 | `site/` | Vite 默认/Pages | `getzhimu.com` |

主应用生产由 Railway fullstack 托管；玩家端、主持端和官网按 Cloudflare Pages 分域。

## 主应用

关键目录：

| 路径 | 说明 |
|---|---|
| `src/api/client.js` | Creator 端 API 适配器，底层复用 `shared/api-client.js`、session 与 SSE 游标策略 |
| `src/runtime/` | auth、workspace、data、actions、room events |
| `src/runtime/view-registry.js` | 视图注册表（替代 `zhimuViews` 窗口桥） |
| `src/runtime/runtime-facade.js` | 运行时门面（替代 `zhimuRuntime`/`zhimuDom` 窗口桥） |
| `src/state/` | 8 个状态 shard + `create-store.js`（替代 `zhimuState` 窗口桥） |
| `src/views/` | account、overview、writer、studio、rules、director、player、archive、assets、ops |
| `src/views/writer-tool-layout.js` | Writer 全页工具共享壳层：页面标识、返回动作、响应式网格、事实统计和风险说明 |
| `config/vite.config.mjs` | dev server、docs static plugin、生产 build |
| `server.js` | 本地静态 dist server |

开发：

```powershell
cd backend
npm run dev

cd ..
npm run dev
```

生产构建：

```powershell
npm run build
```

注意：`npm run start:dist` 只托管静态文件，默认端口 `4173`，不代理 `/api`。

### Writer 工作台边界

新的 Writer 长流程不得自行重复拼接 `.writer-tool-workspace`、返回按钮和双栏上下文结构，应使用 `writer-tool-layout.js`。当前母稿、发布影响、文档解析、导入导出、版本、审稿、协作、玩家模拟和剧情结构提取均已接入。

共享层只负责布局与动态文本转义，不持有 API、store 或领域状态。领域功能继续遵守：

- model 负责上限、归一化、指纹和纯计算；
- view 负责领域内容，不直接发请求；
- controller 负责权限、会话、并发与失败恢复；
- 专用 CSS 随领域模块懒加载，不进入所有 Creator 用户的入口包。

文件长度不是再次拆分的唯一依据。只有出现两个以上独立变化原因时才继续拆：例如远端请求与渲染混在一起、同一文件同时维护多个领域，或测试无法隔离；不得为了把行数变小重新制造无语义的转发文件。

### Host 现场操作边界

Host 玩家详情、发放、解锁、提醒和日志统一使用页面内 `host-operation-workspace`，不得重新接回全局 `modalEl`。该领域按四层维护：

- `host-operation-model.js` 只负责状态与选择规则；
- `host-operation-command-service.js` 只负责命令、幂等反馈与写后核对；
- `host-operation-controller.js` 只负责工作台生命周期、房间上下文和玩家详情请求；
- `host-operation-workspace.js` 只输出经过转义的页面结构。

SSE 到达时只刷新受影响玩家的详情；断线时保留工作台草稿并依赖共享生命周期的轮询 reconcile。写入已成功但刷新失败必须展示“已提交、切勿重复操作”，不得把响应链后半段失败解释为命令未执行。

### Host 自动化规则边界

Host 规则长编辑不得重新接回 `modalEl`。页面内 `host-rule-workspace` 使用草稿模型、编辑事务服务、列表命令服务、控制器和转义视图；保存前同时执行本地 schema 边界与后端资产引用校验。创建响应丢失时通过 `metadata.hostRequestId` 核对服务器列表，无法核对时冻结草稿并要求显式重试核对。

权限必须来自 `/api/worlds` 或 studio 快照中的 `membership_role`：只有 `owner/editor` 展示新建、编辑、启停、删除和全量检查；`host/reviewer` 只展示规则内容、运行预览与允许的现场动作。隐藏按钮不是安全边界，命令服务仍需再次检查权限，后端继续执行最终授权。

## 数据边界

前端不得硬编码玩家、日志、资产、剧本内容或运行状态。运行数据必须来自 API：

| 数据 | 来源 |
|---|---|
| 世界列表 | `GET /api/worlds` |
| 公开剧本库 | `GET /api/worlds/catalog` |
| 资产 | `GET /api/worlds/:worldId/assets` |
| 主持运行态 | host/player/room APIs |
| 玩家内容 | `GET .../player-home` |
| OPS | `GET /api/ops/status` |

测试 fixture UUID 只允许出现在测试和 seed 中，不能成为产品逻辑。

## 验证

```powershell
npm run check:modules
npm run audit:periodic
npm run test:auth-matrix
npm run test:sse-matrix
npm run test:trusted-types
npm run build
node scripts/ui-smoke.js
npm run test:e2e
npm run test:play
npm run test:host
```

Playwright 默认跨 Chromium/Firefox/WebKit。

## 桥接与状态收口进展

| 项 | 状态 |
|---|---|
| A1 桥接清理 | 完成：`zhimuViews`/`zhimuRuntime`/`zhimuDom` 三大桥已从 `src/` 和 `app.js` 全部清除，替换为 `src/runtime/view-registry.js` + `src/runtime/runtime-facade.js` |
| A2 状态分片 | 完成：8 个 shard（asset/room/studio/ui/user/voice/wizard/world）+ `src/state/create-store.js` 已落地；`window.zhimuState` Proxy 仅在测试/demo 模式下条件激活 |

## 当前前端框架风险

Creator、Host、Player 的 API、session、错误转换、SSE 生命周期与游标已经统一到 `shared/`；三端仍保持独立应用和独立视图控制器。当前主要风险变为：

- 官网 `site/` 的公开请求仍是独立 transport，需要补超时、错误边界与 CSP 审计。
- 业务 DTO 虽已逐步生成类型契约，但尚未覆盖全部读写接口。
- Writer/Director 已移除产品直接 `innerHTML`，后续新模板必须继续通过 Trusted Types 门禁。
- 表单、复杂领域视图与 UI tokens 仍有端内重复，不应为了复用重新合并三端。

详见 [架构与端口审视](./ARCHITECTURE_PORT_AUDIT_ZH.md)。

## Pages 发布

`site/play/host` 已接入 `.github/workflows/pages-deploy.yml`，最新 PR 预览部署与安全检查通过。本地 smoke：

```powershell
npm run pages:smoke
```
