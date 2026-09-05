# P7 Playable Vertical Slice V1 — 范围冻结

> 裁决：优先 **Playable vertical slice**，**P6.1 LLM 措辞后移**。  
> 依据：创作前半程链条已在 `6723977` 闭合；下一刀验证「织幕能否让完整剧本真正开完一局」。

## 一句话目标

**拿一本已经写完的完整剧本，打通一次完整开本。**  
不是建设完整 Runtime 全家桶；不是 STORY runtime；不是把 39 个 GAME 全接上。

```text
完整剧本
→ Lossless / Structured Import
→ Playable Compile
→ 创建房间
→ 玩家入场 + 角色分配
→ 主持推进分幕
→ 发线索 / 发内容
→ M03 竞价（结果改权限）
→ 继续分幕
→ M09 投票结算
→ 游戏结束
```

**成功硬标准第 13 条**：一整局从开始到结束无需开发者手改数据库。

---

## 阶段总览（冻结）

```text
创作前半程
────────────────
IA                        ✅
Story Engine              ✅
Persistence               ✅
Integrator                ✅
Semantic Bridge           ✅
Production Master Draft   ✅  (P6.0)

运行后半程（本文件）
────────────────
Playable Compiler         ← P7 主线
Content Runtime
GAME Bridge（先 M03 + M09）
Player Client（瘦）
Host Console（关键）
One Full Session

后移
────────────────
P6.1 Optional LLM Rendering
M10/M11 Content Pack
39 GAME 全接
完整世界状态 / 12 世界域
社区 / 商业化 / 匹配 / 聊天
```

---

## 为什么不先做 P6.1

| P6.0 已够用 | P6.1 做不到的 |
|---|---|
| 结构忠实、可审阅、可继续加工 | 不验证「文字+分幕+角色+线索+GAME」能否开完一局 |
| Deterministic Source 永不丢 | 润色只是锦上添花插件 |

以后：

```text
ProductionMasterDraft
  → [可选] AI 润色这一段
```

底稿永远可回放。

---

## 第一版 Fixture 边界（极重要）

**第一条 playable fixture 必须用已写完的完整剧本。**

禁止：

```text
AI ProductionMasterDraft → 直接开本测 Runtime
```

原因：分不清是 Runtime 坏了，还是内容本身不完整。

路径顺序：

1. **P7.0** 完整剧本 → Import → Playable Compile → Full Session  
2. **之后** 织幕母稿 → 作者补全 → Playable Compile  
3. 两条路径汇合到同一 `PlayableProject`

---

## 五个核心对象（只这些）

### 1. `PlayableProject`

编译好的线上剧本：`roles[]` · `stages[]` · `contentUnits[]` · `clues[]` · `mechanismPlacements[]` · `startStageId`

### 2. `ContentUnit`

玩家真正消费的统一单元：`TEXT | CLUE | REVEAL | CHOICE | SYSTEM` + `stageId` + `visibleTo[]` + `unlockCondition` + `content` + `sourceRef`

### 3. `StageRuntime`

当前幕：`unlockedContentIds` · `releasedClueIds` · `startedMechanismIds` · 轻量 `worldState`（第一版极简）

### 4. `MechanismPlacement`

把现有 GAME 模板钉到幕与触发上：`mechanismTemplateId` · `stageId` · `trigger` · `participants` · `intro` · `runtimeConfig` · `outcomeBindings[]` · `fallback`

### 5. `RuntimeEffect`（第一版只四个）

```text
PERMISSION_GRANT
PERMISSION_REVOKE
STATE_APPLY
STATE_CLEAR
```

禁止先上 ENTITY_* 全家桶。

---

## GAME 桥接范围

| 接 | 验证点 |
|---|---|
| **M03 竞价** | 多人操作 → 一结果 → 赢家权限 |
| **M09 投票** | 多人提交 → 聚合 → 全局结算（终幕指凶） |

不接其余 37 个 GAME 模板。不实现 STORY（M01/M07/M08）runtime。

---

## 端侧最低集

### 主持（必须）

