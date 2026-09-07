# STORY 机制 Formation / Resolution 官方分级（冻结）

> **状态：✅ FROZEN — 后续所有 Formation 改造的基线证据**  
> **冻结 commit：`16716ab`**  
> 来源工作簿：仓库根目录 `STORY_MECHANISM_FORMATIONATION_GRADING_WORKBOOK_ZH_FILLED.md`（人工标注原稿）  
> 证据快照：`captures/story-mechanism-inventory-for-grading.json`  
> 配套骨架：[`STORY_MECHANISM_FORMATIONATION_GAP_ZH.md`](./STORY_MECHANISM_FORMATIONATION_GAP_ZH.md)  
> 下一刀规格：[`M12_FORMATIONATION_CONTRACT_V1_ZH.md`](./M12_FORMATIONATION_CONTRACT_V1_ZH.md)  
> 范围：STORY COMPLETE 18 + FOUNDATION 21（不含 GAME M02–M06/M09）  
> **本文件冻结分级结论。不修改 pack / planner / writer / gate / runtime。**

## 0. 分级口径

| 等级 | Formation 含义 | Resolution 含义 |
|---|---|---|
| `OK` | 当前合同已能解释体验为何自然形成，关键来源/路径/杠杆/触发基本闭合 | 当前合同已能可靠推进并结算该机制 |
| `THIN` | 有真实 Formation 种子，但至少一段关键来源链仍依赖上游/作者临时补足 | 有结算方向，但规则、阶段或出口仍只是薄壳 |
| `GAP_HIGH` | 大量假设玩家已知道答案级信息、已找到对象、已具备行动理由；删掉元提示后缺内生驱动 | Resolution 也存在明显结构缺口 |
| `N_A` | 此层不负责 Formation，应由上游体验生成；本层只消费既有状态 | 本项不适用 |

Formation 的核心判据不是“有没有 HOOK / clue 名称”，而是：**玩家如何知道、如何锁定、如何获得、为什么对方不能无视、为什么此刻发生。**

## 1. 总体裁决

- COMPLETE 18 条：Formation = GAP_HIGH 8，THIN 10；Resolution = OK 18。
- FOUNDATION 21 条：Formation = GAP_HIGH 15，N_A 6；Resolution = THIN 21。
- **核心结论：当前库的主要成熟度集中在 Resolution，不在 Formation。** COMPLETE 并不等于 Formation complete。
- M01-FRAMING 是相对最好的参照，但也只能评 `THIN`：它有证据意义变化的链，却没有把“信息对象的来源/获得/保证可达”像追凶 V1.3 那样正式化。
- M12-1 是最清晰的高缺口样本：第五层谈判桌已经存在，但第一至第四层“如何走到桌边”缺失。

## 2. COMPLETE 总表（已填）

| ID | 名称 | Formation | Resolution | notes |
|---|---|---|---|---|
| M01-FRAMING | 嫁祸型追凶 | **THIN** | **OK** | 已有“误导证据→错误嫌疑→反证→决定性证据”的真实因果骨架，是当前最接近 Formation 的 COMPLETE；但模板本体仍未规定反证/决定性证据的来源、获得方式、可达性与谁先知道，离追凶 V1.3 的信息链仍差一层。 |
| M07-1 | 固定阶段开放 | **GAP_HIGH** | **OK** | 固定阶段到点发放解决的是 release timing，不是玩家如何形成追查；firstAnomaly/fragment/reveal 虽存在，但缺“为何在意→如何定位来源→如何获得→为何此刻打开”的链。 |
| M07-2 | 条件触发开放 | **THIN** | **OK** | 比 M07-1 多了正式 trigger 与玩家动作，至少有“做对事才打开”；但 trigger 仍是抽象条件，缺玩家如何知道触发方式、如何获得所需权限/结算码以及触发物的来源链。 |
| M07-3 | 多路径开放 | **THIN** | **OK** | 明确要求两条不同到达路径，是很好的 Formation 方向；但 pathA/pathB 目前仍是“调查/交换/拼接/选择”的类别标签，没有具体信息源、路径节点、失败/替代可达链。 |
| M07-4 | 个人记忆分层 | **GAP_HIGH** | **OK** | 记忆分层把内容如何逐层开放做清楚了，但“为什么会恢复、什么事实/行为促成下一层、别人怎样影响或验证恢复”未形成链；容易退化为系统按阶段发记忆。 |
| M07-5 | 身份权限变化 | **THIN** | **OK** | 身份→证明→权限的后半链较完整，且权限变化能产生真实后果；但仍假定承担者知道该查哪份记录/去哪查，site_accessible 也是上游前置，缺发现入口与获取因果。 |
| M07-6 | 旧事实重新解释 | **THIN** | **OK** | OBJECTIVE→EARLY_INTERPRETATION→LATER_CONTEXT 是当前 M07 最接近真正“晚理解”的结构；不足在于 laterContext 如何被玩家发现、谁持有、怎样验证仍未成为 Formation 合同。 |
| M07-7 | 主动选择保留或恢复 | **THIN** | **OK** | 候选内容+扩选成本让‘恢复什么’成为玩家决策，具备真实 agency；但候选为何出现、为何这些选项此刻重要、扩选资源从哪来仍由上游兜底。 |
| M07-8 | 集合属性探测 | **GAP_HIGH** | **OK** | 集合探测的 Resolution 很清楚，但 probeLead 为什么拥有/知道探测能力、为什么选这组人/这个 trait、探测机会或信息预算从哪来没有 Formation；容易变成凭空出现的查验按钮。 |
| M08-1 | 固定公开阵营 | **THIN** | **OK** | 公开阵营可合法作为开局既定事实，formationReason/publicGoal/hiddenGoal 也提供动机种子；但成员为什么必须围绕具体人/资源发生互动、对手为什么不能无视、线索如何改变立场仍较抽象。 |
| M08-2 | 固定隐藏阵营 | **GAP_HIGH** | **OK** | 隐藏阵营的保密/暴露/行动差 Resolution 齐全，但‘怎样从可观察行为推到怀疑/接触/确认’缺因果信息链；很容易退化成纯猜身份。 |
| M08-3 | 非对称阵营 | **GAP_HIGH** | **OK** | 非对称接口与胜负条件属于很强的结算差异，但为什么两边在当前剧情中形成不可回避的冲突、关键资源如何被双方识别与争夺未具体化。 |
| M08-4 | 动态阵营 | **THIN** | **OK** | changeNode、joining/leaving、identity trigger 让改属有明确触发点，Formation 比静态阵营强；但改属前的压力来源、替代选择、角色为何愿意付代价仍是泛化槽。 |
| M08-5 | 个人目标叠加阵营目标 | **THIN** | **OK** | personalGoal + loyaltyConflict 能形成真实内在张力，避免单纯阵营标签；但个人目标如何获得、何时与阵营目标发生可见冲突、别人如何利用该冲突没有来源链。 |
| M08-6 | 临时联盟 | **GAP_HIGH** | **OK** | duration/shareScope/exitCost 把临时联盟如何运行写清楚，却没有回答双方为什么此刻必须合作、各自缺什么、谁先知道对方能补缺、如何促成接触；正是‘联盟桌已经摆好但没人有理由坐下’。 |
| M08-7 | 阵营影响公共任务 | **THIN** | **OK** | 公共任务本身提供了一个固定 trigger，各阵营 stance 也能产生可观察冲突；但阵营为何重视该任务、支援/破坏资源从哪来、信息如何让玩家识别对方立场仍不完整。 |
| M08-8 | 多阵营并存 | **GAP_HIGH** | **OK** | 多阵营条件表与第三方渔利属于 Resolution；Formation 只靠‘存在三营’和抽象利益，缺阵营间接触、互相依赖/威胁、短盟为何形成与何时破裂的具体链。 |
| M12-1 | 双边关系议价 | **GAP_HIGH** | **OK** | 典型的 Resolution 完整、Formation 缺失：seeker/holder/stake/price/exchange/aftermath 都有，但没有‘怎么知道标的存在→怎么锁定 holder→怎么获得杠杆→对家为何需要→为何现在必须谈’。 |

