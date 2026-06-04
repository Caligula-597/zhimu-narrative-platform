# 织幕

服务于线上长线剧本杀与跑团的自动化互动叙事引擎第一版。

## 当前工程状态

- 前端：**Vite 6** 构建（`npm run dev` / `build` / `start:dist`），仍用 `window.*` 全局。
- `backend/`：PostgreSQL 正式后端。
- **休息/交接**：[docs/PROJECT_STATUS.md](./docs/PROJECT_STATUS.md)
- [RELEASE_NOTES.md](./RELEASE_NOTES.md) P0/P1/P2 发布说明
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) **功能实现状态总览**
- [docs/BACKEND_OPS.md](./docs/BACKEND_OPS.md) **后端运维路线图**（下一步）
- [docs/OPS.md](./docs/OPS.md) 部署与故障排查
- [FEATURE_CATALOG.md](./FEATURE_CATALOG.md) 完整功能目录
- [SECURITY_AND_TESTING.md](./SECURITY_AND_TESTING.md) 安全与测试（**131** 项后端测试）
- [FRONTEND_MODULE_PLAN.md](./FRONTEND_MODULE_PLAN.md) Vite + 模块边界
- [DEMO_ROUTE.md](./DEMO_ROUTE.md) 雾港 12 分钟 Demo

## 启动

**开发（推荐）** — Vite HMR，`/api` 代理到后端 4180：

```powershell
cd backend; npm run dev          # 或 node src/server.js
cd ..; npm run dev               # http://localhost:4173
```

**生产静态包**：

```powershell
npm run build
npm run start:dist               # 托管 dist/
```

Legacy 无构建：`node server.js`（源码直出，CI 以 Vite build 为准）。

- 预发部署：[docs/ops/STAGING.md](./docs/ops/STAGING.md)（Docker Compose，可选）
- E2E 验收：`npm run verify:full:fresh`（Playwright 雾港全链路）

**收工前**可停掉本地 4173/4180 进程以释放端口与 DB 连接（见 [docs/PROJECT_STATUS.md](./docs/PROJECT_STATUS.md) §6）。

## 已包含

- 世界总览（仅 API 数据或空状态，无硬编码演示玩家/日志/资产）
- 可直接处理工作的首页控制台：角色阅读状态、待办入口与能力地图
- 剧情流程图编辑器
- 内容资产库（仅 `cloudAssets` 真实附件列表）
- 自动化规则管理
- 主持监控台（运行时玩家表、待确认事件、手动干预、SSE 实时推送）
- 玩家互动视角
- 角色专属剧情与私密信息
- 公共麦、角色私密麦和受邀私密语音房（LiveKit 音频 + 文字频道）
- 五步标准创作教程与测试房间流程
- 由玩家阅读、调查与线索解读驱动的规则推进（云端持久化）
- 小说式角色章节、段落重点标记与角色随身笔记本
- 随行为状态变化的玩家场景、玩家进度和运行日志
- 存档与复盘（运行房 checkpoint 快照 + scoped restore + 房间复盘报告）
- 物品系统（创作台定义、主持发放、玩家背包、调查门槛）
- 世界设置、导入导出和实体卡接口入口
