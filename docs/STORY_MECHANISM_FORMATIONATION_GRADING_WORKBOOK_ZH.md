# STORY 机制标注工作簿（Formation 等级 · 人工填）

> 用途：你统一标注 Formation / Resolution 等级；**先标注、再考虑改代码**。
> 生成自 registry 快照：`captures/story-mechanism-inventory-for-grading.json`
> 配套骨架：`docs/STORY_MECHANISM_FORMATIONATION_GAP_ZH.md`
> **本文件不改机制；只供阅读与打分。**

## 怎么标

| 字段 | 含义 |
|---|---|
| `Formation` | 玩家如何自己走到结算桌（存在/知情/锁定/杠杆/触发） |
| `Resolution` | 形成后怎么推进/结算（阶段、换手、开放、阵营结算等） |
| 等级建议 | `OK` / `THIN` / `GAP_HIGH` / `N_A`（本层不负责 Formation） |
| `notes` | 你的一句话理由 |

Formation 8 问（交换类；其它族做同构映射）：valueSource / existenceSource / knowledgePath / locatorPath / counterpartLeverage / leverageProvenance / counterpartNeed / trigger

---

## 0. 材料包索引（文档 + 关键代码）

### 必读文档

| 文件 | 内容 |
|---|---|
| `docs/STORY_MECHANISM_FORMATIONATION_GAP_ZH.md` | Formation vs Resolution 骨架 |
| `shared/STORY_MECHANISM_PRODUCTION.md` | STORY 生产原则（冻结） |
| `shared/M07_CONTENT_COVERAGE.md` | M07×8 设计矩阵 |
| `shared/M08_CONTENT_COVERAGE.md` | M08×8 设计矩阵 |
| `docs/P10_3_STORY_EXPERIENCE_COVERAGE_ZH.md` | M12-1 为何出现 |
| `docs/追凶机制生产架构_工作流协议版_V1.3.md` | 追凶参照（Formation 相对完整的传统） |
| `docs/创作者机制设计与多审查工作台-V1.md` | 工作台产品面 |
| `docs/机制运行包与主持端联动实施基线-V1.md` | runtime 包（偏 GAME/主持） |

### 关键代码（STORY 合同本体）

| 文件 | 内容 |
|---|---|
| `shared/story-mechanism-contracts.js` | Block / ProjectStoryState |
| `shared/story-mechanism-registry.js` | Registry |
| `shared/story-mechanism-templates-data.js` | 组装 + FOUNDATION 种子 + M01-FRAMING |
| `shared/story-mechanism-m01-framing-data.js` | 追凶变体/plot 候选 |
| `shared/story-mechanism-m01-framing.js` | 兼容导出 |
| `shared/story-mechanism-m07-pack.js` | M07-1…8 COMPLETE |
| `shared/story-mechanism-m08-pack.js` | M08-1…8 COMPLETE |
| `shared/story-mechanism-m12-pack.js` | M12-1 COMPLETE |
| `shared/complete-beat-semantics-data.js` | COMPLETE BeatSemantics |
| `shared/story-experience-profiles-data.js` | ExperienceProfile |
| `shared/creation-catalog-metadata.js` | Planner 用家族元数据 |
| `shared/story-mechanism-engine.js` | 通用生成引擎 |
| `mechanism-catalog-v2.ts` | 全库 MechanismRole 映射（含 GAME） |

### 机器快照

- `captures/story-mechanism-inventory-for-grading.json` — 全部 STORY template 的 stages/roles/plots/clues/profile

### 明确先不标 / 另册

- **GAME**（M02–M06、M09）：`shared/mechanism-templates.js` / `mechanism-catalog*.ts` — 幕内玩法，不是本册 Formation 主战场
- Writer / Projection / Rendering：P10.4–P10.5，不在本标注范围

---

## 1. COMPLETE 总表（先标这里）

| ID | 名称 | Formation | Resolution | notes |
|---|---|---|---|---|
| M01-FRAMING | 嫁祸型追凶 |  |  |  |
| M07-1 | 固定阶段开放 |  |  |  |
| M07-2 | 条件触发开放 |  |  |  |
| M07-3 | 多路径开放 |  |  |  |
| M07-4 | 个人记忆分层 |  |  |  |
| M07-5 | 身份权限变化 |  |  |  |
| M07-6 | 旧事实重新解释 |  |  |  |
| M07-7 | 主动选择保留或恢复 |  |  |  |
| M07-8 | 集合属性探测 |  |  |  |
| M08-1 | 固定公开阵营 |  |  |  |
| M08-2 | 固定隐藏阵营 |  |  |  |
| M08-3 | 非对称阵营 |  |  |  |
| M08-4 | 动态阵营 |  |  |  |
| M08-5 | 个人目标叠加阵营目标 |  |  |  |
| M08-6 | 临时联盟 |  |  |  |
| M08-7 | 阵营影响公共任务 |  |  |  |
| M08-8 | 多阵营并存 |  |  |  |
| M12-1 | 双边关系议价 |  |  |  |

---

## 2. COMPLETE 逐条合同摘要（供对照）

### M01-FRAMING · 嫁祸型追凶

- **purpose：** 让玩家先形成一个有证据支撑的错误嫌疑，再通过反证推翻嫁祸并锁定真凶。
- **stages：** SETUP → CRIME_DISCOVERY → FALSE_DIRECTION → CONTRADICTION → TRUTH_REVEAL
- **owners：** culprit, discoverer
- **phases：** 0, 1, 2, 3, 4
- **profile：** READY · commitments=CRIME_FRAMING · modes=PROBE,CONCEAL,SUSPECT · anchors=EARLY_AGENCY,LATE_REINTERPRETATION · pressure=CULPRIT_CENTRIC_HIGH
- **roles：**
  - `victim*` 死者/被害关联 → victim
  - `culprit*` 真凶 → killer
  - `framedCharacter*` 被嫁祸者 → framed
  - `discoverer` 发现异常者 → discoverer
- **plotSlots：**
  - `trueMotive` 真实动机 · presets: 掩盖十年前的私吞行为 / 争夺继承权 / 灭口以免旧案曝光
  - `trueMethod` 真实手法 · presets: 勒杀 / 投毒 / 钝器击打
  - `plantedEvidence` 栽赃/误导物 · presets: 玉佩 / 账册残页 / 带血手帕
  - `apparentConclusion` 第一层错误判断 · presets: 被嫁祸者进入过现场并与死者起过冲突
  - `contradiction` 反证
  - `decisiveEvidence` 关键突破
  - `concealmentMethod` 掩饰方式
- **clues：**
  - `FALSE_LEAD` (FALSE_LEAD@FALSE_DIRECTION) 误导
  - `CONTRADICTION` (CONTRADICTION@CONTRADICTION) 反证
  - `TRUE_EVIDENCE` (TRUE_EVIDENCE@TRUTH_REVEAL) 真手法
  - `DECISIVE_EVIDENCE` (DECISIVE_EVIDENCE@TRUTH_REVEAL) 突破

**你的标注：** Formation=`____` · Resolution=`____` · notes=`____________________`

---

### M07-1 · 固定阶段开放

- **purpose：** 保证关键记忆/身份相关内容在指定剧情阶段自动到达接收者，建立可控的信息节奏，而不依赖主持临场发挥。
- **stages：** HIDDEN → FIRST_ANOMALY → PARTIAL_REVEAL → CONTRADICTION → CONFIRMATION → CONSEQUENCE
- **owners：** bearer
- **phases：** 0, 1, 2, 3
- **profile：** READY · commitments=HIDDEN_IDENTITY · modes=CONCEAL,PROBE,SUSPECT · anchors=EARLY_AGENCY,LATE_REINTERPRETATION · pressure=IDENTITY_REVEAL
- **roles：**
  - `bearer*` 核心身份/记忆承担者 → identity_bearer
  - `knower` 知情者 → witness
  - `misled` 被误导者 → misled
  - `revealer` 揭示推动者 → discoverer
  - `related` 关联人物 → support
- **plotSlots：**
  - `surfaceBelief` 表面认知 · presets: 承担者只是普通客人/职员 / 众人相信既有公开身世
  - `hiddenContent` 隐藏内容 · presets: 一段被封闭的关键记忆 / 一个未公开的真实身份事实
  - `trueContent` 真实内容 · presets: 可被证据验证的真实版本 / 与表面认知冲突的客观事实
  - `concealmentReason` 隐藏原因 · presets: 保护他人免受牵连 / 逃避旧案追责 / 维持当前身份所依赖的社会位置
  - `misdirectionForm` 误导方式 · presets: 伪造身世文书 / 栽赃他人身份线索 / 故意散播错误称谓
  - `firstAnomaly` 第一次异常 · presets: 称谓口误 / 对某地过度熟悉 / 对某物的异常反应
  - `midFragment` 中期证据/记忆碎片 · presets: 半截旧信 / 残缺名册 / 与公开身份不符的私人物件
  - `decisiveReveal` 决定性揭示 · presets: 物件对读 / 知情者被迫开口 / 公开记录被调出
  - `revealConsequence` 揭示后的影响 · presets: 改变信任关系 / 开放新权限或关闭旧权限 / 推翻此前一项公开判断
  - `knowerSource` 知情来源 · presets: 亲历旧事件 / 保管关键文书 / 受人之托保密
  - `identityProofForm` 身份证明形式 · presets: 私人物件 / 身体特征 / 家族记录
  - `openStageLabel` 计划开放阶段名 · presets: 第二幕末 / 第三幕初 / 搜证结束后