## 3. COMPLETE 逐条合同摘要 + 人工标注

### M01-FRAMING · 嫁祸型追凶

- **purpose：** 让玩家先形成一个有证据支撑的错误嫌疑，再通过反证推翻嫁祸并锁定真凶。
- **stages：** SETUP → CRIME_DISCOVERY → FALSE_DIRECTION → CONTRADICTION → TRUTH_REVEAL
- **roles：** victim / culprit / framedCharacter / discoverer
- **plotSlots：** trueMotive / trueMethod / plantedEvidence / apparentConclusion / contradiction / decisiveEvidence / concealmentMethod
- **clues：** FALSE_LEAD / CONTRADICTION / TRUE_EVIDENCE / DECISIVE_EVIDENCE
- **profile：** status=READY · modes=PROBE / CONCEAL / SUSPECT · anchors=EARLY_AGENCY / LATE_REINTERPRETATION · pressure=CULPRIT_CENTRIC_HIGH

**人工标注：Formation=`THIN` · Resolution=`OK`**

**notes：** 已有“误导证据→错误嫌疑→反证→决定性证据”的真实因果骨架，是当前最接近 Formation 的 COMPLETE；但模板本体仍未规定反证/决定性证据的来源、获得方式、可达性与谁先知道，离追凶 V1.3 的信息链仍差一层。

---

### M07-1 · 固定阶段开放

- **purpose：** 保证关键记忆/身份相关内容在指定剧情阶段自动到达接收者，建立可控的信息节奏，而不依赖主持临场发挥。
- **stages：** HIDDEN → FIRST_ANOMALY → PARTIAL_REVEAL → CONTRADICTION → CONFIRMATION → CONSEQUENCE
- **roles：** bearer / knower / misled / revealer / related
- **plotSlots：** surfaceBelief / hiddenContent / trueContent / concealmentReason / misdirectionForm / firstAnomaly / midFragment / decisiveReveal / revealConsequence / knowerSource / identityProofForm / openStageLabel
- **clues：** FORESHADOW / MEMORY_FRAGMENT / IDENTITY_HINT / MISDIRECTION / CONFIRMATION / DECISIVE_REVEAL
- **profile：** status=READY · modes=CONCEAL / PROBE / SUSPECT · anchors=EARLY_AGENCY / LATE_REINTERPRETATION · pressure=IDENTITY_REVEAL

**人工标注：Formation=`GAP_HIGH` · Resolution=`OK`**

**notes：** 固定阶段到点发放解决的是 release timing，不是玩家如何形成追查；firstAnomaly/fragment/reveal 虽存在，但缺“为何在意→如何定位来源→如何获得→为何此刻打开”的链。

---

### M07-2 · 条件触发开放

