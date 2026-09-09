# M12 Formation Production Slice V1

> **状态：F4B 已落地（Beat Compiler V1，待人工审）· F4C 未开**  
> 规格基线：[`M12_FORMATIONATION_CONTRACT_V1_ZH.md`](./M12_FORMATIONATION_CONTRACT_V1_ZH.md) ✅ GOLDEN @ `05164fe`  
> 分级基线：[`STORY_MECHANISM_FORMATIONATION_GRADING_ZH.md`](./STORY_MECHANISM_FORMATIONATION_GRADING_ZH.md) @ `16716ab`  
> **规格层 GOLDEN ≠ 生产层已具备。pack 内 M12-1 仍 = GAP_HIGH。**  
> F1 ✅ FROZEN（`0c4f191` + Hardening `e67e1e9`：缺失语义保留 null，不得 normalize 成成立）  
> F2 ✅ FROZEN @ `17953bd`（Blueprint + Builder + 双 fixture + Authority Hardening）  
> F3 ✅ FROZEN @ `d9a86c9`（Validator/Gate + 直接谈判桌反例 + Semantic Hardening：  
> Visible ≠ Owned / 杠杆可见 ≠ 可支配 / Fact ≠ Need）  
> Packet V1.1 Fidelity Patch ✅ FROZEN @ `8a93a23`（provenance 投射 + publicCastDirectory）  
> Content Preview V1 ✅ PASS（两轮 real A/B + Run #3）  
> F4A ✅ FROZEN @ `bc2c44a`（Role-Relative Projection V1；冻结备注：INLINE_ARROW_STRIP  
> = F4A V1 rendering heuristic ≠ universal semantic parser，不得扩散进 Beat compiler）  
> F4B Beat Compiler V1 已落地：16 节点 → 4 Beat（Node ≠ Beat），待人工审

## 一句话

```text
把已经 GOLDEN 的 M12 Formation，
从「文档里成立」变成「生产链真的能生成、保存、验证、投影」。
```

## 锁死顺序

```text
M12 pack 提供 Formation Blueprint（问题）
        ↓
生成 M12FormationArtifact（答案 / 实例）
        ↓
Formation Gate 验证
        ↓
Integrator 吃 Formation Beats（非每个 Node 一幕）
        ↓
PMD / Packet 能看到信息来源与接触理由
        ↓
离线 Gold + Negative replay
        ↓
（以后）Projection Survival
        ↓
（更以后）真 Writer RPT #1D
```

**不是** `pack → Writer` 直接硬塞。  
**不是** 一口气全库 Formation。  
**不是** 自动重开 P6 / Voice / M07 / M08。

---

## 分层原则（钉死）

| 层 | 职责 |
|---|---|
| **pack `formationBlueprint`** | 只定义「需要形成哪些能力 / 禁止什么」 |
| **`M12FormationArtifact`** | 存**实例化后**的完整 Formation（节点、证明、绑定） |
| **Gate** | 只答「不靠作者喊话能否形成接触理由」 |
| **Integrator** | 吃 `formationBeats[]`，接到既有 Resolution 前 |
| **Resolution** | `PROBE→NEGOTIATE→EXCHANGE→AFTERMATH` **不改** |

> Artifact 存答案；pack 只提问题。  
> **禁止**把《闭馆之后》N1–N12 写死进 pack。

---

## 切片地图

| ID | 名称 | 产出 | 本阶段 |
|---|---|---|---|
| **F1** | Formation Artifact 合同 | `shared/m12-formation-contracts.js` · `fixtures/m12-formation/` | ✅ 本刀 |
| **F2** | Blueprint + Builder | pack blueprint + `buildM12FormationArtifact` | 紧随 F1 |
| **F3** | Validator / Gate | 结构错误码 → `FORMATION_READY` / `REVIEW_REQUIRED` | |
| **F4** | Integrator Formation Beats | `formationNodes` ≠ `formationBeats`；接到 PROBE 前 | |
| **F5** | Gold + Negative Replay | `scripts/m12-formation-gold-replay.mjs` + 反例 | |
| — | **Implementation Gate** | 见下方 12 条 | F1–F5 全绿 |
| **F6** | Projection Survival | Artifact→Outline→PMD→Packet probe | 第二阶段 |
| **F7** | Real Writer RPT #1D | 真模型闭环 | 更后 |

---

## F1 — Artifact（优先）

建议模块（落地时再建，现仅规格）：

```text
shared/m12-formation-contracts.js
shared/m12-formation-builder.js
shared/m12-formation-validator.js
```

