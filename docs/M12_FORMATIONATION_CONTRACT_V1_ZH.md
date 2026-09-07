# M12 Formation Contract V1

> **Concept / Boundary：✅ PASS**（`e7e470b` 方向过审）  
> **Gold Sample N1–N12：⚠️ PARTIAL_PASS → 本修订为 v1.1 样本修补；仍 NOT GOLDEN，不进落地**  
> 基线分级：[`STORY_MECHANISM_FORMATIONATION_GRADING_ZH.md`](./STORY_MECHANISM_FORMATIONATION_GRADING_ZH.md) @ **`16716ab`**  
> 示范题材：RPT #1C《闭馆之后》· 未公开预展目录册  
> **不是跨族 Formation schema。不是 Voice。不改 Writer / Planner / Gate / pack。**

## 人工裁决（冻结记录）

```text
M12 Formation Contract V1
  Concept / Boundary       ✅ PASS

Gold Sample (e7e470b 原文)
  Causal Shape             ✅ PASS
  Information Provenance   ⚠️ PARTIAL
  Player Reachability      ⚠️ PARTIAL
  Bilateral Leverage       ❌ NOT CLOSED
  Meta-prompt deletion     ⚠️ NOT YET PROVEN
  OVERALL                  ⚠️ PARTIAL_PASS · NOT READY FOR IMPLEMENTATION

Blockers（已在下文 v1.1 修补，待再审）:
  1. N8 不得为预写成交的 EXCHANGE_EVENT
  2. N10 不得为「待填」placeholder
  3. N11 须闭合「沈岚如何识别梁赫需要」
  4. N4/N5/N7 须标可达性；白绫不得成唯一硬通路
```

## 一句话

```text
Resolution 告诉你怎么谈；
Formation 证明玩家能自己走到谈判桌。
M12 V1 只做后者的黄金样本——样本未过 Full PASS 前不进 pack。
```

## PASS Gate（钉死）

```text
✅ 8 形成字段不是八段说明文，而是可引用的节点/事实/持有关系
✅ formationNodes[] 标明链上每个角色/信息/物件的位置
✅ 每节点标清：谁持有 / 如何获得 / 何时可获得 / 是否保证可达（或仅增强置信）
✅ formationProof 能说明：删掉「去找 X 谈 / 你可以交换」后仍会自然走到 holder
✅ 双边杠杆闭合：杠杆有 provenance；对家需求存在；seeker 能识别该需求
✅ 不预写玩家现场成交（交换/欺骗/拒绝留给玩家）
✅ 进入 NEGOTIATE 之前，形成链足以产生接触理由（不必保证成交）
✅ 不改 M12 Resolution 合同；不开跨族 schema；不跑真模型
```

**失败样例（禁止）：**

```text
valueSource: "目录册很重要"
existenceSource: "玩家会知道有目录册"
…（纯说明，无节点、无来源、无谁先知道）

N8: "沈岚用 A 换到白绫的 B"（预写成交）
N10: "腕带如何到手，以后再写"（placeholder）
```

---

## 字段合同（仅 M12）

### A. 硬规则修正（相对 e7e470b）

**不要**把下列升格为 M12 永久铁律：

```text
❌ 开场不得知道谁可能持有 stake
❌ 筹码绝不能开场拥有
```

**正确硬规则：**

```text
✅ 开场答案级知识必须有来源，且不得让 Formation 的核心发现过程被无理由跳过
✅ 开场筹码允许存在，但必须有 provenance（不得无来源拥有）
✅ 筹码的价值 / 对家需求不得靠模板硬指定；须有可追溯的需求事实 + seeker 识别路径
✅ 玩家自由互动可改变置信度，不得成为「唯一必须成交」的硬通路
```

《闭馆之后》样本可以选择「开场不知目录在谁手」——这是样本设计，不是族级禁令。

### B. 八形成字段