- **clues：**
  - `FORESHADOW` (FORESHADOW@HIDDEN) 早期伏笔
  - `MEMORY_FRAGMENT` (MEMORY_FRAGMENT@PARTIAL_REVEAL) 记忆碎片
  - `IDENTITY_HINT` (IDENTITY_HINT@FIRST_ANOMALY) 身份暗示
  - `MISDIRECTION` (MISDIRECTION@PARTIAL_REVEAL) 误导
  - `CONFIRMATION` (CONFIRMATION@CONFIRMATION) 确认
  - `DECISIVE_REVEAL` (DECISIVE_REVEAL@CONFIRMATION) 决定性揭示

**你的标注：** Formation=`____` · Resolution=`____` · notes=`____________________`

---

### M07-2 · 条件触发开放

- **purpose：** 让隐藏内容在正式状态满足时由系统发放，建立“做对事才看到”的认知奖励，同时保证必要内容有超时出口。
- **stages：** HIDDEN → FIRST_ANOMALY → PARTIAL_REVEAL → CONTRADICTION → CONFIRMATION → CONSEQUENCE
- **owners：** bearer
- **phases：** 0, 1, 2, 3
- **profile：** READY · commitments=HIDDEN_IDENTITY · modes=PROBE,CONCEAL,SUSPECT · anchors=EARLY_AGENCY · pressure=IDENTITY_REVEAL
- **roles：**
  - `bearer*` 核心身份/记忆承担者 → identity_bearer
  - `knower` 知情者 → witness
  - `misled` 被误导者 → misled
  - `revealer` 揭示推动者 → discoverer
  - `related` 关联人物 → support
- **plotSlots：**
  - `surfaceBelief` 表面认知 · presets: 承担者只是普通客人/职员 / 众人相信既有公开身世
  - `hiddenContent` 隐藏内容 · presets: 一段被封闭的关键记忆 / 一个未公开的真实身份事实
  - `trueContent` 真实内容 · presets: 可被证据验证的真实版本 / 与表面认知冲突的客观事实
  - `concealmentReason` 隐藏原因 · presets: 保护他人免受牵连 / 逃避旧案追责 / 维持当前身份所依赖的社会位置
  - `misdirectionForm` 误导方式 · presets: 伪造身世文书 / 栽赃他人身份线索 / 故意散播错误称谓
  - `firstAnomaly` 第一次异常 · presets: 称谓口误 / 对某地过度熟悉 / 对某物的异常反应
  - `midFragment` 中期证据/记忆碎片 · presets: 半截旧信 / 残缺名册 / 与公开身份不符的私人物件
  - `decisiveReveal` 决定性揭示 · presets: 物件对读 / 知情者被迫开口 / 公开记录被调出
  - `revealConsequence` 揭示后的影响 · presets: 改变信任关系 / 开放新权限或关闭旧权限 / 推翻此前一项公开判断
  - `knowerSource` 知情来源 · presets: 亲历旧事件 / 保管关键文书 / 受人之托保密
  - `identityProofForm` 身份证明形式 · presets: 私人物件 / 身体特征 / 家族记录
  - `triggerCondition` 正式触发条件 · presets: 获得指定结算码 / 使用指定权限 / 完成指定组合
  - `timeoutFallback` 超时替代路径 · presets: 降级内容包 / 公共摘要 / 下一阶段强制保底
- **clues：**
  - `FORESHADOW` (FORESHADOW@HIDDEN) 早期伏笔
  - `MEMORY_FRAGMENT` (MEMORY_FRAGMENT@PARTIAL_REVEAL) 记忆碎片
  - `IDENTITY_HINT` (IDENTITY_HINT@FIRST_ANOMALY) 身份暗示
  - `MISDIRECTION` (MISDIRECTION@PARTIAL_REVEAL) 误导
  - `CONFIRMATION` (CONFIRMATION@CONFIRMATION) 确认
  - `DECISIVE_REVEAL` (DECISIVE_REVEAL@CONFIRMATION) 决定性揭示

**你的标注：** Formation=`____` · Resolution=`____` · notes=`____________________`

---

### M07-3 · 多路径开放

- **purpose：** 同一关键内容至少两条真正不同的到达路径，让玩家用调查/交换/拼接/选择等不同方式抵达同一真相，避免单点卡死。
- **stages：** HIDDEN → FIRST_ANOMALY → PARTIAL_REVEAL → CONTRADICTION → CONFIRMATION → CONSEQUENCE
- **owners：** bearer
- **phases：** 0, 1, 2, 3
- **profile：** READY · commitments=HIDDEN_IDENTITY · modes=CONCEAL,PROBE,SUSPECT · anchors=EARLY_AGENCY,LATE_REINTERPRETATION · pressure=IDENTITY_REVEAL
- **roles：**
  - `bearer*` 核心身份/记忆承担者 → identity_bearer
  - `knower` 知情者 → witness
  - `misled` 被误导者 → misled
  - `revealer` 揭示推动者 → discoverer
  - `related` 关联人物 → support
- **plotSlots：**
  - `surfaceBelief` 表面认知 · presets: 承担者只是普通客人/职员 / 众人相信既有公开身世
  - `hiddenContent` 隐藏内容 · presets: 一段被封闭的关键记忆 / 一个未公开的真实身份事实
  - `trueContent` 真实内容 · presets: 可被证据验证的真实版本 / 与表面认知冲突的客观事实
  - `concealmentReason` 隐藏原因 · presets: 保护他人免受牵连 / 逃避旧案追责 / 维持当前身份所依赖的社会位置
  - `misdirectionForm` 误导方式 · presets: 伪造身世文书 / 栽赃他人身份线索 / 故意散播错误称谓
  - `firstAnomaly` 第一次异常 · presets: 称谓口误 / 对某地过度熟悉 / 对某物的异常反应
  - `midFragment` 中期证据/记忆碎片 · presets: 半截旧信 / 残缺名册 / 与公开身份不符的私人物件
  - `decisiveReveal` 决定性揭示 · presets: 物件对读 / 知情者被迫开口 / 公开记录被调出
  - `revealConsequence` 揭示后的影响 · presets: 改变信任关系 / 开放新权限或关闭旧权限 / 推翻此前一项公开判断
  - `knowerSource` 知情来源 · presets: 亲历旧事件 / 保管关键文书 / 受人之托保密
  - `identityProofForm` 身份证明形式 · presets: 私人物件 / 身体特征 / 家族记录
  - `pathA` 路径A形式 · presets: 调查搜证 / 资源交换 / 内容拼接
  - `pathB` 路径B形式 · presets: 资源交换 / 正式选择 / 权限使用
- **clues：**
  - `FORESHADOW` (FORESHADOW@HIDDEN) 早期伏笔
  - `MEMORY_FRAGMENT` (MEMORY_FRAGMENT@PARTIAL_REVEAL) 记忆碎片
  - `IDENTITY_HINT` (IDENTITY_HINT@FIRST_ANOMALY) 身份暗示
  - `MISDIRECTION` (MISDIRECTION@PARTIAL_REVEAL) 误导
  - `CONFIRMATION` (CONFIRMATION@CONFIRMATION) 确认
  - `DECISIVE_REVEAL` (DECISIVE_REVEAL@CONFIRMATION) 决定性揭示

**你的标注：** Formation=`____` · Resolution=`____` · notes=`____________________`

---

### M07-4 · 个人记忆分层

- **purpose：** 为承担者建立不对称的记忆层级：先给最低可玩层，再按本人正式状态递进，制造隐瞒/公开/误述的社交空间。
- **stages：** HIDDEN → FIRST_ANOMALY → PARTIAL_REVEAL → CONTRADICTION → CONFIRMATION → CONSEQUENCE
- **owners：** bearer
- **phases：** 0, 1, 2, 3
- **profile：** READY · commitments=HIDDEN_IDENTITY · modes=CONCEAL,PROBE,SUSPECT · anchors=EARLY_AGENCY,LATE_REINTERPRETATION · pressure=IDENTITY_REVEAL
- **roles：**
  - `bearer*` 核心身份/记忆承担者 → identity_bearer
  - `knower` 知情者 → witness
  - `misled` 被误导者 → misled
  - `revealer` 揭示推动者 → discoverer
  - `related` 关联人物 → support