核心形状：

```js
M12FormationArtifact = {
  sourceBlockId,
  templateId: "M12-1",
  revision,
  seekerId,
  holderId,
  stakeRef,
  valueSource,
  existenceSource,
  knowledgePath,
  locatorPath,
  counterpartLeverage,
  leverageProvenance,
  counterpartNeed,
  trigger,
  formationNodes: [],   // 因果信息单位
  formationBeats: [],   // 大纲可编排单位（可压缩多 node）
  formationProof: {},
  status
}
```

每个 `formationNode` 至少：

```js
{
  id, kind,
  holderIds, visibleToIds,
  reveals, requires,
  acquire: { method, stage, role }, // GUARANTEED | CONFIDENCE_BOOST | OPENING_OWNED
  provenance
}
```

持久化倾向（additive sidecar，不先动 P6）：

```text
ProjectStoryState.m12FormationArtifacts
MasterOutlineDraft.formationBeatRefs
Writer Packet.formationView   // 更后
```

---

## F2 — pack Blueprint only

`story-mechanism-m12-pack.js` **只**增加类似：

```js
formationBlueprint: {
  requiredCapabilities: [
    "VALUE_SOURCE", "EXISTENCE_SOURCE", "KNOWLEDGE_PATH", "LOCATOR_PATH",
    "LEVERAGE_PROVENANCE", "COUNTERPART_NEED", "NEED_RECOGNITION", "WORLD_TRIGGER"
  ],
  forbid: [
    "UNSOURCED_ANSWER", "UNSOURCED_LEVERAGE",
    "PREWRITTEN_DEAL", "META_PROMPT_DEPENDENCY"
  ]
}
```

Builder 输入只允许：accepted M12 block · ProjectStoryState · 角色/plot 绑定 · ContextProfile · 作者已确认事实。  
F2 第一版可用 Golden Sample 做 **deterministic fixture**，**不接真实 LLM**。

---

## F3 — Formation Gate 错误码（约 9+2）

```text
FORMATION_VALUE_UNSOURCED
FORMATION_EXISTENCE_UNSOURCED
FORMATION_KNOWLEDGE_PATH_MISSING
FORMATION_LOCATOR_PATH_MISSING
FORMATION_LEVERAGE_UNSOURCED
FORMATION_COUNTERPART_NEED_MISSING
FORMATION_NEED_NOT_RECOGNIZABLE
FORMATION_TRIGGER_NOT_PERCEIVABLE
FORMATION_PREWRITTEN_DEAL

FORMATION_SINGLE_POINT_DEPENDENCY
FORMATION_META_PROMPT_DEPENDENCY
```

结果：`FORMATION_READY` | `FORMATION_REVIEW_REQUIRED`  
**不评**文笔 / 心理 / 全员体验 / Writer。

放置：

```text
M12 accepted block → Artifact → Gate → FORMATION_READY → Master Outline Integrator
```

**不在** Writer 前才检查。

---

## F4 — Integrator

- 不改 Resolution 四段  
- Formation → 前置 beats（例：`FORMATION_OBSERVE/INFER/TRACE/LOCATE/LEVERAGE/TRIGGER`）再接 `PROBE…`  
- **Node ≠ Beat**：禁止默认 12 node = 12 幕  

---

## F5 — Replay

```bash
# 预期（落地后）
node scripts/m12-formation-gold-replay.mjs
# → captures/m12-formation-gold-replay.json
# FORMATION_READY, issues=[]
```

另做反例 fixture（旧「直接谈判桌」），至少期望：

```text
FORMATION_EXISTENCE_UNSOURCED
FORMATION_LOCATOR_PATH_MISSING
FORMATION_LEVERAGE_UNSOURCED
FORMATION_NEED_NOT_RECOGNIZABLE
FORMATION_META_PROMPT_DEPENDENCY
```

坏样本若也能 PASS → Gate 无效。

---

## Implementation Gate（F1–F5 PASS）

```text
1.  M12FormationArtifact 有正式合同
2.  ProjectStoryState 能保存/恢复 artifact
3.  M12 pack 只有 blueprint，不硬编码 Gold Sample
4.  validator 判 Gold Sample → READY
5.  validator 判旧「直接谈判桌」→ 失败
6.  Formation beat 能进入 Integrator
7.  不修改既有 M12 Resolution
8.  不修改 M07/M08
9.  不修改 Writer
10. 不修改 P9.4
11. 不开跨族 Formation schema
12. 不跑真模型
```

