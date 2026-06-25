# 织幕待处理问题清单

## 问题一：进入监控台卡顿

> **处理状态：已完成（2026-06-25）**  
> 已将 `host/src/main.js` 的 console 视图切换前移，进入监控台后立即展示控制台壳与加载状态；`host/src/runtime/data.js` 在加载开始/结束时主动渲染，避免只停留在 landing + 顶部 loading。验证：`npm run build --prefix host`、`npm test --prefix host`。

### 问题描述

用户点击进入主持监控台（console）时，页面会长时间卡顿，只能看到顶部细细的 loading 条，感觉像是卡住了。

### 影响范围

- **产品**：织幕主持端（host.getzhimu.com）
- **模块**：主持监控台（console view）
- **触发场景**：从 landing 页选择房间进入、通过 ?room= 深链进入、刷新页面

### 问题分析

#### 核心问题：串行等待 + 全量加载 + 视图切换太晚

进入监控台的入口函数 `enterConsole()`（`host/src/main.js`）：

```javascript
async function enterConsole() {
  setBusy(true);                 // 1. 显示加载条
  try {
    await loadHostData(false, true);  // 2. 等待所有数据加载完（最慢）
    state.view = "console";           // 3. 才切换到监控台视图
    syncRoomStream();                 // 4. 连接 SSE
    syncDirectorPolling();            // 5. 启动轮询
  } finally {
    setBusy(false);               // 6. 隐藏加载条
  }
}
```

#### 具体问题点

##### 1. 全量串行加载，首屏太慢

`loadHostData()`（`host/src/runtime/data.js`）一次性加载 **8 类数据**，并且是**串行等待**：

| 阶段 | 加载内容 | 方式 | 阻塞后续？ |
|------|---------|------|-----------|
| 第一阶段 | studio（世界数据） | 串行 | ✅ 阻塞 |
| 第一阶段 | rules（规则列表） | 串行 | ✅ 阻塞 |
| 第二阶段 | rooms（房间列表） | 串行 | ✅ 阻塞 |
| 第三阶段 | 玩家进度 / 待确认事件 / 世界日志 / 线索矩阵 / 审计日志 | 5个并行 | ✅ 阻塞视图切换 |

**问题**：必须等 3 个串行请求 + 5 个并行请求**全部完成**，才能看到监控台界面。

##### 2. 视图切换太晚，用户感知卡顿

当前流程：**加载完成 → 切换视图 → 渲染内容**

用户点击进入后，界面仍停留在 landing 页，只有顶部一个细细的 loading 条，视觉上感觉就是"卡住了"。

##### 3. 线索矩阵可能是重接口

`getHostClueMatrix()` 是计算密集型接口：
- 遍历所有线索 × 所有玩家
- 计算拥有/已读/公开/私享状态
- 数据量大时可能很慢

但它和其他 4 个接口并行加载，仍然会拖慢整体完成时间。

##### 4. SSE 连接 + 轮询同时启动（次要）

虽然 SSE 连接和轮询是异步的不会阻塞，但如果 SSE 连接建立慢，会导致一段时间内状态显示"未连接"。

---

## 问题二：手动操作卡顿

> **处理状态：已完成（2026-06-25）**  
> 已将 `host/src/views/console.js` 和 `host/src/runtime/invite.js` 中手动操作后的 `loadHostData()` 全量刷新替换为 `refreshHostRoom()` / `refreshHostPlayers()` / `refreshHostClueMatrix()` 等运行时粒度刷新，不再重复拉取 studio/rules/rooms。验证：`npm run build --prefix host`、`npm test --prefix host`。

### 问题描述

主持人在监控台进行手动操作（如手动解锁分幕、发放线索、发放物品等）后，页面会卡顿很久，感觉像是卡住了。

### 影响范围

- **产品**：织幕主持端（host.getzhimu.com）
- **模块**：主持监控台（console view）
- **触发场景**：所有手动干预操作

### 问题分析

#### 核心问题：每次操作后都全量刷新所有数据

所有手动操作完成后，都会调用 `loadHostData()` 全量刷新所有数据。`loadHostData()` 会一次性加载 8 类数据，导致每次操作后都要等很久才能继续。

受影响的操作包括：

