# 织幕前端模块化计划

当前前端为静态 HTML + `src/` 模块化脚本。`app.js` 仅负责 bootstrap；API 在 `src/api/client.js`，视图在 `src/views/`。

## 已落地边界

FRONTEND_MODULE_PLAN.md
- 玩家入口、平行房邀请、语音房文字频道和主持台已经使用真实后端数据。
- **世界总览、内容资产、存档页**（2026-06-03 P0-1）仅展示 API 数据或空状态；`state.js` 不再含 `players`/`logs` 等运行时假字段，总览动态来自 `cloudWorldLogs`。
- 有正式 Bearer Session 时，浏览器不再发送 demo `x-user-id` 请求头。
- 切换世界或平行房时会清理旧房间运行态，避免残留上一个房间的剧情、线索、语音消息和探索点。

## 拆分顺序

1. `state.js` → **`src/state.js`** ✅
   - `window.zhimuState`（含 `cloudWorldLogs`）；不含运行时演示字段。

2. `components/modal.js` + `toast.js` + `emptyState.js` → **`src/components/`** ✅

3. `views/player.js` 等 → **`src/views/`** ✅（player / director / writer / studio / …）

4. **`app.js`** ✅ — 仅 render / go / 顶栏 wiring（~70 行）

5. `graph.js`（可选后续）
   - 剧情编排拖拽/连线 helpers 可进一步从 `src/views/studio.js` 抽出。

## 框架迁移判断

**2026-06-03 更新**：已引入 **Vite** 作为构建与开发服务器，仍保留 `window.*` 全局命名空间；`frontend/main.js` 按原 `index.html` 顺序 side-effect import。完整 ES module 导出与去全局化留作后续阶段。

不要在权限和 API 仍快速变化时硬迁移 React/Vue/Svelte。推荐先完成 Vite 打包 + 原生模块拆分；等玩家、主持、创作者三个视角的接口稳定后，再用同一套模块边界迁移到组件框架。

### Vite 工作流

| 命令 | 用途 |
|------|------|
| `npm run dev` | Vite 开发（HMR，`/api` 代理） |
| `npm run build` | 输出 `dist/` |
| `npm run preview` | 预览生产构建 |
| `npm run start:dist` | `node server.js --dist` 静态托管 |
| `npm run check:modules` | 脚本链 SyntaxError 检查 |

环境：`VITE_API_BASE`（见 `.env.development`）、`VITE_API_PROXY_TARGET`。

## 回归要求

- 玩家入口必须能仅凭邀请码读取对应剧本角色。
- 主持台只展示当前平行房数据。
- 玩家视角只能展示当前角色已发布或已解锁的内容。
- 正式登录 session 存在时，不发送 demo 身份请求头。
- **空世界**打开总览/资产页时，不得出现假玩家、假日志、假资产卡片（`assetsData` 不得回归主 UI）。

---

## 模块加载与命名空间

**Vite 入口**：`index.html` 仅加载 LiveKit CDN + `<script type="module" src="/frontend/main.js">`。`frontend/main.js` 按**严格顺序** import 各模块（与旧 script 链一致）。

**Legacy 排查**：若不用 Vite，仍可按原顺序单独加载 `config.js` → … → `app.js`（不推荐，CI 以 Vite build 为准）。

任一文件 **SyntaxError** 会导致后续脚本全部不执行，表现整页空白。排查时打开浏览器 Console，从第一个报错文件开始修；或运行 `npm run check:modules`。

| 全局对象 | 定义位置 | 用途 |
|----------|----------|------|
| `window.zhimuState` | `src/state.js` | 应用状态 |
| `window.zhimuApi` | `src/api/client.js` | HTTP / SSE |
| `window.zhimuFormat` | `src/utils/format.js` | 格式化、XSS 转义 |
| `window.zhimuUi` | `src/components/emptyState.js` | 通用 HTML 片段（`cloudStatus`、`stat` 等） |
| `window.zhimuToast` | `src/components/toast.js` | Toast、通知角标 |
| `window.zhimuModal` | `src/components/modal.js` | 弹窗壳 |
| `window.zhimuViews` | `src/views/*.js` | 各导航视图（按子键挂载，如 `zhimuViews.player.player`） |
| `window.zhimuRuntime` | `src/runtime/*.js` + `app.js` | 数据加载、事件分发、向导、登录/世界选择、`render` / `go` |

---

## 定义方 vs 消费方（新增/修改模块时必须遵守）

拆分工具曾给**每个文件**注入相同「兜底别名头」，与文件内 `function xxx()` 撞名导致页面崩溃。日后手工改模块时请区分两类文件：

**定义方**（本文件实现并 `window.zhimuXxx = { xxx }` 导出）  
- 示例：`format.js`、`emptyState.js`、`toast.js`、`modal.js`、各 `views/*.js` 内的视图函数、`runtime/*.js` 内的运行时函数  
- **禁止**在同一 IIFE 内再写 `const xxx = F.xxx || ...` 或 `const xxx = U.xxx || ...` 等同名别名  
- 仅保留：`state`、`zhimuApi`、`zhimuDom`、命名空间引用（`F`/`U`/`T`/`M`/`R`/`V`），以及**从其他模块导入、本文件不定义**的符号