全绿 → **M12 Formation Implementation V1 ✅**  
此时 **仍不**自动把官方 Formation 等级从 `GAP_HIGH` 升 `OK`。

---

## 第二阶段 F6 — Projection Survival

```text
Gold Artifact → Master Outline → PMD → Role Packet
```

检查沈岚/梁赫/白绫材料是否仍保有：无开场 holder 答案、N1/N2、N4/N5 可达、有来源 N10、可见 N11b、感知 N12；白绫不强制告知等。  
PASS 后才说明 Formation 进入角色生产输入。

---

## 第三阶段 F7 — RPT #1D

真 Writer；测完整：

```text
Intent → STORY → Formation → Resolution → Integrator → PMD → Packet → Writer
```

存活后再重评 pack 内 M12 Formation 等级。

---

## 明确不做（本 Slice 全程）

```text
🚫 M07 / M08 Formation
🚫 全族 Formation schema
🚫 Voice V2 / Host 修复 / P9.4 改分
🚫 Full Cast Experience Gate
🚫 为「以后可能」先动已冻结 P6 核心（除非 Survival 证明必然丢失）
```

---

## 授权协议

```text
F1 = 已落地并 FROZEN（Artifact 合同 + Gold fixture + sidecar + Hardening）
F2 = 已 FROZEN（Blueprint + Builder + 双 fixture + Authority Hardening）
F3 = 已授权并落地（Validator/Gate + Gold/Alt PASS + 直接谈判桌 FAIL），待人工审
开始 F4 = 需要明确：「开始 F4」或「开始 M12 Formation Beats + Integrator」
```

## F1 落地清单

```text
✅ shared/m12-formation-contracts.js
✅ ProjectStoryState.m12FormationArtifacts[]
✅ fixtures/m12-formation/closed-after-hours-gold.json
✅ scripts/m12-formation-artifact.test.mjs
✅ Hardening：mode/type/proof 缺失 → null，负例 ×3，roundtrip 全量 deepEqual（e67e1e9）
🚫 Builder / Gate / Integrator / Writer（F2+）
```

## F2 落地清单

```text
✅ pack formationBlueprint（story-mechanism-m12-pack.js）：9 requiredCapabilities + 3 forbiddenSemantics，零剧情内容
✅ shared/m12-formation-builder.js：buildM12FormationArtifact（deterministic，不接 LLM）
✅ fixtures/m12-formation/sealed-room-alt-topology.json（不同 topology：holder 公开已知、未知=holder 需求、推断式识别）
✅ scripts/m12-formation-builder.test.mjs（25 tests：正负例 20 + 权威 5）
✅ Blueprint 能力覆盖检查：requiredCapabilities 每项必须落到具体节点/引用
✅ 预写成交原文（gave/received/tradeCompleted/exchangeResult、非 OPEN resolution）→ 拒绝，不借 normalize 洗白
✅ Authority Hardening（PARTIAL_PASS blocker 收口）：
   入口 = { state, sourceBlockId, authoredFormation{stake,nodes,formation,proof}, artifactId }
   projectId ← state.projectId；block ← state.mechanismBlocks[sourceBlockId]
   revision ← block.revision；participants ← block.roleBindings
   调用方无权另行提供 projectId/block/revision/participants（传入即被忽略）
   STATE_BLOCK_NOT_FOUND / STATE_MISSING 错误码；contextProfile 不假装消费
🚫 Gate / Integrator / Writer / 真模型（F3+）
```

## F3 落地清单