- **plotSlots：**
  - `surfaceBelief` 表面认知 · presets: 承担者只是普通客人/职员 / 众人相信既有公开身世
  - `hiddenContent` 隐藏内容 · presets: 一段被封闭的关键记忆 / 一个未公开的真实身份事实
  - `trueContent` 真实内容 · presets: 可被证据验证的真实版本 / 与表面认知冲突的客观事实
  - `concealmentReason` 隐藏原因 · presets: 保护他人免受牵连 / 逃避旧案追责 / 维持当前身份所依赖的社会位置
  - `misdirectionForm` 误导方式 · presets: 伪造身世文书 / 栽赃他人身份线索 / 故意散播错误称谓
  - `firstAnomaly` 第一次异常 · presets: 称谓口误 / 对某地过度熟悉 / 对某物的异常反应
  - `midFragment` 中期证据/记忆碎片 · presets: 半截旧信 / 残缺名册 / 与公开身份不符的私人物件
  - `decisiveReveal` 决定性揭示 · presets: 物件对读 / 知情者被迫开口 / 公开记录被调出
  - `revealConsequence` 揭示后的影响 · presets: 改变信任关系 / 开放新权限或关闭旧权限 / 推翻此前一项公开判断
  - `knowerSource` 知情来源 · presets: 亲历旧事件 / 保管关键文书 / 受人之托保密
  - `identityProofForm` 身份证明形式 · presets: 私人物件 / 身体特征 / 家族记录
  - `layerCount` 记忆层数 · presets: 2 / 3 / 4
  - `memoryLossForm` 记忆缺失/封闭形式 · presets: 创伤性封闭 / 人为药物/仪式阻断 / 第三者篡改叙述
- **clues：**
  - `FORESHADOW` (FORESHADOW@HIDDEN) 早期伏笔
  - `MEMORY_FRAGMENT` (MEMORY_FRAGMENT@PARTIAL_REVEAL) 记忆碎片
  - `IDENTITY_HINT` (IDENTITY_HINT@FIRST_ANOMALY) 身份暗示
  - `MISDIRECTION` (MISDIRECTION@PARTIAL_REVEAL) 误导
  - `CONFIRMATION` (CONFIRMATION@CONFIRMATION) 确认
  - `DECISIVE_REVEAL` (DECISIVE_REVEAL@CONFIRMATION) 决定性揭示

**你的标注：** Formation=`____` · Resolution=`____` · notes=`____________________`

---

### M07-5 · 身份权限变化

- **purpose：** 先让身份内容显现，再按预声明规则启用界面权限，使“我是谁”转化为“我现在能做什么”，并禁止万能补丁能力。
- **stages：** HIDDEN → FIRST_ANOMALY → PARTIAL_REVEAL → CONTRADICTION → CONFIRMATION → CONSEQUENCE
- **owners：** bearer
- **phases：** 0, 1, 2, 3
- **profile：** READY · commitments=HIDDEN_IDENTITY · modes=PROBE,CONCEAL,SUSPECT · anchors=EARLY_AGENCY · pressure=IDENTITY_REVEAL
- **roles：**
  - `bearer*` 核心身份/记忆承担者 → identity_bearer
  - `knower` 知情者 → witness
  - `misled` 被误导者 → misled
  - `revealer` 揭示推动者 → discoverer
  - `related` 关联人物 → support
- **plotSlots：**
  - `surfaceBelief` 表面认知 · presets: 承担者只是普通客人/职员 / 众人相信既有公开身世
  - `hiddenContent` 隐藏内容 · presets: 一段被封闭的关键记忆 / 一个未公开的真实身份事实
  - `trueContent` 真实内容 · presets: 可被证据验证的真实版本 / 与表面认知冲突的客观事实
  - `concealmentReason` 隐藏原因 · presets: 保护他人免受牵连 / 逃避旧案追责 / 维持当前身份所依赖的社会位置
  - `misdirectionForm` 误导方式 · presets: 伪造身世文书 / 栽赃他人身份线索 / 故意散播错误称谓
  - `firstAnomaly` 第一次异常 · presets: 称谓口误 / 对某地过度熟悉 / 对某物的异常反应
  - `midFragment` 中期证据/记忆碎片 · presets: 半截旧信 / 残缺名册 / 与公开身份不符的私人物件
  - `decisiveReveal` 决定性揭示 · presets: 物件对读 / 知情者被迫开口 / 公开记录被调出
  - `revealConsequence` 揭示后的影响 · presets: 改变信任关系 / 开放新权限或关闭旧权限 / 推翻此前一项公开判断
  - `knowerSource` 知情来源 · presets: 亲历旧事件 / 保管关键文书 / 受人之托保密
  - `identityProofForm` 身份证明形式 · presets: 私人物件 / 身体特征 / 家族记录
  - `permissionScope` 新权限范围 · presets: 一次查阅权 / 区域通行 / 表决加权
  - `permissionExpiry` 权限失效节点 · presets: 本幕结束 / 使用一次后 / 被公开承认后
  - `cognitionConflict` 认知冲突形式 · presets: 早期行为与后期设定冲突 / 知情者本应阻止却未阻止 / 表面关系与真实血缘冲突
- **clues：**
  - `FORESHADOW` (FORESHADOW@HIDDEN) 早期伏笔
  - `MEMORY_FRAGMENT` (MEMORY_FRAGMENT@PARTIAL_REVEAL) 记忆碎片
  - `IDENTITY_HINT` (IDENTITY_HINT@FIRST_ANOMALY) 身份暗示
  - `MISDIRECTION` (MISDIRECTION@PARTIAL_REVEAL) 误导
  - `CONFIRMATION` (CONFIRMATION@CONFIRMATION) 确认
  - `DECISIVE_REVEAL` (DECISIVE_REVEAL@CONFIRMATION) 决定性揭示

**你的标注：** Formation=`____` · Resolution=`____` · notes=`____________________`

---

### M07-6 · 旧事实重新解释

- **purpose：** 在不改写早期客观动作的前提下，追加后期语境，迫使玩家重估已发生事件的意义，并自动拦截“早该知道却装不知道”的冲突。
- **stages：** HIDDEN → FIRST_ANOMALY → PARTIAL_REVEAL → CONTRADICTION → CONFIRMATION → CONSEQUENCE
- **owners：** bearer
- **phases：** 0, 1, 2, 3
- **profile：** READY · commitments=HIDDEN_IDENTITY · modes=CONCEAL,PROBE,SUSPECT · anchors=EARLY_AGENCY,LATE_REINTERPRETATION · pressure=IDENTITY_REVEAL
- **roles：**
  - `bearer*` 核心身份/记忆承担者 → identity_bearer
  - `knower` 知情者 → witness
  - `misled` 被误导者 → misled
  - `revealer` 揭示推动者 → discoverer
  - `related` 关联人物 → support
- **plotSlots：**
  - `surfaceBelief` 表面认知 · presets: 承担者只是普通客人/职员 / 众人相信既有公开身世
  - `hiddenContent` 隐藏内容 · presets: 一段被封闭的关键记忆 / 一个未公开的真实身份事实
  - `trueContent` 真实内容 · presets: 可被证据验证的真实版本 / 与表面认知冲突的客观事实
  - `concealmentReason` 隐藏原因 · presets: 保护他人免受牵连 / 逃避旧案追责 / 维持当前身份所依赖的社会位置
  - `misdirectionForm` 误导方式 · presets: 伪造身世文书 / 栽赃他人身份线索 / 故意散播错误称谓
  - `firstAnomaly` 第一次异常 · presets: 称谓口误 / 对某地过度熟悉 / 对某物的异常反应
  - `midFragment` 中期证据/记忆碎片 · presets: 半截旧信 / 残缺名册 / 与公开身份不符的私人物件
  - `decisiveReveal` 决定性揭示 · presets: 物件对读 / 知情者被迫开口 / 公开记录被调出
  - `revealConsequence` 揭示后的影响 · presets: 改变信任关系 / 开放新权限或关闭旧权限 / 推翻此前一项公开判断
  - `knowerSource` 知情来源 · presets: 亲历旧事件 / 保管关键文书 / 受人之托保密
  - `identityProofForm` 身份证明形式 · presets: 私人物件 / 身体特征 / 家族记录
  - `objectiveEvent` 客观事件（不可改写） · presets: 某人在某时某地做了某可验证动作
  - `earlyInterpretation` 早期解释 · presets: 出于善意 / 出于敌意 / 出于偶然
  - `laterContext` 后期语境 · presets: 保护性隐瞒 / 另有交易 / 被胁迫
  - `cognitionConflict` 知情冲突形式 · presets: 早期行为与后期设定冲突 / 知情者本应阻止却未阻止 / 表面关系与真实血缘冲突
- **clues：**
  - `FORESHADOW` (FORESHADOW@HIDDEN) 早期伏笔
  - `MEMORY_FRAGMENT` (MEMORY_FRAGMENT@PARTIAL_REVEAL) 记忆碎片
  - `IDENTITY_HINT` (IDENTITY_HINT@FIRST_ANOMALY) 身份暗示
  - `MISDIRECTION` (MISDIRECTION@PARTIAL_REVEAL) 误导
  - `CONFIRMATION` (CONFIRMATION@CONFIRMATION) 确认
  - `DECISIVE_REVEAL` (DECISIVE_REVEAL@CONFIRMATION) 决定性揭示

**你的标注：** Formation=`____` · Resolution=`____` · notes=`____________________`

---

### M07-7 · 主动选择保留或恢复

- **purpose：** 让玩家在多份既有内容中主动选择优先开放或付费扩选，把“记起什么/公开什么”变成可玩决策，同时保证未选项不含唯一主线钥匙。
- **stages：** HIDDEN → FIRST_ANOMALY → PARTIAL_REVEAL → CONTRADICTION → CONFIRMATION → CONSEQUENCE
- **owners：** bearer
- **phases：** 0, 1, 2, 3
- **profile：** READY · commitments=HIDDEN_IDENTITY · modes=CONCEAL,PROBE,SUSPECT · anchors=EARLY_AGENCY,LATE_REINTERPRETATION · pressure=IDENTITY_REVEAL
- **roles：**
  - `bearer*` 核心身份/记忆承担者 → identity_bearer
  - `knower` 知情者 → witness
  - `misled` 被误导者 → misled
  - `revealer` 揭示推动者 → discoverer
  - `related` 关联人物 → support
