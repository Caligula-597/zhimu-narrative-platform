# 织幕主持端

最后更新：2026-07-24

目录：`host/`

生产域：`https://host.getzhimu.com`

## 本地开发

```powershell
cd backend
npm run dev

cd ../host
npm install
npm run dev
```

默认地址：`http://localhost:5175`

默认 `/api` 代理到 `http://127.0.0.1:4180`。

## 环境变量

```env
VITE_HOST_DEV_PORT=5175
VITE_API_PROXY_TARGET=http://127.0.0.1:4180
VITE_API_ORIGIN=https://app.getzhimu.com
VITE_APP_ORIGIN=https://app.getzhimu.com
VITE_PLAY_ORIGIN=https://play.getzhimu.com
```

## 部署

Cloudflare Pages：

| 项 | 值 |
|---|---|
| Root directory | `host` |
| Build command | `npm ci && npm run build` |
| Output directory | `dist` |
| Custom domain | `host.getzhimu.com` |

后端 Railway 需要：

```env
HOST_SITE_ORIGIN=https://host.getzhimu.com
HOST_SITE_URL=https://host.getzhimu.com
```

## 当前状态

主持端作为独立 Vite 应用部署。API、session、错误转换、SSE 生命周期与受众游标复用 `shared/`，投票、秘密行动、玩家任务、runbook 和补救视图已有基础接线。

玩家详情、发线索、发物品、解锁/撤回/跳过分幕、开放场景、提醒、主持日志、线索备注和移出玩家统一进入页面内“现场操作工作台”，不再占用全局居中弹窗。相关代码边界：

| 路径 | 责任 |
|---|---|
| `src/runtime/host-operation-model.js` | 纯状态、默认值、角色与分幕选择规则 |
| `src/runtime/host-operation-command-service.js` | 幂等命令调用、提交状态、刷新失败恢复、危险操作 |
| `src/runtime/host-operation-controller.js` | 打开/关闭、房间上下文、输入草稿、玩家详情请求 |
| `src/views/host-operation-workspace.js` | 页面内工作台和“某玩家现在知道什么”视图 |
| `src/styles/host-operation-workspace.css` | 现场工作台独立布局与响应式规则 |

命令固定绑定当前 roomId，写入期间阻止重复提交；成功后优先用 SSE 更新，断线时由轮询 reconcile 补偿。Player 对线索、物品、分幕、场景与提醒事件都有独立同步契约。

自动化规则的新建、编辑、启停、删除和检查使用页面内“规则工作区”，不再打开全局居中长弹窗。该领域按独立变化原因拆分：

| 路径 | 责任 |
|---|---|
| `src/runtime/host-rule-workspace-model.js` | 草稿、Fastify schema 对齐的本地边界、脏状态与上下文指纹 |
| `src/runtime/host-rule-workspace-service.js` | 单条规则校验、保存、响应不确定时的服务器核对 |
| `src/runtime/host-rule-list-service.js` | 启停、删除、全量检查和列表刷新 |
| `src/runtime/host-rule-store.js` | 规则列表 upsert、重新读取和响应核对 |
| `src/runtime/host-rule-permissions.js` | 将世界 `membership_role` 映射为规则写权限 |
| `src/runtime/host-rule-workspace-controller.js` | 工作区生命周期、未保存离开确认和动作分派 |
| `src/views/host-rule-workspace.js` | 转义后的页面内编辑器与资产 ID 引用助手 |
| `src/styles/host-rule-workspace.css` | 规则工作区独立布局与响应式规则 |

规则写入仅允许拥有者和编辑者；主持人、审稿人保留规则查看和房间运行预览，不显示注定被后端拒绝的写按钮。创建请求通过 `metadata.hostRequestId` 支持响应丢失后的列表核对；服务器已提交但列表刷新失败时必须提示不要重复写入。

本地验证：

```powershell
npm test
npm run build
cd ..
npm run pages:smoke
npm run test:sse-matrix
```

`npm test` 可以独立运行；如果尚未执行 `npm run build`，产物存在性用例会明确跳过。正式发布门禁仍必须先构建，再运行测试。

真实发布候选、容量和恢复证据见 [项目状态](../docs/PROJECT_STATUS.md) 与 [架构/端口审计](../docs/ARCHITECTURE_PORT_AUDIT_ZH.md)。