| 操作 | 代码位置 | 刷新方式 |
|------|---------|---------|
| 踢出玩家 | `console.js:kickHostPlayer()` | `loadHostData()` |
| 保存玩家主持备注 | `console.js:openHostPlayerDetail()` | `loadHostData()` |
| 玩家详情内手动解锁分幕 | `console.js:openHostPlayerDetail()` | `loadHostData()` |
| 保存线索主持备注 | `console.js:openHostClueNote()` | `loadHostData()` |
| 延迟待确认事件 | `console.js:openDelayHostEventModal()` | `loadHostData()` |
| 手动发放线索 | `console.js:openHostGrantClueModal()` | `loadHostData()` |
| 手动发放物品 | `console.js:openHostGrantItemModal()` | `loadHostData()` |
| 手动解锁分幕 | `console.js:openHostUnlockSectionModal()` | `loadHostData()` |
| 手动开放场景 | `console.js:openHostUnlockSceneModal()` | `loadHostData()` |
| 添加主持日志 | `console.js:openHostLogModal()` | `loadHostData()` |
| 手动触发规则 | `console.js:triggerManualRuleFromDirector()` | `loadHostData()` |

#### 具体问题点

##### 1. 操作后全量刷新，11 处都在调用 `loadHostData()`

每次操作后都走全量加载，包括：
- studio（世界数据）
- rules（规则列表）
- rooms（房间列表）
- 玩家进度
- 待确认事件
- 世界日志
- 线索矩阵
- 审计日志

**问题**：解锁一个分幕而已，完全不需要重新加载 studio、rules、rooms、线索矩阵、审计日志。

##### 2. 关闭弹窗后才开始刷新，用户感知等待

当前流程：
```
点击确认 → API 请求 → 关闭弹窗 → 全量 loadHostData() → 弹窗消失但页面卡顿 → 刷新完成
```

用户点完按钮后，弹窗虽然关了，但页面卡住不动，要等所有数据加载完才能继续操作。

##### 3. 没有操作中的 loading 状态

用户点击按钮后，没有明显的"处理中"反馈，不知道是点了没反应还是正在加载。

##### 4. 部分操作可以用增量更新替代全量刷新

比如：
- **解锁分幕**：只需要刷新玩家进度 + 待确认事件
- **发放线索**：只需要刷新玩家进度 + 线索矩阵
- **延迟/确认/拒绝事件**：只需要刷新待确认事件列表
- **保存备注**：甚至不需要刷新，直接改本地 state 就行

---

## 问题三：官方示例 seed 空壳待清理

> **处理状态：已完成（2026-06-25）**  
> 已删除 `backend/scripts/seed-official-example.mjs`，移除 `backend/scripts/seed.js` 对该 seed 的调用；本地/CI 使用普通测试桩覆盖 E2E 入口链路，生产/预发继续由 `OFFICIAL_EXAMPLE_WORLD_ID` 指向已审核公开库示例。同步更新了 `backend/.env.example`、`playwright.config.js`、`e2e/global-setup.mjs`、`docs/ops/LAUNCH_ENV.md`、`docs/LAUNCH_PRIORITIES_ZH.md` 与 `docs/DESIGN_DECISIONS_NEEDED_ZH.md`。验证：`node --check backend/scripts/seed.js`、`npm run check --prefix backend`、`node --test-concurrency=1 --test-force-exit --import ./test/hooks.mjs --test test/official-example.test.js test/platform-site.test.js`。

### 问题描述

本地/CI seed 会生成一个空壳官方示例（只有 2 个角色 + 1 段分幕，无探索/线索/规则），用途不大且容易与生产「小示例」混淆。官方示例仅使用 Caligula 创作的「小示例」即可，不再维护本地 seed 版空壳示例。

### 影响范围

- **产品**：织幕主应用 / 后端
- **模块**：种子数据、官方示例
- **触发场景**：`npm run db:seed` 本地建库时

### 问题分析

#### 需要删除的内容

| 项 | 位置 | 说明 |
|----|------|------|
| seed 脚本 | `backend/scripts/seed-official-example.mjs` | 整个文件删除 |
| seed 入口 | `backend/scripts/seed.js` | 移除对 `seedOfficialExampleWorld` 的调用 |
| 常量文件 | `backend/scripts/fixture-constants.mjs` | 如无其他引用，清理相关常量 |
| 测试 hooks | `backend/test/hooks.mjs` | 检查是否有依赖，如有则改为用 CI 测试桩或直接创建 |
| `.env.example` | `backend/.env.example` | 检查是否有相关变量引用 |
| 文档 | `docs/WORLDS_AND_FIXTURES_ZH.md` | 删除本地/CI seed 相关描述 |

#### 删除前检查

- 确认 CI / E2E / smoke 测试不依赖此官方示例 seed
- 确认 `play-official-example` 等 E2E 测试用的是测试桩还是此 seed
- 如本地开发需要体验官方示例，改为引导直接连生产或用测试桩替代

