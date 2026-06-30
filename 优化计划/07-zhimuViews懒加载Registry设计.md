# zhimuViews 懒加载 Registry 设计

最后更新：2026-06-30

## 结论

`zhimuViews` 不应该用“把所有 view 静态 import 到 app.js”的方式清理。这样会破坏现在已经做出来的 view-level code splitting，让创作者端首屏重新背上所有视图、动作和编辑器代码。

正确方向是新增一个轻量 view registry：view 模块被懒加载后主动注册自己的导出；渲染器、动作模块、跨视图协作模块通过 registry 读取 view 能力。这样既能保留 Vite 动态分包，又能逐步移除 `window.zhimuViews` 全局桥。

## 当前问题

当前结构已经有一半是对的：

- `src/runtime/view-loader.js` 负责按页面动态 import view/action 模块。
- `app.js` 在渲染前会调用 `window.zhimuViewLoader.ensureViewModules(view)`。
- 每个 `src/views/*.js` 已经有真实 ES Module exports。

但另一半还停留在桥接时代：

- view 模块加载后仍写入 `window.zhimuViews.xxx`。
- `app.js`、`src/bootstrap/view-resolver.js`、`src/runtime/actions-*.js`、若干 view 内部协作仍读 `window.zhimuViews`。
- 如果直接改成静态 import，会让 `writer/studio/clues/rules/archive/account` 等模块全部进入主包，损失懒加载收益。

## 目标

1. 保留当前懒加载分包。
2. 移除业务代码对 `window.zhimuViews` 的直接读取。
3. 让 view/action 模块的依赖关系显式化，可测试、可追踪。
4. 不改变业务行为、不改 API、不改数据库。
5. 允许分阶段迁移，任一步都能回退。

## 新增模块

建议新增：

`src/runtime/view-registry.js`

职责：

- 保存已加载 view namespace 到 module exports 的映射。
- 提供同步读取能力，适配当前 `render()`。
- 提供安全调用方法，适配 action 模块。
- 在过渡期兼容旧 `window.zhimuViews`，但只作为 fallback。

建议 API：

```js
const registry = new Map();

export function registerView(namespace, exports) {
  registry.set(namespace, exports || {});
  return registry.get(namespace);
}

export function getView(namespace) {
  return registry.get(namespace) || window.zhimuViews?.[namespace] || {};
}

export function hasView(namespace) {
  return registry.has(namespace) || Boolean(window.zhimuViews?.[namespace]);
}

export function callView(namespace, method, ...args) {
  const fn = getView(namespace)?.[method];
  if (typeof fn !== "function") return undefined;
  return fn(...args);
}

export function viewRegistrySnapshot() {
  return Object.fromEntries(registry.entries());
}
```

过渡期可以继续暴露：

```js
window.zhimuViewRegistry = { registerView, getView, hasView, callView };
```

这不是新的长期全局桥，而是为了启动检查、调试和渐进迁移保留的观测入口。最终业务模块应该 import 这些函数。

## view 模块注册方式

以 `clues.js` 为例，当前底部是：

```js
window.zhimuViews = window.zhimuViews || {};
window.zhimuViews.clues = { clues, selectClue, closeClueDetail };
```

迁移后变成：

```js
import { registerView } from "../runtime/view-registry.js";

export const cluesViewApi = {
  clues,
  selectClue,
  closeClueDetail,
  setClueFlowFilter,
  setClueDetailTab,
  adjustClueFlowZoom
};

registerView("clues", cluesViewApi);
```

第一阶段可以同时保留旧桥：

```js
window.zhimuViews = window.zhimuViews || {};
window.zhimuViews.clues = cluesViewApi;
registerView("clues", cluesViewApi);
```

等所有消费者迁移完，再删除旧桥写入。

## 渲染器迁移

当前 `src/bootstrap/view-resolver.js` 接收 `V = window.zhimuViews`：

```js
resolveViewFn(view, V)
```