- **plotSlots：**
  - `surfaceBelief` 表面认知 · presets: 承担者只是普通客人/职员 / 众人相信既有公开身世
  - `hiddenContent` 隐藏内容 · presets: 一段被封闭的关键记忆 / 一个未公开的真实身份事实
  - `trueContent` 真实内容 · presets: 可被证据验证的真实版本 / 与表面认知冲突的客观事实
  - `concealmentReason` 隐藏原因 · presets: 保护他人免受牵连 / 逃避旧案追责 / 维持当前身份所依赖的社会位置
  - `misdirectionForm` 误导方式 · presets: 伪造身世文书 / 栽赃他人身份线索 / 故意散播错误称谓
  - `firstAnomaly` 第一次异常 · presets: 称谓口误 / 对某地过度熟悉 / 对某物的异常反应
  - `midFragment` 中期证据/记忆碎片 · presets: 半截旧信 / 残缺名册 / 与公开身份不符的私人物件
  - `decisiveReveal` 决定性揭示 · presets: 物件对读 / 知情者被迫开口 / 公开记录被调出
  - `revealConsequence` 揭示后的影响 · presets: 改变信任关系 / 开放新权限或关闭旧权限 / 推翻此前一项公开判断
  - `knowerSource` 知情来源 · presets: 亲历旧事件 / 保管关键文书 / 受人之托保密
  - `identityProofForm` 身份证明形式 · presets: 私人物件 / 身体特征 / 家族记录
  - `candidateCount` 候选数量 · presets: 2 / 3 / 4
  - `expandCost` 扩选代价形式 · presets: 正式资源 / 权限次数 / 暴露风险
- **clues：**
  - `FORESHADOW` (FORESHADOW@HIDDEN) 早期伏笔
  - `MEMORY_FRAGMENT` (MEMORY_FRAGMENT@PARTIAL_REVEAL) 记忆碎片
  - `IDENTITY_HINT` (IDENTITY_HINT@FIRST_ANOMALY) 身份暗示
  - `MISDIRECTION` (MISDIRECTION@PARTIAL_REVEAL) 误导
  - `CONFIRMATION` (CONFIRMATION@CONFIRMATION) 确认
  - `DECISIVE_REVEAL` (DECISIVE_REVEAL@CONFIRMATION) 决定性揭示

**你的标注：** Formation=`____` · Resolution=`____` · notes=`____________________`

---

### M07-8 · 集合属性探测

- **purpose：** 在不点名个人的前提下，用聚合结果压缩身份候选空间，制造谨慎组队与信息预算压力。
- **stages：** HIDDEN → FIRST_ANOMALY → PARTIAL_REVEAL → CONTRADICTION → CONFIRMATION → CONSEQUENCE
- **owners：** bearer, probeLead
- **phases：** 0, 1, 2, 3
- **profile：** READY · commitments=HIDDEN_IDENTITY · modes=CONCEAL,PROBE,SUSPECT · anchors=EARLY_AGENCY,LATE_REINTERPRETATION · pressure=IDENTITY_REVEAL
- **roles：**
  - `bearer*` 核心身份/记忆承担者 → identity_bearer
  - `knower` 知情者 → witness
  - `misled` 被误导者 → misled
  - `revealer` 揭示推动者 → discoverer
  - `related` 关联人物 → support
  - `probeLead*` 探测发起者 → discoverer
- **plotSlots：**
  - `surfaceBelief` 表面认知 · presets: 承担者只是普通客人/职员 / 众人相信既有公开身世
  - `hiddenContent` 隐藏内容 · presets: 一段被封闭的关键记忆 / 一个未公开的真实身份事实
  - `trueContent` 真实内容 · presets: 可被证据验证的真实版本 / 与表面认知冲突的客观事实
  - `concealmentReason` 隐藏原因 · presets: 保护他人免受牵连 / 逃避旧案追责 / 维持当前身份所依赖的社会位置
  - `misdirectionForm` 误导方式 · presets: 伪造身世文书 / 栽赃他人身份线索 / 故意散播错误称谓
  - `firstAnomaly` 第一次异常 · presets: 称谓口误 / 对某地过度熟悉 / 对某物的异常反应
  - `midFragment` 中期证据/记忆碎片 · presets: 半截旧信 / 残缺名册 / 与公开身份不符的私人物件
  - `decisiveReveal` 决定性揭示 · presets: 物件对读 / 知情者被迫开口 / 公开记录被调出
  - `revealConsequence` 揭示后的影响 · presets: 改变信任关系 / 开放新权限或关闭旧权限 / 推翻此前一项公开判断
  - `knowerSource` 知情来源 · presets: 亲历旧事件 / 保管关键文书 / 受人之托保密
  - `identityProofForm` 身份证明形式 · presets: 私人物件 / 身体特征 / 家族记录
  - `targetTrait` 被探测正式属性 · presets: 隐藏阵营标记 / 身份权限位 / 知情者标记
  - `probeOutputMode` 聚合输出模式 · presets: MAJORITY / EXACT_COUNT / COUNT_RANGE
  - `snapshotRule` 快照规则 · presets: CURRENT / STAGE_LOCKED
  - `groupSize` 集合大小 · presets: 2-3 / 3 / 3-5
- **clues：**
  - `FORESHADOW` (FORESHADOW@HIDDEN) 早期伏笔
  - `MEMORY_FRAGMENT` (MEMORY_FRAGMENT@PARTIAL_REVEAL) 记忆碎片
  - `IDENTITY_HINT` (IDENTITY_HINT@FIRST_ANOMALY) 身份暗示
  - `MISDIRECTION` (MISDIRECTION@PARTIAL_REVEAL) 误导
  - `CONFIRMATION` (CONFIRMATION@CONFIRMATION) 确认
  - `DECISIVE_REVEAL` (DECISIVE_REVEAL@CONFIRMATION) 决定性揭示

**你的标注：** Formation=`____` · Resolution=`____` · notes=`____________________`

---

### M08-1 · 固定公开阵营

- **purpose：** 开场即公开归属与目标，用可观察行动差异制造阵营博弈与公共任务张力。
- **stages：** LATENT → CONTACT → FORMATION → RECRUITMENT → SUSPICION → PRESSURE → SPLIT → BETRAYAL → EXPOSURE → CONFRONTATION → RESOLUTION → CONSEQUENCE
- **owners：** factionLead, defector
- **phases：** 0, 1, 2, 3
- **profile：** READY · commitments=FACTION_STRUCTURE · modes=CONCEAL,SUSPECT,NEGOTIATE · anchors=EARLY_AGENCY · pressure=FACTION_SETTLE
- **roles：**
  - `factionLead*` 阵营领袖 → faction_lead
  - `memberA*` 核心成员甲 → member
  - `memberB` 核心成员乙 → member
  - `outsider` 局外观察者 → outsider
  - `rivalLead` 对立阵营领袖 → rival_lead
  - `defector` 叛离/摇摆者 → defector
- **plotSlots：**
  - `factionIdentity` 阵营身份/名义 · presets: 公开同盟 / 隐秘结社 / 临时同盟
  - `factionGoal` 阵营真实目标 · presets: 夺取关键资源 / 保全共同秘密 / 推翻既有秩序
  - `publicGoal` 公开宣称目标 · presets: 维护秩序 / 追查真相 / 保全利益
  - `hiddenGoal` 隐藏目标 · presets: 公开目标 / 成员共享秘密目标 / 每人理解不同
  - `formationReason` 成形原因 · presets: 共同敌人 / 共同利益 / 血缘或组织归属
  - `recruitmentMethod` 招募方式 · presets: 私下邀请 / 任务考验 / 信物确认
  - `joiningCondition` 加入条件 · presets: 完成考验 / 交出信物 / 共享秘密
  - `leavingCondition` 退出条件 · presets: 支付代价 / 公开切割 / 被驱逐
  - `loyaltyConflict` 忠诚冲突 · presets: 个人目标冲突 / 道德底线 / 被牺牲风险
  - `betrayalTrigger` 背叛触发 · presets: 利益冲突 / 身份揭露 / 重要人物死亡
  - `betrayalCost` 背叛代价 · presets: 失去资源 / 失去庇护 / 暴露身份
  - `exposureRisk` 暴露风险 · presets: 行动失败 / 信物流失 / 证词
  - `secrecyRule` 保密/互认规则 · presets: 成员互认全名单 / 只认领袖 / 只认直接联系人
  - `communicationRule` 沟通规则 · presets: 仅领袖串联 / 点对点 / 公开协调
  - `membershipVisibility` 归属可见性 · presets: PUBLIC / PRIVATE / PARTIAL
  - `decisiveChoice` 决定性选择 · presets: 公开站队 / 牺牲同伴 / 交出目标
  - `consequence` 剧情后果 · presets: 阵营公开 / 阵营分裂 / 目标易手