---

## 问题四：自动化规则部分同步到主持端

> **处理状态：已完成（2026-06-25）**  
> 已在 Host 主持端接入规则管理闭环：`host/src/api.js` 同步后端规则 CRUD 与校验接口，`host/src/views/console.js` 在「规则运行与管理」卡片中提供新建、编辑、启停、删除、全量检查和 JSON 结构校验，`host/src/main.js` 补齐动作分发，`host/src/styles.css` 补齐弹窗与错误态样式。复杂可视化编排仍保留在创作者端，主持端提供轻量 JSON 管理以降低现场操作风险。验证：`npm run build --prefix host`、`npm test --prefix host`、实际打开 `http://127.0.0.1:5176/` 桌面/移动页面，无控制台错误。

### 问题描述

主应用（创作者端）的自动化规则功能需要同步迁移到 Host 主持端。目前主持端仅有「规则运行预览」（只读查看 + 手动触发），缺少完整的规则管理能力。主持人需要在主持端也能查看和管理自动化规则，而不只是预览运行状态。

### 影响范围

- **产品**：织幕主持端（host.getzhimu.com）
- **模块**：自动化规则
- **触发场景**：主持人在主持端需要查看/编辑规则时

### 问题分析

#### 当前主持端已有的规则功能

- 规则运行预览卡片（显示规则列表、条件评估状态）
- 手动触发规则按钮
- 规则详情查看（条件 + 动作）

#### 需要同步的内容

- 待梳理主应用自动化规则视图的全部功能，确认哪些需要迁移到主持端
- 规则的增删改查能力
- 规则可视化编辑器或 JSON 编辑器
- 规则校验
- 规则模板/示例

---

## 问题五：小游戏功能设计与实现

> **处理状态：阶段完成（2026-06-25）**  
> 已先完成不破坏现有流程的玩家端最小承载层：新增 `play/src/components/mini-games.js`，支持 `zhimu_lock` 数字密码锁运行态渲染；`play/src/views/game.js` 增加局中互动区域；`play/src/runtime/patch-game.js` 将小游戏区域纳入现有局部刷新；`play/src/room-events.js` 预留 `room.game_started` / `room.game_updated` / `room.game_completed` SSE 事件；`play/src/api.js` 预留 `/rooms/game/submit` 提交入口。验证：`node --check` 相关 play 文件、`npm run build --prefix play`。当前后端尚无 `current_game`、`game/submit`、`force-skip` 协议和表结构，因此数据库/API/主持一键跳过闭环需要先确认产品协议后继续实现。

### 问题描述

需要在织幕中添加小游戏功能（如数字密码锁、道具合成等），丰富剧本杀的互动体验。

### 影响范围

- **产品**：织幕全端（创作端 / 玩家端 / 主持端）
- **模块**：小游戏系统
- **触发场景**：剧本中触发解密、互动环节时

---

### 一、数据层：如何在模板与实例中表达小游戏？

按照"模板与运行实例分离"的原则，小游戏必须分为"配置态"和"运行态"。

#### 1. 创作端（世界/章节模板中）

创作者设计剧本时，小游戏只是一个"动作节点"或"线索附加属性"。在后端的数据库和前端的 zhimuState 中，它表现为一段静态的 JSON 配置：

```javascript
// 假设这是某个章节（chapter）数据中的一个节点
{
  "node_id": "plot_node_105",
  "type": "game_trigger", // 触发小游戏节点
  "game_config": {
    "game_type": "zhimu_lock", // 游戏类型：数字密码锁
    "title": "书桌上的密码箱",
    "prompt": "线索似乎藏在刚才那张泛黄的报纸里...",
    "answer": "1997",          // 触发通关的正确答案
    "max_attempts": 5          // 允许尝试的最大次数
  },
  "branches": {
    "success": "plot_node_106_win", // 成功后跳转的下一个剧情节点
    "fail": "plot_node_107_lose"    // 失败（或次数用尽）后跳转的节点
  }
}
```

#### 2. 玩家端（房间运行态中）

当玩家触发这个小游戏时，后端会通过 SSE（Server-Sent Events）向房间内的玩家广播一个事件。玩家端的 room-events.js 监听到该事件后，更新本地的运行态：

```javascript
// window.zhimuState.room_running_state
{
  "current_game": {
    "game_type": "zhimu_lock",
    "instance_id": "game_inst_999",
    "status": "playing", // playing, success, fail
    "attempts_left": 5,
    "shared": false     // 是否全房同步（false 表示每个人独立解密）
  }
}
```