- **purpose：** 让隐藏内容在正式状态满足时由系统发放，建立“做对事才看到”的认知奖励，同时保证必要内容有超时出口。
- **stages：** HIDDEN → FIRST_ANOMALY → PARTIAL_REVEAL → CONTRADICTION → CONFIRMATION → CONSEQUENCE
- **roles：** bearer / knower / misled / revealer / related
- **plotSlots：** surfaceBelief / hiddenContent / trueContent / concealmentReason / misdirectionForm / firstAnomaly / midFragment / decisiveReveal / revealConsequence / knowerSource / identityProofForm / triggerCondition / timeoutFallback
- **clues：** FORESHADOW / MEMORY_FRAGMENT / IDENTITY_HINT / MISDIRECTION / CONFIRMATION / DECISIVE_REVEAL
- **profile：** status=READY · modes=PROBE / CONCEAL / SUSPECT · anchors=EARLY_AGENCY · pressure=IDENTITY_REVEAL

**人工标注：Formation=`THIN` · Resolution=`OK`**

**notes：** 比 M07-1 多了正式 trigger 与玩家动作，至少有“做对事才打开”；但 trigger 仍是抽象条件，缺玩家如何知道触发方式、如何获得所需权限/结算码以及触发物的来源链。

---

### M07-3 · 多路径开放

- **purpose：** 同一关键内容至少两条真正不同的到达路径，让玩家用调查/交换/拼接/选择等不同方式抵达同一真相，避免单点卡死。
- **stages：** HIDDEN → FIRST_ANOMALY → PARTIAL_REVEAL → CONTRADICTION → CONFIRMATION → CONSEQUENCE
- **roles：** bearer / knower / misled / revealer / related
- **plotSlots：** surfaceBelief / hiddenContent / trueContent / concealmentReason / misdirectionForm / firstAnomaly / midFragment / decisiveReveal / revealConsequence / knowerSource / identityProofForm / pathA / pathB
- **clues：** FORESHADOW / MEMORY_FRAGMENT / IDENTITY_HINT / MISDIRECTION / CONFIRMATION / DECISIVE_REVEAL
- **profile：** status=READY · modes=CONCEAL / PROBE / SUSPECT · anchors=EARLY_AGENCY / LATE_REINTERPRETATION · pressure=IDENTITY_REVEAL

**人工标注：Formation=`THIN` · Resolution=`OK`**

**notes：** 明确要求两条不同到达路径，是很好的 Formation 方向；但 pathA/pathB 目前仍是“调查/交换/拼接/选择”的类别标签，没有具体信息源、路径节点、失败/替代可达链。

---

### M07-4 · 个人记忆分层

- **purpose：** 为承担者建立不对称的记忆层级：先给最低可玩层，再按本人正式状态递进，制造隐瞒/公开/误述的社交空间。
- **stages：** HIDDEN → FIRST_ANOMALY → PARTIAL_REVEAL → CONTRADICTION → CONFIRMATION → CONSEQUENCE
- **roles：** bearer / knower / misled / revealer / related
- **plotSlots：** surfaceBelief / hiddenContent / trueContent / concealmentReason / misdirectionForm / firstAnomaly / midFragment / decisiveReveal / revealConsequence / knowerSource / identityProofForm / layerCount / memoryLossForm
- **clues：** FORESHADOW / MEMORY_FRAGMENT / IDENTITY_HINT / MISDIRECTION / CONFIRMATION / DECISIVE_REVEAL
- **profile：** status=READY · modes=CONCEAL / PROBE / SUSPECT · anchors=EARLY_AGENCY / LATE_REINTERPRETATION · pressure=IDENTITY_REVEAL

**人工标注：Formation=`GAP_HIGH` · Resolution=`OK`**

**notes：** 记忆分层把内容如何逐层开放做清楚了，但“为什么会恢复、什么事实/行为促成下一层、别人怎样影响或验证恢复”未形成链；容易退化为系统按阶段发记忆。

---

### M07-5 · 身份权限变化

- **purpose：** 先让身份内容显现，再按预声明规则启用界面权限，使“我是谁”转化为“我现在能做什么”，并禁止万能补丁能力。
- **stages：** HIDDEN → FIRST_ANOMALY → PARTIAL_REVEAL → CONTRADICTION → CONFIRMATION → CONSEQUENCE
- **roles：** bearer / knower / misled / revealer / related
- **plotSlots：** surfaceBelief / hiddenContent / trueContent / concealmentReason / misdirectionForm / firstAnomaly / midFragment / decisiveReveal / revealConsequence / knowerSource / identityProofForm / permissionScope / permissionExpiry / cognitionConflict
- **clues：** FORESHADOW / MEMORY_FRAGMENT / IDENTITY_HINT / MISDIRECTION / CONFIRMATION / DECISIVE_REVEAL
- **profile：** status=READY · modes=PROBE / CONCEAL / SUSPECT · anchors=EARLY_AGENCY · pressure=IDENTITY_REVEAL

**人工标注：Formation=`THIN` · Resolution=`OK`**

**notes：** 身份→证明→权限的后半链较完整，且权限变化能产生真实后果；但仍假定承担者知道该查哪份记录/去哪查，site_accessible 也是上游前置，缺发现入口与获取因果。

---

### M07-6 · 旧事实重新解释