| 字段 | 必须回答 | 合法形态 | 非法形态 |
|---|---|---|---|
| `valueSource` | X 为什么值得要？ | 可观察异常 + 推断出的利害 | 「很重要」「剧情需要」 |
| `existenceSource` | A 怎么知道 X **可能存在** / 或为何值得追？ | 异常→推断；或有来源的开场已知（须 provenance） | 「玩家自然知道」「无来源直发答案」 |
| `knowledgePath` | A 怎么知道**谁可能知道** X？ | 记录/口供/签字/他玩家节点 + **获取方式** | 「holder 岗位就是知道的人」 |
| `locatorPath` | 如何收窄到 holder / 去向？ | 可错定位信息；允许歧义；**非唯一硬通路** | 直接宣布 initialOwner 且无来源 |
| `counterpartLeverage` | holder **为何不能直接拒绝**？ | 可验证「无视有代价」 | 「因为可以谈」 |
| `leverageProvenance` | 杠杆**从哪来**？ | 有完整 provenance（可开场持有，不可无来源） | 「开场莫名有腕带」/「以后再写」 |
| `counterpartNeed` | holder 为何需要 + **seeker 如何得知**？ | holder 需求事实 + seeker 侧观察/信息节点 | 仅「梁赫侧可知」 |
| `trigger` | **为何现在**？ | 场内可感知时窗/压力 | 「到 NEGOTIATE 幕了」 |

### C. 结果字段

| 字段 | 含义 |
|---|---|
| `formationNodes[]` | 每节点：`id, kind, heldBy, reveals, requires, acquire{who,how,when,guaranteed?}, role` |
| `formationProof` | 结构化：无元提示时仍会接近 holder；含可达性与非单点依赖 |

`acquire.role`：

| 值 | 含义 |
|---|---|
| `GUARANTEED` | 主形成链依赖；须保证 seeker（或等价路径）可获得 |
| `CONFIDENCE_BOOST` | 显著增强判断；缺失时仍应能产生「值得去问 holder」 |
| `OPENING_OWNED` | 开场持有，但必须有 past provenance 文本/节点 |

### D. 与 Resolution 的接缝

```text
Formation 完成（接触理由足够强）
    ↓
才允许进入既有 M12 Resolution：
  PROBE → NEGOTIATE → EXCHANGE → AFTERMATH
```

Formation **保证的是接触理由，不是成交。**

---

## 黄金样本 v1.1：《闭馆之后》（修补版 · 待再审）

> 沈岚=seeker · 梁赫=holder · stake=未公开的预展目录册 · 杠杆=私人预展邀请腕带  
> **仍非 GOLDEN**；修完 blocker 后需再跑 meta-prompt deletion 审。

### 目标链

```text
不知道目录册在谁手里（本样本选择）
→ 发现异常 → 推断存在 → 知情路径 → 定位收窄
→ 杠杆有 provenance → 识别对方需要 → 时窗
→ 才进入 NEGOTIATE
```

### 节点表（含可达性）