---

### 二、客户端实现：原生 JS 模块化挂载

既然拥有 window.zhimuUi 和 window.zhimuViews，可以像乐高积木一样，将小游戏抽象为独立的渲染函数，由 zhimuRuntime 根据状态分发。

#### 1. 新建小游戏独立组件模块

在 src/components/（创作端）和 play/src/components/（玩家端）下，不要写散乱的 JS，而是利用类似现有的模式：

在玩家端，新建一个 play/src/components/miniGames.js，挂载到 window.zhimuUi.miniGames：

```javascript
// play/src/components/miniGames.js

window.zhimuUi.miniGames = {
  // 1. 数字密码锁模板
  renderLock: function(config, onSubmit) {
    const wrapper = document.createElement('div');
    wrapper.className = 'mini-game-lock-container';
    
    // 使用原生模板字符串生成 HTML，契合你们的模式
    wrapper.innerHTML = `
      <div class="game-header"><h3>${window.zhimuFormat.escapeHtml(config.title)}</h3></div>
      <p class="game-prompt">${window.zhimuFormat.escapeHtml(config.prompt)}</p>
      <div class="lock-inputs">
        <input type="text" maxlength="4" id="lock-input-val" placeholder="0000" />
        <button id="lock-submit-btn">尝试解锁</button>
      </div>
      <div class="game-error-msg" id="lock-error"></div>
    `;

    // 绑定原生事件
    wrapper.querySelector('#lock-submit-btn').addEventListener('click', () => {
      const inputVal = wrapper.querySelector('#lock-input-val').value.trim();
      // 回调给上层逻辑
      onSubmit(inputVal);
    });

    return wrapper;
  },

  // 2. 道具合成/拖拽模板
  renderDragAndDrop: function(config, onCombine) {
    // 采用原生 HTML5 Drag and Drop API 实现物品合并
    // 逻辑类似，返回一个 DOM 节点
  }
};
```

#### 2. 玩家端运行时调度

play/src/runtime/game.js 当状态发生改变（通过 SSE 触发或点击 UI 触发），渲染引擎负责切换视图：

```javascript
// play/src/runtime/game.js 中的视图渲染逻辑片段
function updateGameView() {
  const gameState = window.zhimuState.current_game;
  const container = document.getElementById('game-interaction-zone');
  
  if (gameState && gameState.status === 'playing') {
    // 1. 隐藏常规剧本/对话框
    document.getElementById('story-reader-zone').style.display = 'none';
    
    // 2. 根据类型动态渲染小游戏
    if (gameState.game_type === 'zhimu_lock') {
      const lockConfig = gameState.config; // 后端下发的配置
      const gameDom = window.zhimuUi.miniGames.renderLock(lockConfig, function(answer) {
        // 3. 玩家提交答案，直接调用 API 模块发送给后端
        window.zhimuApi.post(`/rooms/game/submit`, {
          instance_id: gameState.instance_id,
          answer: answer
        }).then(res => {
          if (!res.correct && res.attempts_left <= 0) {
             window.zhimuToast.show("机关锁死！解锁失败。");
          }
        });
      });
      
      container.innerHTML = '';
      container.appendChild(gameDom);
    }
  } else {
    // 恢复常规剧情阅读器（reader.js）
    document.getElementById('story-reader-zone').style.display = 'block';
  }
}
```

---

### 三、结合现有技术栈的 3 条关键建议

#### 1. 充分利用 SSE 的轻量级同步

既然没有用 WebSockets，而是采用 Express + PostgreSQL LISTEN/NOTIFY + SSE。对于剧本杀的"搜证和轻度解密"，SSE 的延迟和单向推送完全够用：

玩家 A 输对了密码 → 发送 HTTP POST 给后端。
后端验证成功 → 修改数据库中房间的运行实例状态（rooms 表）。
PostgreSQL 触发 NOTIFY → 后端 SSE 服务感知 → 向全房玩家广播 ROOM_GAME_SUCCESS。
所有玩家的 room-events.js 收到消息，自动更新 window.zhimuState 并刷新 UI，共同进入下一章节。

#### 2. 统一使用 window.zhimuModal 承载小游戏

为了不破坏现有的 game.js（游戏主界面）整体布局，最稳妥的做法是把小游戏丢进现有的弹窗壳（window.zhimuModal）里。触发小游戏时，直接调用 `window.zhimuModal.show({ title: '解密机关', body: gameDom })`。

这样既能保证主界面（如 LiveKit 语音状态、队友列表）不受影响，又能在空间上聚焦。

#### 3. 给主持端（host/）留出"物理外挂"