- **purpose：** 在不改写早期客观动作的前提下，追加后期语境，迫使玩家重估已发生事件的意义，并自动拦截“早该知道却装不知道”的冲突。
- **stages：** HIDDEN → FIRST_ANOMALY → PARTIAL_REVEAL → CONTRADICTION → CONFIRMATION → CONSEQUENCE
- **roles：** bearer / knower / misled / revealer / related
- **plotSlots：** surfaceBelief / hiddenContent / trueContent / concealmentReason / misdirectionForm / firstAnomaly / midFragment / decisiveReveal / revealConsequence / knowerSource / identityProofForm / objectiveEvent / earlyInterpretation / laterContext / cognitionConflict
- **clues：** FORESHADOW / MEMORY_FRAGMENT / IDENTITY_HINT / MISDIRECTION / CONFIRMATION / DECISIVE_REVEAL
- **profile：** status=READY · modes=CONCEAL / PROBE / SUSPECT · anchors=EARLY_AGENCY / LATE_REINTERPRETATION · pressure=IDENTITY_REVEAL

**人工标注：Formation=`THIN` · Resolution=`OK`**

**notes：** OBJECTIVE→EARLY_INTERPRETATION→LATER_CONTEXT 是当前 M07 最接近真正“晚理解”的结构；不足在于 laterContext 如何被玩家发现、谁持有、怎样验证仍未成为 Formation 合同。

---

### M07-7 · 主动选择保留或恢复

- **purpose：** 让玩家在多份既有内容中主动选择优先开放或付费扩选，把“记起什么/公开什么”变成可玩决策，同时保证未选项不含唯一主线钥匙。
- **stages：** HIDDEN → FIRST_ANOMALY → PARTIAL_REVEAL → CONTRADICTION → CONFIRMATION → CONSEQUENCE
- **roles：** bearer / knower / misled / revealer / related
- **plotSlots：** surfaceBelief / hiddenContent / trueContent / concealmentReason / misdirectionForm / firstAnomaly / midFragment / decisiveReveal / revealConsequence / knowerSource / identityProofForm / candidateCount / expandCost
- **clues：** FORESHADOW / MEMORY_FRAGMENT / IDENTITY_HINT / MISDIRECTION / CONFIRMATION / DECISIVE_REVEAL
- **profile：** status=READY · modes=CONCEAL / PROBE / SUSPECT · anchors=EARLY_AGENCY / LATE_REINTERPRETATION · pressure=IDENTITY_REVEAL

**人工标注：Formation=`THIN` · Resolution=`OK`**

**notes：** 候选内容+扩选成本让‘恢复什么’成为玩家决策，具备真实 agency；但候选为何出现、为何这些选项此刻重要、扩选资源从哪来仍由上游兜底。

---

### M07-8 · 集合属性探测

- **purpose：** 在不点名个人的前提下，用聚合结果压缩身份候选空间，制造谨慎组队与信息预算压力。
- **stages：** HIDDEN → FIRST_ANOMALY → PARTIAL_REVEAL → CONTRADICTION → CONFIRMATION → CONSEQUENCE
- **roles：** bearer / knower / misled / revealer / related / probeLead
- **plotSlots：** surfaceBelief / hiddenContent / trueContent / concealmentReason / misdirectionForm / firstAnomaly / midFragment / decisiveReveal / revealConsequence / knowerSource / identityProofForm / targetTrait / probeOutputMode / snapshotRule / groupSize
- **clues：** FORESHADOW / MEMORY_FRAGMENT / IDENTITY_HINT / MISDIRECTION / CONFIRMATION / DECISIVE_REVEAL
- **profile：** status=READY · modes=CONCEAL / PROBE / SUSPECT · anchors=EARLY_AGENCY / LATE_REINTERPRETATION · pressure=IDENTITY_REVEAL

**人工标注：Formation=`GAP_HIGH` · Resolution=`OK`**

**notes：** 集合探测的 Resolution 很清楚，但 probeLead 为什么拥有/知道探测能力、为什么选这组人/这个 trait、探测机会或信息预算从哪来没有 Formation；容易变成凭空出现的查验按钮。

---

### M08-1 · 固定公开阵营

- **purpose：** 开场即公开归属与目标，用可观察行动差异制造阵营博弈与公共任务张力。
- **stages：** LATENT → CONTACT → FORMATION → RECRUITMENT → SUSPICION → PRESSURE → SPLIT → BETRAYAL → EXPOSURE → CONFRONTATION → RESOLUTION → CONSEQUENCE
- **roles：** factionLead / memberA / memberB / outsider / rivalLead / defector
- **plotSlots：** factionIdentity / factionGoal / publicGoal / hiddenGoal / formationReason / recruitmentMethod / joiningCondition / leavingCondition / loyaltyConflict / betrayalTrigger / betrayalCost / exposureRisk / secrecyRule / communicationRule / membershipVisibility / decisiveChoice / consequence
- **clues：** FACTION_FORESHADOW / MEMBERSHIP_HINT / SECRET_SIGNAL / RECRUITMENT_EVIDENCE / LOYALTY_TEST / BETRAYAL_HINT / INTERNAL_CONFLICT / HIDDEN_GOAL_HINT / MEMBERSHIP_CONFIRMATION / FACTION_EXPOSURE
- **profile：** status=READY · modes=CONCEAL / SUSPECT / NEGOTIATE · anchors=EARLY_AGENCY · pressure=FACTION_SETTLE

**人工标注：Formation=`THIN` · Resolution=`OK`**

**notes：** 公开阵营可合法作为开局既定事实，formationReason/publicGoal/hiddenGoal 也提供动机种子；但成员为什么必须围绕具体人/资源发生互动、对手为什么不能无视、线索如何改变立场仍较抽象。

---

### M08-2 · 固定隐藏阵营