| nodeId | kind | heldBy / locus | reveals | requires | acquire |
|---|---|---|---|---|---|
| **N1** | FACT | 展厅公开可观察 | 若干本应上正式预展清单的藏品被临时撤下 | — | 全体可观察 · `GUARANTEED` · 开场即可见 |
| **N2** | MEMORY | 沈岚 | 曾见过其中一件；公开来源与自己所知不一致 | N1 | 开场角色记忆 · `OPENING_OWNED` + past provenance（私人观摩/旧委托） |
| **N3** | INFERENCE | 沈岚 | 可能另有内部/未公开目录（**仍不知在谁手**） | N1+N2 | 推断 · 非发放答案 |
| **N4** | RECORD | 预展筹备签名档（资料台/可借阅夹） | 梁赫签字参与资料整理 → **可能知道**内部目录 | N3 | **who:** 沈岚（及任意搜资料者）· **how:** 在「筹备资料台」翻阅签名页 · **when:** act1 起开放 · **guaranteed:** 资料台对全员可达，不依赖白绫 · `GUARANTEED` |
| **N5** | RECORD | 闭馆门禁/库房授权终端（只读） | 昨晚有人用与梁赫绑定的授权进库 | N4 | **who:** 持「安保只读权限」者或终端旁可窥的日志摘要条 · **how:** 本样本：展厅安保台放有**昨晚异常进出摘要条**（一条，非全库）· **when:** act1 中后段 · **guaranteed:** 摘要条公开可取 · `GUARANTEED`（全库详情可另作增强） |
| **N6** | INFO | 周祁 | 该授权昨晚可能被借用 → 持有 vs 只知去向未决 | N5 | 周祁开场知情 · 他人需问到他 · `CONFIDENCE_BOOST`（增加不确定性，非发答案） |
| **N7** | INFO | 白绫 | **过去固定事实**：她看见梁赫离库时夹走一份文件 | N5 相关时段 | 白绫开场知情 · **不预设告诉谁** · `CONFIDENCE_BOOST` |
| **N8a** | INFO | 沈岚 | **过去固定事实**：缺席收藏家曾托她留意「被抽掉的那一页到底写了谁」——她握有「有人在找抽页」的线索，**不是**现场编造 | 角色过去委托 | `OPENING_OWNED` + provenance（昨天电话/字条）· **这是筹码来源，不是成交** |
| **N8b** | INFO | 白绫 | **过去固定事实**：她自己也想搞清抽页去向（与 N7 目击相关） | — | 白绫开场动机 · 她**需要**「谁在找抽页 / 抽页指向谁」类信息 |
| **N8** | LEVERAGE_EDGE | 沈岚↔白绫 | **仅结构**：沈岚有 N8a 且白绫需要；白绫有 N7 且沈岚需要。**不写谁换给谁、是否成交** | N7+N8a+N8b | 玩家现场：骗/套/换/拒/旁敲 · **全部开放** · 边本身 `CONFIDENCE_BOOST`（主链不依赖成交） |
| **N9** | INFERENCE | 沈岚 | 目录册**大概率**在梁赫手里（足以促使接近，非 100% 证明） | **最低：** N3+N4+N5；**增强：** +N6/N7/N8 | 推断；白绫路径可选 |
| **N10** | OBJECT + PROVENANCE | 沈岚 | 私人预展邀请腕带**已在沈岚处** | — | **provenance（必须写完）：** 昨天下午缺席收藏家委托沈岚：预展结束后把一件赠品转交馆方，并**当场把本人腕带交给她**以便她代为出入第二轮私人区办交接。沈岚开场持有腕带 = `OPENING_OWNED`，**有来源，非白送** |
| **N11a** | FACT | 世界规则 / 可查告示 | 第二轮后进入某私人展厅**必须**持该规格腕带 | — | 门厅告示或腕带说明文字 · 全员可读 · `GUARANTEED` |
| **N11b** | OBSERVABLE / INFO | 场内可观察或第三方 | **沈岚可识别梁赫需要腕带**的路径（结构上必须有一条） | N11a | **本样本采用：** act1 沈岚看见梁赫在私人展厅门口被拒（无腕带）或听见他向工作人员追问「第二轮私人区如何进」。· `GUARANTEED` 对沈岚 · **不得**只写「梁赫侧可知」 |
| **N11** | NEED | 梁赫 | 他要核验的藏品在该私人展厅内 → 需要腕带 | N11a | 梁赫开场目标；对外不可见，除非经 N11b |
| **N12** | TRIGGER | 场内可感知 | 第二轮/私人展厅时窗临近 → 拖过则梁赫核验失败风险上升 | N9 接触理由 + N10 + N11/N11b | 广播倒计时/工作人员催场 · `GUARANTEED` 可感知 |

### 八字段 → 节点绑定