```text
✅ shared/m12-formation-validator.js：validateM12Formation({ state, artifactId })
   只读 · deterministic · 不跑 LLM；decision = FORMATION_READY | FORMATION_REVIEW_REQUIRED
   （READY 是 Gate decision，不是 Artifact lifecycle status，不回写）
✅ 基础 blocker：STATE_MISSING / FORMATION_ARTIFACT_NOT_FOUND / FORMATION_ARTIFACT_STALE /
   FORMATION_ARTIFACT_NOT_READY（STALE/DRAFT 一律 BLOCK）
✅ 11 主错误码全部实现：
   guaranteed spine 算法（存在 + 非 CONFIDENCE_BOOST + seeker 可达 + INFERENCE 前提递归可达）
   → SINGLE_POINT_DEPENDENCY
   玩家侧 capability（VALUE/EXISTENCE/KNOWLEDGE/LOCATOR/TRIGGER：spine ∨ opening-owned）
   双边杠杆（seekerLeverage ⊆ counterpartLeverage ⊆ leverageProvenance + seeker 真持有 +
   provenance 非空壳）→ LEVERAGE_UNSOURCED
   holder 需求（归属 holder，可私有）与 seeker 识别（必须保证可达）分开验证
   预写成交（结构断言 + 成交叙述窄 lint）· 作者指令（窄 deterministic lint）
   注意：requiresNodeIds ≠ player knowledge dependency，只有 INFERENCE 前提要求 seeker 可达
✅ fixtures/m12-formation/direct-bargain-table-negative.json：
   能过 F2 Builder（结构完整）但 F3 恰好打出 NEED_NOT_RECOGNIZABLE +
   SINGLE_POINT_DEPENDENCY + META_PROMPT_DEPENDENCY —— 证明「结构完整 ≠ Formation 成立」
✅ scripts/m12-formation-validator.test.mjs（25 tests：Gold/Alt READY + 直接谈判桌 REVIEW
   + 基础 blocker×4 + 只读/权威×2 + 11 码确定性负例 + LEVERAGE 空壳负例
   + Semantic Hardening 负例×3）
✅ F3 Semantic Hardening：Visible ≠ Owned（OPENING_OWNED 必须 holderIds 真持有）、
   杠杆可见 ≠ 可支配（必须持有/保证可得）、Fact ≠ Need（holderNeed 必须 kind=NEED）
🚫 Integrator / PMD / Writer / 真模型（F4+）
```

## 受控生成实验（Preview Writer V1，F3 后 / F4 前）

```text
链路：ProjectStoryState → F2 Builder → F3 Gate(FORMATION_READY)
      → Preview Writer Packet（可见性严格投射）→ Writer 模型 → 实际成品

运行：node scripts/m12-formation-preview-writer.mjs --mode=real --audiences=P1,P2,HOST
产物：captures/m12-formation-preview/real-*/（packet-*.json + output-*.json + run.json）

组件：
✅ shared/m12-formation-writer-packet.js — 薄 adapter：
   LEVERAGE_EDGE 不进任何 packet；INFERENCE 只进 subject 的；CONFIDENCE_BOOST 只进持有者的；
   公共事实进 fixedFacts（必须写进成品）；七条写作纪律进 writingRules
✅ shared/m12-formation-preview-writer.js — prompt 组装 + 模型调用 + 确定性自检
   （parseOk / metaPromptHits / prewrittenDealHits）；MockPreviewWriterLlm 离线链路
✅ fixtures/m12-formation/closed-after-hours-context.json — 角色/场景上下文（实验素材）
✅ scripts/m12-formation-writer-packet.test.mjs — 可见性矩阵逐角色 deepEqual + mock 端到端

实验结论（人工审 2026-09-09，真模型 deepseek 生成，两轮 A/B）：
- Run #1（V1）：三份成品 Formation 成立性成功落地——沈岚有理由（N1–N9）+ 有筹码（N10）
  + 识需求（N11b）+ 有时窗（N12）；梁赫有需求（N11）+ 有压力（N12），行动完全留给玩家；
  HOST 零剧透；meta / 预写成交 lint 全零。
  暴露两个 Packet 表达层缺口：① provenance 未投射 → Writer 为腕带编造来历（「馆方寄的」）；
  ② 角色缺公共人物目录 → Writer 编造梁赫身份（「策展人」）。
- Packet V1.1 Fidelity Patch（只修两处，N4 人称错位故意保留作对照变量）：
  ① factEntry 带 provenance（跟随节点可见性走，P2/HOST 不获得 N10 私有来源）；
  ② publicCastDirectory 进每个角色 packet（只有公开身份，无 openingGoal/roleInBargain）。
- Run #2（V1.1）：腕带来历 ✔ 修复（收藏家交托语义如实落地）；梁赫身份 ✔ 修复（资深藏家）；
  零 meta / 零预写成交保持；Formation 链完整（N9 ACTIONABLE「还不能完全确定」语气保持）；
  N4 人称错位仍存在（「内部目录你翻过不止一遍」）——变量隔离成功：
  Packet completeness defect ✅ 已修 ≠ Role-relative semantic rendering defect → F4 / Packet V2
→ 阶段结果：织幕已可把通过 F3 的 Formation 交给真实 Writer 产生基本正确的角色内容；
  剩余主要问题进入「角色视角化 / Node→Beat 编排」层，而非「系统不会写」。
```

## F4A — Role-Relative Semantic Projection V1（已落地，待人工审）