- **clues：**
  - `FACTION_FORESHADOW` (FACTION_FORESHADOW@LATENT) 阵营伏笔
  - `MEMBERSHIP_HINT` (MEMBERSHIP_HINT@CONTACT) 成员暗示
  - `SECRET_SIGNAL` (SECRET_SIGNAL@FORMATION) 秘密信号
  - `RECRUITMENT_EVIDENCE` (RECRUITMENT_EVIDENCE@RECRUITMENT) 招募证据
  - `LOYALTY_TEST` (LOYALTY_TEST@PRESSURE) 忠诚考验
  - `BETRAYAL_HINT` (BETRAYAL_HINT@BETRAYAL) 背叛暗示
  - `INTERNAL_CONFLICT` (INTERNAL_CONFLICT@SPLIT) 内部冲突
  - `HIDDEN_GOAL_HINT` (HIDDEN_GOAL_HINT@PRESSURE) 隐藏目标暗示
  - `MEMBERSHIP_CONFIRMATION` (MEMBERSHIP_CONFIRMATION@EXPOSURE) 归属确认
  - `FACTION_EXPOSURE` (FACTION_EXPOSURE@EXPOSURE) 阵营暴露

**你的标注：** Formation=`____` · Resolution=`____` · notes=`____________________`

---

### M08-2 · 固定隐藏阵营

- **purpose：** 归属固定但仅本人可见；必须存在可观察行动差异，而非只能猜身份。
- **stages：** LATENT → CONTACT → FORMATION → RECRUITMENT → SUSPICION → PRESSURE → SPLIT → BETRAYAL → EXPOSURE → CONFRONTATION → RESOLUTION → CONSEQUENCE
- **owners：** factionLead, defector
- **phases：** 0, 1, 2, 3
- **profile：** READY · commitments=FACTION_STRUCTURE · modes=CONCEAL,SUSPECT,NEGOTIATE · anchors=EARLY_AGENCY · pressure=FACTION_SETTLE
- **roles：**
  - `factionLead*` 阵营领袖 → faction_lead
  - `memberA*` 核心成员甲 → member
  - `memberB` 核心成员乙 → member
  - `hiddenMember` 潜伏成员 → hidden_member
  - `outsider` 局外观察者 → outsider
  - `rivalLead` 对立阵营领袖 → rival_lead
  - `defector` 叛离/摇摆者 → defector
  - `witness` 知情见证者 → witness
- **plotSlots：**
  - `factionIdentity` 阵营身份/名义 · presets: 公开同盟 / 隐秘结社 / 临时同盟
  - `factionGoal` 阵营真实目标 · presets: 夺取关键资源 / 保全共同秘密 / 推翻既有秩序
  - `publicGoal` 公开宣称目标 · presets: 维护秩序 / 追查真相 / 保全利益
  - `hiddenGoal` 隐藏目标 · presets: 公开目标 / 成员共享秘密目标 / 每人理解不同
  - `formationReason` 成形原因 · presets: 共同敌人 / 共同利益 / 血缘或组织归属
  - `recruitmentMethod` 招募方式 · presets: 私下邀请 / 任务考验 / 信物确认
  - `joiningCondition` 加入条件 · presets: 完成考验 / 交出信物 / 共享秘密
  - `leavingCondition` 退出条件 · presets: 支付代价 / 公开切割 / 被驱逐
  - `loyaltyConflict` 忠诚冲突 · presets: 个人目标冲突 / 道德底线 / 被牺牲风险
  - `betrayalTrigger` 背叛触发 · presets: 利益冲突 / 身份揭露 / 重要人物死亡
  - `betrayalCost` 背叛代价 · presets: 失去资源 / 失去庇护 / 暴露身份
  - `exposureRisk` 暴露风险 · presets: 行动失败 / 信物流失 / 证词
  - `secrecyRule` 保密/互认规则 · presets: 成员互认全名单 / 只认领袖 / 只认直接联系人
  - `communicationRule` 沟通规则 · presets: 仅领袖串联 / 点对点 / 公开协调
  - `membershipVisibility` 归属可见性 · presets: PUBLIC / PRIVATE / PARTIAL
  - `decisiveChoice` 决定性选择 · presets: 公开站队 / 牺牲同伴 / 交出目标
  - `consequence` 剧情后果 · presets: 阵营公开 / 阵营分裂 / 目标易手
- **clues：**
  - `FACTION_FORESHADOW` (FACTION_FORESHADOW@LATENT) 阵营伏笔
  - `MEMBERSHIP_HINT` (MEMBERSHIP_HINT@CONTACT) 成员暗示
  - `SECRET_SIGNAL` (SECRET_SIGNAL@FORMATION) 秘密信号
  - `RECRUITMENT_EVIDENCE` (RECRUITMENT_EVIDENCE@RECRUITMENT) 招募证据
  - `LOYALTY_TEST` (LOYALTY_TEST@PRESSURE) 忠诚考验
  - `BETRAYAL_HINT` (BETRAYAL_HINT@BETRAYAL) 背叛暗示
  - `INTERNAL_CONFLICT` (INTERNAL_CONFLICT@SPLIT) 内部冲突
  - `HIDDEN_GOAL_HINT` (HIDDEN_GOAL_HINT@PRESSURE) 隐藏目标暗示
  - `MEMBERSHIP_CONFIRMATION` (MEMBERSHIP_CONFIRMATION@EXPOSURE) 归属确认
  - `FACTION_EXPOSURE` (FACTION_EXPOSURE@EXPOSURE) 阵营暴露

**你的标注：** Formation=`____` · Resolution=`____` · notes=`____________________`

---

### M08-3 · 非对称阵营

- **purpose：** 各阵营不同操作接口、资源与成功条件；允许同时成功或同时失败。
- **stages：** LATENT → CONTACT → FORMATION → RECRUITMENT → SUSPICION → PRESSURE → SPLIT → BETRAYAL → EXPOSURE → CONFRONTATION → RESOLUTION → CONSEQUENCE
- **owners：** factionLead, defector
- **phases：** 0, 1, 2, 3
- **profile：** READY · commitments=FACTION_STRUCTURE · modes=CONCEAL,SUSPECT,NEGOTIATE · anchors=EARLY_AGENCY · pressure=FACTION_SETTLE
- **roles：**
  - `factionLead*` 阵营领袖 → faction_lead
  - `memberA*` 核心成员甲 → member
  - `memberB` 核心成员乙 → member
  - `rivalLead` 对立阵营领袖 → rival_lead
  - `outsider` 局外观察者 → outsider
  - `recruiter` 招募者 → recruiter
  - `mediator` 调停者 → mediator
  - `defector` 叛离/摇摆者 → defector
- **plotSlots：**
  - `factionIdentity` 阵营身份/名义 · presets: 公开同盟 / 隐秘结社 / 临时同盟
  - `factionGoal` 阵营真实目标 · presets: 夺取关键资源 / 保全共同秘密 / 推翻既有秩序
  - `publicGoal` 公开宣称目标 · presets: 维护秩序 / 追查真相 / 保全利益
  - `hiddenGoal` 隐藏目标 · presets: 公开目标 / 成员共享秘密目标 / 每人理解不同
  - `formationReason` 成形原因 · presets: 共同敌人 / 共同利益 / 血缘或组织归属
  - `recruitmentMethod` 招募方式 · presets: 私下邀请 / 任务考验 / 信物确认
  - `joiningCondition` 加入条件 · presets: 完成考验 / 交出信物 / 共享秘密
  - `leavingCondition` 退出条件 · presets: 支付代价 / 公开切割 / 被驱逐
  - `loyaltyConflict` 忠诚冲突 · presets: 个人目标冲突 / 道德底线 / 被牺牲风险
  - `betrayalTrigger` 背叛触发 · presets: 利益冲突 / 身份揭露 / 重要人物死亡
  - `betrayalCost` 背叛代价 · presets: 失去资源 / 失去庇护 / 暴露身份
  - `exposureRisk` 暴露风险 · presets: 行动失败 / 信物流失 / 证词
  - `secrecyRule` 保密/互认规则 · presets: 成员互认全名单 / 只认领袖 / 只认直接联系人
  - `communicationRule` 沟通规则 · presets: 仅领袖串联 / 点对点 / 公开协调
  - `membershipVisibility` 归属可见性 · presets: PUBLIC / PRIVATE / PARTIAL
  - `decisiveChoice` 决定性选择 · presets: 公开站队 / 牺牲同伴 / 交出目标
  - `consequence` 剧情后果 · presets: 阵营公开 / 阵营分裂 / 目标易手
  - `rivalGoal` 对立阵营目标 · presets: 夺取关键资源 / 公开真相 / 阻止保全
  - `asymmetricInterface` 非对称接口差异 · presets: 信息接口 / 行动接口 / 否决接口
- **clues：**
  - `FACTION_FORESHADOW` (FACTION_FORESHADOW@LATENT) 阵营伏笔
  - `MEMBERSHIP_HINT` (MEMBERSHIP_HINT@CONTACT) 成员暗示
  - `SECRET_SIGNAL` (SECRET_SIGNAL@FORMATION) 秘密信号
  - `RECRUITMENT_EVIDENCE` (RECRUITMENT_EVIDENCE@RECRUITMENT) 招募证据
  - `LOYALTY_TEST` (LOYALTY_TEST@PRESSURE) 忠诚考验
  - `BETRAYAL_HINT` (BETRAYAL_HINT@BETRAYAL) 背叛暗示
  - `INTERNAL_CONFLICT` (INTERNAL_CONFLICT@SPLIT) 内部冲突
  - `HIDDEN_GOAL_HINT` (HIDDEN_GOAL_HINT@PRESSURE) 隐藏目标暗示
  - `MEMBERSHIP_CONFIRMATION` (MEMBERSHIP_CONFIRMATION@EXPOSURE) 归属确认
  - `FACTION_EXPOSURE` (FACTION_EXPOSURE@EXPOSURE) 阵营暴露