- **purpose：** 归属固定但仅本人可见；必须存在可观察行动差异，而非只能猜身份。
- **stages：** LATENT → CONTACT → FORMATION → RECRUITMENT → SUSPICION → PRESSURE → SPLIT → BETRAYAL → EXPOSURE → CONFRONTATION → RESOLUTION → CONSEQUENCE
- **roles：** factionLead / memberA / memberB / hiddenMember / outsider / rivalLead / defector / witness
- **plotSlots：** factionIdentity / factionGoal / publicGoal / hiddenGoal / formationReason / recruitmentMethod / joiningCondition / leavingCondition / loyaltyConflict / betrayalTrigger / betrayalCost / exposureRisk / secrecyRule / communicationRule / membershipVisibility / decisiveChoice / consequence
- **clues：** FACTION_FORESHADOW / MEMBERSHIP_HINT / SECRET_SIGNAL / RECRUITMENT_EVIDENCE / LOYALTY_TEST / BETRAYAL_HINT / INTERNAL_CONFLICT / HIDDEN_GOAL_HINT / MEMBERSHIP_CONFIRMATION / FACTION_EXPOSURE
- **profile：** status=READY · modes=CONCEAL / SUSPECT / NEGOTIATE · anchors=EARLY_AGENCY · pressure=FACTION_SETTLE

**人工标注：Formation=`GAP_HIGH` · Resolution=`OK`**

**notes：** 隐藏阵营的保密/暴露/行动差 Resolution 齐全，但‘怎样从可观察行为推到怀疑/接触/确认’缺因果信息链；很容易退化成纯猜身份。

---

### M08-3 · 非对称阵营

- **purpose：** 各阵营不同操作接口、资源与成功条件；允许同时成功或同时失败。
- **stages：** LATENT → CONTACT → FORMATION → RECRUITMENT → SUSPICION → PRESSURE → SPLIT → BETRAYAL → EXPOSURE → CONFRONTATION → RESOLUTION → CONSEQUENCE
- **roles：** factionLead / memberA / memberB / rivalLead / outsider / recruiter / mediator / defector
- **plotSlots：** factionIdentity / factionGoal / publicGoal / hiddenGoal / formationReason / recruitmentMethod / joiningCondition / leavingCondition / loyaltyConflict / betrayalTrigger / betrayalCost / exposureRisk / secrecyRule / communicationRule / membershipVisibility / decisiveChoice / consequence / rivalGoal / asymmetricInterface
- **clues：** FACTION_FORESHADOW / MEMBERSHIP_HINT / SECRET_SIGNAL / RECRUITMENT_EVIDENCE / LOYALTY_TEST / BETRAYAL_HINT / INTERNAL_CONFLICT / HIDDEN_GOAL_HINT / MEMBERSHIP_CONFIRMATION / FACTION_EXPOSURE
- **profile：** status=READY · modes=CONCEAL / SUSPECT / NEGOTIATE · anchors=EARLY_AGENCY · pressure=FACTION_SETTLE

**人工标注：Formation=`GAP_HIGH` · Resolution=`OK`**

**notes：** 非对称接口与胜负条件属于很强的结算差异，但为什么两边在当前剧情中形成不可回避的冲突、关键资源如何被双方识别与争夺未具体化。

---

### M08-4 · 动态阵营

- **purpose：** 只在预设节点因选择、结算或身份恢复改变归属；保存历史归属，旧贡献按当时阵营解释。
- **stages：** LATENT → CONTACT → FORMATION → RECRUITMENT → SUSPICION → PRESSURE → SPLIT → BETRAYAL → EXPOSURE → CONFRONTATION → RESOLUTION → CONSEQUENCE
- **roles：** factionLead / memberA / memberB / rivalLead / defector / outsider
- **plotSlots：** factionIdentity / factionGoal / publicGoal / hiddenGoal / formationReason / recruitmentMethod / joiningCondition / leavingCondition / loyaltyConflict / betrayalTrigger / betrayalCost / exposureRisk / secrecyRule / communicationRule / membershipVisibility / decisiveChoice / consequence / changeNode / historyRule
- **clues：** FACTION_FORESHADOW / MEMBERSHIP_HINT / SECRET_SIGNAL / RECRUITMENT_EVIDENCE / LOYALTY_TEST / BETRAYAL_HINT / INTERNAL_CONFLICT / HIDDEN_GOAL_HINT / MEMBERSHIP_CONFIRMATION / FACTION_EXPOSURE
- **profile：** status=READY · modes=CONCEAL / SUSPECT / NEGOTIATE · anchors=EARLY_AGENCY · pressure=FACTION_SETTLE

**人工标注：Formation=`THIN` · Resolution=`OK`**

**notes：** changeNode、joining/leaving、identity trigger 让改属有明确触发点，Formation 比静态阵营强；但改属前的压力来源、替代选择、角色为何愿意付代价仍是泛化槽。

---

### M08-5 · 个人目标叠加阵营目标

- **purpose：** 阵营与个人分别结算，可同时成败；个人目标不要求全部背叛阵营。
- **stages：** LATENT → CONTACT → FORMATION → RECRUITMENT → SUSPICION → PRESSURE → SPLIT → BETRAYAL → EXPOSURE → CONFRONTATION → RESOLUTION → CONSEQUENCE
- **roles：** factionLead / memberA / memberB / defector / outsider
- **plotSlots：** factionIdentity / factionGoal / publicGoal / hiddenGoal / formationReason / recruitmentMethod / joiningCondition / leavingCondition / loyaltyConflict / betrayalTrigger / betrayalCost / exposureRisk / secrecyRule / communicationRule / membershipVisibility / decisiveChoice / consequence / personalGoal / personalSettleRule
- **clues：** FACTION_FORESHADOW / MEMBERSHIP_HINT / SECRET_SIGNAL / RECRUITMENT_EVIDENCE / LOYALTY_TEST / BETRAYAL_HINT / INTERNAL_CONFLICT / HIDDEN_GOAL_HINT / MEMBERSHIP_CONFIRMATION / FACTION_EXPOSURE
- **profile：** status=READY · modes=CONCEAL / SUSPECT / NEGOTIATE · anchors=EARLY_AGENCY · pressure=FACTION_SETTLE