| 字段 | 绑定 | 摘要 |
|---|---|---|
| `valueSource` | N1+N2 | 撤展 + 来源不一致 → 内部目录若存在则利害成立 |
| `existenceSource` | N3 | 推断存在；开场无「在梁赫手里」 |
| `knowledgePath` | N4 + acquire | 签名档可达 → 梁赫可能知道 |
| `locatorPath` | N5（保底）+ N6/N7/N8（增强）→ N9 | 授权摘要收窄；白绫路径非唯一 |
| `counterpartLeverage` | N10 | 腕带（有 provenance） |
| `leverageProvenance` | N10 | 收藏家委托交付 + 交托腕带 |
| `counterpartNeed` | N11 + **N11b** | 梁赫需要进私人展厅；**沈岚经 N11b 识别** |
| `trigger` | N12 | 时窗 |

### formationProof v1.1

```text
formationProof:
  noUnsourcedAnswerAtStart: true
    # 开场无「目录册在梁赫手里」；腕带有 N10 provenance
  everyBeliefHasNode: [N3, N4, N9, N11, N11b]
  bilateralLeverage:
    seekerObject: N10
    holderNeed: N11
    seekerRecognizesNeed: N11b   # 关键：需求被利用
  reachability:
    guaranteedPathToContactReason: [N1, N2, N3, N4, N5, N9, N10, N11a, N11b, N12]
    optionalConfidence: [N6, N7, N8]   # 白绫不成交也不打断「值得去问梁赫」
  noPreWrittenDeal: true
    # N8 仅为 LEVERAGE_EDGE，无 EXCHANGE_EVENT
  metaPromptDeletionTest: READY_FOR_RE_REVIEW
    # 删除「去找梁赫谈 / 你可以交换」后应仍成立：
    # - 未闭合：目录是否存在、是否在梁赫手（N3–N9）
    # - 沈岚有腕带且已看见/听说梁赫进不去私人区（N10+N11b）
    # - 时窗压迫（N12）→ 接近梁赫是优势策略
  singlePointBan:
    bailianMustDeal: false
```

### 逐节点状态（相对人工裁决）

```text
N1   ✅
N2   ✅
N3   ✅/⚠️  仍可加第二支撑，非 blocker
N4   ✅ v1.1 补 acquire（资料台签名页）
N5   ✅ v1.1 补 acquire（异常进出摘要条）
N6   ✅
N7   ✅ 过去目击；不强迫告知
N8   ✅ v1.1 改为 LEVERAGE_EDGE + N8a 来源 + N8b 需求；无预写成交
N9   ✅ 最低 N3+N4+N5
N10  ✅ v1.1 写完 provenance（允许开场持有）
N11  ✅ v1.1 拆 N11a 规则 + N11b 沈岚识别路径 + N11 需求
N12  ✅
```

### 仍不宣称

- 本样本 **尚未** 再次人工 Full PASS / GOLDEN  
- **不进** pack / artifact / Gate / 真模型  
- meta-prompt deletion 待你用 v1.1 再审一次  

---

## 非目标

```text
🚫 跨族 Formation schema
🚫 改 M07/M08 / Writer / pack
🚫 在 PARTIAL 未清前讨论落地切片
🚫 把「先找东西再谈」做成唯一 M12 套路
```

## 下一步

1. **你再审 v1.1 样本**（尤其 N8/N10/N11b/可达性）  
2. Full PASS 后才问：删光元提示，谈判会不会自己长出来  
3. 那个测试过了 → 才配称 **M12 Formation Gold Sample** → 才谈落地  

## 验收位置

| 项目 | 说明 |
|---|---|
| 视图 | 仓库文档 |
| 区域 | `docs/M12_FORMATIONATION_CONTRACT_V1_ZH.md`（本修订） |
| 操作 | 对照「人工裁决」与 v1.1 节点表再审；确认未改 pack |
| 文件 | 本文；分级 @ `16716ab` |