**你的标注：** Formation=`____` · Resolution=`____` · notes=`____________________`

---

### M08-4 · 动态阵营

- **purpose：** 只在预设节点因选择、结算或身份恢复改变归属；保存历史归属，旧贡献按当时阵营解释。
- **stages：** LATENT → CONTACT → FORMATION → RECRUITMENT → SUSPICION → PRESSURE → SPLIT → BETRAYAL → EXPOSURE → CONFRONTATION → RESOLUTION → CONSEQUENCE
- **owners：** factionLead, defector
- **phases：** 0, 1, 2, 3
- **profile：** READY · commitments=FACTION_STRUCTURE · modes=CONCEAL,SUSPECT,NEGOTIATE · anchors=EARLY_AGENCY · pressure=FACTION_SETTLE
- **roles：**
  - `factionLead*` 阵营领袖 → faction_lead
  - `memberA*` 核心成员甲 → member
  - `memberB` 核心成员乙 → member
  - `rivalLead` 对立阵营领袖 → rival_lead
  - `defector` 叛离/摇摆者 → defector
  - `outsider` 局外观察者 → outsider
- **plotSlots：**
  - `factionIdentity` 阵营身份/名义 · presets: 公开同盟 / 隐秘结社 / 临时同盟
  - `factionGoal` 阵营真实目标 · presets: 夺取关键资源 / 保全共同秘密 / 推翻既有秩序
  - `publicGoal` 公开宣称目标 · presets: 维护秩序 / 追查真相 / 保全利益
  - `hiddenGoal` 隐藏目标 · presets: 公开目标 / 成员共享秘密目标 / 每人理解不同
  - `formationReason` 成形原因 · presets: 共同敌人 / 共同利益 / 血缘或组织归属
  - `recruitmentMethod` 招募方式 · presets: 私下邀请 / 任务考验 / 信物确认
  - `joiningCondition` 加入条件 · presets: 完成考验 / 交出信物 / 共享秘密
  - `leavingCondition` 退出条件 · presets: 支付代价 / 公开切割 / 被驱逐
  - `loyaltyConflict` 忠诚冲突 · presets: 个人目标冲突 / 道德底线 / 被牺牲风险
  - `betrayalTrigger` 背叛触发 · presets: 利益冲突 / 身份揭露 / 重要人物死亡
  - `betrayalCost` 背叛代价 · presets: 失去资源 / 失去庇护 / 暴露身份
  - `exposureRisk` 暴露风险 · presets: 行动失败 / 信物流失 / 证词
  - `secrecyRule` 保密/互认规则 · presets: 成员互认全名单 / 只认领袖 / 只认直接联系人
  - `communicationRule` 沟通规则 · presets: 仅领袖串联 / 点对点 / 公开协调
  - `membershipVisibility` 归属可见性 · presets: PUBLIC / PRIVATE / PARTIAL
  - `decisiveChoice` 决定性选择 · presets: 公开站队 / 牺牲同伴 / 交出目标
  - `consequence` 剧情后果 · presets: 阵营公开 / 阵营分裂 / 目标易手
  - `changeNode` 预设改变节点 · presets: 中期选择 / 结算后 / 身份揭示后
  - `historyRule` 历史归属规则 · presets: 保存双轨 / 旧贡献冻结 / 知情分层
- **clues：**
  - `FACTION_FORESHADOW` (FACTION_FORESHADOW@LATENT) 阵营伏笔
  - `MEMBERSHIP_HINT` (MEMBERSHIP_HINT@CONTACT) 成员暗示
  - `SECRET_SIGNAL` (SECRET_SIGNAL@FORMATION) 秘密信号
  - `RECRUITMENT_EVIDENCE` (RECRUITMENT_EVIDENCE@RECRUITMENT) 招募证据
  - `LOYALTY_TEST` (LOYALTY_TEST@PRESSURE) 忠诚考验
  - `BETRAYAL_HINT` (BETRAYAL_HINT@BETRAYAL) 背叛暗示
  - `INTERNAL_CONFLICT` (INTERNAL_CONFLICT@SPLIT) 内部冲突
  - `HIDDEN_GOAL_HINT` (HIDDEN_GOAL_HINT@PRESSURE) 隐藏目标暗示
  - `MEMBERSHIP_CONFIRMATION` (MEMBERSHIP_CONFIRMATION@EXPOSURE) 归属确认
  - `FACTION_EXPOSURE` (FACTION_EXPOSURE@EXPOSURE) 阵营暴露

**你的标注：** Formation=`____` · Resolution=`____` · notes=`____________________`

---

### M08-5 · 个人目标叠加阵营目标

- **purpose：** 阵营与个人分别结算，可同时成败；个人目标不要求全部背叛阵营。
- **stages：** LATENT → CONTACT → FORMATION → RECRUITMENT → SUSPICION → PRESSURE → SPLIT → BETRAYAL → EXPOSURE → CONFRONTATION → RESOLUTION → CONSEQUENCE
- **owners：** factionLead, defector
- **phases：** 0, 1, 2, 3
- **profile：** READY · commitments=FACTION_STRUCTURE · modes=CONCEAL,SUSPECT,NEGOTIATE · anchors=EARLY_AGENCY · pressure=FACTION_SETTLE
- **roles：**
  - `factionLead*` 阵营领袖 → faction_lead
  - `memberA*` 核心成员甲 → member
  - `memberB` 核心成员乙 → member
  - `defector` 叛离/摇摆者 → defector
  - `outsider` 局外观察者 → outsider
- **plotSlots：**
  - `factionIdentity` 阵营身份/名义 · presets: 公开同盟 / 隐秘结社 / 临时同盟
  - `factionGoal` 阵营真实目标 · presets: 夺取关键资源 / 保全共同秘密 / 推翻既有秩序
  - `publicGoal` 公开宣称目标 · presets: 维护秩序 / 追查真相 / 保全利益
  - `hiddenGoal` 隐藏目标 · presets: 公开目标 / 成员共享秘密目标 / 每人理解不同
  - `formationReason` 成形原因 · presets: 共同敌人 / 共同利益 / 血缘或组织归属
  - `recruitmentMethod` 招募方式 · presets: 私下邀请 / 任务考验 / 信物确认
  - `joiningCondition` 加入条件 · presets: 完成考验 / 交出信物 / 共享秘密
  - `leavingCondition` 退出条件 · presets: 支付代价 / 公开切割 / 被驱逐
  - `loyaltyConflict` 忠诚冲突 · presets: 个人目标冲突 / 道德底线 / 被牺牲风险
  - `betrayalTrigger` 背叛触发 · presets: 利益冲突 / 身份揭露 / 重要人物死亡
  - `betrayalCost` 背叛代价 · presets: 失去资源 / 失去庇护 / 暴露身份
  - `exposureRisk` 暴露风险 · presets: 行动失败 / 信物流失 / 证词
  - `secrecyRule` 保密/互认规则 · presets: 成员互认全名单 / 只认领袖 / 只认直接联系人
  - `communicationRule` 沟通规则 · presets: 仅领袖串联 / 点对点 / 公开协调
  - `membershipVisibility` 归属可见性 · presets: PUBLIC / PRIVATE / PARTIAL
  - `decisiveChoice` 决定性选择 · presets: 公开站队 / 牺牲同伴 / 交出目标
  - `consequence` 剧情后果 · presets: 阵营公开 / 阵营分裂 / 目标易手
  - `personalGoal` 个人叠加目标 · presets: 保全某人 / 取得信物 / 隐藏罪责
  - `personalSettleRule` 个人结算规则 · presets: 只读正式状态 / 可与阵营同成同败 / 不强制背叛
- **clues：**
  - `FACTION_FORESHADOW` (FACTION_FORESHADOW@LATENT) 阵营伏笔
  - `MEMBERSHIP_HINT` (MEMBERSHIP_HINT@CONTACT) 成员暗示
  - `SECRET_SIGNAL` (SECRET_SIGNAL@FORMATION) 秘密信号
  - `RECRUITMENT_EVIDENCE` (RECRUITMENT_EVIDENCE@RECRUITMENT) 招募证据
  - `LOYALTY_TEST` (LOYALTY_TEST@PRESSURE) 忠诚考验
  - `BETRAYAL_HINT` (BETRAYAL_HINT@BETRAYAL) 背叛暗示
  - `INTERNAL_CONFLICT` (INTERNAL_CONFLICT@SPLIT) 内部冲突
  - `HIDDEN_GOAL_HINT` (HIDDEN_GOAL_HINT@PRESSURE) 隐藏目标暗示
  - `MEMBERSHIP_CONFIRMATION` (MEMBERSHIP_CONFIRMATION@EXPOSURE) 归属确认
  - `FACTION_EXPOSURE` (FACTION_EXPOSURE@EXPOSURE) 阵营暴露