发内容 / 发线索 / 开机制 / 看结果 / 补发 / 推进幕 / **override**（强制解锁、重开机制、修正结果、跳过、直接下一幕）

### 玩家（瘦）

我的角色 · 当前幕 · 角色正文 · 获得线索 · 机制入口 · 系统通知  

不做：聊天、语音、地图、3D 搜证、社区、商城。

### 房间流程（必须真跑）

创建房间 → 房间码 → 6 人加入 → 分配角色 → 开局 → Stage 链 → M03 → M09 → 结束

---

## Compiler vs Runtime

```text
Authoritative Source (完整剧本)
  → Compiler → PlayableProject
  → Runtime 只执行：谁 / 何时 / 能看什么 / 能做什么 / 结果改什么
```

Runtime **不**重新理解文学文本。

---

## 成功标准（硬）

1. 完整剧本可编译为 `PlayableProject`  
2. 6 玩家各自看到正确角色内容  
3. 不该看的绝对看不到  
4. 主持可推进 Stage 1 → 终幕  
5. 线索可按阶段 / 主持操作发放  
6. M03 实际跑一次  
7. M03 结果改变某玩家后续内容权限  
8. M09 实际跑一次  
9. 投票进入最终结算  
10. 玩家刷新/重连状态不丢  
11. 主持刷新/重连局不丢  
12. 主持可 override  
13. **一整局无需开发者手改数据库**

API tests pass ≠ vertical slice 成功。

---

## 本轮明确禁止

```text
❌ P6.1 LLM 文案
❌ STORY runtime
❌ 37 STORY 全 COMPLETE / 39 GAME 全接
❌ 完整世界状态系统 / 12 世界域
❌ 社区 / 母稿热度 / 商业化 / 匹配 / 多人聊天
❌ Canon / v42 主路径绑架
```

---

## 仓库现状（开工前盘点）

| 已有 | 缺口 |
|---|---|
| 房间创建/邀请码/加入/选角（`creator-room-*` / `player-access-*` / `play/` / `host/`） | 无 `PlayableProject` / `ContentUnit` / `StageRuntime` 命名与合同 |
| 主持控制台、玩家读本、线索与 section unlock | 无真正 `MechanismPlacement` 绑定 outcome |
| M03/M09 **模板引擎**在 `shared/mechanism-templates.js` | **未**桥进房间 runtime；房间机制是另一套 package |
| 房间内投票（content-platform vote） | ≠ M09 模板结算管道 |
| `PERMISSION_GRANT` / `STATE_APPLY` 仅在目录/设计文 | **未**进 `shared/mechanism-effects.js` 可执行层 |
| DOCX/ZIP/script-bundle import | 未编译成 P7 `PlayableProject` |
| P6 `gameMechanismSlots` | 仅 hint，不驱动开本 |

**策略**：复用房间/主持/玩家壳与 M03/M09 模板语义；新建 Playable 合同 + Placement + 四 effect + 一条 fixture 全流程；避免再造并行房间系统。

---

## 建议切片顺序

```text
P7.0  PlayableProject + ContentUnit 合同 + 一本 fixture 编译  ✅ 实现中/见下方
P7.1 Content Runtime
P7.2 MechanismPlacement + M03 + PERMISSION_GRANT 闭环
P7.3 M09 + 终局结算
P7.4 Host override + 重连持久化
P7.5 一整局验收（标准 1–13）
```

## P7.0 实现入口

| 层 | 路径 |
|---|---|
| 合同 | `shared/playable-project-contracts.js` |
| Fixture | `shared/playable-fixtures/warehouse-six.js` |
| Compiler | `shared/playable-project-compiler.js` |
| 持久化 | `backend/migrations/130_world_playable_projects.sql` + `playable-project-service.js` |
| UI | `src/views/creator-playable-compile-workbench.js` |
| 报告 | `docs/P7_PLAYABLE_FIXTURE_COMPILE_REPORT.md` |

原则：**已开局 session 固定使用开局时的 playable snapshot**（`runtimeConfig.pinSnapshotOnSessionStart`）。