建议改为：

```js
import { getView } from "../runtime/view-registry.js";

export function resolveViewFn(view) {
  const views = {
    overview: getView("overview").overview,
    writer: getView("writer").writer,
    studio: getView("studio").studioCloud,
    clues: getView("clues").clues,
    rules: getView("rules").rules,
    miniGames: getView("miniGames").miniGames,
    archive: getView("archive").archive,
    settings: getView("settings").settings,
    account: getView("accountHub").accountHub,
    ops: getView("ops").ops
  };
  return views[view];
}
```

`app.js` 保持现在的流程：

1. 读取当前 view。
2. `ensureViewModules(view)`。
3. 模块加载完成后，view 模块已完成 `registerView()`。
4. `resolveViewFn(view)` 同步取函数并渲染。

这样不需要把 `render()` 一次性改成全异步。

## action 模块迁移

当前 action 模块大多这样写：

```js
function views() { return window.zhimuViews || {}; }
const C = views().clues || {};
C.openCluesEditor?.(...)
```

建议改为：

```js
import { callView } from "./view-registry.js";

case "clues-edit":
  callView("clues", "openCluesEditor", el?.dataset?.clue);
  return true;
```

注意：action 模块本身已经跟随 view 懒加载。例如 `actions-clues.js` 是 `clues` view 的模块列表之一，所以通常 action 执行时对应 view API 已经注册，不需要额外 await。

跨端入口或全局搜索这类可能跨 view 调用的模块，需要两种处理：

- 如果只是跳转页面，先 `go(view)`，让 view-loader 加载目标模块。
- 如果必须跨 view 直接调用，先 `await ensureViewModules(targetView)`，再 `callView(namespace, method)`。

## 跨 view 依赖处理

当前存在一些合理的跨 view 依赖：

- `accountHub` 使用 `account` 和 `assets`。
- `overview/director/player/archive` 会复用状态、弹窗或局部 UI。
- `modal/emptyState` 有少量入口会打开 creator guide 或 view 方法。

规则：

1. 同一个页面组合内的 view，可以放在同一 `modulesByView` 分组里，例如 account 分组继续加载 `assets/account/account-hub/actions-assets`。
2. 不允许 action 模块为了拿方法而静态 import 大 view。
3. 跨 view 调用必须通过 `ensureViewModules + callView`，让加载关系显式写在调用点。

## 分阶段计划

### Phase V1：新增 registry，不删旧桥

- 新增 `src/runtime/view-registry.js`。
- `view-loader.js` 加载前先 import registry，或由 view 模块自行 import。
- `overview/clues/settings` 先试点注册。
- `resolveViewFn` 改成 registry 优先、旧桥 fallback。

验收：

- `npm run check:modules`
- `npm run build`
- `npm run test:runtime-stores`
- 进入 overview/clues/settings 页面，加载和点击行为不变。

### Phase V2：迁移 action 消费者

- `actions-clues/actions-rules/actions-assets/actions-archive/actions-player/actions-director/actions-studio/actions-writer` 分批改用 `callView`。
- 每批只迁移 1-2 个领域，避免一次 diff 过大。
- 保留旧 `window.zhimuViews.xxx = api` 写入。

验收：

- 对应 view 的主要按钮可点击。
- `rg "function views\\(\\) \\{ return window\\.zhimuViews"` 数量下降。
- `npm run check:modules && npm run build`。

### Phase V3：迁移 view 内部协作

- `account-hub`、`archive`、`director`、`overview`、`player`、`writer/studio` 内部的 `window.zhimuViews` 读取改用 `getView/callView`。
- 对跨 view 调用补上 `ensureViewModules`，不要隐式假设目标模块已经加载。

验收：

- `rg "window\\.zhimuViews\\?\\." src/views src/runtime src/components` 只剩旧桥写入。
- account 资产页、线索页、主持页、玩家页手动 smoke 通过。

### Phase V4：删除旧桥写入

