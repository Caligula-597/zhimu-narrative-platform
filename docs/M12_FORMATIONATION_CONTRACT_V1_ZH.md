# M12 Formation Contract V1

> **状态：规格开刀 / 未改 pack**  
> 基线分级：[`STORY_MECHANISM_FORMATIONATION_GRADING_ZH.md`](./STORY_MECHANISM_FORMATIONATION_GRADING_ZH.md) @ **`16716ab`**（M12-1 Formation=`GAP_HIGH` · Resolution=`OK`）  
> 示范题材：RPT #1C《闭馆之后》· 未公开预展目录册  
> **不是跨族 Formation schema。不是 Voice。不改 Writer / Planner / Gate / pack。**

## 一句话

```text
Resolution 告诉你怎么谈；
Formation 证明玩家能自己走到谈判桌。
M12 V1 只做后者的黄金样本。
```

## PASS Gate（钉死）

```text
✅ 8 形成字段不是八段说明文，而是可引用的节点/事实/持有关系
✅ formationNodes[] 标明链上每个角色/信息/物件的位置
✅ formationProof 能说明：删掉「去找 X 谈 / 你可以交换」后仍会自然走到 holder
✅ 进入 NEGOTIATE 之前，链必须走完（或等价可证明已走完）
✅ 双边杠杆成立（counterpartLeverage ≠ 空 / ≠「模板设定」）
✅ 不改 M12 Resolution 合同（seeker/holder/stake/exchange… 仍保留）
✅ 不开跨族 schema、不改 M07/M08、不跑真模型
```

**失败样例（禁止）：**

```text
valueSource: "目录册很重要"
existenceSource: "玩家会知道有目录册"
knowledgePath: "梁赫整理过资料"
locatorPath: "目录册在梁赫手里"
counterpartLeverage: "腕带"
…（纯说明，无节点、无来源、无谁先知道）
```

---

## 字段合同（仅 M12）

### A. 八形成字段

| 字段 | 必须回答 | 合法形态 | 非法形态 |
|---|---|---|---|
| `valueSource` | X 为什么值得要？ | 可观察异常 + 推断出的利害（对谁、若缺会怎样） | 「很重要」「剧情需要」 |
| `existenceSource` | A 怎么知道 X **可能存在**？ | 异常事实 → 推断；开场不得直发「X 在某人手里」 | 开场发放答案级持有信息 |
| `knowledgePath` | A 怎么知道**谁可能知道** X？ | 来自具体记录/口供/签字/他玩家信息节点 | 「holder 岗位就是知道的人」 |
| `locatorPath` | A 怎么把「可能知道」收窄到 **holder / 去向**？ | ≥1 条可错的定位信息；允许「持有 vs 只知去向」歧义 | 直接宣布 initialOwner |
| `counterpartLeverage` | holder **为何不能直接拒绝**？ | 信息/权限/证明/人情/威胁/替代渠道等，须可验证「无视有代价」 | 「因为可以谈」「礼貌」 |
| `leverageProvenance` | A 的杠杆**从哪来**？ | 与主链同构的获取链（不得开场白送） | 「开场拥有腕带」 |
| `counterpartNeed` | holder **为何需要**该杠杆？ | holder 侧独立信息来源解释需求 | 「holderPrice 预设」 |
| `trigger` | **为何现在**必须谈，而不是永远拒绝？ | 时窗/阶段/即将失效/第二轮预展等可感知压力 | 「到 NEGOTIATE 幕了」 |

### B. 结果字段（必须）

| 字段 | 含义 |
|---|---|
| `formationNodes[]` | 链上节点：角色 / 信息碎片 / 物件 / 场所；每节点含 `id, kind, heldBy?, reveals?, requires?` |
| `formationProof` | 结构化证明（非散文）：列出「无元提示时，玩家仍会接近 holder」的充分条件集合 |

`formationProof` 最低要求：

```text
1. seeker 不拥有开场答案级「holder 握有 stake」
2. 每条关键认知都能追溯到 ≥1 个 formationNode
3. 杠杆两侧均可追溯（leverageProvenance + counterpartNeed）
4. trigger 可被场内感知，不依赖主持旁白宣布「现在谈」
5. 删 meta prompts 后，接近 holder 仍是优势策略（有信息缺口要补 / 有时窗 / 无视有代价）
```

### C. 与 Resolution 的接缝

```text
Formation 完成
    ↓
才允许进入既有 M12 Resolution：
  PROBE → NEGOTIATE → EXCHANGE → AFTERMATH
  seeker / holder / stake / price / exchange / aftermath
```

Formation **不替代** Resolution；它只证明 Resolution 桌有资格被摆出来。

---

## 黄金样本：《闭馆之后》目录册议价形成链

> 示例绑定：沈岚=seeker · 梁赫=holder · stake=未公开的预展目录册 · 杠杆≈私人预展邀请腕带  
> 此样本是 **Contract V1 的证明物**，不是 Writer 成品，也不是已实现的 pack 数据。

### 目标链（必须长这样）

```text
不知道目录册
→ 发现异常
→ 推断存在
→ 找到知情路径
→ 锁定 holder（或可行动的去向假设）
→ 获得自己的杠杆
→ 知道对方为什么需要
→ 时机触发
→ 才进入 NEGOTIATE
```

### formationNodes[]（草案节点表）