主持控制台（console.js）有单独的运行态。在设计小游戏时，一定要在主持端加一个"一键通关/一键跳过"的按钮。

当现场有玩家因为网络卡顿、或者死活猜不出密码导致卡关时，主持端可以发送一个 `POST /rooms/game/force-skip`。后端直接把游戏状态强制改为 success 并推给所有玩家。

这对于线上的剧本杀体验是绝对的刚需。

---

## 问题六：官网接入主持人入口

> **处理状态：已完成（2026-06-25）**  
> 已在 `site/index.html` 的顶部导航、Hero 行动区、三种视角卡片、内测 CTA 和页脚加入主持端入口，并在 `site/main.js` 支持后端 bootstrap 返回的 `hostConsole` / `hostUrl` 覆盖静态链接。验证：`npm run build --prefix site`、`node --test-concurrency=1 --test-force-exit --import ./test/hooks.mjs --test test/platform-site.test.js`。

### 问题描述

织幕官网（`site/index.html`）目前缺少主持人（Director/Host）独立入口。现有「三种视角」板块中，创作者和玩家都有对应的入口按钮，唯独主持人只有文字描述，没有跳转链接。需要在官网的多处位置接入主持端入口（`host.getzhimu.com`）。

### 影响范围

- **产品**：织幕官网（getzhimu.com）
- **模块**：官网首页入口导航
- **触发场景**：主持人从官网进入主持端时

### 问题分析

#### 当前官网已有入口

| 位置 | 创作者入口 | 玩家入口 | 主持人入口 |
|------|-----------|---------|-----------|
| 顶部导航右侧 | ✅ `app.getzhimu.com` | ✅ `play.getzhimu.com` | ❌ 缺失 |
| Hero 主行动区 | ✅ 「我是创作者 · 开始创作」 | ✅ 「我是玩家 · 输入邀请码」 | ❌ 缺失 |
| 三种视角板块 | ✅ 「进入创作者端」按钮 | ✅ 「进入玩家端」按钮 | ❌ 缺失（仅文字描述） |
| 页脚导航 | ✅ 创作者端 / 创作者登录 | ✅ 玩家端 | ❌ 缺失 |

#### 需要接入的位置

1. **顶部 header-actions**：增加主持端入口按钮（或在下拉/更多菜单中）
2. **Hero 行动区**：考虑是否增加第三个入口，或调整为三入口布局
3. **三种视角板块（role-section）**：给主持人卡片加上「进入主持端」按钮，链接到 `https://host.getzhimu.com/`
4. **页脚导航**：增加「主持端」链接
5. **内测表单意向选项**：已有 `host` 选项，需确保提交后引导正确

---

## 问题七：主应用（创作者端）全量加载

> **处理状态：阶段完成（2026-06-25）**  
> 已将 `src/runtime/data.js` 的运行态与资源态接口按当前视图收窄：玩家页只拉玩家/探索/最新复盘，主持页才拉玩家进度、线索矩阵和审计，归档页才拉 checkpoint/recap，资源/配额/创作者检查只在需要的视图启动；房间成员权限错误也从单一接口扩展到所有实际调用的房间接口，避免跳过主持接口时无法自动恢复。验证：`node --check src/runtime/data.js`、`npm run build`、`npm run check:modules`、实际打开 `http://127.0.0.1:5173/` 桌面/移动页面，无控制台错误。仍保留基础世界/studio 数据的首屏加载，后续可结合问题十做按需模块与按需数据进一步拆分。

### 问题描述

主应用（创作者端）每次加载数据时，一次性加载十几类数据，不管用户当前在哪个视图。导致首屏慢、切换视图卡、每次刷新都要等很久。

### 影响范围

- **产品**：织幕创作者端（app.getzhimu.com）
- **模块**：全局数据加载
- **触发场景**：页面刷新、切换世界、点击「刷新」按钮

### 问题分析

#### 当前加载的全部数据

`loadCloudDataInternal()`（`src/runtime/data.js`）一次性加载：