**人工标注：Formation=`THIN` · Resolution=`OK`**

**notes：** personalGoal + loyaltyConflict 能形成真实内在张力，避免单纯阵营标签；但个人目标如何获得、何时与阵营目标发生可见冲突、别人如何利用该冲突没有来源链。

---

### M08-6 · 临时联盟

- **purpose：** 规定节点双确认建立联盟；设持续时间、共享范围与退出成本；不自动共享私人内容。
- **stages：** LATENT → CONTACT → FORMATION → RECRUITMENT → SUSPICION → PRESSURE → SPLIT → BETRAYAL → EXPOSURE → CONFRONTATION → RESOLUTION → CONSEQUENCE
- **roles：** factionLead / memberA / memberB / rivalLead / mediator / outsider / defector
- **plotSlots：** factionIdentity / factionGoal / publicGoal / hiddenGoal / formationReason / recruitmentMethod / joiningCondition / leavingCondition / loyaltyConflict / betrayalTrigger / betrayalCost / exposureRisk / secrecyRule / communicationRule / membershipVisibility / decisiveChoice / consequence / allianceDuration / shareScope / exitCost
- **clues：** FACTION_FORESHADOW / MEMBERSHIP_HINT / SECRET_SIGNAL / RECRUITMENT_EVIDENCE / LOYALTY_TEST / BETRAYAL_HINT / INTERNAL_CONFLICT / HIDDEN_GOAL_HINT / MEMBERSHIP_CONFIRMATION / FACTION_EXPOSURE
- **profile：** status=READY · modes=NEGOTIATE / CONCEAL / SUSPECT / PUBLIC_CHOICE · anchors=EARLY_AGENCY / OWNERSHIP_SHIFT · pressure=FACTION_SETTLE

**人工标注：Formation=`GAP_HIGH` · Resolution=`OK`**

**notes：** duration/shareScope/exitCost 把临时联盟如何运行写清楚，却没有回答双方为什么此刻必须合作、各自缺什么、谁先知道对方能补缺、如何促成接触；正是‘联盟桌已经摆好但没人有理由坐下’。

---

### M08-7 · 阵营影响公共任务

- **purpose：** 先定义独立可运行的公共任务，再定义各阵营希望其成功、失败、延迟或换方案；破坏须有次数与成本。
- **stages：** LATENT → CONTACT → FORMATION → RECRUITMENT → SUSPICION → PRESSURE → SPLIT → BETRAYAL → EXPOSURE → CONFRONTATION → RESOLUTION → CONSEQUENCE
- **roles：** factionLead / memberA / memberB / rivalLead / defector / outsider
- **plotSlots：** factionIdentity / factionGoal / publicGoal / hiddenGoal / formationReason / recruitmentMethod / joiningCondition / leavingCondition / loyaltyConflict / betrayalTrigger / betrayalCost / exposureRisk / secrecyRule / communicationRule / membershipVisibility / decisiveChoice / consequence / publicTask / stancePreference / sabotageRule
- **clues：** FACTION_FORESHADOW / MEMBERSHIP_HINT / SECRET_SIGNAL / RECRUITMENT_EVIDENCE / LOYALTY_TEST / BETRAYAL_HINT / INTERNAL_CONFLICT / HIDDEN_GOAL_HINT / MEMBERSHIP_CONFIRMATION / FACTION_EXPOSURE
- **profile：** status=READY · modes=PROBE / CONCEAL / SUSPECT · anchors=EARLY_AGENCY · pressure=FACTION_SETTLE

**人工标注：Formation=`THIN` · Resolution=`OK`**

**notes：** 公共任务本身提供了一个固定 trigger，各阵营 stance 也能产生可观察冲突；但阵营为何重视该任务、支援/破坏资源从哪来、信息如何让玩家识别对方立场仍不完整。

---

### M08-8 · 多阵营并存

- **purpose：** 推荐三阵营非对称；条件表结算，不强制单一冠军；须防两盟永久无成本压制第三方。
- **stages：** LATENT → CONTACT → FORMATION → RECRUITMENT → SUSPICION → PRESSURE → SPLIT → BETRAYAL → EXPOSURE → CONFRONTATION → RESOLUTION → CONSEQUENCE
- **roles：** factionLead / memberA / memberB / rivalLead / thirdLead / outsider / hiddenMember / mediator / defector
- **plotSlots：** factionIdentity / factionGoal / publicGoal / hiddenGoal / formationReason / recruitmentMethod / joiningCondition / leavingCondition / loyaltyConflict / betrayalTrigger / betrayalCost / exposureRisk / secrecyRule / communicationRule / membershipVisibility / decisiveChoice / consequence / conditionTable / campCountRule
- **clues：** FACTION_FORESHADOW / MEMBERSHIP_HINT / SECRET_SIGNAL / RECRUITMENT_EVIDENCE / LOYALTY_TEST / BETRAYAL_HINT / INTERNAL_CONFLICT / HIDDEN_GOAL_HINT / MEMBERSHIP_CONFIRMATION / FACTION_EXPOSURE
- **profile：** status=READY · modes=CONCEAL / SUSPECT / NEGOTIATE · anchors=EARLY_AGENCY · pressure=FACTION_SETTLE