```text
解决的真实 bug（Run #2 对照变量）：N4 reveals 是 seeker-oriented 文本，直接发给 P2 时
Writer 把 inline 推断升级成「我翻过内部目录」。

三原则：Canonical truth 只有一份；audience rendering 可以不同；不得新增事实。
实现（不逐角色手写文案）：
✅ F1 合同 additive 扩展：FormationNode 可选 subjectCharacterIds（事实主体；缺省 [] =
   未声明，无默认语义，投影退化为原文——不违反 Missing ≠ Valid）
✅ shared/m12-formation-role-projection.js：8 投影类型确定性推导
   （CANON_FACT / SELF_KNOWN_FACT / OBSERVED_FACT / ACTIONABLE_INFERENCE /
    PRIVATE_MEMORY / PUBLIC_RULE / OWNED_OBJECT / SELF_KNOWN_NEED）
   文本规则：主体受众与 HOST 剥离 inline 推断（"→" 尾段）；非主体保留原文
   （非主体拿到 inline 推断是合法世界理解，如任何翻签名页者都可推断梁赫可能知道目录）
✅ Packet 集成：entry 带 projectionType；subjectCharacterIds 只发给主体本人
✅ Prompt：投影类型说明 + 主体禁外推规则（「参与过资料整理」≠「看过内部目录」）
✅ Gold fixture：N4/N5 加 subjectCharacterIds=["P2"]（Alt 不动）
✅ scripts/m12-formation-role-projection.test.mjs：15 tests（Gate 1-10/12 + 单元层）

Run #3（real，deepseek）Gate 11 四项全过：
- N4 错位消失：梁赫全文再无「目录」二字，只写「资料整理你也签字参与了」
- 腕带来源保持正确（V1.1 不回退）；梁赫身份保持「资深藏家」
- meta / 预写成交 = 0；P1 侧 inline 推断保留（「说不定会知道内部目录的下落」）
- P1 推断语气保持 ACTIONABLE（「只是我的推断，还远不能下定论」）

🚫 F4B（Node→Beat / Integrator / PMD）未开——F4A 只做语义投影，不压剧情
```

## F4B — Formation Node → Beat Compilation V1（已落地，待人工审）

```text
Node ≠ Beat：Beat 是一次有体验意义的剧情变化，nodeRefs 只是证据来源。
链路：Artifact → F3 Gate（compiler 内复跑，仅 READY）→ F4A 投影 → FormationBeat[]

实现：
✅ shared/m12-formation-beat-compiler.js：compileM12FormationBeats({ state, artifactId })
   State-authoritative；族级编排规则（B1 异常浮现 / B2 对手定位 / B3 双边条件形成 /
   B4 时机闭合 ← 9 capabilities 分组，零 Gold 剧情知识）
✅ required/optional 分离：CONFIDENCE_BOOST → optionalNodeRefs，绝不进 required
   与 requiresBeatIds 因果（白绫/周祁可拒绝配合）；孤立 LEVERAGE_EDGE → B3 optional
✅ supportNodeRefs：requires 前提 + 边成员（N8a/N8b/N11a 被追踪，Gate 全覆盖）
✅ audienceViews = F4A 投影输出（不重新读 raw reveals，零字符串解析——遵守
   INLINE_ARROW_STRIP 冻结备注）；delivery.mode 5 值结构推导；requiresBeatIds
   Gold 因果链 = B1←无 / B2←B1 / B3←无 / B4←B2+B3
✅ 渲染：renderM12FormationBeatsForReview（隐藏 Node ID 的人工审素材）
   captures/m12-formation-beats/{gold,alt}-beats.md
✅ scripts/m12-formation-beat-compiler.test.mjs：13 tests（Gate 1-12 + Alt 旁证）
✅ Alt 旁证：11 节点 → 4 Beat，B2 required=[K1]（holder 公开）与 Gold 结构不同
   ——compiler 不是 Gold 生成器
✅ Alt fixture 微调：K4（老纪 boost）入 knowledgePath（知情人增强路径）

三个危险坑（全部钉死）：不写新剧情（全部文本 ⊆ canonical reveals 子串）；
optional 不升格 required；不生成 NEGOTIATE/EXCHANGE outcome（无 resolution 概念）

🚫 F4C（Integrator / PMD / Master Outline）未开
```

## 验收位置

| 项目 | 说明 |
|---|---|
| 视图 | 仓库文档 |
| 区域 | `docs/M12_FORMATIONATION_PRODUCTION_SLICE_V1_ZH.md` |
| 操作 | 确认 F1–F7 顺序与 Implementation Gate；确认未改 pack |
| 文件 | 本文；Gold @ `05164fe` |