| 类别 | 数据项 | 是否每个视图都需要 |
|------|--------|-------------------|
| 基础 | 世界列表（catalog） | ✅ 是 |
| 基础 | studio 全量数据（场景/线索/物品/调查点/章节/角色/分幕） | 仅 studio/writer/clues 等视图需要 |
| 运行时 | 玩家进度（hostPlayers） | 仅 director/player/overview 需要 |
| 运行时 | 待确认事件（hostEvents） | 仅 director/overview 需要 |
| 运行时 | 探索数据（exploration） | 仅 player 视图需要 |
| 运行时 | 线索矩阵（clueMatrix） | 仅 director 需要 |
| 运行时 | 存档列表（checkpoints） | 仅 archive/director 需要 |
| 运行时 | 复盘列表（recaps） | 仅 archive/director 需要 |
| 运行时 | 世界日志（worldLogs） | 仅 director/overview 需要 |
| 运行时 | 规则列表（rules） | 仅 rules/studio 需要 |
| 运行时 | 审计日志（auditLog） | 仅 director 需要 |
| 资源 | 资产列表（assets） | 仅 assets/writer 需要 |
| 资源 | 存储用量（storageUsage） | 仅 account/settings 需要 |
| 资源 | 创作者检查（creatorChecks） | 仅 overview/settings 需要 |
| 语音 | 语音消息（voiceMessages） | 仅 player 语音 tab 需要 |

**问题**：80% 的数据在大多数视图下都是不需要的，但每次都全量加载。

---

## 问题八：主应用全局全量重渲染

> **处理状态：阶段完成（2026-06-25）**  
> 已在 `app.js` 的最终内容写入层增加 `setContentHtml()` 内容缓存，相同 HTML 不再重复替换 `#content.innerHTML`，从而减少重复重绑、输入焦点丢失和无意义 DOM 重建；动态视图加载错误态也复用同一写入路径。验证：`node --check app.js`、`npm run check:modules`。这不是完整虚拟 DOM/局部 patch 重构，后续仍可继续对 studio/clues/director 做视图级局部更新。

### 问题描述

主应用每次任何状态变化，都是全量替换整个页面的 innerHTML。数据量大的时候（比如几百条线索、几十个场景），切视图、点按钮都会明显卡顿。

### 影响范围

- **产品**：织幕创作者端（app.getzhimu.com）
- **模块**：全局渲染机制
- **触发场景**：任何交互导致状态变化时

### 问题分析

#### 当前渲染方式

- 入口：`window.zhimuRender()` → 全量 `app.innerHTML = renderApp()`
- 16 个视图全部用 innerHTML 字符串拼接渲染
- 没有虚拟 DOM，没有局部更新机制
- 每次状态变化（哪怕只是改一个搜索框的值）都会重建整个 DOM

#### 对比

- **玩家端（play）**：有 `patchGameView()` / `patchSyncChrome()` 等局部更新机制，只更新变化的部分
- **主应用（creator）**：全部全量重绘，没有任何 patch 优化

#### 影响最严重的视图

1. **编排台（studio）**：节点多、连线多，每次筛选/缩放全量重绘
2. **线索列表（clues）**：几百条线索时，每次搜索全量重渲
3. **主持台（director）**：数据多，每次刷新卡很久

---

## 问题九：编排台（studio）图谱 DOM 节点过多

> **处理状态：阶段完成（2026-06-25）**  
> 已在 `src/views/studio.js` / `src/runtime/actions-studio.js` 增加「折叠全部 / 展开全部」场景分支控制，复用现有场景子节点统计，支持创作者快速减少可见节点和连线数量；移动端还新增节点目录，最多展示前 80 个可见节点，配合筛选和折叠降低小屏 DOM 压力。验证：`node --check src/views/studio.js`、`npm run build`、`npm run check:modules`。这不是 canvas/虚拟化重构，超大型图谱后续仍建议继续推进局部渲染或画布化。

### 问题描述

剧情编排台的图谱是纯 DOM + CSS 实现的，不是 canvas。节点多了以后（50+ 场景/线索/调查点），DOM 节点数量爆炸，操作卡顿。

### 影响范围

- **产品**：织幕创作者端（app.getzhimu.com）
- **模块**：剧情编排台（studio）
- **触发场景**：节点数量较多的剧本，进行筛选、缩放、自动排布、拖动时

### 问题分析

#### 当前实现方式

- 每个节点是一个 `<button class="node">` + 多个子元素（badge、title、desc、drag handle、多个 link handle）
- 每条连线是 SVG `<path>`
- 全部放在 `.graph-canvas` 容器里，用 CSS transform 做缩放
- 每次状态变化全量重建所有节点和连线

#### 潜在性能瓶颈

| 场景 | 节点数 | DOM 元素估算 |
|------|--------|-------------|
| 小型剧本（10场景 + 20线索 + 10调查点） | 40 节点 | ~400 元素 |
| 中型剧本（30场景 + 80线索 + 30调查点） | 140 节点 | ~1500 元素 |
| 大型剧本（100场景 + 300线索 + 100调查点） | 500 节点 | ~5000 元素 |