**你的标注：** Formation=`____` · Resolution=`____` · notes=`____________________`

---

### M08-6 · 临时联盟

- **purpose：** 规定节点双确认建立联盟；设持续时间、共享范围与退出成本；不自动共享私人内容。
- **stages：** LATENT → CONTACT → FORMATION → RECRUITMENT → SUSPICION → PRESSURE → SPLIT → BETRAYAL → EXPOSURE → CONFRONTATION → RESOLUTION → CONSEQUENCE
- **owners：** factionLead, mediator, defector
- **phases：** 0, 1, 2, 3
- **profile：** READY · commitments=FACTION_STRUCTURE,RESOURCE_CONTEST · modes=NEGOTIATE,CONCEAL,SUSPECT,PUBLIC_CHOICE · anchors=EARLY_AGENCY,OWNERSHIP_SHIFT · pressure=FACTION_SETTLE
- **roles：**
  - `factionLead*` 阵营领袖 → faction_lead
  - `memberA*` 核心成员甲 → member
  - `memberB` 核心成员乙 → member
  - `rivalLead` 对立阵营领袖 → rival_lead
  - `mediator` 调停者 → mediator
  - `outsider` 局外观察者 → outsider
  - `defector` 叛离/摇摆者 → defector
- **plotSlots：**
  - `factionIdentity` 阵营身份/名义 · presets: 公开同盟 / 隐秘结社 / 临时同盟
  - `factionGoal` 阵营真实目标 · presets: 夺取关键资源 / 保全共同秘密 / 推翻既有秩序
  - `publicGoal` 公开宣称目标 · presets: 维护秩序 / 追查真相 / 保全利益
  - `hiddenGoal` 隐藏目标 · presets: 公开目标 / 成员共享秘密目标 / 每人理解不同
  - `formationReason` 成形原因 · presets: 共同敌人 / 共同利益 / 血缘或组织归属
  - `recruitmentMethod` 招募方式 · presets: 私下邀请 / 任务考验 / 信物确认
  - `joiningCondition` 加入条件 · presets: 完成考验 / 交出信物 / 共享秘密
  - `leavingCondition` 退出条件 · presets: 支付代价 / 公开切割 / 被驱逐
  - `loyaltyConflict` 忠诚冲突 · presets: 个人目标冲突 / 道德底线 / 被牺牲风险
  - `betrayalTrigger` 背叛触发 · presets: 利益冲突 / 身份揭露 / 重要人物死亡
  - `betrayalCost` 背叛代价 · presets: 失去资源 / 失去庇护 / 暴露身份
  - `exposureRisk` 暴露风险 · presets: 行动失败 / 信物流失 / 证词
  - `secrecyRule` 保密/互认规则 · presets: 成员互认全名单 / 只认领袖 / 只认直接联系人
  - `communicationRule` 沟通规则 · presets: 仅领袖串联 / 点对点 / 公开协调
  - `membershipVisibility` 归属可见性 · presets: PUBLIC / PRIVATE / PARTIAL
  - `decisiveChoice` 决定性选择 · presets: 公开站队 / 牺牲同伴 / 交出目标
  - `consequence` 剧情后果 · presets: 阵营公开 / 阵营分裂 / 目标易手
  - `allianceDuration` 联盟持续时间 · presets: 一阶段 / 至危机解除 / 至任务完成
  - `shareScope` 共享范围 · presets: 仅资源 / 仅行动结果 / 有限情报
  - `exitCost` 退出成本 · presets: 失去资源 / 暴露部分归属 / 关系惩罚
- **clues：**
  - `FACTION_FORESHADOW` (FACTION_FORESHADOW@LATENT) 阵营伏笔
  - `MEMBERSHIP_HINT` (MEMBERSHIP_HINT@CONTACT) 成员暗示
  - `SECRET_SIGNAL` (SECRET_SIGNAL@FORMATION) 秘密信号
  - `RECRUITMENT_EVIDENCE` (RECRUITMENT_EVIDENCE@RECRUITMENT) 招募证据
  - `LOYALTY_TEST` (LOYALTY_TEST@PRESSURE) 忠诚考验
  - `BETRAYAL_HINT` (BETRAYAL_HINT@BETRAYAL) 背叛暗示
  - `INTERNAL_CONFLICT` (INTERNAL_CONFLICT@SPLIT) 内部冲突
  - `HIDDEN_GOAL_HINT` (HIDDEN_GOAL_HINT@PRESSURE) 隐藏目标暗示
  - `MEMBERSHIP_CONFIRMATION` (MEMBERSHIP_CONFIRMATION@EXPOSURE) 归属确认
  - `FACTION_EXPOSURE` (FACTION_EXPOSURE@EXPOSURE) 阵营暴露

**你的标注：** Formation=`____` · Resolution=`____` · notes=`____________________`

---

### M08-7 · 阵营影响公共任务

- **purpose：** 先定义独立可运行的公共任务，再定义各阵营希望其成功、失败、延迟或换方案；破坏须有次数与成本。
- **stages：** LATENT → CONTACT → FORMATION → RECRUITMENT → SUSPICION → PRESSURE → SPLIT → BETRAYAL → EXPOSURE → CONFRONTATION → RESOLUTION → CONSEQUENCE
- **owners：** factionLead, defector
- **phases：** 0, 1, 2, 3
- **profile：** READY · commitments=FACTION_STRUCTURE · modes=PROBE,CONCEAL,SUSPECT · anchors=EARLY_AGENCY · pressure=FACTION_SETTLE
- **roles：**
  - `factionLead*` 阵营领袖 → faction_lead
  - `memberA*` 核心成员甲 → member
  - `memberB` 核心成员乙 → member
  - `rivalLead` 对立阵营领袖 → rival_lead
  - `defector` 叛离/摇摆者 → defector
  - `outsider` 局外观察者 → outsider
- **plotSlots：**
  - `factionIdentity` 阵营身份/名义 · presets: 公开同盟 / 隐秘结社 / 临时同盟
  - `factionGoal` 阵营真实目标 · presets: 夺取关键资源 / 保全共同秘密 / 推翻既有秩序
  - `publicGoal` 公开宣称目标 · presets: 维护秩序 / 追查真相 / 保全利益
  - `hiddenGoal` 隐藏目标 · presets: 公开目标 / 成员共享秘密目标 / 每人理解不同
  - `formationReason` 成形原因 · presets: 共同敌人 / 共同利益 / 血缘或组织归属
  - `recruitmentMethod` 招募方式 · presets: 私下邀请 / 任务考验 / 信物确认
  - `joiningCondition` 加入条件 · presets: 完成考验 / 交出信物 / 共享秘密
  - `leavingCondition` 退出条件 · presets: 支付代价 / 公开切割 / 被驱逐
  - `loyaltyConflict` 忠诚冲突 · presets: 个人目标冲突 / 道德底线 / 被牺牲风险
  - `betrayalTrigger` 背叛触发 · presets: 利益冲突 / 身份揭露 / 重要人物死亡
  - `betrayalCost` 背叛代价 · presets: 失去资源 / 失去庇护 / 暴露身份
  - `exposureRisk` 暴露风险 · presets: 行动失败 / 信物流失 / 证词
  - `secrecyRule` 保密/互认规则 · presets: 成员互认全名单 / 只认领袖 / 只认直接联系人
  - `communicationRule` 沟通规则 · presets: 仅领袖串联 / 点对点 / 公开协调
  - `membershipVisibility` 归属可见性 · presets: PUBLIC / PRIVATE / PARTIAL
  - `decisiveChoice` 决定性选择 · presets: 公开站队 / 牺牲同伴 / 交出目标
  - `consequence` 剧情后果 · presets: 阵营公开 / 阵营分裂 / 目标易手
  - `publicTask` 公共任务 · presets: 护送 / 搜证 / 封印
  - `stancePreference` 阵营立场偏好 · presets: 希望成功 / 希望失败 / 希望延迟
  - `sabotageRule` 正式破坏规则 · presets: 有次数 / 有成本 / 可观察后果
- **clues：**
  - `FACTION_FORESHADOW` (FACTION_FORESHADOW@LATENT) 阵营伏笔
  - `MEMBERSHIP_HINT` (MEMBERSHIP_HINT@CONTACT) 成员暗示
  - `SECRET_SIGNAL` (SECRET_SIGNAL@FORMATION) 秘密信号
  - `RECRUITMENT_EVIDENCE` (RECRUITMENT_EVIDENCE@RECRUITMENT) 招募证据
  - `LOYALTY_TEST` (LOYALTY_TEST@PRESSURE) 忠诚考验
  - `BETRAYAL_HINT` (BETRAYAL_HINT@BETRAYAL) 背叛暗示
  - `INTERNAL_CONFLICT` (INTERNAL_CONFLICT@SPLIT) 内部冲突
  - `HIDDEN_GOAL_HINT` (HIDDEN_GOAL_HINT@PRESSURE) 隐藏目标暗示
  - `MEMBERSHIP_CONFIRMATION` (MEMBERSHIP_CONFIRMATION@EXPOSURE) 归属确认
  - `FACTION_EXPOSURE` (FACTION_EXPOSURE@EXPOSURE) 阵营暴露

**你的标注：** Formation=`____` · Resolution=`____` · notes=`____________________`

---

### M08-8 · 多阵营并存