**消费方**（只调用、不定义）  
- 示例：多数 `views/*.js` 对 `U.cloudStatus` 的引用；`runtime/actions.js` 对 `V.player.readCloudClue` 的引用  
- 使用 `const foo = U.foo || (() => "")` 等别名即可  
- **禁止**在本文件再声明 `function foo`

**`runtime/actions.js` 特例**：头部有大量 `V.*` / `R.*` 别名供 `handle()` 分发；勿与 slim 头重复声明同一名字（曾出现两次 `openJoinRoom`）。

---

## 事故复盘：拆分后 UI 全空白（2026-06-03）

### 现象

P1-3 机械拆分完成后，`npm run test:ui` 22/22 通过，但浏览器打开后**整页空白**。

### 直接原因

部分 `src/**/*.js` 在解析阶段抛出：

```text
SyntaxError: Identifier 'formatRelativeTime' has already been declared
```

`index.html` 脚本链在第一个出错文件处中断，`app.js` 的 `render()` 从未运行。

### 根本原因

1. **`scripts/split-app.mjs`** 切分代码时，给每个模块注入相同模板头，例如：
   ```javascript
   const formatRelativeTime = F.formatRelativeTime || (() => "");
   ```
   而被切出的块里已有 `function formatRelativeTime() { ... }`，同一作用域重复声明。

2. **首批修复脚本正则不完整**：用 `^function` 匹配本地函数，漏掉行首空格的 `  function foo`，部分文件未清理干净。

3. **人工补丁引入重复**：`actions.js` 额外别名块与头部 `openJoinRoom` 等重复。

4. **UI smoke 不测 JS 执行**：`scripts/ui-smoke.js` 只检查文件存在、关键字、行数，**不解析/执行**脚本，SyntaxError 无法被现有 CI 捕获。

### 修复方式

1. 手工重写 `src/utils/format.js`（纯定义、无重复别名）。  
2. 运行 **`node scripts/fix-module-imports.mjs`**：扫描各文件本地 `function`，从模板头中删除同名 `const` 行（正则：`^\s*(?:async )?function`）。  
3. 清理 `actions.js` 等文件的重复 `const`。  
4. 将误放在 `toast.js` 的轮询变量保留在 `data.js`（`directorPollTimer` 等）。

### 教训

| 问题 | 对策 |
|------|------|
| 机械模板头 | 定义方不用 import 别名；或共用极薄 `imports.js`（未做，可选后续） |
| smoke 漏报 | 改模块后执行下方「脚本链验证」；长期可考虑把该检查并入 `ui-smoke.js` |
| 新增 view/runtime 文件 | 复制**消费方**头时核对：本文件是否要 `function` 定义？若要，不要加同名 `const` |

---

## 日常维护检查清单

**改完任意 `src/**/*.js` 或 `frontend/main.js` 后：**

1. **脚本链验证**（项目根目录）——模拟浏览器加载顺序，确保无 SyntaxError：
   ```bash
   npm run check:modules
   # 或
   cd backend && npm run test:ui:load
   ```

2. **构建**（改 import 顺序或 Vite 配置时）：
   ```bash
   npm run build
   ```

3. **UI smoke**：
   ```bash
   cd backend && npm run test:ui
   ```

3. **浏览器**：Ctrl+Shift+R 强刷，Console 无红色报错，左侧导航与「世界总览」可见。

**新增模块文件时：**

- 在 `frontend/main.js` 插入正确依赖位置（组件 → 视图 → runtime → app.js）。  
- 在 `scripts/ui-smoke.js` 的 `requiredModuleScripts` 中同步路径。  
- 运行 `node scripts/ensure-esm-exports.mjs` 为新文件追加 `export {}`（Vite ESM 需要）。  
- 导出挂到对应 `window.zhimu*` 命名空间，与 `app.js` / `actions.js` 引用一致。

**若再次执行机械拆分：**

- 跑完 `split-app.mjs` 后**必须**跑 `node scripts/fix-module-imports.mjs`。  
- 禁止对「定义方」文件保留 slim 头里的同名 `const`。

---

## 相关脚本

| 脚本 | 用途 |
|------|------|
| `scripts/split-app.mjs` | 从单体 `app.js` 机械切分（会注入模板头，需后续修复） |
| `scripts/fix-module-imports.mjs` | 删除与本地 `function` 冲突的 `const` 别名行 |
| `scripts/patch-src-modules.mjs` | 拆分后的补丁辅助（历史用途） |
| `scripts/ui-smoke.js` | 静态接线检查（**不**执行 JS） |
| `scripts/verify-script-load.mjs` | 按加载顺序解析/执行脚本，捕获 SyntaxError（维护用） |