**问题**：大型剧本下，每次筛选/缩放/拖动都会重建几千个 DOM 节点，明显卡顿。

---

## 问题十：主应用首屏模块加载过多

> **处理状态：已完成（2026-06-25）**  
> 已新增 `src/runtime/view-loader.js`，将 writer/studio/clues/rules/director/player/archive/settings/account 等普通功能页与对应动作处理器改为按视图动态加载；`frontend/main.js` 只保留首屏总览、认证、数据、导航、弹窗、向导等核心模块；`app.js` 增加视图模块加载态和加载失败兜底；`scripts/verify-script-load.mjs` 改为先验证核心首包，再验证懒加载模块。验证：`npm run check:modules`、`npm run build`，入口 JS 从约 506KB 降到约 189KB，Vite 500KB chunk 警告已消失；实际打开 `http://127.0.0.1:5173/` 并切换剧情编排、玩家视角、账号与资产，页面无控制台错误。

### 问题描述

主应用首屏一次性 import 了 60+ 个模块，包括所有视图、所有运行时、所有组件。没有按需加载，首屏 JS 体积大，加载慢。

### 影响范围

- **产品**：织幕创作者端（app.getzhimu.com）
- **模块**：前端构建 / 入口
- **触发场景**：用户首次打开应用时

### 问题分析

#### 当前加载方式

- `frontend/main.js` 一次性 import 了所有模块（约 68 个 import）
- 包括：writer（剧本编辑器）、studio（编排台）、rules（规则引擎）、director（主持台）等大模块
- 用户可能只用其中 1-2 个功能，但全部都加载了

#### 对比

- **玩家端（play）**：模块化做得更好，ES Module + 按需加载
- **主应用（creator）**：还是老式的全量加载，所有模块挂 window

---

## 问题十一：主应用 vs Host 端大量代码重复

> **处理状态：阶段完成（2026-06-25）**  
> 已先收敛主应用主持台与 Host 端最明显的行为差异：`src/views/director.js` 中主持手动操作后的全量 `loadCloudData()` 已迁移为 `refreshHostRoom()` / `refreshHostPlayers()` / `refreshHostClueMatrix()` 局部刷新，与 Host 端策略同步，避免两端在性能和数据刷新粒度上继续分叉。验证：`node --check src/views/director.js`、`npm run check:modules`。代码删除级合并仍需等 Host 端功能覆盖稳定后再做。

### 问题描述

Host 主持端是从主应用的 director 视图独立出来的，两边的状态管理、API 调用、UI 渲染逻辑有大量重复代码。以后改功能要改两边，很容易不一致。

### 影响范围

- **产品**：织幕全端
- **模块**：主应用 director 视图 + Host 端 console 视图
- **触发场景**：任何主持台相关的功能修改

### 问题分析

#### 重复的代码

| 功能 | 主应用位置 | Host 端位置 |
|------|-----------|------------|
| 数据加载 | `src/runtime/data.js` | `host/src/runtime/data.js` |
| 主持台视图 | `src/views/director.js` | `host/src/views/console.js` |
| SSE 事件 | `src/runtime/room-events.js` | `host/src/runtime/room-events.js` |
| API 调用 | `src/api/client.js` | `host/src/api.js` |
| 状态管理 | `src/state.js` | `host/src/state.js` |
| 邀请/存档/复盘弹窗 | `src/runtime/invite.js` | `host/src/runtime/invite.js` |
| UI 组件（modal/toast 等） | `src/components/` | `host/src/components/` |

#### 风险

- 功能修改需要改两边，容易漏改
- 两边行为可能不一致
- 维护成本翻倍

#### 后续计划

> **待负责人验收 Host 端功能完整后，考虑删除主应用的 director 视图及相关重复代码。**
> 
> 验收标准：Host 端功能 100% 覆盖主应用 director 视图，且稳定运行一段时间。
> 
> 删除范围：`src/views/director.js`、`src/runtime/actions-director.js`、以及 data.js / state.js 中仅 director 用的字段和逻辑。

---

## 问题十二：主应用全局变量挂载模式

> **处理状态：阶段完成（2026-06-25）**  
> 已新增 `src/runtime/dependency-guard.js`，在主应用启动前检查关键 `window.zhimu*` 依赖是否完整，缺失时渲染统一错误态并输出缺失清单；`frontend/main.js` 与 `scripts/verify-script-load.mjs` 已同步入口顺序，`app.js` 启动时调用守卫，降低加载顺序错误导致半初始化的风险。验证：`node --check src/runtime/dependency-guard.js app.js`、`npm run check:modules`。这一步是安全护栏，完整 ES Module 显式 import/export 迁移仍需分批推进。