**人工标注：Formation=`GAP_HIGH` · Resolution=`OK`**

**notes：** 多阵营条件表与第三方渔利属于 Resolution；Formation 只靠‘存在三营’和抽象利益，缺阵营间接触、互相依赖/威胁、短盟为何形成与何时破裂的具体链。

---

### M12-1 · 双边关系议价

- **purpose：** 让两名（或多名）玩家围绕具体标的进行试探、隐瞒、谈判与交换；玩家行为造成 owner/access/knowledge 真实换手，并改变后续选择。
- **stages：** PROBE → NEGOTIATE → EXCHANGE → AFTERMATH
- **roles：** bargainA / bargainB / stakeholder / witness
- **plotSlots：** contestedStake / initialOwner / seekerNeed / holderPrice / exchangeTerms / afterOwner / aftermathChoice
- **clues：** STAKE_HINT / TERM_LEAK / TRANSFER_PROOF
- **profile：** status=READY · modes=NEGOTIATE / EXCHANGE / PROBE / CONCEAL / PUBLIC_CHOICE · anchors=EARLY_AGENCY / OWNERSHIP_SHIFT / FLEXIBLE_RESOLUTION · pressure=OPEN

**人工标注：Formation=`GAP_HIGH` · Resolution=`OK`**

**notes：** 典型的 Resolution 完整、Formation 缺失：seeker/holder/stake/price/exchange/aftermath 都有，但没有‘怎么知道标的存在→怎么锁定 holder→怎么获得杠杆→对家为何需要→为何现在必须谈’。

---

## 4. FOUNDATION 21 条粗标（已填）

| ID | 名称 | Formation | Resolution | notes |
|---|---|---|---|---|
| M01-1 | 行为人判断 | **GAP_HIGH** | **THIN** | 只有 judgmentQuestion/trueAnswer/falseLead + HOOK/PAYOFF；没有证据来源、获取方式、可达路径与排除链。 |
| M01-2 | 真实原因判断 | **GAP_HIGH** | **THIN** | 能定义‘真实原因’结论，但缺导致玩家从表象走到原因的证据链、来源与反证路径。 |
| M01-3 | 决定性行为判断 | **GAP_HIGH** | **THIN** | 能问‘哪一行为决定性’，但没有多行动因果图、证据如何指向决定性行为的 Formation。 |
| M01-4 | 行动顺序判断 | **GAP_HIGH** | **THIN** | 顺序判断需要时间/位置/物证来源链；当前种子只有答案与 falseLead，无法支撑玩家自行重建顺序。 |
| M01-5 | 意图判断 | **GAP_HIGH** | **THIN** | 意图判断必须受既有事实和证据边界约束；当前没有‘哪些信息允许推到何种意图’的获取/论证链。 |
| M01-6 | 责任划分 | **GAP_HIGH** | **THIN** | 责任划分需要行为贡献、因果程度、判断标准与证据来源；当前只有问题壳。 |
| M01-7 | 公开说法核验 | **GAP_HIGH** | **THIN** | 核验公开说法应有 statement source→conflicting facts→verification path；当前只剩问答结算壳。 |
| M01-8 | 单幕追凶 | **GAP_HIGH** | **THIN** | 单幕追凶尤其要求本幕内问题、信息、获得方式和保证可达闭合；当前 HOOK/PAYOFF 远不够。 |
| M01-9 | 贯穿式追凶 | **GAP_HIGH** | **THIN** | 贯穿式追凶需要跨幕依赖与 release/reinterpretation 链；当前没有跨幕信息形成协议。 |
| M01-10 | 动态现场调查 | **GAP_HIGH** | **THIN** | 动态现场应把状态版本→观察方式→证据解释→判断串起来；当前未表达动态状态如何被玩家读取。 |
| M10-1 | 单项正式选择 | **N_A** | **THIN** | 这是纯结局映射层，Formation 应由上游剧情负责；当前 Resolution 也只有 choicePrompt→endingA/B 的种子壳。 |
| M10-2 | 多项优先级选择 | **N_A** | **THIN** | Formation 不应在结局映射层重造；但优先级规则、冲突/平票与多项选择如何映射尚未形成完整合同。 |
| M10-3 | 成对或分组问答 | **N_A** | **THIN** | Formation 由上游关系/剧情提供；当前只定义成对/分组问答概念，缺组合、聚合、冲突出口。 |
| M10-4 | 条件式结局矩阵 | **N_A** | **THIN** | Formation 不属本层；Resolution 需要明确条件表、优先级、覆盖规则和无匹配出口，当前仍是种子。 |
| M10-5 | 个人与公共结果并行 | **N_A** | **THIN** | Formation 不属本层；个人/公共结果并行的合并、冲突、同时成败规则尚未完整。 |
| M10-6 | 延迟结算 | **N_A** | **THIN** | Formation 不属本层；延迟结算需要冻结选择、后续读取点、失效/覆盖规则，当前未展开。 |
| M11-1 | 可变现场 | **GAP_HIGH** | **THIN** | 只有 stateChange/immutableBoundary；缺玩家如何发现现场可变、为何要改、谁在乎、什么触发改变与如何观察。 |
| M11-2 | 有源伪造 | **GAP_HIGH** | **THIN** | 标题强调有源伪造，但当前 FOUNDATION 仍未把伪造物来源、执行者、可发现痕迹、验证路径写成合同。 |
| M11-3 | 剧情状态传播 | **GAP_HIGH** | **THIN** | 状态传播的后果方向存在概念，但缺传播依赖图、触发源、观察节点及谁因此获得/失去行动空间。 |
| M11-4 | 现场快照与版本读取 | **GAP_HIGH** | **THIN** | 快照/版本读取天然需要‘谁在何时凭什么读取哪个版本’；当前没有观察权限、来源与读取触发链。 |
| M11-5 | 世界状态恢复 | **GAP_HIGH** | **THIN** | 恢复状态需要恢复依据、执行权限/成本、可恢复边界、触发与冲突处理；当前只有泛化 stateChange。 |