| nodeId | kind | heldBy / locus | reveals（玩家可得到的认知） | requires |
|---|---|---|---|---|
| N1_withdraw_anomaly | FACT | 公开/展厅可观察 | 若干本应出现在正式预展清单的藏品被临时撤下 | — |
| N2_provenance_mismatch | MEMORY/INFO | 沈岚 | 自己曾见过其中一件；公开来源记录与已知不一致 | N1 |
| N3_internal_catalog_hypothesis | INFERENCE | 沈岚 | **推断**：可能另有内部/未公开目录（仍不知在谁手里） | N1+N2 |
| N4_liang_prep_trail | RECORD | 可查资料/邮件/签字 | 梁赫参与过预展资料整理 → **可能知道**内部目录 | N3 |
| N5_auth_log | RECORD | 门禁/库房授权日志 | 昨晚闭馆后有人用与梁赫相关的授权进库 | N4 |
| N6_auth_borrow_doubt | INFO | 另一玩家（如周祁/白绫侧） | 该授权昨晚可能被借用 → 持有 vs 只知去向未决 | N5 |
| N7_bailian_sight | INFO | 白绫 | 梁赫离开库房时带走一份文件（仍可被质疑） | N5 或交换得到 |
| N8_info_trade_shen_bailian | EXCHANGE_EVENT | 沈岚↔白绫 | 沈岚用「有人问过被抽页内容」换白绫确认带走文件 | N7 的开口杠杆 |
| N9_holder_lock | INFERENCE | 沈岚 | 目录册**大概率在梁赫手里**（至此才锁定） | N3+N4+N5+N7 |
| N10_wristband_acquire | OBJECT_CHAIN | 沈岚 | 缺席收藏家的私人预展腕带如何到沈岚手（独立形成链，可压缩写） | ≠开场白送 |
| N11_liang_need_wrist | INFO | 梁赫侧可知 | 第二轮后唯持此腕带可入私人展厅；梁赫要核验的藏品在那里 | 梁赫独立来源 |
| N12_time_window | TRIGGER | 场内可感知 | 第二轮预展/私人展厅时窗临近 → 现在谈，否则机会关闭 | N9+N10+N11 |

### 八字段 → 节点绑定（禁止无绑定散文）

| 字段 | 绑定节点 | 内容（摘要，不是唯一正文） |
|---|---|---|
| `valueSource` | N1+N2 | 撤展 + 来源不一致 → 内部目录若存在，能解释/利用被藏信息 |
| `existenceSource` | N3 | 推断「另有内部目录」；**开场无「目录册在梁赫手里」** |
| `knowledgePath` | N4 | 整理记录 → 梁赫可能知道 |
| `locatorPath` | N5+N6+N7+N9 | 授权进库 → 借用疑云 → 白绫目击带走 → 收窄为梁赫持有假说 |
| `counterpartLeverage` | N10 | 腕带（及/或 N8 类信息杠杆在形成期已演示「不能白拿情报」） |
| `leverageProvenance` | N10 | 腕带获取链（不得开场拥有） |
| `counterpartNeed` | N11 | 梁赫需要腕带进私人展厅核验 |
| `trigger` | N12 | 时窗压迫，使「拒绝并拖过时窗」对梁赫有代价 |

### formationProof（结构化）

```text
formationProof:
  noAnswerLevelAtStart: true
    # 沈岚开场不知「目录册在梁赫手里」
  everyBeliefHasNode: [N3, N4, N9, N11]
  bilateralLeverage: { seeker: N10, holderNeed: N11 }
  triggerPerceivableInWorld: N12
  metaPromptDeletionTest: PASS_CRITERIA
    # 删除「去找梁赫谈 / 你可以交换目录册」后：
    # - 沈岚仍有未闭合问题（目录是否存在、在谁手）
    # - 白绫开口需要交换（N8），自然产生人际信息流通
    # - 梁赫侧有时窗需求（N11+N12），无视沈岚有代价
    # → 接近梁赫是优势策略，而非剧本点名
  sixPlayerPlacementHint:
    # 节点自然占位，而非纯岗位标签：
    # 沈岚=综合推断与杠杆持有；梁赫=holder+需求；
    # 白绫=N7/N8；周祁等可持 N6；顾清/方序可走并列 M07，不抢 M12 OWNER
```

### 明确未完成（本规格允许）

- N10 腕带获取链可在下一修订展开为与主链同构的子节点表  
- 未写入 `story-mechanism-m12-pack.js`  
- 未接 Pre-Writer Gate / Writer / 真模型  

---

## 非目标（本刀）

```text
🚫 跨族通用 Formation schema
🚫 一次改完 M07/M08
🚫 用 RepairBrief / Voice 伪装 Formation
🚫 全本 RPT #1D / 真模型重跑
🚫 宣称 M12 Formation 已生产可用（需样本过审 + 后续落地切片）
```

## 下一步（仅在样本过审后）

1. 人工过审本黄金样本（节点表是否假、是否仍像说明文）  
2. 再决定：pack 增补 Formation 槽 / 独立 formation artifact / Pre-Writer Gate  
3. 仍不做全库改造  

## 验收位置

| 项目 | 说明 |
|---|---|
| 视图 | 仓库文档 |
| 区域 | `docs/M12_FORMATIONATION_CONTRACT_V1_ZH.md` |
| 操作 | 按 PASS Gate 审节点表与 formationProof；确认未改 pack |
| 文件 | 本文；分级基线 @ `16716ab` |