### 问题描述

主应用所有模块都挂在 `window.zhimuXxx` 上，没有明确的依赖关系，加载顺序错了就崩。类型安全差，重构风险高。

### 影响范围

- **产品**：织幕创作者端（app.getzhimu.com）
- **模块**：前端架构
- **触发场景**：新增模块、重构、调整加载顺序时

### 问题分析

#### 当前模式

- 所有模块挂在 `window.zhimuState` / `window.zhimuApi` / `window.zhimuUi` / `window.zhimuViews` / `window.zhimuRuntime` 等全局对象上
- 模块之间通过全局变量互相调用，没有显式 import
- 加载顺序由 `frontend/main.js` 的 import 顺序决定，顺序错了直接报错
- 没有类型定义，IDE 智能提示差

#### 对比

- **玩家端（play）**：已经改用 ES Module，显式 import/export
- **Host 端**：也已经改用 ES Module
- **主应用（creator）**：还是老模式，技术栈落后于其他两端

---

## 问题十三：错误提示和加载状态不统一

> **处理状态：阶段完成（2026-06-25）**  
> 已新增 `src/components/status-ui.js` 作为统一的 loading / empty / error 状态渲染器，并接入 `frontend/main.js` 与 `scripts/verify-script-load.mjs`；`app.js` 的动态视图模块加载态/加载失败态、`src/components/service-outage.js` 的云端中断页、`src/runtime/global-search.js` 的搜索空态/加载态/错误态、`src/views/account-hub.js` 与 `src/views/account.js` 的账号加载/空/错误态已改为统一组件；`src/runtime/data.js` 的主持运行数据刷新错误 toast 也开始统一走 `zhimuStatus.normalizeError()`。验证：`node --check` 相关文件、`npm run check:modules`、`npm run build`，并实际打开 `http://127.0.0.1:5173/` 检查账号入口和搜索入口，无页面控制台错误。视图内零散空态和 catch 仍需后续批量迁移，因此暂标阶段完成。

### 问题描述

主应用的错误提示、加载状态、空状态在各个视图中不统一。有些地方用 toast，有些直接显示在页面上，有些 catch 是空的，出错了用户没感知。

### 影响范围

- **产品**：织幕创作者端（app.getzhimu.com）
- **模块**：全局用户体验
- **触发场景**：网络错误、加载失败、空数据时

### 问题分析

#### 不统一的地方

1. **错误提示**：
   - 有些地方 `showToast(error.message)`
   - 有些地方直接把错误信息塞到页面 HTML 里
   - 有些 catch 是空的，静默失败

2. **加载状态**：
   - 有些视图有 loading 骨架
   - 有些视图只有一个转圈或文字
   - 有些视图加载中是空白的

3. **空状态**：
   - 每个视图的空状态样式都不一样
   - 有些空状态有引导按钮，有些没有

---

## 问题十四：编排台移动端适配问题

> **处理状态：阶段完成（2026-06-25）**  
> 已在 Studio 中加入移动端节点目录、窄屏工具栏换行、画布高度约束和节点目录样式；小屏下保留画布但先提供目录定位能力，避免固定宽画布成为唯一入口。验证：`npm run build`、`npm run check:modules`，并实际打开 `http://127.0.0.1:5173/` 后切换到 390×844 视口，页面无横向溢出、无控制台错误。当前本地未连接后端真实世界数据，因此只能验证断点壳层与错误降级，真实大图谱手感仍需接入测试世界后复测。

### 问题描述

剧情编排台（studio）的图谱是固定像素布局（最小 1200px 宽），手机上看会横向溢出，基本没法操作。

### 影响范围

- **产品**：织幕创作者端（app.getzhimu.com）
- **模块**：剧情编排台（studio）
- **触发场景**：在手机或平板上打开编排台时

### 问题分析

#### 当前布局

- 画布最小宽度 1200px，最大 2800px
- 节点尺寸固定 172×140 像素
- 三栏布局（左侧树 + 中间画布 + 右侧 inspector）
- 没有响应式适配，小屏幕下只能横向滚动

#### 影响

- 手机上基本没法用编排台
- 平板上体验也很差
- 创作者只能在电脑上工作

---

## 状态

- **当前状态**：部分完成（问题一、二、三、四、六、十已完成并验证；问题五、七、八、九、十一、十二、十三、十四阶段完成并验证；小游戏后端协议与主持强制跳过闭环待确认后继续）
- **负责人**：荆湛彭