## 5. 跨族观察（只作为标注结论，不是改造方案）

### 5.1 M01

M01-FRAMING 已经具备“证据先造成错误意义、后续反证改变其意义”的真正信息因果，因此明显优于其它 COMPLETE；但当前 STORY 模板只声明 `FALSE_LEAD / CONTRADICTION / DECISIVE_EVIDENCE`，没有追凶 V1.3 中 `source_event_ids / holder_ids / location / acquisition_method / required_conclusion_ids / guaranteed reachability` 那种 Formation 级合同。

### 5.2 M07

M07 的共同强项是**信息何时、按什么规则开放**；共同弱项是**玩家为什么会追这条身份/记忆线、第一异常从哪里来、谁持有验证信息、承担者/旁观者如何一步步拼到确认**。因此 M07 多数是“release 完整，formation 偏薄”。

### 5.3 M08

M08 已有 `formationReason / recruitmentMethod / joiningCondition / loyaltyConflict / betrayalTrigger / cost` 等很好的 Formation 词汇，但它们目前主要是字段/候选值，不是有来源的因果链。尤其隐藏阵营、临时联盟、多阵营：如果删掉“你们现在结盟/怀疑/站队”的元指令，玩家未必能仅凭现有信息自然走到那一步。

### 5.4 M12

M12 的 `seeker · holder · stake · price · exchange · aftermath` 是合格的 Resolution 合同；但 Formation 目前没有正式表达 `valueSource · existenceSource · knowledgePath · locatorPath · counterpartLeverage · leverageProvenance · counterpartNeed · trigger`。因此 Formation 必须判 `GAP_HIGH`，不能因为 Packet 已 grounding 就升格。

### 5.5 M10 / M11 FOUNDATION

M10 本质是结局映射，因此 Formation 应判 `N_A`，不能强迫结局层重新制造玩家动机；但它们目前连 Resolution 也只是 FOUNDATION 薄壳。M11 则不同：现场/状态改变本身会成为玩家体验，必须说明玩家如何发现可改、为什么要改、谁受影响、状态变化如何被观察，因此 Formation 不能判 N_A。

## 6. 最终等级清单（便于后续机器读取/人工抄回）

```yaml
COMPLETE:
  M01-FRAMING: { formation: THIN, resolution: OK }
  M07-1: { formation: GAP_HIGH, resolution: OK }
  M07-2: { formation: THIN, resolution: OK }
  M07-3: { formation: THIN, resolution: OK }
  M07-4: { formation: GAP_HIGH, resolution: OK }
  M07-5: { formation: THIN, resolution: OK }
  M07-6: { formation: THIN, resolution: OK }
  M07-7: { formation: THIN, resolution: OK }
  M07-8: { formation: GAP_HIGH, resolution: OK }
  M08-1: { formation: THIN, resolution: OK }
  M08-2: { formation: GAP_HIGH, resolution: OK }
  M08-3: { formation: GAP_HIGH, resolution: OK }
  M08-4: { formation: THIN, resolution: OK }
  M08-5: { formation: THIN, resolution: OK }
  M08-6: { formation: GAP_HIGH, resolution: OK }
  M08-7: { formation: THIN, resolution: OK }
  M08-8: { formation: GAP_HIGH, resolution: OK }
  M12-1: { formation: GAP_HIGH, resolution: OK }
FOUNDATION:
  M01-1: { formation: GAP_HIGH, resolution: THIN }
  M01-2: { formation: GAP_HIGH, resolution: THIN }
  M01-3: { formation: GAP_HIGH, resolution: THIN }
  M01-4: { formation: GAP_HIGH, resolution: THIN }
  M01-5: { formation: GAP_HIGH, resolution: THIN }
  M01-6: { formation: GAP_HIGH, resolution: THIN }
  M01-7: { formation: GAP_HIGH, resolution: THIN }
  M01-8: { formation: GAP_HIGH, resolution: THIN }
  M01-9: { formation: GAP_HIGH, resolution: THIN }
  M01-10: { formation: GAP_HIGH, resolution: THIN }
  M10-1: { formation: N_A, resolution: THIN }
  M10-2: { formation: N_A, resolution: THIN }
  M10-3: { formation: N_A, resolution: THIN }
  M10-4: { formation: N_A, resolution: THIN }
  M10-5: { formation: N_A, resolution: THIN }
  M10-6: { formation: N_A, resolution: THIN }
  M11-1: { formation: GAP_HIGH, resolution: THIN }
  M11-2: { formation: GAP_HIGH, resolution: THIN }
  M11-3: { formation: GAP_HIGH, resolution: THIN }
  M11-4: { formation: GAP_HIGH, resolution: THIN }
  M11-5: { formation: GAP_HIGH, resolution: THIN }
```

> 标注结论到此为止。**未据此修改 pack / Writer / Planner / Gate。**