- **purpose：** 推荐三阵营非对称；条件表结算，不强制单一冠军；须防两盟永久无成本压制第三方。
- **stages：** LATENT → CONTACT → FORMATION → RECRUITMENT → SUSPICION → PRESSURE → SPLIT → BETRAYAL → EXPOSURE → CONFRONTATION → RESOLUTION → CONSEQUENCE
- **owners：** factionLead, thirdLead, defector
- **phases：** 0, 1, 2, 3
- **profile：** READY · commitments=FACTION_STRUCTURE · modes=CONCEAL,SUSPECT,NEGOTIATE · anchors=EARLY_AGENCY · pressure=FACTION_SETTLE
- **roles：**
  - `factionLead*` 阵营领袖 → faction_lead
  - `memberA*` 核心成员甲 → member
  - `memberB` 核心成员乙 → member
  - `rivalLead` 对立阵营领袖 → rival_lead
  - `thirdLead` 第三方阵营领袖 → faction_lead
  - `outsider` 局外观察者 → outsider
  - `hiddenMember` 潜伏成员 → hidden_member
  - `mediator` 调停者 → mediator
  - `defector` 叛离/摇摆者 → defector
- **plotSlots：**
  - `factionIdentity` 阵营身份/名义 · presets: 公开同盟 / 隐秘结社 / 临时同盟
  - `factionGoal` 阵营真实目标 · presets: 夺取关键资源 / 保全共同秘密 / 推翻既有秩序
  - `publicGoal` 公开宣称目标 · presets: 维护秩序 / 追查真相 / 保全利益
  - `hiddenGoal` 隐藏目标 · presets: 公开目标 / 成员共享秘密目标 / 每人理解不同
  - `formationReason` 成形原因 · presets: 共同敌人 / 共同利益 / 血缘或组织归属
  - `recruitmentMethod` 招募方式 · presets: 私下邀请 / 任务考验 / 信物确认
  - `joiningCondition` 加入条件 · presets: 完成考验 / 交出信物 / 共享秘密
  - `leavingCondition` 退出条件 · presets: 支付代价 / 公开切割 / 被驱逐
  - `loyaltyConflict` 忠诚冲突 · presets: 个人目标冲突 / 道德底线 / 被牺牲风险
  - `betrayalTrigger` 背叛触发 · presets: 利益冲突 / 身份揭露 / 重要人物死亡
  - `betrayalCost` 背叛代价 · presets: 失去资源 / 失去庇护 / 暴露身份
  - `exposureRisk` 暴露风险 · presets: 行动失败 / 信物流失 / 证词
  - `secrecyRule` 保密/互认规则 · presets: 成员互认全名单 / 只认领袖 / 只认直接联系人
  - `communicationRule` 沟通规则 · presets: 仅领袖串联 / 点对点 / 公开协调
  - `membershipVisibility` 归属可见性 · presets: PUBLIC / PRIVATE / PARTIAL
  - `decisiveChoice` 决定性选择 · presets: 公开站队 / 牺牲同伴 / 交出目标
  - `consequence` 剧情后果 · presets: 阵营公开 / 阵营分裂 / 目标易手
  - `conditionTable` 多营条件表摘要 · presets: 三档并存 / 两成一败 / 部分成功渔利
  - `campCountRule` 阵营数约束 · presets: 远小于玩家数 / 推荐三营 / 禁止接近人数
- **clues：**
  - `FACTION_FORESHADOW` (FACTION_FORESHADOW@LATENT) 阵营伏笔
  - `MEMBERSHIP_HINT` (MEMBERSHIP_HINT@CONTACT) 成员暗示
  - `SECRET_SIGNAL` (SECRET_SIGNAL@FORMATION) 秘密信号
  - `RECRUITMENT_EVIDENCE` (RECRUITMENT_EVIDENCE@RECRUITMENT) 招募证据
  - `LOYALTY_TEST` (LOYALTY_TEST@PRESSURE) 忠诚考验
  - `BETRAYAL_HINT` (BETRAYAL_HINT@BETRAYAL) 背叛暗示
  - `INTERNAL_CONFLICT` (INTERNAL_CONFLICT@SPLIT) 内部冲突
  - `HIDDEN_GOAL_HINT` (HIDDEN_GOAL_HINT@PRESSURE) 隐藏目标暗示
  - `MEMBERSHIP_CONFIRMATION` (MEMBERSHIP_CONFIRMATION@EXPOSURE) 归属确认
  - `FACTION_EXPOSURE` (FACTION_EXPOSURE@EXPOSURE) 阵营暴露

**你的标注：** Formation=`____` · Resolution=`____` · notes=`____________________`

---

### M12-1 · 双边关系议价

- **purpose：** 让两名（或多名）玩家围绕具体标的进行试探、隐瞒、谈判与交换；玩家行为造成 owner/access/knowledge 真实换手，并改变后续选择。
- **stages：** PROBE → NEGOTIATE → EXCHANGE → AFTERMATH
- **owners：** bargainA, bargainB
- **phases：** 0, 1, 2, 3
- **profile：** READY · commitments=RELATIONSHIP_BARGAIN · modes=NEGOTIATE,EXCHANGE,PROBE,CONCEAL,PUBLIC_CHOICE · anchors=EARLY_AGENCY,OWNERSHIP_SHIFT,FLEXIBLE_RESOLUTION · pressure=OPEN
- **roles：**
  - `bargainA*` 需求方 → seeker
  - `bargainB*` 掌握方 → holder
  - `stakeholder` 利害相关者 → stakeholder
  - `witness` 见证者 → witness
- **plotSlots：**
  - `contestedStake` 争夺标的（资源/信息/权利） · presets: 一份未公开的名录或通行权限 / 可改变他人处境的关键物件 / 一段只有掌握方能证实的信息
  - `initialOwner` 开场掌握方 · presets: bargainB 独占 / bargainB 与第三方共管，实际控制在 bargainB
  - `seekerNeed` 需求方要它的理由 · presets: 保护自己或盟友 / 换取另一项关键承诺 / 阻止对方滥用
  - `holderPrice` 掌握方开出的代价 · presets: 公开一个秘密 / 转让另一项小权限 / 站队或背书
  - `exchangeTerms` 可成交的交换条件 · presets: 信息换物件 / 承诺换权限 / 作证换免责
  - `afterOwner` 换手后的新掌握方 · presets: bargainA 独占 / 双方共持但权限翻转 / stakeholder 临时代管
  - `aftermathChoice` 换手后被迫重谈的关系选择 · presets: 是否公开交换事实 / 是否继续合作 / 是否撕毁原承诺
- **clues：**
  - `STAKE_HINT` (FORESHADOW@PROBE) 标的存在暗示
  - `TERM_LEAK` (IDENTITY_HINT@NEGOTIATE) 对方底线/条件外泄
  - `TRANSFER_PROOF` (CONFIRMATION@EXCHANGE) 换手完成凭证

**你的标注：** Formation=`____` · Resolution=`____` · notes=`____________________`

---

## 3. FOUNDATION 总表（种子壳 · 可粗标）

| ID | 名称 | purpose（截断） | Formation | Resolution | notes |
|---|---|---|---|---|---|
| M01-1 | 行为人判断 | 对谁实施了决定性行为作出可验证判断 |  |  |  |
| M01-10 | 动态现场调查 | 读取可变现场后的调查判断 |  |  |  |
| M01-2 | 真实原因判断 | 对表面结果的真实原因作判断 |  |  |  |
| M01-3 | 决定性行为判断 | 判断哪一行为是决定性的 |  |  |  |
| M01-4 | 行动顺序判断 | 重建关键行动顺序 |  |  |  |
| M01-5 | 意图判断 | 在证据允许范围内判断意图类别 |  |  |  |
| M01-6 | 责任划分 | 划分可验证的责任归属 |  |  |  |
| M01-7 | 公开说法核验 | 核验公开说法与既有事实是否一致 |  |  |  |
| M01-8 | 单幕追凶 | 单幕内完成一次可结算的追凶判断 |  |  |  |
| M01-9 | 贯穿式追凶 | 多幕贯穿的追凶结构 |  |  |  |
| M10-1 | 单项正式选择 | 单项正式选择映射结局 |  |  |  |
| M10-2 | 多项优先级选择 | 多项按优先级映射 |  |  |  |
| M10-3 | 成对或分组问答 | 成对/分组问答映射 |  |  |  |
| M10-4 | 条件式结局矩阵 | 条件矩阵决定结局 |  |  |  |
| M10-5 | 个人与公共结果并行 | 个人结果与公共结果并行 |  |  |  |
| M10-6 | 延迟结算 | 选择与结算分离 |  |  |  |
| M11-1 | 可变现场 | 现场可被改写但不改客观历史 |  |  |  |
| M11-2 | 有源伪造 | 新增与篡改对象须有来源 |  |  |  |
| M11-3 | 剧情状态传播 | 正式状态改变后续可行动作 |  |  |  |
| M11-4 | 现场快照与版本读取 | 时点见证与版本读取 |  |  |  |
| M11-5 | 世界状态恢复 | 合法复原可变状态 |  |  |  |

---

## 4. 你填完后回传约定

直接改本文件空格即可；或另存 `docs/STORY_MECHANISM_FORMATIONATION_GRADES_ZH.md`。
标注完成前：**不改 pack / semantics / Writer。**