- 删除每个 view 底部 `window.zhimuViews.xxx = ...`。
- `dependency-guard` 不再要求 `zhimuViews`。
- 删除 `window.zhimuViews` 初始化。

验收：

- `rg "window\\.zhimuViews" src app.js` 为 0，或只剩已标注的兼容诊断入口。
- `npm run check:modules`
- `npm run build`
- `npm run test:runtime-stores`
- `npm run test:ui-semantics`

## 风险与控制

最大风险不是 API 设计，而是加载时序：

- `app.js` 当前依赖“模块加载完成后 view function 同步可用”。
- action 模块当前默认“当前页面 action 已随 view 加载”。
- `accountHub/assets/account` 这种组合页面存在跨模块协作。

控制方式：

- registry 第一阶段必须支持旧桥 fallback。
- 不把 view 静态 import 到 action 模块。
- 每次只迁移一个领域，先迁移 `clues/settings/assets` 这类边界较清晰的模块。
- 每次迁移都跑构建，观察 Vite chunk 是否没有把大 view 合进 `index-*.js` 主包。

## 推荐下一步

下一步不要直接全量删除 `window.zhimuViews`。

推荐先做 Phase V1：

1. 新增 `src/runtime/view-registry.js`。
2. 让 `overview/clues/settings` 三个 view 同时注册 registry 和旧桥。
3. `resolveViewFn` 改为 registry 优先。
4. 跑完整状态验收。

如果 V1 稳定，再进入 actions 的分批迁移。

## 执行状态

2026-06-30 更新：

- Phase V1 已落地：新增 `src/runtime/view-registry.js`。
- `src/bootstrap/view-resolver.js` 已改为 registry 优先读取 view function。
- `app.js` 已移除 `const V = window.zhimuViews` 的直接入口依赖。
- `overview / clues / settings` 三个试点 view 已同时注册 registry 和旧桥。
- 已补充 `scripts/runtime-stores.test.mjs` source-inspection 覆盖，防止后续误回退。
- Phase V2 第一批已落地：`actions-clues.js`、`actions-rules.js` 已改用 `callView()`，不再直接读取 `window.zhimuViews`。
- Phase V2 第二批已落地：`assets / archive / player` 三个 view 已注册 registry；`actions-assets.js`、`actions-archive.js`、`actions-player.js` 已改用 `callView()`。
- Phase V2 第三批已落地：`director / studio / writer` 三个 view 已注册 registry；`actions-director.js`、`actions-studio.js`、`actions-writer.js` 已改用 `callView()`。
- Phase V2 action 消费者收尾已落地：`miniGames / ops` 已注册 registry；`actions-mini-games.js`、`actions-ops.js` 已改用 `callView()`。
- Phase V3 前置清理已开始：`account / accountHub` 已注册 registry；`actions.js` 的渲染后绑定已改用 `callView()`。
- Phase V3 第一批已落地：`account-hub` 对 `account/assets` 的跨 view 读取已改用 `callView()`；`modal/emptyState` 已移除未使用的 `window.zhimuViews` 捕获，同时保留兼容初始化。
- Phase V3 第二批已落地：`room-events/search-focus` 的真实跨 view 调用已补 `ensureViewModules()` 并改用 `callView()`；`archive/director/overview/player/rules/studio/writer/auth-world/wizard` 中未使用的 `const V = window.zhimuViews` 已清理。
- Phase V4 第一批已落地：`src/` 与 `app.js` 已移除 `window.zhimuViews` 旧桥写入、初始化和 registry fallback；`dependency-guard` 不再要求 `zhimuViews`；`verify-script-load` 改为检查 `zhimuViewRegistry`。

下一步进入 Phase V4 收尾：清理历史脚本和旧优化文档里的 `zhimuViews` 示例/模板描述，或将其标注为历史记录；再评估是否把 `zhimuViewRegistry` 诊断入口也收窄为 dev-only。
