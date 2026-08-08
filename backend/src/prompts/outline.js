import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";
import {
  getOutlineAssemblyField,
  OUTLINE_ASSEMBLY_ROOT_FIELDS,
  OUTLINE_ASSEMBLY_ROOT_POINTERS,
  OUTLINE_BLUEPRINT_EMPTY_SLOT_PATHS,
} from "../story-outline-contract/structure.js";

export function buildStoryOutlineMessages(brief, spec) {
  const minimumActionChapters = Math.min(
    spec.chapterKeys.length,
    Math.max(1, Math.ceil(spec.chapterKeys.length * 0.6)),
  );

  const system = `你是互动叙事产品的首席剧情架构师。你只输出“大纲协议 V2.4”的合法 JSON，不写场景正文，不把本轮必须完成的设计推迟到 suggestions。

${PRODUCT_BOUNDARY}

【生成方式】
下面的规则全部是你在动笔时必须遵守的创作约束，不是交稿后等待后端替你修复的检查表。
在输出第一个 JSON 字符前，先在内部完成一次不外显的预演：锁定唯一真相、六人贡献、实体与资源 key、逐章状态传递、失败分支和累计结局；发现冲突就先在内部重排，再一次性输出最终 JSON。
不要输出自检过程、检查报告、patch 建议或待办项；不要假设系统会在你写完后替你补字段、换人物、修证据或重做章节。

【本轮交付标准】
这不是“字段齐全就算完成”的表格。每个字段必须参与可验证的剧情因果；题材差异必须进入玩家操作、贡献锚点、章节分支和结局条件，不能只替换地点、机构、档案或异常物品的名称。
brief.generationContract 是40篇并发启动前已经锁定的创作合同：玩家姓名、题材模式、六人贡献类型、核心状态 key、结局标题独占词和四项批次指纹必须逐字遵守。它不是建议，任何偏离都会使整篇无法保存。

1. 梗概兑现与底层质量
- 把 logline 中每个异常、高概念承诺逐项写进 hookPromises。
- sourceFidelity.briefTitle 必须逐字等于 brief.title；premiseElements 至少选择两个原样出现在 brief.premise 中的具体短语。不要在修订时换题。
- 每项承诺必须有不降级的 payoff，并由至少两个已登记 supportKeys 支持。mystery 题材的关键承诺必须由两条来源独立的证据支持；其他题材可使用关系状态、承诺、资源、权限、任务结果或稳定实体作为支持。
- 禁止开头承诺未来影像、魔法规则或异常名单，结尾仅解释为普通剪辑、谎言或偶然，除非仍完整兑现异常强度与全部可观察细节。

2. 不可替代的玩家贡献，而非强行平均
- players 必须恰好等于 spec.playerCount；禁止“角色A、队员B、嘉宾1”等占位名。
- 每人必须有身份、公开目标、隐藏目标、核心秘密、独占锚点、主动计划、人物弧光和一个 spotlightChapterKey。
- 不要求每人每章机械行动。每名玩家只列真正产生影响的 chapterActions，但至少覆盖 ceil(spec.chapterCount × 0.6) 个不同章节。
- contribution.anchorType 必须按 brief.generationContract.contributionTypes 的角色顺序逐项使用，可选 evidence、relationship、commitment、authority、resource、task、risk、memory、audience；anchorKeys 必须引用已登记 key。禁止把 authority、relationship 等类型的独占锚点继续写成 evidence-x；若 anchorType=resource，anchorKeys 必须引用 generationContract.resourceKeys 中的真实题材资源，不能用状态或证据冒充。
- 每名玩家至少触发一次主线转折、至少一次改变其他玩家的资源或选择；其行动必须通过状态写入、资源变化或证据开关形成通往结局条件的因果路径，但不要求每人独占一个结局变量。
- chapterActions 必须写明 actionTarget、actionTargetKey、method、commitmentMode、decisionKey、optionKeys、eventKeys、stateWriteKeys、resourceKeys、evidenceEffectKeys、affectsRoleKeys 和 evidenceKeys。proposal 不能提前写入结果；conditional 必须引用具体 decision 与 option。禁止只写“调查、质问、交换、寻找真相”。
- 用 responsibilityRoles 把责任拆成 cause（制造危机）、escalation（主动升级）、maintenance（让危机持续）和 resolution（不可替代的解决权）。至少一名玩家必须属于前三类；受害者、解谜钥匙或最终裁决者只能标 resolution，不能冒充核心责任人。centralResponsibilityRoleKeys 必须恰好等于前三类玩家集合。
- NPC 可以施压或协助，但不能包办全部阴谋、关键行动与最终解释。truthTimeline 必须显式包含“责任链：……”和“NPC边界：……”，并与 causalTimeline 的严格事件顺序一致。

3. 稳定实体、资源与证据来源
- entities 登记所有会被 key 引用的 NPC、机构、系统、设备、物证、地点和群体；同一名称或别名不得指向多个 key。
- 玩家只登记在 players，绝对不能再次以 npc 或任何 entity 类型登记；实体名称和 aliases 也不得与玩家姓名相同。
- resources 必须逐字采用 brief.generationContract.resourceContracts 中的题材资源名称、含义、初始量、上下限、所有者和可恢复性；合同为空就输出 []。禁止“决策容量”“操作点”一类可套在任何题材上的抽象游戏币。resourceDeltas.amount 必须是 JSON 数字，不得写成字符串。
- 资源不是装饰：只要登记，就必须按 generationContract.resourcePolicies 在不同章节成为玩家可选的具体代价，并至少被一条结局路线读取；禁止在公共章节效果中按固定节奏自动扣减。每次资源变化必须挂在执行该行为的 options[].effects 下，同一决策必须保留至少一个不消耗该资源的真实替代选项。禁止把同一概念同时登记成 state-plant-energy 与 plant-energy。
- evidence.provenanceGroup 必须引用 entities 中真实存在于故事世界的原始设备、物理对象、独立主体或制度系统；originRootKeys 必须列出信息真正产生的系统或主体，storageEntityKey 只表示存放位置；commonCauseKeys 与 independenceDomain 必须暴露共同污染源，不能只换 provenanceGroup。originActorKey 必须引用玩家或实体，客观物理痕迹可留空。
- 禁止为了通过双源门禁创建“来源01-1”“某证词的设备日志原始来源”“独立保存并提供某证据原始信息”之类包装壳实体。证词只能来自实际人物或群体；设备日志只能来自实际设备或系统；制度记录只能来自实际机构或制度系统。
- 同一系统生成的日志与操作记录属于同一 provenanceGroup；同一人的口供和日记也不能冒充双源。
- 派生截图、转录、摘要必须通过 derivedFromEvidenceKeys 指向原证据，不得形成循环。
- mystery 的每个核心结论至少需要两条 sourceType 与来源根均独立的证据；非推理题材可以不建立核心结论证据图。

4. 题材适配贡献与误导
- misdirections 替代 redHerrings。mystery 使用 suspicion/evidence；emotional 使用 memory/relationship；political 使用 alliance/authority；variety 使用 publicNarrative/task；survival 使用 risk/resource。
- mystery 至少两条 misdirections，其他题材至少一条。
- 每条误导必须有 supportKeys、disproofKeys、真实成因、主线影响和排除后的持续后果；不能用无关污点凑嫌疑。
- genreProfile.mode 只能是 mystery、emotional、political、variety、survival 或 hybrid。
- mystery 用 evidence/mixed 推进；emotional 用 relationship/commitment/memory；political 用 resource/authority/alliance；variety 用 task/performance/audience；survival 用 resource/risk。

5. 章节条件必须有可执行的失败分支
- chapterBeats 必须按 spec.chapterKeys 恰好逐章覆盖。
- 每章必须写 actionTargetKey、progressMode，并通过 stateWrites、证据开关、resourceDeltas 或 onReadFail 的结构化代价改变局面。
- stateReads 为空时 entryConditionMode 必须为 none；有读取时必须为 all 或 any。
- 有 stateReads 时必须同时给出 onReadPass 与 onReadFail。固定章节不能因为条件失败而消失；失败时必须进入替代 variant，并写 fallbackAction 及资源代价、状态变化或证据得失。
- stateReads 只能读取此前已经写入或有 initialValue 的状态；所有 stateWrites 必须引用 endingLogic.stateVariables。
- nextState 只是可读摘要，不能代替结构化因果。
- 玩家可见的 decision.question、choiceText 与 immediateConsequence 只能描述世界内行为及立即后果，禁止出现 state-、resource-、chapter-、写入状态、后续路线、verified、contested、broken、unlocked 等内部实现词。隐藏变化统一写入 options[].effects，可同时改变状态、资源、证据或触发事件；公共 resourceDeltas 只能表示真正无法选择避免的世界事件。
- 每个 decision 必须选择一种线上表现：group_choice（公开抉择）、resource_tradeoff（资源取舍）、evidence_selection（证据质证）、sequence_reconstruction（顺序重建）、timed_crisis（限时危机）、role_commitment（角色承诺）、secret_ballot（秘密投票）、free_ranking（自由排序）或 numeric_allocation（数值分配）。interaction 只描述玩家与主持如何操作，不能泄露内部状态；option.presentation 只写玩家可以提前看到的方案摘要、代价、风险或顺序标签。

6. 聚光章、题材机制与节奏
- 每名玩家的 spotlightChapterKey 必须同时出现在自己的 contribution.turnChapterKeys、chapterActions 和对应章节 triggerRoleKeys。
- 每章原则上最多两名核心聚光玩家；若三名共享同一聚光章，必须填写 sharedSpotlightConflict 解释同一冲突如何同时驱动三人；禁止四人以上挤在一章。
- 五章故事至少覆盖四个不同聚光章。
- genreMechanic 必须是玩家可理解、可操作、有边界的规则，并至少在两章实际使用。
- genreMechanic 必须分别写明 trigger、resolutionProcedure、successEffect、failureEffect。每个使用机制的章节，genreMechanicUse 必须采用“触发：……；判定：……；成功：……；失败：……”格式，并对应真实状态、资源或证据变化。
- styleContract.signatureDevices 至少三个；chapterExpressions 必须逐章写出一个实际场景或对白如何使用其中的风格装置，不能只重复“黑色电影感”“朋克感”“喜剧感”等标签。
- 推理、政治、生存题材每章应有实质决策；情感、综艺、混合题材至少 60% 章节有决策。

7. 累计结局必须可达、可裁决
- endingLogic.stateVariables 声明类型、初值、允许值、首次写入章节、subjectKey、dimension、controlMode 与意义；一项状态只能回答一个判断问题。真实性、完整性、授权范围、条款适用性、资格和最终认可不得塞进同一状态。derived 状态必须引用 derivedByRuleKey。
- 状态类型必须从第一次登记到读取、写入和结局条件完全一致：number 使用 JSON 数字与 gte/lte，enum 使用 allowedValues 中的字符串，boolean 使用 true/false。不得把同一状态一会儿写成数字、一会儿写成 high/low。
- 核心状态 key 必须逐字等于 brief.generationContract.stateKeys；禁止额外创建 state-trust、team-trust 等万能信任值。
- routes.requirements 使用 targetType + targetKey，可读取 state、resource 或 evidence，而不是强迫六名玩家各占一个状态变量。
- 非默认路线 requirementMode 必须为 all；priority 必须唯一；冲突按 highest-priority；必须恰好有一条无 requirements 的默认路线。
- 五章主要结局至少读取两个不同章节产生的条件：至少一个来自前半段，一个来自后半段且在最终章之前。
- 每条条件值必须由初值、决策、stateWrites、resourceDeltas 或证据开关实际到达；禁止不可达路线。
- 至少 60% 的章节决策必须被后续章节或结局读取；禁止最后临时投票选择 A/B/C。

8. 忠实度、模板检测与批次指纹
- 真相必须唯一确定，禁止“真凶或幕后黑手”“实为A但又实为B”“待定”。
- semanticConstitution 必须先锁定 facts、authorizationGrants、branchEvents 与 worldRules，再写人物和章节。授权必须区分允许用途和禁止用途；玩家选择或世界规则可能触发的条件事件必须先登记在 branchEvents，不能拿已经发生的 causalTimeline 事件充当未来分支；每条关键规则必须写 evaluationChapterKey、触发事件、前置条件、授权主体、结构化效果、审计证据和失败方式。任何 worldRules.effects 都不得在目标 stateVariables.setInChapterKey 之前写入该状态；derived 状态只能由 derivedByRuleKey 指向的规则在该章写入。
- causalTimeline 必须引用上述事实与授权，登记 actionType、targetKey、parameterKey、beforeValue、afterValue、purposeKey、authorizationStatus、factKeys，并用 actorResponsibilities 把每名玩家与其责任类型逐一配对，再写章节发现顺序；禁止用一组 actorKeys 和一组 responsibilityTypes 做含义不明的笛卡尔组合。“此前已经发生”与“玩家本章触发”不得重复描述同一事件。brief.generationContract.semanticInvariants 只作为回归补充，不能代替事实账本。
- playerAction、chapterActions.action、activePlan、irreversibleConsequence 和 nextState 不能大量复用泛化句。
- batchFingerprint 必须具体填写十三维：剧情发动机、对抗者、结局代价、主题、异常对象、揭示方式、关系拓扑、章节因果、媒介组合、权力结构、结局机制、存在状态机制、真相知情分布。其中 storyEngine、playerRelationshipTopology、existenceStatusMechanism、truthKnowledgeDistribution 必须逐字复制 brief.generationContract 对应字段。
- routes 的四个标题必须是本故事世界内独有且彼此可区分的结果，不再为通过校验而拼接预分配词；禁止“真相大白、悬而未决、沉默的代价、未竟之事”等批量模板名。
- suggestions 只能写锦上添花的表现层提醒，不能要求未来补角色贡献、来源、资源、实体、分支或结局因果。

【唯一允许的输出 schema】
{
  "outlineVersion": 2,
  "outlineRevision": "2.4",
  "logline": "一句话冲突",
  "truthTimeline": "唯一确定的幕后真相与因果时间线。必须含：责任链：逐一说明 cause/escalation/maintenance/resolution。NPC边界：NPC只承担哪些辅助压力、为何没有包办危机。",
  "sourceFidelity": {
    "briefTitle": "逐字复制 brief.title",
    "premiseElements": [
      {"element":"brief.premise 原文短语","implementation":"机制与剧情用途","chapterKeys":["chapter-1"],"supportKeys":["state-contract-primary"]}
    ]
  },
  "hookPromises": [
    {"key":"promise-1","promise":"梗概异常点","payoff":"完整机制、成因、代价与意义","supportKeys":["evidence-1","state-contract-primary"]}
  ],
  "genreProfile": {
    "mode":"mystery|emotional|political|variety|survival|hybrid",
    "chapterProgressRule":"该题材每章如何改变局面",
    "decisionCadence":"决策频率及原因"
  },
  "genreMechanic": {
    "name":"题材专属玩法名",
    "playerFacingRule":"稳定规则",
    "playerOperation":"玩家如何操作",
    "trigger":"什么玩家行为或局面会触发机制",
    "resolutionProcedure":"玩家依据什么公开信息、按什么顺序完成判定",
    "successEffect":"成功后明确写入什么状态、资源或证据",
    "failureEffect":"失败后明确失去什么权限、资源或证据",
    "limits":"规则边界",
    "chapterKeys":["chapter-1","chapter-2"],
    "payoff":"玩法如何进入真相与结局"
  },
  "styleContract": {
    "signatureDevices":["可执行文风装置1","可执行文风装置2","可执行文风装置3"],
    "forbiddenDrift":"本题材最容易滑向的通用悬疑/严肃法理/项目管理语言，以及明确禁用方式",
    "chapterExpressions":[
      {"chapterKey":"chapter-1","device":"必须引用 signatureDevices 中的一个装置","sceneOrDialogue":"本章至少一个具体场景或对白如何落实该装置"}
    ]
  },
  "entities": [
    {"key":"npc-zhao-ke","type":"npc","name":"赵恪","aliases":["守馆人"],"meaning":"独立证词主体"},
    {"key":"system-tidal-control","type":"system","name":"潮汐库楼宇控制主机","aliases":[],"meaning":"门禁与环境日志的同一来源根"},
    {"key":"object-master-tape","type":"physicalObject","name":"未剪辑母带","aliases":[],"meaning":"可被质证的原始物证"}
  ],
  "resources": [
    {"key":"appeal-token","name":"正式复核次数","valueType":"integer","initialValue":2,"minimum":0,"maximum":3,"ownerType":"group","ownerKey":"","recoverable":false,"meaning":"全组可发起正式复核的次数"}
  ],
  "players": [
    {
      "key":"role-1",
      "name":"具体姓名",
      "identity":"不可替代的专业或关系位置",
      "publicGoal":"公开目标",
      "hiddenGoal":"隐藏目标",
      "coreSecret":"与主线有因果关系的秘密",
      "secretFactKeys":["fact-1"],
      "authorizationGrantKeys":["grant-1"],
      "exclusiveAnchorKey":"evidence-1",
      "activePlan":"包含对象、方法与代价的主动计划",
      "arc":"人物变化",
      "spotlightChapterKey":"chapter-1",
      "contribution":{
        "anchorType":"evidence",
        "anchorKeys":["evidence-1"],
        "turnChapterKeys":["chapter-1"],
        "affectsRoleKeys":["role-2"]
      },
      "chapterActions":[{
        "chapterKey":"chapter-1",
        "action":"具体动作",
        "actionTarget":"质证未剪辑母带",
        "actionTargetKey":"object-master-tape",
        "method":"使用个人保管链签名",
        "consequence":"证据可用性与另一玩家权限发生变化",
        "commitmentMode":"proposal|attempt|conditional|committed",
        "decisionKey":"decision-1；没有依赖则为空",
        "optionKeys":["option-a"],
        "eventKeys":["event-1"],
        "stateWriteKeys":["state-contract-access"],
        "resourceKeys":["appeal-token"],
        "evidenceEffectKeys":["evidence-1"],
        "affectsRoleKeys":["role-2"],
        "evidenceKeys":["evidence-1"]
      }]
    }
  ],
  "centralResponsibilityRoleKeys":["role-1"],
  "responsibilityRoles":[
    {"roleKey":"role-1","responsibilityType":"cause","eventKeys":["event-1"],"action":"制造核心危机的具体世界内行动","causalEffect":"该行动如何成为不可删除的因果起点"},
    {"roleKey":"role-2","responsibilityType":"resolution","eventKeys":["event-2"],"action":"掌握不可替代的解决权","causalEffect":"只能解决危机，不能据此冒充危机责任人"}
  ],
  "causalTimeline":[
    {"key":"event-1","order":1,"event":"第一项已经发生的因果事件","actorKeys":["role-1"],"actionType":"modify","targetKey":"system-tidal-control","parameterKey":"access-policy","purposeKey":"training-review","beforeValue":"closed","afterValue":"open","authorizationGrantKey":"grant-1","authorizationStatus":"authorized","factKeys":["fact-1"],"responsibilityTypes":["cause"],"actorResponsibilities":[{"actorKey":"role-1","responsibilityType":"cause"}],"preconditionKeys":[],"outcomeStateKeys":["state-contract-primary"]},
    {"key":"event-2","order":2,"event":"由第一项事件导致的后续行动","actorKeys":["role-2"],"actionType":"approve","targetKey":"system-tidal-control","parameterKey":"review-scope","purposeKey":"official-review","beforeValue":"pending","afterValue":"accepted","authorizationGrantKey":"","authorizationStatus":"not-required","factKeys":["fact-2"],"responsibilityTypes":["resolution"],"actorResponsibilities":[{"actorKey":"role-2","responsibilityType":"resolution"}],"preconditionKeys":["event-1"],"outcomeStateKeys":[]},
    {"key":"event-3","order":3,"event":"玩家入场前或入场后明确发生的第三项事件","actorKeys":["system-tidal-control"],"actionType":"record","targetKey":"object-master-tape","parameterKey":"audit-copy","purposeKey":"audit","beforeValue":"absent","afterValue":"created","authorizationGrantKey":"","authorizationStatus":"not-required","factKeys":["fact-3"],"responsibilityTypes":[],"actorResponsibilities":[],"preconditionKeys":["event-2"],"outcomeStateKeys":["state-contract-access"]}
  ],
  "semanticConstitution":{
    "facts":[
      {"key":"fact-1","subjectKey":"role-1","predicate":"holds-limited-access","objectKey":"system-tidal-control","objectValue":"","scopeKey":"training-review","truthValue":true,"validFromEventKey":"event-1","validToEventKey":"","evidenceKeys":["evidence-1"]},
      {"key":"fact-2","subjectKey":"role-2","predicate":"may-request-review","objectKey":"system-tidal-control","objectValue":"","scopeKey":"official-review","truthValue":true,"validFromEventKey":"event-2","validToEventKey":"","evidenceKeys":["evidence-3"]},
      {"key":"fact-3","subjectKey":"object-master-tape","predicate":"contains-continuous-record","objectKey":"","objectValue":true,"scopeKey":"audit","truthValue":true,"validFromEventKey":"event-3","validToEventKey":"","evidenceKeys":["evidence-2"]}
    ],
    "authorizationGrants":[
      {"key":"grant-1","grantorKey":"role-2","granteeKey":"role-1","assetKey":"system-tidal-control","allowedPurposeKeys":["training-review"],"forbiddenPurposeKeys":["official-decision"],"validFromEventKey":"event-1","validToEventKey":"","evidenceKeys":["evidence-1"]}
    ],
    "branchEvents":[],
    "worldRules":[
      {"key":"rule-review-entry","statement":"只有保留至少一次正式复核机会且取得独立审计材料时，角色才能发起最终程序复核。","evaluationChapterKey":"chapter-1","triggerEventKeys":["event-2"],"authorizedActorKeys":["role-2"],"preconditions":[{"targetType":"resource","targetKey":"appeal-token","operator":"gte","value":1},{"targetType":"evidence","targetKey":"evidence-2","operator":"equals","value":"available"}],"effects":[{"targetType":"state","targetKey":"state-contract-access","operation":"set","amount":null,"value":"revoked","consequence":"独立材料成立后，原持有人权限被规则自动撤销并转入复核程序"}],"auditEvidenceKeys":["evidence-2"],"failureMode":"资源或独立材料不足时只能进入受限处理路线。"}
    ]
  },
  "evidenceGraph": {
    "evidence":[
      {
        "key":"evidence-1",
        "label":"原始门禁缓存",
        "sourceType":"制度记录",
        "provenanceGroup":"system-tidal-control",
        "originRootKeys":["system-tidal-control"],
        "storageEntityKey":"system-tidal-control",
        "commonCauseKeys":[],
        "independenceDomain":"楼宇控制主机及其本地时钟",
        "originActorKey":"",
        "collectionMethod":"断网后读取本地只读缓存",
        "methodDomain":"digital-forensics",
        "methodOperation":"校验签名、文件哈希与追加日志序列",
        "artifactProduced":"带签名的只读日志导出件",
        "derivedFromEvidenceKeys":[],
        "sourceOwnerRoleKey":"role-1",
        "availableChapterKey":"chapter-1",
        "obtainedBy":"玩家冻结控制主机后读取",
        "supportsConclusionKeys":["conclusion-1"],
        "alsoExplains":"错误到场时间"
      },
      {
        "key":"evidence-2",
        "label":"未剪辑母带的连续录制痕迹",
        "sourceType":"物理检验",
        "provenanceGroup":"object-master-tape",
        "originRootKeys":["object-master-tape"],
        "storageEntityKey":"object-master-tape",
        "commonCauseKeys":[],
        "independenceDomain":"母带物理记录层与保管链",
        "originActorKey":"",
        "collectionMethod":"现场取样并比对连续录制痕迹",
        "methodDomain":"physical-media-forensics",
        "methodOperation":"检查磁带接头、记录连续性与时间码漂移",
        "artifactProduced":"连续性检验报告与显微照片",
        "derivedFromEvidenceKeys":[],
        "sourceOwnerRoleKey":"",
        "availableChapterKey":"chapter-1",
        "obtainedBy":"玩家使用保管链权限完成无损检验",
        "supportsConclusionKeys":["conclusion-1"],
        "alsoExplains":"剪辑时间码为何出现偏移"
      },
      {
        "key":"evidence-3",
        "label":"赵恪的私人保管记录",
        "sourceType":"独立证词",
        "provenanceGroup":"npc-zhao-ke",
        "originRootKeys":["npc-zhao-ke"],
        "storageEntityKey":"",
        "commonCauseKeys":[],
        "independenceDomain":"赵恪个人直接观察与记忆",
        "originActorKey":"npc-zhao-ke",
        "collectionMethod":"玩家在无提示条件下进行独立访谈",
        "methodDomain":"witness-interview",
        "methodOperation":"无提示自由回忆后再用封闭问题核对程序细节",
        "artifactProduced":"签字访谈笔录与录音",
        "derivedFromEvidenceKeys":[],
        "sourceOwnerRoleKey":"",
        "availableChapterKey":"chapter-1",
        "obtainedBy":"失败分支中以一次申诉机会换取访谈",
        "supportsConclusionKeys":[],
        "alsoExplains":"受限权限下仍可进入副档案室"
      }
    ],
    "conclusions":[
      {"key":"conclusion-1","statement":"核心结论","evidenceKeys":["evidence-1","evidence-2"]}
    ]
  },
  "misdirections":[
    {
      "key":"misdirection-1",
      "kind":"suspicion",
      "apparentInterpretation":"表面解释",
      "trueCause":"真实原因",
      "mainlineImpact":"与主线的真实因果",
      "supportKeys":["evidence-1"],
      "disproofKeys":["evidence-2"],
      "lastingConsequence":"排除后仍持续改变的关系或资源"
    }
  ],
  "chapterBeats":[
    {
      "chapterKey":"chapter-1",
      "title":"章名",
      "goal":"本章要改变的局面",
      "turn":"由玩家行动造成的转折",
      "hostNotes":"主持人只控制节奏与判定",
      "triggerRoleKeys":["role-1"],
      "playerAction":"具体可执行行为",
      "actionObject":"被质证的原始母带与门禁系统",
      "actionTargetKey":"object-master-tape",
      "irreversibleConsequence":"无法无代价复原的后果",
      "nextState":"结构化变化摘要",
      "progressMode":"evidence",
      "stateReads":[{"stateKey":"state-contract-primary","operator":"equals","value":"eligible"}],
      "entryConditionMode":"all",
      "onReadPass":{"variantKey":"chapter-1-open","effectSummary":"保留完整质证权限"},
      "onReadFail":{
        "variantKey":"chapter-1-restricted",
        "fallbackAction":"通过赵恪的私人保管权限进入只读副本",
        "additionalCosts":[{"resourceKey":"appeal-token","operation":"lose","amount":1,"affectsRoleKeys":["role-2"],"consequence":"全组失去一次正式复核机会"}],
        "stateWrites":[],
        "locksEvidenceKeys":["evidence-3"],
        "unlocksEvidenceKeys":[]
      },
      "stateWrites":[],
      "unlocksEvidenceKeys":["evidence-1"],
      "locksEvidenceKeys":[],
      "resourceDeltas":[],
      "evidenceKeys":["evidence-1"],
      "genreMechanicUse":"触发：具体条件；判定：依据哪些公开信息按什么步骤判定；成功：写入什么状态/资源/证据；失败：失去什么状态/资源/证据",
      "sharedSpotlightConflict":"",
      "decision":{
        "key":"decision-1",
        "stateKey":"state-contract-primary",
        "question":"具体冲突",
        "options":[
          {"key":"option-a","choiceText":"公开完整DNA报告，并申请正式机器复核","sets":{"stateKey":"","value":""},"effects":[{"targetType":"state","targetKey":"state-contract-primary","operation":"set","value":"eligible","amount":null,"consequence":"身份材料进入正式复核程序"},{"targetType":"resource","targetKey":"appeal-token","operation":"lose","value":"","amount":1,"consequence":"正式申请消耗一次复核机会"}],"immediateConsequence":"机器开放身份复核台，但报告签署者立即失去匿名保护"},
          {"key":"option-b","choiceText":"封存报告，改用两名幸存者交叉作证","sets":{"stateKey":"","value":""},"effects":[{"targetType":"state","targetKey":"state-contract-primary","operation":"set","value":"ineligible","amount":null,"consequence":"身份材料不进入机器复核程序"}],"immediateConsequence":"身份复核台保持关闭，两名证人的旧关系被迫公开"}
        ]
      }
    }
  ],
  "endingLogic": {
    "stateVariables":[
      {"key":"state-contract-primary","valueType":"enum","initialValue":"pending","allowedValues":["pending","eligible","ineligible"],"setInChapterKey":"chapter-1","meaning":"身份材料是否取得正式程序资格","subjectKey":"object-master-tape","dimension":"程序资格","controlMode":"adjudicated","derivedFromFactKeys":["fact-3"],"derivedByRuleKey":"","valueSemantics":[{"value":"pending","worldMeaning":"身份材料尚未进入正式复核程序","incompatibleClaims":["身份已经获得正式承认"]},{"value":"eligible","worldMeaning":"身份材料通过程序并获得行动资格","incompatibleClaims":["身份资格被撤销"]},{"value":"ineligible","worldMeaning":"身份材料未通过程序且不能使用对应权限","incompatibleClaims":["身份已经获得正式承认"]}]},
      {"key":"state-contract-access","valueType":"enum","initialValue":"granted","allowedValues":["granted","restricted","revoked"],"setInChapterKey":"chapter-1","meaning":"角色进入关键区域的权限范围","subjectKey":"role-1","dimension":"区域访问权限","controlMode":"derived","derivedFromFactKeys":["fact-1"],"derivedByRuleKey":"rule-review-entry","valueSemantics":[{"value":"granted","worldMeaning":"角色保留完整进入与取得材料的权限","incompatibleClaims":["全部入口已经关闭"]},{"value":"restricted","worldMeaning":"角色只能通过高代价替代路径取得部分材料","incompatibleClaims":["保留完整进入权限"]},{"value":"revoked","worldMeaning":"角色失去进入关键区域与取得材料的权限","incompatibleClaims":["保留完整进入权限"]}]}
    ],
    "defaultRouteKey":"ending-default",
    "conflictResolution":"highest-priority",
    "routes":[
      {
        "key":"ending-1",
        "title":"第一独占结局词·条件路线",
        "priority":10,
        "isDefault":false,
        "requirementMode":"all",
        "requirements":[
          {"targetType":"state","targetKey":"state-contract-primary","operator":"equals","value":"eligible"},
          {"targetType":"state","targetKey":"state-contract-access","operator":"equals","value":"revoked"},
          {"targetType":"resource","targetKey":"appeal-token","operator":"gte","value":1},
          {"targetType":"evidence","targetKey":"evidence-2","operator":"equals","value":"available"}
        ],
        "preconditionFactKeys":["fact-3"],
        "preconditionRuleKeys":["rule-review-entry"],
        "consequence":"由累计条件自然造成的结局"
      },
      {
        "key":"ending-2",
        "title":"第二独占结局词·代价路线",
        "priority":8,
        "isDefault":false,
        "requirementMode":"all",
        "requirements":[
          {"targetType":"state","targetKey":"state-contract-primary","operator":"equals","value":"ineligible"},
          {"targetType":"resource","targetKey":"appeal-token","operator":"lte","value":1}
        ],
        "preconditionFactKeys":["fact-1"],
        "preconditionRuleKeys":[],
        "consequence":"前后章节的状态与资源共同造成另一条路线"
      },
      {
        "key":"ending-3",
        "title":"第三独占结局词·受限路线",
        "priority":6,
        "isDefault":false,
        "requirementMode":"all",
        "requirements":[
          {"targetType":"evidence","targetKey":"evidence-3","operator":"equals","value":"locked"}
        ],
        "preconditionFactKeys":["fact-1"],
        "preconditionRuleKeys":[],
        "consequence":"权限受限状态持续到终局后的确定结果"
      },
      {
        "key":"ending-default",
        "title":"第四独占结局词·余波路线",
        "priority":0,
        "isDefault":true,
        "requirementMode":"all",
        "requirements":[],
        "preconditionFactKeys":[],
        "preconditionRuleKeys":[],
        "consequence":"没有条件路线命中时的确定结果"
      }
    ]
  },
  "batchFingerprint": {
    "storyEngine":"具体剧情发动机",
    "antagonistType":"具体对抗者/阻力结构",
    "finalChoiceType":"具体结局资源或关系抉择",
    "themeExpression":"本故事独有主题命题",
    "mysteryObjectType":"异常对象或争议载体",
    "truthRevealMethod":"玩家如何证明或完成核心转变",
    "playerRelationshipTopology":"关系拓扑",
    "chapterCausalPattern":"章节状态如何连续传递",
    "evidenceModalityMix":"支持媒介与来源组合",
    "powerStructure":"权限、制度或资源分布",
    "endingMechanism":"结局由哪些累计机制触发",
    "existenceStatusMechanism":"逐字复制 brief.generationContract.existenceStatusMechanism",
    "truthKnowledgeDistribution":"逐字复制 brief.generationContract.truthKnowledgeDistribution"
  },
  "suggestions":["仅限表现层扩写建议"]
}`;

  const user = `请严格按照大纲协议 V2.4 生成可直接进入角色矩阵与正文扩写的总纲。

当前动态规格：
- players 必须恰好为 ${spec.playerCount} 名。
- chapterCount=${spec.chapterKeys.length}，chapterBeats 必须完整覆盖：${spec.chapterKeys.join("、")}。
- 每名玩家 chapterActions 的最低覆盖公式为 ceil(chapterCount × 0.6)。
- 当前最低覆盖数为 ceil(${spec.chapterKeys.length} × 0.6) = ${minimumActionChapters} 个不同章节；不得按固定“2章”处理。
- 完成题材适配贡献、实体与资源登记、条件失败分支、状态传递和结局因果路径闭环。

${untrustedUserPayload("规格", spec)}

${untrustedUserPayload("创作 brief", brief)}`;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function buildLegacyStoryOutlineBlueprintMessages(brief, spec) {
  const system = `你是互动叙事产品的首席剧情架构师。你正在完成大纲协议 V2.4 的“创作蓝图阶段”，不是修稿，也不是审稿。

${PRODUCT_BOUNDARY}

在输出 JSON 前先完成唯一真相、六人责任、题材玩法、状态类型、资源用途、证据来源和累计结局的整体设计。brief.generationContract 是并发开始前已经锁定的合同，必须逐字遵守。

只输出一个 JSON 对象，字段要求如下：
- outlineVersion=2，outlineRevision="2.4"。
- logline、truthTimeline、sourceFidelity、hookPromises。
- truthTimeline 必须包含“责任链：”和“NPC边界：”；responsibilityRoles 必须区分 cause/escalation/maintenance/resolution，前三类至少有一名玩家，NPC 不得成为包办一切的外部主谋。
- causalTimeline 必须先于章节装配锁定真实事件顺序；受害者、钥匙与最终裁决者只属于 resolution，不能冒充制造或维持危机的责任人。
- genreProfile.mode 必须等于 generationContract.genreMode。
- genreMechanic 必须包含 name、playerFacingRule、playerOperation、trigger、resolutionProcedure、successEffect、failureEffect、limits、chapterKeys、payoff。
- styleContract 必须包含至少三个 signatureDevices、forbiddenDrift，以及逐章覆盖 spec.chapterKeys 的 chapterExpressions；每条写 chapterKey、device、sceneOrDialogue。
- generationContract.styleDeviceSeeds 中每个种子都必须被写入 signatureDevices 或对应章的 sceneOrDialogue，不能只停留在文风标签里。
- entities 只能登记 NPC、机构、系统、设备、物证、地点和群体，不能再次登记任何玩家姓名或别名。
- resources 可以为空；一旦创建，就必须按 generationContract.resourcePolicies 在规定数量的不同章节成为玩家可选代价，并被结局读取。公共 resourceDeltas 默认必须为空，不能用每章自动扣减伪造使用率。
- players 必须严格按 generationContract.playerNames 的顺序使用六个姓名，key 依次为 role-1 至 role-6。每人先设计 identity、publicGoal、hiddenGoal、coreSecret、secretFactKeys、authorizationGrantKeys、exclusiveAnchorKey、activePlan、arc、spotlightChapterKey、contribution；每个核心秘密至少引用一条语义宪章事实，涉及授权的秘密与行动必须引用相应 grant，不能在人物字段中另写相反事实；chapterActions 在本阶段统一输出空数组。
- 六人的 contribution.anchorType 必须逐项等于 generationContract.contributionTypes；非 evidence 类型不得引用 evidence-x 作为独占锚点。
- centralResponsibilityRoleKeys 只能引用玩家，且必须恰好等于 responsibilityRoles 中 cause/escalation/maintenance 的玩家集合。
- evidenceGraph 对 mystery 必须包含独立来源双证据；其他题材可为空或只保留真正需要的证据。
- misdirections 必须按题材设计，不能用无关污点凑数。
- chapterBeats 本阶段统一输出空数组，不得提前填章节。
- endingLogic.stateVariables 必须至少包含 generationContract.stateKeys；若语义宪章中存在不同判断维度，必须新增题材专属原子状态，但不得创建 state-trust。number 全程使用 JSON 数字，enum 全程使用 allowedValues 字符串，boolean 全程使用 true/false。
- endingLogic.routes 必须恰好四条，优先级唯一，最后一条是默认路线；title 必须描述世界内结果，不能出现状态 key、枚举值或批量模板名。
- batchFingerprint 填写十三维，其中 storyEngine、playerRelationshipTopology、existenceStatusMechanism、truthKnowledgeDistribution 必须逐字复制 generationContract。
- suggestions 只能是表现层建议。

不要输出自检、说明或 Markdown。`;
  const user = `请先生成不可随意改动的创作蓝图。章节行动和章节节点将在下一阶段基于该蓝图装配。

${untrustedUserPayload("规格", spec)}

${untrustedUserPayload("创作 brief 与批次合同", brief)}`;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function buildStoryOutlineBlueprintMessages(
  brief,
  spec,
  previousIssues = [],
) {
  const messages = buildStoryOutlineMessages(brief, spec);
  const contract = brief.generationContract || {};
  const projectedResourceValues = (contract.resourceContracts || []).map(
    (resource) => {
      let finalValue = Number(resource.initialValue);
      const plans = (contract.resourceUsagePlans || []).filter(
        (plan) => plan?.resourceKey === resource.key,
      );
      for (const plan of plans) {
        const repetitions = Array.isArray(plan.chapterKeys)
          ? plan.chapterKeys.length
          : 0;
        const amount = Number(plan.amount);
        if (!Number.isFinite(finalValue) || !Number.isFinite(amount)) continue;
        if (plan.operation === "gain") finalValue += amount * repetitions;
        if (plan.operation === "lose") finalValue -= amount * repetitions;
        if (plan.operation === "set" && repetitions) finalValue = amount;
      }
      return {
        resourceKey: resource.key,
        initialValue: resource.initialValue,
        mandatoryPlans: plans,
        finalValueAfterMandatoryPublicDeltas: finalValue,
      };
    },
  );
  const contractScaffold = {
    outlineRevision: contract.outlineRevision || "2.4",
    premiseAnchors: contract.premiseAnchors || [],
    players: (contract.playerNames || []).map((name, index) => ({
      key: `role-${index + 1}`,
      name,
      requiredIdentity: contract.playerIdentityRequirements?.[index] || "",
      contributionAnchorType: contract.contributionTypes?.[index] || "",
      spotlightChapterKey: contract.spotlightChapterKeys?.[index] || "",
      actionChapterKeys:
        contract.roleActionChapterKeys?.[index]?.chapterKeys || [],
      endingInfluence: contract.roleEndingInfluences?.[index] || null,
      requiredTurnChapterKeys: [
        ...new Set(
          [
            contract.spotlightChapterKeys?.[index],
            contract.roleEndingInfluences?.[index]?.chapterKey,
          ].filter(Boolean),
        ),
      ],
    })),
    stateVariables: (contract.stateKeys || []).map((key, index) => ({
      key,
      valueType: contract.stateTypes?.[index] || "",
      setInChapterKey: contract.stateSetChapterKeys?.[index] || "",
      controlMode: contract.stateControlModes?.[index] || "",
      fixedValue: contract.fixedStateValues?.[index] || "",
    })),
    stateKeysAreExhaustive: contract.stateKeysAreExhaustive === true,
    resourceKeys: contract.resourceKeys || [],
    resourceContracts: contract.resourceContracts || [],
    resourceUsagePlans: contract.resourceUsagePlans || [],
    resourcePolicies: contract.resourcePolicies || [],
    projectedResourceValues,
    semanticInvariants: contract.semanticInvariants || [],
    evidenceSourceRequirements: (contract.evidenceSourceContracts?.length
      ? contract.evidenceSourceContracts
      : (contract.evidenceSourceTypes || []).map((sourceType, index) => ({
          evidenceKey: `evidence-${index + 1}`,
          sourceType,
          provenanceGroup: contract.evidenceProvenanceGroups?.[index] || "",
        }))
    ).map((entry, index) => ({
      evidenceKey: entry.evidenceKey || `evidence-${index + 1}`,
      sourceType: entry.sourceType,
      provenanceGroup: entry.provenanceGroup || "",
      originRootKeys:
        entry.originRootKeys ||
        (entry.provenanceGroup ? [entry.provenanceGroup] : []),
      commonCauseKeys: entry.commonCauseKeys || [],
      independenceDomain: entry.independenceDomain || "",
      methodDomain: entry.methodDomain || "",
      provenanceRule:
        "引用本篇 entities 中真实存在且类型相容的来源实体；必须暴露真正信息根与共同故障域，不得创建来源壳",
      derivedFromEvidenceKeys: [],
    })),
    requiredConclusionEvidenceKeys:
      contract.requiredConclusionEvidenceKeys || [],
    hookEvidenceRequirements: contract.hookEvidenceRequirements || [],
    endingTitleTokens: contract.endingTitleTokens || [],
    endingRouteStateTargets: [
      [contract.stateKeys?.[0], contract.stateKeys?.[1]],
      [contract.stateKeys?.[0], contract.stateKeys?.[2]],
      [contract.stateKeys?.[0], contract.stateKeys?.[1]],
    ],
    signatureDevicesRequired: contract.styleDeviceSeeds || [],
    lockedFingerprints: {
      storyEngine: contract.storyEngine || "",
      existenceStatusMechanism: contract.existenceStatusMechanism || "",
      truthKnowledgeDistribution: contract.truthKnowledgeDistribution || "",
      playerRelationshipTopology: contract.playerRelationshipTopology || "",
      finalChoiceType: contract.finalChoiceType || "",
      themeExpression: contract.themeExpression || "",
      antagonistType: contract.antagonistType || "",
      mysteryObjectType: contract.mysteryObjectType || "",
      truthRevealMethod: contract.truthRevealMethod || "",
      chapterCausalPattern: contract.chapterCausalPattern || "",
      evidenceModalityMix: contract.evidenceModalityMix || "",
      powerStructure: contract.powerStructure || "",
      endingMechanism: contract.endingMechanism || "",
    },
  };
  messages[0].content += `

【当前阶段：V2.4语义宪章与创作蓝图】
你不是在输出最终稿，而是在用上方同一份完整 JSON schema 建立不可变蓝图。上方 schema 的字段形状、数组形状和字段名称全部继续有效；只覆盖两项内容要求：
1. players 仍是恰好 ${spec.playerCount} 项的数组，每项必须保留完整 contribution 结构，但每项 chapterActions 必须是 []。
2. chapterBeats 必须是 []。
3. styleContract 先锁定至少三个 signatureDevices 和 forbiddenDrift，但 chapterExpressions 必须是 []，逐章文风场景在章节装配阶段填写。
不得把 players、entities、stateVariables、routes 或任何其他数组改写成以 key 为属性名的对象映射。
endingLogic.stateVariables 每项必须使用 key、valueType、initialValue、allowedValues、setInChapterKey、meaning；meaning 至少八个汉字并明确“哪个对象的哪项判断”。
endingLogic.routes 必须恰好四项，每项必须使用 key、title、priority、isDefault、requirementMode、requirements、consequence；最后一项为唯一默认路线。
generationContract.styleDeviceSeeds 的每个词必须在 styleContract.signatureDevices 或 chapterExpressions.sceneOrDialogue 中落地。
semanticConstitution 必须在人物、证据、状态和结局之前锁定：facts 至少三条；涉及授权时必须填写 authorizationGrants 并区分 allowedPurposeKeys/forbiddenPurposeKeys；branchEvents 只登记可能由玩家选项或世界规则触发的条件事件，每项写 key、chapterKey、description，既成事实仍放 causalTimeline；worldRules 至少一条，且 evaluationChapterKey、前置条件、效果、审计证据和失败方式完整。规则 evaluationChapterKey 不得早于其 state effect 目标的 setInChapterKey；derived 状态的全部取值变化只能来自对应世界规则，后续所有秘密、责任、事件和结局必须引用这份宪章，不得另写一套相反事实。
responsibilityRoles[].eventKeys 不是大致相关事件：每一个 key 都必须指向 causalTimeline 中真实存在的事件，而且该事件 actorResponsibilities 必须包含完全相同的 roleKey + responsibilityType 配对；写完 causalTimeline 后逐项反查，禁止把“系统自动结算”等无玩家责任事件误挂给相邻编号的玩家。
resources 必须逐字段复制 generationContract.resourceContracts：key、name、meaning、initialValue、minimum、maximum、ownerType、ownerKey、recoverable 都不得改写；只额外填写 valueType="integer"。合同为空就输出 []。每个资源必须出现在至少一条结局 requirements 中，禁止另造“决策容量”。
V2.4 禁止 resourceUsagePlans 公共必扣合同。必须遵守 resourcePolicies：资源变化放在玩家选择 options[].effects 中；每个出现资源代价的决策至少有一个不消耗该资源的可执行选项。公共 resourceDeltas 原则上为空，只有世界规则证明不可避免时才允许。
endingLogic.stateVariables 必须包含 generationContract.stateKeys。contractScaffold.stateKeysAreExhaustive=true 时状态表必须与合同完全一致，不得为了填满结局另造资格、信任或冠军主张状态；否则这些 key 只是最低题材种子，确有不同判断时才新增独立状态。每个状态填写 subjectKey、dimension、controlMode、derivedFromFactKeys、derivedByRuleKey；enum 必须给出至少三个题材专属 allowedValues。
若 contractScaffold.stateVariables 已指定 controlMode，必须逐项照抄。observed 且 fixedValue 非空的状态是客观真值：所有结局若读取它只能读取该 fixedValue，不能为了制造分支把同一客观事实写出相反版本；它在装配阶段由 setInChapterKey 的公共 stateWrites 写入，不能交给玩家选项裁定。
每个 stateVariables.setInChapterKey 必须逐项等于 generationContract.stateSetChapterKeys。每条非默认结局至少读取 stateKeys[0]，并再读取 stateKeys[1] 或 stateKeys[2]，从而天然跨越前后章节。
六名玩家的 spotlightChapterKey 必须逐项等于 generationContract.spotlightChapterKeys；contribution.turnChapterKeys 必须同时包含本人的 spotlightChapterKey 和 generationContract.roleEndingInfluences 对应项的 chapterKey（相同则只写一次）。这六个预分配项只保证每个人通往结局的因果路径，不等于玩家直接给状态赋值；influenceMode=causal-path 时允许通过证据、触发规则或改变他人选择间接影响 derived 状态，只有 influenceMode=direct 才禁止 observed/derived。
若 contractScaffold.players[].requiredIdentity 非空，对应玩家 identity 必须逐字包含该身份短语；不得把应属于同一组织的玩家换成对手、裁判、监督者或外部 NPC。外部权力角色只能登记在 entities。
玩家贡献锚点必须使用已登记 key：evidence→证据 key；resource→资源 key；task→证据/状态/资源/实体 key；relationship、commitment、authority、risk、memory、audience→状态 key。exclusiveAnchorKey 是另一个独立字段，可以引用角色独占的已登记证据、状态、资源或实体，不要求与 contribution.anchorKeys 相同。禁止自造 authority-1、task-1、relationship-1 等未登记 key。
mystery 至少登记四条可实际取得、质证或操作的证据，只设计一个聚合核心 conclusion；不要求六名玩家各分一条证据。每条 provenanceGroup 必须引用先在 entities 中登记的真实世界来源（人物、机构、系统、设备、物件或地点），不得使用 source-*、来源01-1 或“某证据的原始来源”包装壳。sourceType 与实体类型必须相容：证词→npc/group，设备日志→device/system，制度记录→organization/system，物理痕迹→physicalObject/device/location。不要为六名玩家各造一个边缘 conclusion；不能把同源截图拆成双源。核心 conclusion 必须逐项包含 contractScaffold.requiredConclusionEvidenceKeys；每个 hook 必须逐项包含 hookEvidenceRequirements 指定的 evidenceKeys。两条证据即使 provenanceGroup 不同，只要 originRootKeys 或 commonCauseKeys 指向同一系统，仍算同源，必须再加入不同根的证据。
若 contractScaffold.evidenceSourceRequirements 已给出 provenanceGroup，则必须在 entities 先登记完全相同的真实 key，并按 key 的世界含义使用相容类型：system-* 登记为 system，object-* 登记为 physicalObject，npc-* 登记为 npc。不得把这些真实来源再包装成“某证据的来源实体”。
- 每个 enum stateVariable 必须逐值填写 valueSemantics；每项 worldMeaning 至少8个汉字，必须同时指出对象与世界内事实，不能只把枚举值翻译一遍；incompatibleClaims 至少一项，并在写结局时逐项排除语义冲突。
- generationContract.semanticInvariants 是本篇回归合同：requiredPatterns 对应事实必须进入真相/机制/章节，forbiddenPatterns 对应矛盾绝不能出现。
输出前逐项检查 hookPromises：包括第二项在内，每项 key、promise、payoff、supportKeys 都必须存在；payoff 至少六十个汉字，必须直接说明该异常的机制、责任行动和最终可验证结果，不能只重复 promise。promise、payoff 与 ending routes 的 title、consequence 必须使用世界内语言，禁止出现 state-、resource-、chapter-、role- 或 verified 等内部 key/枚举；结构化引用只放在 supportKeys、requirements 等隐藏字段。mystery 的每个 hook 必须由至少两条 evidence key 支持，且两条证据指向不同的真实 provenanceGroup；状态、资源和实体 key 不能冒充双源证据。
每条 evidence.collectionMethod 和 obtainedBy 都要写明具体载体、取得动作与复核方式，禁止只写“调查获得”“系统提取”或空字符串。sourceFidelity.premiseElements[].implementation 至少二十个汉字，说明原始钩子怎样进入机制和章节。
sourceFidelity.briefTitle 必须逐字等于原题；premiseElements 至少两项，每项 element 必须逐字截取自 brief.premise 的连续原文，不能概括、改写或另造近义句。
entities.type 只能是 npc、organization、system、device、physicalObject、location、group；每个实体必须有非空 key、name、meaning，玩家姓名及别名不得进入 entities。
实体类型必须符合名称与用途：数据库、服务器、控制主机是 system/device；委员会、管理局、公司、联盟组织是 organization；医疗组、建设组、行动组、以“人员/成员/队伍”命名的多人集合是 group；具体单人是 npc；只有真实可触摸物件才是 physicalObject。不得把系统写成 npc、把人员集合写成 organization、把数据库或日志写成 physicalObject。
misdirections.kind 必须严格按题材选择：mystery=suspicion/evidence；emotional=memory/relationship；political=alliance/authority；variety=publicNarrative/task；survival=risk/resource；hybrid 可使用这些类型。
batchFingerprint 的十三个字段必须全部写出不少于六个汉字的题材专属内容，不能遗漏 antagonistType、mysteryObjectType 等非锁定字段。
 generationContract.styleDeviceSeeds 的每一项都要逐字复制到 signatureDevices 数组中，不能只用近义文风描述代替。
truthTimeline 必须给出唯一确定版本，禁止出现“真凶或幕后黑手”“可能是A也可能是B”“待定”“尚未确定”“任选其一”。
每条非默认 ending route 至少两个累计条件，并通过状态变量的 setInChapterKey 同时覆盖前半段与最终章之前的后半段。不要把所有结局条件都放在同一章。
本阶段先锁定唯一真相、六人责任、题材机制、文风装置、实体、资源、贡献类型、状态类型、结局路线和十三维指纹；不要提前填章节行动。`;
  messages[1].content += `

【蓝图输出覆盖规则】
严格沿用系统消息给出的完整 JSON schema，只将 ${OUTLINE_BLUEPRINT_EMPTY_SLOT_PATHS.join("、")} 输出为空数组。不要输出说明、自检报告、Markdown 或 schema 之外的字段。

${untrustedUserPayload("程序已预填且不可覆盖的批次合同骨架", contractScaffold)}`;
  if (Array.isArray(previousIssues) && previousIssues.length) {
    messages[1].content += `\n\n${untrustedUserPayload("上一份蓝图被拒绝的原因；请从零重生且不得复用失败结构", previousIssues.slice(0, 20))}`;
  }
  return messages;
}

export function buildStoryOutlineBlueprintPatchMessages(
  brief,
  spec,
  blueprint,
  issues,
) {
  const blueprintPatchGuidance = { requiredPatchPaths: [] };
  const derivedOnlyIssue = (Array.isArray(issues) ? issues : [])
    .map((issue) => String(issue || ""))
    .find((issue) =>
      /worldRules\[\d+\]\.effects\[\d+\] 只能写 controlMode=derived/u.test(
        issue,
      ),
    );
  const derivedOnlyMatch = derivedOnlyIssue?.match(
    /worldRules\[(\d+)\]\.effects\[(\d+)\]/u,
  );
  if (derivedOnlyMatch) {
    const ruleIndex = Number(derivedOnlyMatch[1]);
    const effectIndex = Number(derivedOnlyMatch[2]);
    const rule = blueprint?.semanticConstitution?.worldRules?.[ruleIndex];
    const evidenceKey = (
      Array.isArray(rule?.auditEvidenceKeys) ? rule.auditEvidenceKeys : []
    )[0];
    if (evidenceKey) {
      const basePath = `/semanticConstitution/worldRules/${ruleIndex}/effects/${effectIndex}`;
      blueprintPatchGuidance.rule =
        "该蓝图没有可由规则写入的 derived 状态；将规则效果原子改为审计证据解锁，五个字段必须一起修改。";
      blueprintPatchGuidance.requiredPatchPaths.push(
        { op: "replace", path: `${basePath}/targetType`, value: "evidence" },
        { op: "replace", path: `${basePath}/targetKey`, value: evidenceKey },
        { op: "replace", path: `${basePath}/operation`, value: "unlock" },
        { op: "replace", path: `${basePath}/value`, value: "" },
        { op: "replace", path: `${basePath}/amount`, value: null },
      );
    }
  }
  const system = `你是互动叙事蓝图的定点校对器。${PRODUCT_BOUNDARY}
只输出一个 JSON 对象，形状必须为 {"patches":[{"op":"replace|add|remove","path":"/JSON/Pointer","value":"仅 add/replace 需要"}]}。
只修复所列机械问题；不得借机改写题目、logline、truthTimeline、高概念、玩家姓名、责任结构、证据结论、状态语义、结局含义或批次指纹。
path 必须是合法 JSON Pointer；数组使用十进制下标，向数组末尾追加可使用 /-。remove 不得携带 value。
修复引用时只能选择蓝图中已经登记、且语义真实匹配的 key；禁止制造占位 key。players[].secretFactKeys 只能从 semanticConstitution.facts 现有 key 中选择，并优先选择 subjectKey 与该玩家一致、predicate 与 coreSecret 一致的事实；若没有匹配事实，就修改现有事实的 subject/predicate，不得编造 fact-7、fact-8 等未登记 key。
当错误是“路线引用规则但遗漏前置条件”时：worldRules[].preconditions 中 targetType=fact 的项才追加到 route.preconditionFactKeys；targetType=state/resource/evidence 的项必须把完整 {targetType,targetKey,operator,value} 原样追加到 route.requirements。绝不能把 evidence-2、resource key 或 state key 塞进 preconditionRuleKeys；该数组只允许 worldRules[].key。
当 observed 状态的路线值违背合同固定真值时，只替换该 route requirement 的 value 为 generationContract.fixedStateValues 对应值；不要改写事实、状态语义或结局后果。修复 initialValue/allowedValues 时优先把 initialValue 改成 allowedValues 中表达“尚未判定”的既有值，不得删除合同固定真值。
当 responsibilityRoles 与 causalTimeline 的逐人映射不一致时，先按同一角色真实实施的既有事件修正 eventKeys；只有事件中遗漏该角色真实责任时才补 actorResponsibilities，不得把系统自动行为伪造成玩家责任。
当 causalTimeline.authorizationStatus 无效时，只能从 authorized、exceeded、forged、not-required 中按既定事实选择；除 not-required 外必须引用已登记 authorizationGrantKey，并让 purposeKey 与 allowedPurposeKeys/forbiddenPurposeKeys 的事实一致。
当事件文本明确写“越权、擅自、未经授权”但 authorizationStatus=authorized 时，不得删掉越权事实；若行动者确有一份范围较窄的真实授权，把 purposeKey 改成该授权中与事件最匹配的 forbiddenPurposeKeys，并将 authorizationStatus 改为 exceeded。只有签名或授权本身伪造时才使用 forged。
当 causalTimeline 的 beforeValue 与 afterValue 相同时，依据该事件已经写明的动作、事实和相邻事件，只修正能明确推导出的事件前值或后值；修复后必须表示真实变化，不能用换同义词伪造变化。
当 worldRules.effects.targetKey 引用未知对象时，只能替换为蓝图已登记且与规则效果语义一致的状态、资源、证据或 branchEvent key；不得把 schema 示例里的 state-contract-access 等占位 key 加进蓝图。
当 worldRules 在目标状态 setInChapterKey 之前提前写入该状态时，状态合同不可修改；把该规则的 evaluationChapterKey 移到目标状态的 setInChapterKey，并同步检查触发事件与审计证据在该章已经可用。不得把提前写入值改名为 pending 来绕过时序门禁。
当 worldRules.effects 试图写入 adjudicated、player-decision 或 observed 状态时，不得修改状态的 controlMode；把该 effect 改为与同一规则审计程序真实对应的 evidence lock/unlock、resource gain/lose 或已登记 branchEvent trigger。玩家裁决状态只能由登记章节的 decision options 决定。
当 evidence lock/unlock 的 consequence 越权声称“授权有效性已确认”“赛果已认定”“责任已裁定”时，只改写 consequence 为该证据被封存或获准进入复核；不得把证据可用性写成最终裁决。
当 authorizationGrants.evidenceKeys 缺失时，只能补入已经登记、且确实能证明该授权主体、范围或有效期的证据 key；不能随便拿无关日志凑一项。authorizationGrants 位于 /semanticConstitution/authorizationGrants，JSON Pointer 必须包含这两层，禁止误写成根级 /authorizationGrants。
当 entities 的名称/意义与 type 语义冲突且错误已经明确给出“应为”类型时，只替换对应 /entities/{index}/type，不改名称、描述或 key。authorizationGrants 的 grantorKey、granteeKey、assetKey 同样位于 /semanticConstitution/authorizationGrants/{index}/...，不得误写成根级路径。
修复 objectKey/objectValue 互斥时，保留能表达既定事实的一项并删除另一项。
不要输出完整蓝图、解释、Markdown、自检或 patches 之外的字段。`;
  const user = `${untrustedUserPayload("规格与生成前合同", { spec, generationContract: brief.generationContract || {} })}

${untrustedUserPayload("待定点修复的蓝图", blueprint)}

${untrustedUserPayload("本问题的机器定位提示；requiredPatchPaths 非空时必须逐项原样执行", blueprintPatchGuidance)}

${untrustedUserPayload("仅允许修复的机械问题", Array.isArray(issues) ? issues.slice(0, 20) : [])}`;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function buildLegacyStoryOutlineAssemblyMessages(brief, spec, blueprint) {
  const messages = buildStoryOutlineMessages(brief, spec);
  messages[0].content += `

【两阶段装配规则】
下面会提供已锁定的创作蓝图。它不是待修复的旧稿，而是本篇在第一阶段确定的创作合同。
最终 JSON 必须保留蓝图的真相、玩家姓名与身份、实体、资源、贡献类型、核心责任、证据图、状态类型、结局路线、文风合同和批次指纹；本阶段只负责：
1. 为每名玩家补齐覆盖 ceil(chapterCount × 0.6) 个不同章节的 chapterActions。
2. 按 spec.chapterKeys 补齐 chapterBeats。
3. 让章节状态读写、资源变化、证据开关、题材机制和结局条件真实连通。
蓝图阶段应已避免装饰性资源；本阶段必须按 resourcePolicies 把资源变化绑定到具体选项，并保留不消耗资源的替代路径。
不要把玩家重新登记为 NPC，不要新增万能 state-trust，不要把题材贡献改回 evidence。`;
  messages[1].content += `\n\n${untrustedUserPayload("已锁定创作蓝图", blueprint)}`;
  return messages;
}

export function buildStoryOutlineAssemblyMessages(
  brief,
  spec,
  blueprint,
  previousIssues = [],
) {
  const minimumActionChapters = Math.ceil(spec.chapterKeys.length * 0.6);
  const resourceKeys = Array.isArray(blueprint?.resources)
    ? blueprint.resources.map((resource) => resource?.key).filter(Boolean)
    : [];
  const additionalCostsExample = "[]";
  const resourceDeltasExample = "[]";
  const resourceRule = resourceKeys.length
    ? `蓝图题材资源为 ${resourceKeys.join("、")}。按 resourcePolicies 把资源变化放在执行具体行为的 decision.options[].effects 中；同一决策必须至少保留一个不消耗该资源的可执行选项。公共 resourceDeltas 默认输出 []。`
    : "蓝图 resources 为空：所有 additionalCosts 和 resourceDeltas 必须输出 []，失败代价只能通过已登记状态或证据锁定/解锁表达，绝不能输出空 resourceKey 占位对象。";
  const influencePlan = JSON.stringify(
    brief.generationContract?.roleEndingInfluences || [],
  );
  const actionChapterPlan = JSON.stringify(
    brief.generationContract?.roleActionChapterKeys || [],
  );
  const stateVariables = Array.isArray(blueprint?.endingLogic?.stateVariables)
    ? blueprint.endingLogic.stateVariables
    : [];
  const endingRoutes = Array.isArray(blueprint?.endingLogic?.routes)
    ? blueprint.endingLogic.routes
    : [];
  const stateDecisionCoveragePlan = stateVariables
    .filter((state) =>
      ["adjudicated", "player-decision"].includes(state?.controlMode),
    )
    .map((state) => {
      const routeValues = endingRoutes.flatMap((route) =>
        Array.isArray(route?.requirements)
          ? route.requirements
              .filter(
                (requirement) =>
                  requirement?.targetType === "state" &&
                  requirement?.targetKey === state?.key,
              )
              .map((requirement) => requirement?.value)
          : [],
      );
      const optionValues = [
        ...new Set(
          [
            ...routeValues,
            ...(Array.isArray(state?.allowedValues) ? state.allowedValues : []),
          ].filter((value) => value !== undefined && value !== null),
        ),
      ];
      return {
        chapterKey: state?.setInChapterKey,
        stateKey: state?.key,
        optionValues,
      };
    });
  const observedStateWritePlan = stateVariables
    .map((state) => {
      const contractIndex = (brief.generationContract?.stateKeys || []).indexOf(
        state?.key,
      );
      return {
        chapterKey: state?.setInChapterKey,
        stateKey: state?.key,
        value:
          brief.generationContract?.fixedStateValues?.[contractIndex] || "",
      };
    })
    .filter((entry) => entry.value);
  const fallbackStateWritePlan = spec.chapterKeys.map(
    (chapterKey, chapterIndex) => {
      const availableState = stateVariables
        .filter(
          (state) =>
            state?.controlMode !== "derived" &&
            spec.chapterKeys.indexOf(state?.setInChapterKey) <= chapterIndex,
        )
        .at(-1);
      return {
        chapterKey,
        whenStateReadsPresent: availableState
          ? {
              stateKey: availableState.key,
              operation: "set",
              value: availableState.initialValue,
            }
          : null,
        additionalCosts: [],
        locksEvidenceKeys: [],
        unlocksEvidenceKeys: [],
      };
    },
  );
  const assemblyScaffold = {
    playerActionChapterKeys:
      brief.generationContract?.roleActionChapterKeys || [],
    roleEndingInfluences: brief.generationContract?.roleEndingInfluences || [],
    requiredTriggerRoleKeysByChapter: spec.chapterKeys.map((chapterKey) => ({
      chapterKey,
      roleKeys: (Array.isArray(blueprint?.players) ? blueprint.players : [])
        .filter((player) =>
          player?.contribution?.turnChapterKeys?.includes(chapterKey),
        )
        .map((player) => player?.key),
    })),
    chapterDecisionObligations: spec.chapterKeys.map((chapterKey) => ({
      chapterKey,
      decisionStateKeys: stateDecisionCoveragePlan
        .filter((entry) => entry.chapterKey === chapterKey)
        .map((entry) => entry.stateKey),
      observedStateWrites: observedStateWritePlan.filter(
        (entry) => entry.chapterKey === chapterKey,
      ),
      branchEventKeys: (Array.isArray(
        blueprint?.semanticConstitution?.branchEvents,
      )
        ? blueprint.semanticConstitution.branchEvents
        : []
      )
        .filter((event) => event?.chapterKey === chapterKey)
        .map((event) => event?.key),
      optionalResourceKeys: (brief.generationContract?.resourcePolicies || [])
        .filter((policy) =>
          policy?.optionalUseChapterKeys?.includes(chapterKey),
        )
        .map((policy) => policy?.resourceKey),
    })),
    stateDecisionCoveragePlan,
    observedStateWritePlan,
    requiredBranchEvents: (Array.isArray(
      blueprint?.semanticConstitution?.branchEvents,
    )
      ? blueprint.semanticConstitution.branchEvents
      : []
    ).map((event) => ({
      eventKey: event?.key,
      chapterKey: event?.chapterKey,
    })),
    resourcePolicies: brief.generationContract?.resourcePolicies || [],
    fallbackStateWritePlan,
  };
  const system = `你是互动叙事产品的章节架构师。第一阶段创作蓝图已经通过机械合同；你现在只能为它装配玩家章节行动和公共章节节点。
${PRODUCT_BOUNDARY}

只输出一个 JSON 对象，顶层只能有 ${OUTLINE_ASSEMBLY_ROOT_FIELDS.join("、")} 三个字段。不要复述、改写或补充蓝图的其他字段。

playerChapterActions 必须恰好 ${spec.playerCount} 项，按蓝图 players 顺序输出：
{
  "roleKey":"role-1",
  "chapterActions":[
    {
      "chapterKey":"chapter-1",
      "action":"包含明确动词、对象和不可替代操作的具体行动",
      "actionTarget":"玩家实际处理的对象",
      "actionTargetKey":"引用蓝图中已登记的玩家、实体、资源或证据 key；不要把抽象状态当作行动对象",
      "method":"如何执行与如何判定",
      "consequence":"对其他角色、证据、权限、关系或资源造成的可见后果",
      "commitmentMode":"proposal|attempt|conditional|committed",
      "decisionKey":"依赖的章节 decision.key；没有则空字符串",
      "optionKeys":["conditional 行动对应的选项 key；否则空数组"],
      "eventKeys":["蓝图 causalTimeline 中本行动延续的既成事件，或 semanticConstitution.branchEvents 中由选项触发的分支事件 key"],
      "stateWriteKeys":["已登记状态 key"],
      "resourceKeys":["已登记资源 key"],
      "evidenceEffectKeys":["解锁或关闭的证据 key"],
      "affectsRoleKeys":["role-2"],
      "evidenceKeys":["本行动实际使用的证据 key"]
    }
  ]
}
每名玩家恰好覆盖 ${minimumActionChapters} 个不同章节，不要为了填表让六人每章轮流行动。禁止只写“调查线索、质问某人、交换信息、隐瞒秘密、寻找真相”。actionTarget 即使对象名称很短，也要写成可辨识的具体对象说明。每名玩家至少一次改变另一玩家的资源、权限或选择，并沿登记状态、资源、证据或分支事件形成通往结局的真实因果路径；不要求六个人各自直接给一个结局状态赋值。

chapterBeats 必须严格按 ${spec.chapterKeys.join("、")} 输出 ${spec.chapterKeys.length} 项：
{
  "chapterKey":"chapter-1",
  "title":"本章独有标题",
  "goal":"本章必须改变的局面",
  "turn":"由玩家行为造成的转折",
  "hostNotes":"主持人只控制节奏与公开判定",
  "triggerRoleKeys":["role-1"],
  "playerAction":"公共层面的具体可执行行为",
  "actionObject":"被操作、质证、保护、消耗或放弃的具体对象",
  "actionTargetKey":"蓝图中的稳定 key",
  "irreversibleConsequence":"无法无代价复原的后果",
  "nextState":"明确写出下游读取哪个状态、资源、证据、区域或关系",
  "progressMode":"evidence|relationship|commitment|memory|resource|authority|alliance|task|performance|audience|risk|mixed",
  "stateReads":[{"stateKey":"已登记状态 key","operator":"equals|not_equals|includes|gte|lte","value":"类型正确的值"}],
  "entryConditionMode":"all|any",
  "onReadPass":{"variantKey":"唯一分支 key","effectSummary":"满足条件时的可执行变化"},
  "onReadFail":{
    "variantKey":"唯一分支 key",
    "fallbackAction":"不满足条件时仍可继续的具体行动",
    "additionalCosts":${additionalCostsExample},
    "stateWrites":[{"stateKey":"已登记状态 key","operation":"set|increment|decrement","value":"类型正确的值"}],
    "locksEvidenceKeys":[],
    "unlocksEvidenceKeys":[]
  },
  "stateWrites":[{"stateKey":"已登记状态 key","operation":"set|increment|decrement","value":"类型正确的值"}],
  "unlocksEvidenceKeys":[],
  "locksEvidenceKeys":[],
  "resourceDeltas":${resourceDeltasExample},
  "evidenceKeys":[],
  "genreMechanicUse":"触发：具体条件；判定：公开信息与步骤；成功：状态/资源/证据变化；失败：状态/资源/证据代价",
  "sharedSpotlightConflict":"同章超过两名聚光玩家时的共同冲突，否则空字符串",
  "decision":{
    "key":"本章唯一 decision key",
    "stateKey":"本决策确实裁决状态时填写已登记状态 key；只改变资源、证据或分支事件时为空字符串",
    "question":"具体选择冲突",
    "interaction":{"kind":"group_choice|resource_tradeoff|evidence_selection|sequence_reconstruction|timed_crisis|role_commitment|secret_ballot|free_ranking|numeric_allocation","label":"题材内玩法名称","playerInstruction":"玩家如何完成本轮操作","hostInstruction":"主持人如何确认并结算","deadlineSeconds":0,"defaultOptionKey":"仅限时危机填写超时后自动采用的本决策 option key，否则空字符串","resourceKey":"仅资源取舍时引用已登记资源，否则空字符串","allocationTotal":"仅数值分配填写每位玩家的固定总额，默认100","allocationUnitLabel":"仅数值分配填写题材内单位，默认点"},
    "options":[
      {"key":"option-a","choiceText":"玩家在世界内执行的具体行为","presentation":{"eyebrow":"方案短标签","publicPreview":"玩家提前可见的结果范围","costLabel":"明确代价或空字符串","riskLabel":"明确风险或空字符串","sequenceLabel":"顺序重建时的步骤摘要，否则空字符串"},"sets":{"stateKey":"","value":""},"effects":[{"targetType":"state|resource|evidence|event","targetKey":"蓝图稳定key","operation":"与targetType相容的操作","value":"状态值或空字符串","amount":null,"consequence":"世界内效果"}],"immediateConsequence":"不暴露内部字段的立刻可见后果"},
      {"key":"option-b","choiceText":"另一项世界内行为","presentation":{"eyebrow":"方案短标签","publicPreview":"另一方案的公开预览","costLabel":"","riskLabel":"","sequenceLabel":""},"sets":{"stateKey":"","value":""},"effects":[{"targetType":"state","targetKey":"已登记状态","operation":"set","value":"另一合法值","amount":null,"consequence":"该选择立即确定的世界内事实"}],"immediateConsequence":"不暴露内部字段的另一后果"}
    ]
  }
}

styleChapterExpressions 必须严格按 ${spec.chapterKeys.join("、")} 输出 ${spec.chapterKeys.length} 项：
{
  "chapterKey":"chapter-1",
  "device":"逐字引用蓝图 signatureDevices 中的一项",
  "sceneOrDialogue":"把该装置落实成这一章可直接扩写的场景、叙述动作或对白，不得只写风格标签"
}

硬规则：
- 只能引用蓝图已经登记的 key，不能新建人物、实体、资源、证据、状态或结局。player actionTargetKey 只能引用具体玩家、实体、资源或证据，不能引用抽象状态；styleChapterExpressions.device 只能复制蓝图 signatureDevices。
- progressMode 必须按题材选择：mystery=evidence/mixed；emotional=relationship/commitment/memory/mixed；political=resource/authority/alliance/mixed；variety=task/performance/audience/mixed；survival=resource/risk/mixed。
- number 使用 JSON 数字，enum 使用 allowedValues 中的字符串，boolean 使用 true/false。
- enum 状态的 stateReads 只能使用 equals/not_equals/includes，不能使用 gte/lte；number 状态才可使用 gte/lte。
- 没有 stateReads 时 entryConditionMode 必须为 none；有 stateReads 时才使用 all/any，并通过 onReadFail 继续且付出真实状态、资源或证据代价。
- 每章的 genreMechanicUse 必须同时包含“触发：”“判定：”“成功：”“失败：”，并落实蓝图机制。
- mystery 每章 evidenceKeys 至少一项，包括最终章。玩家 action 的 stateWriteKeys/resourceKeys/evidenceEffectKeys 必须与同章公共效果或其引用的 decision option effects 对应，不能只在文字中声称发生了变化。
- 玩家只是读取、提交、比对或质证某条证据时，只把它放进 action.evidenceKeys，evidenceEffectKeys 必须为空；只有该行动对应的章节选项真的 unlock/lock 该证据时才能写 evidenceEffectKeys。stateWriteKeys 与 resourceKeys 同理，默认输出 []，只有同章结构化效果确实发生时才能声明。
- 六人的行动章节分配已经锁定为 ${actionChapterPlan}；当前每人至少覆盖 ${minimumActionChapters} 章，必须逐项逐章照抄。角色可以拥有多种责任；proposal 只提出问题且不得提前写结果，conditional 必须引用本章或此前真实存在的 decision.key 与 optionKeys，committed 只能执行此前已经作出的选择。禁止在最终公共选择之前把重赛、牺牲、公开、放弃等结果写死。
- ${resourceRule} 不能同时把同一变化再记入状态造成双扣。
- 对每项资源按章节顺序计算所有公共效果、失败分支和选项可能造成的最坏轨迹；任何可执行路径都不得低于 minimum 或高于 maximum。若资源初始量为3且至少三章发生变化，不能在四章都无补充地 lose 1。
- 严格遵守 generationContract.resourcePolicies：资源只在具体选项 effects 或确有条件失败代价时变化；每个 optionalUseChapterKeys 指定章节必须至少有一个消耗该资源的选项和一个不消耗的可执行选项，其他章节不要随意重复消费；不能为了满足使用次数把每章公共扣1，也不能让所有选项都扣同一资源。
- onReadFail.additionalCosts 为空时必须输出 []；非空时每一项必须完整使用 {"resourceKey":"已登记资源 key","operation":"lose|transfer","amount":1,"affectsRoleKeys":["role-x"],"consequence":"本次失败在世界内失去或转移了什么"}。禁止只写 resourceKey/amount，禁止使用 gain/set，禁止省略 affectsRoleKeys 或 consequence。additionalCosts 与同章 resourceDeltas 不得重复扣同一笔资源。
- 每个状态第一次真实写入的章节必须等于蓝图 stateVariables.setInChapterKey。非默认结局所需的早期与后期状态必须在对应章节真实写入。
- 必须逐项执行 observedStateWritePlan：在指定章节用公共 stateWrites 写入唯一客观值；不得用 decision、失败分支或选项把 observed 状态改成别的值。
- 在某状态的 setInChapterKey 之前，任何 decision、onReadFail.stateWrites 或公共 stateWrites 都不得写该状态。
- 章节写入的枚举值必须来自对应 allowedValues，并至少覆盖每条非默认结局 requirements 使用的值，禁止制造不可达结局。
- 输出前在内部枚举每章选项组合：每条非默认路线必须存在一条完整路径同时满足全部条件，不能把分别可达的值拼成假路线。规则引用的前置条件必须全部出现在路线条件里。
- 必须逐项执行下方“装配骨架”：每名玩家只输出 playerActionChapterKeys 指定的章节且顺序一致；stateDecisionCoveragePlan 只包含 adjudicated/player-decision 状态，observed/derived 状态不得由玩家选项直接改写。未分配裁决状态的章节如果只选择资源、证据或事件效果，decision.stateKey 必须为空字符串，不能借用 observed 状态充当选择容器。
- chapterBeats[].triggerRoleKeys 必须逐章包含 requiredTriggerRoleKeysByChapter 的全部角色；不得因为某人的行动效果为空就漏掉其真实触发贡献。
- 必须逐项执行 roleEndingInfluences：influenceMode=direct 时，对应章节行动的 stateWriteKeys 必须包含指定 stateKey；influenceMode=causal-path 时，对应章节行动必须实际使用 causalAnchorKey：证据放进 evidenceKeys、资源放进 resourceKeys、事件放进 eventKeys、状态才放进 stateWriteKeys。该锚点只证明角色如何进入集体因果，不表示角色单独决定最终状态。
- chapterDecisionObligations 是逐章唯一装配表：decisionStateKeys 为空时不得产生 state effect；branchEventKeys 必须在该章各由一个选项触发；optionalResourceKeys 必须在该章形成“消费/保留”两条真实路径；observedStateWrites 只能作为公共 stateWrites。
- requiredBranchEvents 中每个事件必须恰好由登记章节的一个 decision option 用 event effect 触发；不能遗漏、提前触发或在多个选项重复触发。
- worldRules 只在各自 evaluationChapterKey 且全部前置条件同时成立时产生 effects；derived 状态只能由 derivedByRuleKey 指向的规则效果写入，公共 stateWrites、失败分支和玩家选项均不得直接赋值。event 类型的选项效果只能触发已登记的 branchEvents，不能重新触发 causalTimeline 中已经发生的事件。
- stateReads 必须基于前章真实分支设计，不再机械读取“最近一个状态”。有读取时 onReadFail 必须提供世界内替代行动和真实状态、资源或证据代价；没有读取时 entryConditionMode="none" 且失败结构为空。
- 每章 decision.key、question、choiceText、effects、immediateConsequence 与 onReadFail.fallbackAction 都必须完整具体；玩家可见文字禁止内部状态机语言。隐藏变化只能放 options[].effects，sets 保持空对象兼容位。
- 后端不会替你补选项、选择文案、状态值、资源消耗、证据来源或失败分支；任何缺失都会整份拒绝并从零重生。
- 前半段和后半段都必须写入会被蓝图结局读取的状态或资源，不能把全部因果推迟到最后一章。
- 不要输出自检、解释、Markdown 或任何额外字段。`;
  let user = `请为已锁定蓝图装配章节行动。不要重写蓝图，只返回规定的三个数组。

${untrustedUserPayload("规格", spec)}

${untrustedUserPayload("生成前批次合同", brief.generationContract || {})}

${untrustedUserPayload("已验收创作蓝图", blueprint)}`;
  user += `\n\n${untrustedUserPayload("装配不可变骨架；必须逐项照抄 key、章节和值，仅创作世界内动作与后果", assemblyScaffold)}`;
  if (Array.isArray(previousIssues) && previousIssues.length) {
    user += `\n\n${untrustedUserPayload("上一份章节装配被拒绝的原因；本次必须重写三个装配数组并逐项消除", previousIssues.slice(0, 20))}`;
  }
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function buildStoryOutlineAssemblyMechanicalPatchPlan(
  blueprint,
  assembly,
  issue,
  spec,
) {
  const focusedIssue = String(issue || "");
  const patches = [];
  const duplicateBranchMatch = focusedIssue.match(
    /分支事件\s+([\w-]+)\s+必须恰好由一个玩家选项触发/u,
  );
  if (duplicateBranchMatch) {
    const eventKey = duplicateBranchMatch[1];
    const locations = [];
    (Array.isArray(assembly?.chapterBeats)
      ? assembly.chapterBeats
      : []
    ).forEach((chapter, chapterIndex) => {
      (Array.isArray(chapter?.decision?.options)
        ? chapter.decision.options
        : []
      ).forEach((option, optionIndex) => {
        (Array.isArray(option?.effects) ? option.effects : []).forEach(
          (effect, effectIndex) => {
            if (
              effect?.targetType === "event" &&
              effect?.targetKey === eventKey &&
              effect?.operation === "trigger"
            ) {
              locations.push({
                chapterIndex,
                optionIndex,
                effectIndex,
                spendsResource: option.effects.some(
                  (candidate) =>
                    candidate?.targetType === "resource" &&
                    candidate?.operation === "lose",
                ),
              });
            }
          },
        );
      });
    });
    const keepIndex = Math.max(
      0,
      locations.findIndex((location) => location.spendsResource),
    );
    locations.forEach((location, index) => {
      if (index !== keepIndex)
        patches.push({
          op: "remove",
          path: `/chapterBeats/${location.chapterIndex}/decision/options/${location.optionIndex}/effects/${location.effectIndex}`,
        });
    });
  }
  const emptyEffectsMatch = focusedIssue.match(
    /^chapterBeats\[(\d+)\]\.decision\.options\[(\d+)\]\.effects 至少需要/u,
  );
  if (emptyEffectsMatch) {
    const chapterIndex = Number(emptyEffectsMatch[1]);
    const optionIndex = Number(emptyEffectsMatch[2]);
    const chapter = assembly?.chapterBeats?.[chapterIndex];
    const option = chapter?.decision?.options?.[optionIndex];
    if (
      chapter?.decision?.stateKey &&
      option?.sets?.stateKey === chapter.decision.stateKey &&
      option?.sets?.value
    ) {
      patches.push({
        op: "add",
        path: `/chapterBeats/${chapterIndex}/decision/options/${optionIndex}/effects/-`,
        value: {
          targetType: "state",
          targetKey: option.sets.stateKey,
          operation: "set",
          value: option.sets.value,
          amount: null,
          consequence: "该选择立即形成公开裁决，并改变后续可进入的结局程序。",
        },
      });
    } else {
      const evidenceKey =
        blueprint?.semanticConstitution?.worldRules?.[0]
          ?.auditEvidenceKeys?.[0] ||
        blueprint?.evidenceGraph?.evidence?.[0]?.key;
      if (evidenceKey)
        patches.push({
          op: "add",
          path: `/chapterBeats/${chapterIndex}/decision/options/${optionIndex}/effects/-`,
          value: {
            targetType: "evidence",
            targetKey: evidenceKey,
            operation: "lock",
            value: "",
            amount: null,
            consequence:
              "未启动正式程序后，联盟封存该项审查材料，后续不能再据此申请同类复核。",
          },
        });
    }
  }
  const branchActionMismatch = focusedIssue.match(
    /分支事件\s+([\w-]+) 的登记行为要求“(公开|复核席位)”/u,
  );
  if (branchActionMismatch) {
    const eventKey = branchActionMismatch[1];
    const branchEvent = (
      Array.isArray(blueprint?.semanticConstitution?.branchEvents)
        ? blueprint.semanticConstitution.branchEvents
        : []
    ).find((event) => event?.key === eventKey);
    const chapterIndex = (
      Array.isArray(assembly?.chapterBeats) ? assembly.chapterBeats : []
    ).findIndex((chapter) => chapter?.chapterKey === branchEvent?.chapterKey);
    const options =
      chapterIndex >= 0 &&
      Array.isArray(assembly.chapterBeats[chapterIndex]?.decision?.options)
        ? assembly.chapterBeats[chapterIndex].decision.options
        : [];
    let currentLocation = null;
    options.forEach((option, optionIndex) =>
      (Array.isArray(option?.effects) ? option.effects : []).forEach(
        (effect, effectIndex) => {
          if (effect?.targetType === "event" && effect?.targetKey === eventKey)
            currentLocation = { optionIndex, effectIndex };
        },
      ),
    );
    const preferredOptionIndex = options.findIndex((option) =>
      option?.effects?.some(
        (effect) =>
          effect?.targetType === "resource" && effect?.operation === "lose",
      ),
    );
    if (
      currentLocation &&
      preferredOptionIndex >= 0 &&
      preferredOptionIndex !== currentLocation.optionIndex
    ) {
      patches.push(
        {
          op: "remove",
          path: `/chapterBeats/${chapterIndex}/decision/options/${currentLocation.optionIndex}/effects/${currentLocation.effectIndex}`,
        },
        {
          op: "add",
          path: `/chapterBeats/${chapterIndex}/decision/options/${preferredOptionIndex}/effects/-`,
          value: {
            targetType: "event",
            targetKey: eventKey,
            operation: "trigger",
            value: "",
            amount: null,
            consequence: branchEvent.description,
          },
        },
      );
      if (
        branchActionMismatch[2] === "公开" &&
        !options[preferredOptionIndex].choiceText.includes("公开")
      ) {
        patches.push({
          op: "replace",
          path: `/chapterBeats/${chapterIndex}/decision/options/${preferredOptionIndex}/choiceText`,
          value: `${options[preferredOptionIndex].choiceText}并向联盟公开`,
        });
      }
    }
  }
  const deniedTriggerMatch = focusedIssue.match(
    /^chapterBeats\[(\d+)\]\.decision\.options\[(\d+)\]\.effects\[(\d+)\] 声称触发事件/u,
  );
  if (deniedTriggerMatch) {
    const chapterIndex = Number(deniedTriggerMatch[1]);
    const optionIndex = Number(deniedTriggerMatch[2]);
    const effectIndex = Number(deniedTriggerMatch[3]);
    const targetEffect =
      assembly?.chapterBeats?.[chapterIndex]?.decision?.options?.[optionIndex]
        ?.effects?.[effectIndex];
    const duplicateCount = (
      Array.isArray(assembly?.chapterBeats) ? assembly.chapterBeats : []
    ).flatMap((chapter) =>
      (Array.isArray(chapter?.decision?.options)
        ? chapter.decision.options
        : []
      ).flatMap((option) =>
        (Array.isArray(option?.effects) ? option.effects : []).filter(
          (effect) =>
            effect?.targetType === "event" &&
            effect?.targetKey === targetEffect?.targetKey,
        ),
      ),
    ).length;
    if (duplicateCount > 1)
      patches.push({
        op: "remove",
        path: `/chapterBeats/${chapterIndex}/decision/options/${optionIndex}/effects/${effectIndex}`,
      });
  }
  const stateChoiceConflictMatch = focusedIssue.match(
    /^chapterBeats\[(\d+)\]\.decision\.options\[(\d+)\]\.effects\[(\d+)\] 的待定状态与玩家可见选项/u,
  );
  if (stateChoiceConflictMatch) {
    const chapterIndex = Number(stateChoiceConflictMatch[1]);
    const optionIndex = Number(stateChoiceConflictMatch[2]);
    patches.push(
      {
        op: "replace",
        path: `/chapterBeats/${chapterIndex}/decision/options/${optionIndex}/choiceText`,
        value: "不消耗复核席位，暂缓最终裁定",
      },
      {
        op: "replace",
        path: `/chapterBeats/${chapterIndex}/decision/options/${optionIndex}/immediateConsequence`,
        value: "复核席位保留，赛果继续等待联盟裁定",
      },
    );
  }
  const anchorIssueMatch = focusedIssue.match(
    /^(.+?)\s+在\s+(chapter-\d+)\s+的行动没有使用因果锚点\s+([\w-]+)/u,
  );
  if (anchorIssueMatch) {
    const [, roleName, chapterKey, anchorKey] = anchorIssueMatch;
    const player = (
      Array.isArray(blueprint?.players) ? blueprint.players : []
    ).find((entry) => entry?.name === roleName.trim());
    const playerIndex = (
      Array.isArray(assembly?.playerChapterActions)
        ? assembly.playerChapterActions
        : []
    ).findIndex((entry) => entry?.roleKey === player?.key);
    const actionIndex =
      playerIndex >= 0
        ? (Array.isArray(
            assembly.playerChapterActions[playerIndex]?.chapterActions,
          )
            ? assembly.playerChapterActions[playerIndex].chapterActions
            : []
          ).findIndex((entry) => entry?.chapterKey === chapterKey)
        : -1;
    if (playerIndex >= 0 && actionIndex >= 0) {
      const current =
        assembly.playerChapterActions[playerIndex].chapterActions[actionIndex];
      patches.push({
        op: "replace",
        path: `/playerChapterActions/${playerIndex}/chapterActions/${actionIndex}/evidenceKeys`,
        value: Array.from(
          new Set([
            ...(Array.isArray(current?.evidenceKeys)
              ? current.evidenceKeys
              : []),
            anchorKey,
          ]),
        ),
      });
    }
  }
  const routeReachabilityMatch = focusedIssue.match(
    /^routes\[(\d+)\] 的条件虽然可能分别出现/u,
  );
  if (routeReachabilityMatch) {
    const route =
      blueprint?.endingLogic?.routes?.[Number(routeReachabilityMatch[1])];
    const requirements = Array.isArray(route?.requirements)
      ? route.requirements
      : [];
    const blockingChapter = (
      Array.isArray(assembly?.chapterBeats) ? assembly.chapterBeats : []
    ).findIndex((chapter) =>
      (Array.isArray(chapter?.stateReads) ? chapter.stateReads : []).some(
        (read) =>
          requirements.some(
            (requirement) =>
              requirement?.targetType === "state" &&
              requirement?.targetKey === read?.stateKey &&
              read?.operator === "equals" &&
              requirement?.operator === "equals" &&
              requirement?.value !== read?.value &&
              (Array.isArray(chapter?.onReadFail?.stateWrites)
                ? chapter.onReadFail.stateWrites
                : []
              ).some(
                (write) =>
                  write?.stateKey === requirement.targetKey &&
                  write?.value !== requirement.value,
              ),
          ),
      ),
    );
    if (blockingChapter >= 0) {
      patches.push(
        {
          op: "replace",
          path: `/chapterBeats/${blockingChapter}/stateReads`,
          value: [],
        },
        {
          op: "replace",
          path: `/chapterBeats/${blockingChapter}/onReadPass/variantKey`,
          value: "",
        },
        {
          op: "replace",
          path: `/chapterBeats/${blockingChapter}/onReadFail/variantKey`,
          value: "",
        },
        {
          op: "replace",
          path: `/chapterBeats/${blockingChapter}/onReadFail/fallbackAction`,
          value: "",
        },
        {
          op: "replace",
          path: `/chapterBeats/${blockingChapter}/onReadFail/stateWrites`,
          value: [],
        },
        {
          op: "replace",
          path: `/chapterBeats/${blockingChapter}/onReadFail/additionalCosts`,
          value: [],
        },
        {
          op: "replace",
          path: `/chapterBeats/${blockingChapter}/onReadFail/locksEvidenceKeys`,
          value: [],
        },
        {
          op: "replace",
          path: `/chapterBeats/${blockingChapter}/onReadFail/unlocksEvidenceKeys`,
          value: [],
        },
      );
    }
  }
  return patches;
}

export function buildStoryOutlineAssemblyPatchMessages(
  brief,
  spec,
  blueprint,
  assembly,
  issues,
) {
  const focusedIssue = String(Array.isArray(issues) ? issues[0] || "" : "");
  const blueprintPatchContext = {
    players: (Array.isArray(blueprint?.players) ? blueprint.players : []).map(
      (player) => ({
        key: player?.key,
        name: player?.name,
        contribution: player?.contribution,
        exclusiveAnchorKey: player?.exclusiveAnchorKey,
      }),
    ),
    entities: (Array.isArray(blueprint?.entities)
      ? blueprint.entities
      : []
    ).map((entity) => ({
      key: entity?.key,
      name: entity?.name,
      type: entity?.type,
    })),
    resources: blueprint?.resources || [],
    evidence: (Array.isArray(blueprint?.evidenceGraph?.evidence)
      ? blueprint.evidenceGraph.evidence
      : []
    ).map((entry) => ({
      key: entry?.key,
      sourceOwnerRoleKey: entry?.sourceOwnerRoleKey,
      supportsConclusionKeys: entry?.supportsConclusionKeys,
    })),
    stateVariables: blueprint?.endingLogic?.stateVariables || [],
    routes: blueprint?.endingLogic?.routes || [],
    branchEvents: blueprint?.semanticConstitution?.branchEvents || [],
    worldRules: blueprint?.semanticConstitution?.worldRules || [],
    signatureDevices: blueprint?.styleContract?.signatureDevices || [],
  };
  const issueGuidance = {
    issue: focusedIssue,
    requiredPatchPaths: [],
    forbiddenPatchPaths: [],
  };
  const stateIssueMatch = focusedIssue.match(
    /状态变量\s+([\w-]+)\.setInChapterKey/u,
  );
  if (stateIssueMatch) {
    const stateKey = stateIssueMatch[1];
    const stateDefinition = blueprintPatchContext.stateVariables.find(
      (entry) => entry?.key === stateKey,
    );
    const registeredIndex = spec.chapterKeys.indexOf(
      stateDefinition?.setInChapterKey,
    );
    issueGuidance.rule = `蓝图登记章节 ${stateDefinition?.setInChapterKey || ""} 不可修改；删除此前对 ${stateKey} 的全部 option state effects，禁止以 pending 或 unknown 占位。`;
    (Array.isArray(assembly?.chapterBeats)
      ? assembly.chapterBeats
      : []
    ).forEach((chapter, chapterIndex) => {
      if (registeredIndex < 0 || chapterIndex >= registeredIndex) return;
      (Array.isArray(chapter?.stateWrites) ? chapter.stateWrites : []).forEach(
        (write, writeIndex) => {
          if (write?.stateKey === stateKey) {
            issueGuidance.requiredPatchPaths.push({
              op: "remove",
              path: `/chapterBeats/${chapterIndex}/stateWrites/${writeIndex}`,
            });
          }
        },
      );
      (Array.isArray(chapter?.decision?.options)
        ? chapter.decision.options
        : []
      ).forEach((option, optionIndex) => {
        (Array.isArray(option?.effects) ? option.effects : []).forEach(
          (effect, effectIndex) => {
            if (
              effect?.targetType === "state" &&
              effect?.targetKey === stateKey
            ) {
              issueGuidance.requiredPatchPaths.push({
                op: "remove",
                path: `/chapterBeats/${chapterIndex}/decision/options/${optionIndex}/effects/${effectIndex}`,
              });
            }
          },
        );
      });
    });
  }
  const emptyDecisionStateMatch = focusedIssue.match(
    /^chapterBeats\[(\d+)\]\.decision\.stateKey 必须为空/u,
  );
  if (emptyDecisionStateMatch) {
    const chapterIndex = Number(emptyDecisionStateMatch[1]);
    issueGuidance.rule =
      "本章所有选项都未裁决状态，decision.stateKey 必须清空；不要为了保留 stateKey 补造新的状态效果。";
    issueGuidance.requiredPatchPaths.push({
      op: "replace",
      path: `/chapterBeats/${chapterIndex}/decision/stateKey`,
      value: "",
    });
  }
  const invalidAdditionalCostMatch = focusedIssue.match(
    /^chapterBeats\[(\d+)\]\.onReadFail\.additionalCosts\[(\d+)\]\.resourceKey 引用未登记资源/u,
  );
  if (invalidAdditionalCostMatch) {
    const chapterIndex = Number(invalidAdditionalCostMatch[1]);
    const costIndex = Number(invalidAdditionalCostMatch[2]);
    issueGuidance.rule =
      "失败分支不得用空 key 或临时资源制造代价；删除这项未登记 additionalCost，不得创建新资源。";
    issueGuidance.requiredPatchPaths.push({
      op: "remove",
      path: `/chapterBeats/${chapterIndex}/onReadFail/additionalCosts/${costIndex}`,
    });
  }
  const anchorIssueMatch = focusedIssue.match(
    /^(.+?)\s+在\s+(chapter-\d+)\s+的行动没有使用因果锚点\s+([\w-]+)/u,
  );
  if (anchorIssueMatch) {
    const [, roleName, chapterKey, anchorKey] = anchorIssueMatch;
    const player = blueprintPatchContext.players.find(
      (entry) => entry?.name === roleName.trim(),
    );
    const playerIndex = (
      Array.isArray(assembly?.playerChapterActions)
        ? assembly.playerChapterActions
        : []
    ).findIndex((entry) => entry?.roleKey === player?.key);
    const actionIndex =
      playerIndex >= 0
        ? (Array.isArray(
            assembly.playerChapterActions[playerIndex]?.chapterActions,
          )
            ? assembly.playerChapterActions[playerIndex].chapterActions
            : []
          ).findIndex((entry) => entry?.chapterKey === chapterKey)
        : -1;
    if (playerIndex >= 0 && actionIndex >= 0) {
      const current =
        assembly.playerChapterActions[playerIndex].chapterActions[actionIndex];
      issueGuidance.rule = `该行动必须实际读取因果锚点 ${anchorKey}，不要改动其他角色或章节。`;
      issueGuidance.requiredPatchPaths.push({
        op: "replace",
        path: `/playerChapterActions/${playerIndex}/chapterActions/${actionIndex}/evidenceKeys`,
        value: Array.from(
          new Set([
            ...(Array.isArray(current?.evidenceKeys)
              ? current.evidenceKeys
              : []),
            anchorKey,
          ]),
        ),
      });
    }
  }
  const resourceIssueMatch = focusedIssue.match(
    /^(.+?)\.(chapter-\d+)\s+声称改变资源\s+([\w-]+)/u,
  );
  if (resourceIssueMatch) {
    const [, roleName, chapterKey, resourceKey] = resourceIssueMatch;
    const player = blueprintPatchContext.players.find(
      (entry) => entry?.name === roleName.trim(),
    );
    const playerIndex = (
      Array.isArray(assembly?.playerChapterActions)
        ? assembly.playerChapterActions
        : []
    ).findIndex((entry) => entry?.roleKey === player?.key);
    const actionIndex =
      playerIndex >= 0
        ? (Array.isArray(
            assembly.playerChapterActions[playerIndex]?.chapterActions,
          )
            ? assembly.playerChapterActions[playerIndex].chapterActions
            : []
          ).findIndex((entry) => entry?.chapterKey === chapterKey)
        : -1;
    if (playerIndex >= 0 && actionIndex >= 0) {
      const current =
        assembly.playerChapterActions[playerIndex].chapterActions[actionIndex];
      issueGuidance.rule = `本章没有公共资源变化；删除角色行动对 ${resourceKey} 的虚假资源声明，不得给本章补造 resourceDeltas。`;
      issueGuidance.requiredPatchPaths.push({
        op: "replace",
        path: `/playerChapterActions/${playerIndex}/chapterActions/${actionIndex}/resourceKeys`,
        value: (Array.isArray(current?.resourceKeys)
          ? current.resourceKeys
          : []
        ).filter((key) => key !== resourceKey),
      });
    }
  }
  const branchIssueMatch = focusedIssue.match(
    /分支事件\s+([\w-]+)\s+只能在登记章节\s+(chapter-\d+)\s+触发/u,
  );
  if (branchIssueMatch) {
    const [, eventKey, registeredChapterKey] = branchIssueMatch;
    issueGuidance.rule = `${eventKey} 只能在 ${registeredChapterKey} 触发；remove 其他章节中以 targetType=event、targetKey=${eventKey}、operation=trigger 写成的 effect。`;
    (Array.isArray(assembly?.chapterBeats)
      ? assembly.chapterBeats
      : []
    ).forEach((chapter, chapterIndex) => {
      if (chapter?.chapterKey === registeredChapterKey) return;
      (Array.isArray(chapter?.decision?.options)
        ? chapter.decision.options
        : []
      ).forEach((option, optionIndex) => {
        (Array.isArray(option?.effects) ? option.effects : []).forEach(
          (effect, effectIndex) => {
            if (
              effect?.targetType === "event" &&
              effect?.targetKey === eventKey &&
              effect?.operation === "trigger"
            ) {
              issueGuidance.requiredPatchPaths.push({
                op: "remove",
                path: `/chapterBeats/${chapterIndex}/decision/options/${optionIndex}/effects/${effectIndex}`,
              });
            }
          },
        );
      });
    });
  }
  const duplicateBranchMatch = focusedIssue.match(
    /分支事件\s+([\w-]+)\s+必须恰好由一个玩家选项触发/u,
  );
  if (duplicateBranchMatch) {
    const eventKey = duplicateBranchMatch[1];
    const triggerLocations = [];
    (Array.isArray(assembly?.chapterBeats)
      ? assembly.chapterBeats
      : []
    ).forEach((chapter, chapterIndex) => {
      (Array.isArray(chapter?.decision?.options)
        ? chapter.decision.options
        : []
      ).forEach((option, optionIndex) => {
        (Array.isArray(option?.effects) ? option.effects : []).forEach(
          (effect, effectIndex) => {
            if (
              effect?.targetType === "event" &&
              effect?.targetKey === eventKey &&
              effect?.operation === "trigger"
            ) {
              const spendsContractResource = option.effects.some(
                (candidate) =>
                  candidate?.targetType === "resource" &&
                  candidate?.operation === "lose",
              );
              triggerLocations.push({
                chapterIndex,
                optionIndex,
                effectIndex,
                spendsContractResource,
              });
            }
          },
        );
      });
    });
    const keepIndex = Math.max(
      0,
      triggerLocations.findIndex((location) => location.spendsContractResource),
    );
    issueGuidance.rule = `${eventKey} 只能保留一个真实触发选项；若事件描述涉及动用正式复核或重赛资格，保留实际消费题材资源的选项，remove 其余 event effect。`;
    triggerLocations.forEach((location, index) => {
      if (index === keepIndex) return;
      issueGuidance.requiredPatchPaths.push({
        op: "remove",
        path: `/chapterBeats/${location.chapterIndex}/decision/options/${location.optionIndex}/effects/${location.effectIndex}`,
      });
    });
  }
  const deniedTriggerMatch = focusedIssue.match(
    /^chapterBeats\[(\d+)\]\.decision\.options\[(\d+)\]\.effects\[(\d+)\] 声称触发事件/u,
  );
  if (deniedTriggerMatch) {
    const chapterIndex = Number(deniedTriggerMatch[1]);
    const optionIndex = Number(deniedTriggerMatch[2]);
    const effectIndex = Number(deniedTriggerMatch[3]);
    const targetEffect =
      assembly?.chapterBeats?.[chapterIndex]?.decision?.options?.[optionIndex]
        ?.effects?.[effectIndex];
    const duplicateCount = (
      Array.isArray(assembly?.chapterBeats) ? assembly.chapterBeats : []
    ).flatMap((chapter) =>
      (Array.isArray(chapter?.decision?.options)
        ? chapter.decision.options
        : []
      ).flatMap((option) =>
        (Array.isArray(option?.effects) ? option.effects : []).filter(
          (effect) =>
            effect?.targetType === "event" &&
            effect?.targetKey === targetEffect?.targetKey,
        ),
      ),
    ).length;
    issueGuidance.rule =
      "event trigger 的 consequence 不能写成未触发。若同一事件已由另一个选项触发，删除当前矛盾 effect；否则把 consequence 改成明确发生的世界内结果。";
    if (duplicateCount > 1) {
      issueGuidance.requiredPatchPaths.push({
        op: "remove",
        path: `/chapterBeats/${chapterIndex}/decision/options/${optionIndex}/effects/${effectIndex}`,
      });
    }
  }
  const stateChoiceConflictMatch = focusedIssue.match(
    /^chapterBeats\[(\d+)\]\.decision\.options\[(\d+)\]\.effects\[(\d+)\] 的待定状态与玩家可见选项/u,
  );
  if (stateChoiceConflictMatch) {
    const chapterIndex = Number(stateChoiceConflictMatch[1]);
    const optionIndex = Number(stateChoiceConflictMatch[2]);
    issueGuidance.rule =
      "状态仍为待定时，玩家文案不得声称已经接受、拒绝或正式裁定；保留隐藏状态值，改写可见选择和即时后果为暂缓裁定。";
    issueGuidance.requiredPatchPaths.push(
      {
        op: "replace",
        path: `/chapterBeats/${chapterIndex}/decision/options/${optionIndex}/choiceText`,
        value: "不消耗复核席位，暂缓最终裁定",
      },
      {
        op: "replace",
        path: `/chapterBeats/${chapterIndex}/decision/options/${optionIndex}/immediateConsequence`,
        value: "复核席位保留，赛果继续等待联盟裁定",
      },
    );
  }
  const routeReachabilityMatch = focusedIssue.match(
    /^routes\[(\d+)\] 的条件虽然可能分别出现/u,
  );
  if (routeReachabilityMatch) {
    const routeIndex = Number(routeReachabilityMatch[1]);
    const route = blueprintPatchContext.routes[routeIndex];
    const requirements = Array.isArray(route?.requirements)
      ? route.requirements
      : [];
    const blockingChapter = (
      Array.isArray(assembly?.chapterBeats) ? assembly.chapterBeats : []
    ).findIndex((chapter) =>
      (Array.isArray(chapter?.stateReads) ? chapter.stateReads : []).some(
        (read) =>
          requirements.some(
            (requirement) =>
              requirement?.targetType === "state" &&
              requirement?.targetKey === read?.stateKey &&
              read?.operator === "equals" &&
              requirement?.operator === "equals" &&
              requirement?.value !== read?.value &&
              (Array.isArray(chapter?.onReadFail?.stateWrites)
                ? chapter.onReadFail.stateWrites
                : []
              ).some(
                (write) =>
                  write?.stateKey === requirement.targetKey &&
                  write?.value !== requirement.value,
              ),
          ),
      ),
    );
    if (blockingChapter >= 0) {
      issueGuidance.rule = `路线 ${route?.key || routeIndex} 被 chapterBeats[${blockingChapter}] 的入口失败分支改写了已经裁决的结局状态。该章必须允许此前所有合法裁决继续进入；清空入口读条件和失败覆盖，不得修改蓝图路线。`;
      issueGuidance.requiredPatchPaths.push(
        {
          op: "replace",
          path: `/chapterBeats/${blockingChapter}/stateReads`,
          value: [],
        },
        {
          op: "replace",
          path: `/chapterBeats/${blockingChapter}/onReadPass/variantKey`,
          value: "",
        },
        {
          op: "replace",
          path: `/chapterBeats/${blockingChapter}/onReadFail/variantKey`,
          value: "",
        },
        {
          op: "replace",
          path: `/chapterBeats/${blockingChapter}/onReadFail/fallbackAction`,
          value: "",
        },
        {
          op: "replace",
          path: `/chapterBeats/${blockingChapter}/onReadFail/stateWrites`,
          value: [],
        },
        {
          op: "replace",
          path: `/chapterBeats/${blockingChapter}/onReadFail/additionalCosts`,
          value: [],
        },
        {
          op: "replace",
          path: `/chapterBeats/${blockingChapter}/onReadFail/locksEvidenceKeys`,
          value: [],
        },
        {
          op: "replace",
          path: `/chapterBeats/${blockingChapter}/onReadFail/unlocksEvidenceKeys`,
          value: [],
        },
      );
    } else {
      issueGuidance.rule = `逐章检查路线 ${route?.key || routeIndex} 的全部 requirements 是否能由同一组选项共同形成；只能修复冲突选项的隐藏 effects、stateReads 或失败覆盖，不得润色 consequence 代替因果修复。`;
      issueGuidance.routeRequirements = requirements;
    }
  }
  const system = `你是互动叙事章节装配的定点校对器。${PRODUCT_BOUNDARY}
只输出一个 JSON 对象，形状必须为 {"patches":[{"op":"replace|add|remove","path":"/JSON/Pointer","value":"仅 add/replace 需要"}]}。
只能修复所列章节装配问题；不得修改蓝图、人物姓名、真相、责任链、事实、授权、证据定义、状态定义、世界规则、结局路线或批次指纹。
装配根字段只有 ${OUTLINE_ASSEMBLY_ROOT_POINTERS.join("、")}。path 必须从这三个根之一开始；数组使用十进制下标。不要输出完整装配、解释、Markdown 或自检。
每条 path 的数组下标必须在“待定点修复的章节装配”中真实存在；若某章只有 options[0] 与 options[1]，禁止写 /options/2。需要增加新选项时才可对 /options/- 使用 add，但优先修正现有选项。
本次错误清单只会包含一个问题。patches 最多 8 项，只能处理这个问题及其不可分割依赖；解决后立即停止输出。禁止遍历并“顺手规范化”其他角色或章节；禁止 replace 整个 ${OUTLINE_ASSEMBLY_ROOT_POINTERS.join("、")}、整个角色、整章或整个 chapterActions 数组。每条补丁尽量落到 commitmentMode、evidenceKeys、effects、question、fallbackAction 等叶子字段。

修复原则：
- proposal 行动若只是提出方案，清空其 stateWriteKeys/resourceKeys/evidenceEffectKeys；若确实执行已出现的选项，改为 conditional 并同时填写真实 decisionKey 和 optionKeys，不能只改 commitmentMode。
- decision option 的 effects 不能为空。第1章必须通过世界内选择触发 branch-1，并在消费赛事认证复核席位的选项之外保留一个不消费资源但会锁定/解锁证据或触发事件的真实效果；第5章同理触发 branch-2。event effect 使用 operation="trigger"。
- 蓝图 stateVariables.setInChapterKey 不可修改。若错误指出某状态“必须等于首次真实写入章节”，唯一修法是 remove 该状态在登记章节之前的所有 state effects；禁止在早期章节写 pending、unknown 或任何其他值来占位。删除提早 effect 后，再在蓝图登记章节的 decision options 中覆盖该状态被结局实际读取的合法值。
- observed 状态只允许公共 stateWrites 写合同固定真值；玩家选项不能改写。
- 修复可达性时只能协调现有章节选项的隐藏 effects、stateReads 与资源消费，不得修改蓝图 routes。每条路线的全部条件必须能在同一选项路径上同时成立。
- 玩家可见的 question、choiceText、immediateConsequence、fallbackAction 禁止内部 key、枚举英文和路线术语；每段至少写清世界内行为与可见后果。
- roleEndingInfluences 为 causal-path 时，必须在指定章节行动的 evidenceKeys/resourceKeys/eventKeys/stateWriteKeys 中落实 causalAnchorKey；只读取或质证证据时放 evidenceKeys，不得误放 evidenceEffectKeys。
- 所有结构化效果必须引用蓝图已登记 key，consequence 至少八个汉字；资源在合同 optionalUseChapterKeys 指定章节形成消费/保留两条路径，任一路径都不得越过上下限。`;
  const user = `${untrustedUserPayload("规格、生成前合同与不可修改蓝图注册表", {
    spec,
    generationContract: brief.generationContract || {},
    blueprint: blueprintPatchContext,
  })}

${untrustedUserPayload("待定点修复的章节装配", assembly)}

${untrustedUserPayload("本问题的机器定位提示；若 requiredPatchPaths 非空，逐项原样执行，不得反向改写", issueGuidance)}

${untrustedUserPayload("仅允许修复的装配问题", Array.isArray(issues) ? issues.slice(0, 30) : [])}`;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function buildStoryOutlineAssemblyComponentMessages(
  brief,
  spec,
  blueprint,
  component,
  previousIssues = [],
) {
  const generationContract = brief.generationContract || {};
  const stateVariables = Array.isArray(blueprint?.endingLogic?.stateVariables)
    ? blueprint.endingLogic.stateVariables
    : [];
  const routes = Array.isArray(blueprint?.endingLogic?.routes)
    ? blueprint.endingLogic.routes
    : [];
  const stateDecisionCoveragePlan = stateVariables.map((state) => ({
    chapterKey: state.setInChapterKey,
    stateKey: state.key,
    optionValues: [
      ...new Set([
        ...routes.flatMap((route) =>
          Array.isArray(route?.requirements)
            ? route.requirements
                .filter(
                  (requirement) =>
                    requirement?.targetType === "state" &&
                    requirement?.targetKey === state.key,
                )
                .map((requirement) => requirement.value)
            : [],
        ),
        ...(Array.isArray(state.allowedValues) ? state.allowedValues : []),
      ]),
    ],
  }));
  const fallbackStateWritePlan = spec.chapterKeys.map(
    (chapterKey, chapterIndex) => {
      const state = stateVariables
        .filter(
          (candidate) =>
            spec.chapterKeys.indexOf(candidate?.setInChapterKey) < chapterIndex,
        )
        .at(-1);
      return {
        chapterKey,
        whenStateReadsPresent: state
          ? { stateKey: state.key, operation: "set", value: state.initialValue }
          : null,
      };
    },
  );
  const stateReadPlan = fallbackStateWritePlan.map((entry) => ({
    chapterKey: entry.chapterKey,
    stateReads: entry.whenStateReadsPresent
      ? [
          {
            stateKey: entry.whenStateReadsPresent.stateKey,
            operator: "not_equals",
            value: entry.whenStateReadsPresent.value,
          },
        ]
      : [],
    entryConditionMode: entry.whenStateReadsPresent ? "all" : "none",
    onReadPassVariantKey: entry.whenStateReadsPresent
      ? `${entry.chapterKey}-condition-pass`
      : "",
    onReadFailVariantKey: entry.whenStateReadsPresent
      ? `${entry.chapterKey}-condition-fail`
      : "",
  }));
  const resourceUsagePlans = Array.isArray(
    generationContract.resourceUsagePlans,
  )
    ? generationContract.resourceUsagePlans
    : [];
  const roleEndingInfluences = Array.isArray(
    generationContract.roleEndingInfluences,
  )
    ? generationContract.roleEndingInfluences
    : [];
  const chapterComponentScaffold = spec.chapterKeys.map((chapterKey) => {
    const readPlan = stateReadPlan.find(
      (entry) => entry.chapterKey === chapterKey,
    );
    const decisions = stateDecisionCoveragePlan.filter(
      (entry) => entry.chapterKey === chapterKey,
    );
    const establishedStateKeys = stateVariables
      .filter(
        (state) =>
          spec.chapterKeys.indexOf(state?.setInChapterKey) <
          spec.chapterKeys.indexOf(chapterKey),
      )
      .map((state) => state.key);
    return {
      chapterKey,
      stateReads: readPlan?.stateReads || [],
      entryConditionMode: readPlan?.entryConditionMode || "none",
      onReadPass: {
        variantKey: readPlan?.onReadPassVariantKey || "",
        requiredFields: ["variantKey", "effectSummary"],
      },
      onReadFail: {
        variantKey: readPlan?.onReadFailVariantKey || "",
        requiredFields: [
          "variantKey",
          "fallbackAction",
          "stateWrites",
          "additionalCosts",
          "locksEvidenceKeys",
          "unlocksEvidenceKeys",
        ],
        stateWrites: establishedStateKeys.length
          ? "恰好一项，引用 establishedStateKeys 中的合法枚举值"
          : [],
        establishedStateKeys,
        additionalCosts: [],
        locksEvidenceKeys: [],
        unlocksEvidenceKeys: [],
      },
      requiredDecisionContracts: decisions,
      requiredPublicStateWriteKeys: [
        ...new Set(
          roleEndingInfluences
            .filter((entry) => entry?.chapterKey === chapterKey)
            .map((entry) => entry?.stateKey)
            .filter(Boolean),
        ),
      ],
      requiredResourceDeltas: resourceUsagePlans
        .filter(
          (plan) =>
            Array.isArray(plan?.chapterKeys) &&
            plan.chapterKeys.includes(chapterKey),
        )
        .map((plan) => ({
          resourceKey: plan.resourceKey,
          operation: plan.operation,
          amount: plan.amount,
        })),
    };
  });
  const payloadBase = {
    spec,
    generationContract,
    blueprint,
  };
  const playerActionScaffold = (
    Array.isArray(blueprint?.players) ? blueprint.players : []
  ).map((player) => {
    const actionPlan = (
      Array.isArray(generationContract.roleActionChapterKeys)
        ? generationContract.roleActionChapterKeys
        : []
    ).find((entry) => entry?.roleKey === player?.key);
    const influence = (
      Array.isArray(generationContract.roleEndingInfluences)
        ? generationContract.roleEndingInfluences
        : []
    ).find((entry) => entry?.roleKey === player?.key);
    return {
      roleKey: player?.key,
      requiredAffectsRoleKeys: Array.isArray(
        player?.contribution?.affectsRoleKeys,
      )
        ? player.contribution.affectsRoleKeys
        : [],
      chapterActions: (Array.isArray(actionPlan?.chapterKeys)
        ? actionPlan.chapterKeys
        : []
      ).map((chapterKey) => ({
        chapterKey,
        stateWriteKeys:
          influence?.chapterKey === chapterKey ? [influence.stateKey] : [],
        resourceKeys: [],
        evidenceEffectKeys: [],
      })),
    };
  });
  let system = "";
  const field = getOutlineAssemblyField(component);
  if (!field)
    throw new Error(`Unknown outline assembly component: ${component}`);

  if (component === "playerActions") {
    system = `你是互动叙事产品的玩家行动设计师。${PRODUCT_BOUNDARY}
只输出一个 JSON 对象，顶层必须且只能包含 playerChapterActions。
外壳必须严格采用 {"playerChapterActions":[{"roleKey":"role-1","chapterActions":[]}]}：playerChapterActions 必须是 JSON 数组，不能改成以 role-1 等 key 组成的对象映射。
playerChapterActions 按蓝图玩家顺序输出，每项为 {"roleKey":"role-1","chapterActions":[...]}。
每个 action 必须完整包含 chapterKey、action、actionTarget、actionTargetKey、method、consequence、stateWriteKeys、resourceKeys、evidenceEffectKeys、affectsRoleKeys、evidenceKeys。
必须逐项照抄 generationContract.roleActionChapterKeys 的章节和顺序；不得多章、少章或换章。
必须逐项照抄 generationContract.roleEndingInfluences：该角色位于 influence.chapterKey 的 action.stateWriteKeys 必须且只能为 [influence.stateKey]，该角色其他 action.stateWriteKeys=[]。
必须逐角色逐章照抄 playerActionScaffold。同一个 action 的 chapterKey、stateWriteKeys、resourceKeys、evidenceEffectKeys 均以骨架同一行为唯一准则，不得跨表自行推断；每个 action.affectsRoleKeys 至少包含该角色 requiredAffectsRoleKeys 中的一名其他玩家。
所有 action.evidenceEffectKeys 和 action.resourceKeys 都固定输出 []。证据开关与公共资源变化只由 chapterBeats 组件负责；玩家可以在 action、method、consequence 的世界内文字中说明谁发起复核、消耗席位或承受代价，但不得在个人行动结构里重复声明资源变化。
action 必须是世界内具体动作，写明动词、对象与方法；禁止只写调查、质问、交换信息、寻找真相。每名玩家至少一次改变另一玩家的权限、资源或选择。
只能引用蓝图已登记 key；不得输出 chapterBeats、styleChapterExpressions、蓝图字段、自检、Markdown。后端不会补写或改写行动。`;
  } else if (component === "chapterBeats") {
    const progressModes = {
      mystery: ["evidence", "mixed"],
      emotional: ["relationship", "commitment", "memory", "mixed"],
      political: ["resource", "authority", "alliance", "mixed"],
      variety: ["task", "performance", "audience", "mixed"],
      survival: ["resource", "risk", "mixed"],
      hybrid: [
        "evidence",
        "relationship",
        "commitment",
        "memory",
        "resource",
        "authority",
        "alliance",
        "task",
        "performance",
        "audience",
        "risk",
        "mixed",
      ],
    }[blueprint?.genreProfile?.mode] || ["mixed"];
    system = `你是互动叙事产品的章节状态与选择设计师。${PRODUCT_BOUNDARY}
只输出一个 JSON 对象，顶层必须且只能包含 chapterBeats。外壳必须严格采用 {"chapterBeats":[{"chapterKey":"chapter-1"},{"chapterKey":"chapter-2"}]} 这种数组形状：chapterBeats 必须是 JSON 数组，绝不能输出 {"chapter-1":{...},"chapter-2":{...}} 这种章节 key 对象映射。
数组必须恰好 ${spec.chapterKeys.length} 项，并按 ${spec.chapterKeys.join("、")} 顺序输出，每个章节对象各出现一次。
每章必须包含 chapterKey、title、goal、turn、hostNotes、triggerRoleKeys、playerAction、actionObject、actionTargetKey、irreversibleConsequence、nextState、progressMode、stateReads、entryConditionMode、onReadPass、onReadFail、stateWrites、unlocksEvidenceKeys、locksEvidenceKeys、resourceDeltas、evidenceKeys、genreMechanicUse、sharedSpotlightConflict、decision。
progressMode 只能从 ${progressModes.join("、")} 中选择；不得自造 decision、state-change、investigation 等值。turn 至少写成一个包含玩家行为与局面后果的完整句子，不能只写“选择”“转折”或状态名。
decision 必须包含 interaction，并从 group_choice、resource_tradeoff、evidence_selection、sequence_reconstruction、timed_crisis、role_commitment、secret_ballot、free_ranking、numeric_allocation 中选择 kind；同时填写题材内 label、playerInstruction、hostInstruction、deadlineSeconds、defaultOptionKey、resourceKey、allocationTotal 和 allocationUnitLabel。timed_crisis 的 deadlineSeconds 必须大于0且 defaultOptionKey 必须引用本决策一个真实选项；其他类型这两个字段均为空或0。role_commitment、secret_ballot、free_ranking 与 numeric_allocation 的玩家答案都只对本人和主持人可见；numeric_allocation 的 allocationTotal 必须为正整数。每个选项必须包含 presentation：eyebrow、publicPreview、costLabel、riskLabel、sequenceLabel。decision 至少两个选项；玩家可见文本禁止 state-、resource-、chapter-、写入状态、verified、contested、broken、unlocked、locked 等内部词。
必须逐项执行 stateDecisionCoveragePlan：在指定章节用指定 stateKey，并让 optionValues 每个值都有一个对应选项；只有隐藏 sets 可出现枚举值。其他章节可选择此前已登记状态形成真实选择。
必须逐项执行 generationContract.resourceUsagePlans：资源只在指定章节的 resourceDeltas 各变化一次，operation/amount 完全一致；每项完整写出 {"resourceKey":"计划key","operation":"计划值","amount":计划数字,"affectsRoleKeys":["至少一名实际受影响玩家"],"consequence":"至少八字的世界内资源变化后果"}。其他章节不得使用该资源；所有 onReadFail.additionalCosts=[]。
必须逐章照抄 chapterComponentScaffold，一个章节对象只能对应其中同 chapterKey 的一行：stateReads、entryConditionMode、onReadPass.variantKey、onReadFail.variantKey、requiredPublicStateWriteKeys 和 requiredResourceDeltas 都不得遗漏、改值或移到别章。不要在多个计划表之间自行重组。
onReadPass 的形状固定为 {"variantKey":"照抄骨架","effectSummary":"至少八字的世界内通过效果"}，不得把 fallbackAction、stateWrites 或其他失败字段塞进 onReadPass。onReadFail 必须包含 variantKey、fallbackAction、stateWrites、additionalCosts、locksEvidenceKeys、unlocksEvidenceKeys。stateReads 非空时，fallbackAction 至少十二字并写清玩家如何继续，stateWrites 恰好一项：引用本章开始前已经建立的任一状态，operation="set"，value 来自该状态 allowedValues；其余三个数组固定为空。stateReads 为空时两个 variantKey 可为空，onReadFail 的四个结构化数组全部为空。
genreMechanicUse 必须逐字采用“触发：具体条件；判定：公开步骤；成功：可见结果；失败：可见代价”四段格式，一个标签都不能少；nextState 必须说明下游实际读取的状态、资源、证据、权限或关系。
只能引用蓝图已登记 key；不得输出 playerChapterActions、styleChapterExpressions、蓝图字段、自检、Markdown。后端不会补写选项、状态或资源。`;
    payloadBase.stateDecisionCoveragePlan = stateDecisionCoveragePlan;
    payloadBase.fallbackStateWritePlan = fallbackStateWritePlan;
    payloadBase.stateReadPlan = stateReadPlan;
    payloadBase.chapterComponentScaffold = chapterComponentScaffold;
  } else if (component === "styleExpressions") {
    system = `你是互动叙事产品的逐章文风设计师。${PRODUCT_BOUNDARY}
只输出一个 JSON 对象，顶层必须且只能包含 styleChapterExpressions。外壳必须严格采用 {"styleChapterExpressions":[{"chapterKey":"chapter-1","device":"...","sceneOrDialogue":"..."}]}：styleChapterExpressions 必须是 JSON 数组，不能改成以章节 key 组成的对象映射。
数组必须恰好 ${spec.chapterKeys.length} 项，并按 ${spec.chapterKeys.join("、")} 顺序输出，每个章节对象各出现一次。
每项必须为 {"chapterKey":"chapter-1","device":"逐字引用 blueprint.styleContract.signatureDevices 中一项","sceneOrDialogue":"可直接扩写的场景、叙述动作或对白"}。
sceneOrDialogue 必须体现该题材的时代、语感、媒介或表演机制，不能只复述“使用某某风格”。不得输出玩家行动、状态机、蓝图字段、自检或 Markdown。`;
  }

  if (component === "playerActions")
    payloadBase.playerActionScaffold = playerActionScaffold;

  let user = `${untrustedUserPayload(`V2.3 ${component} 专用生成材料`, payloadBase)}

${untrustedUserPayload("本次唯一允许的顶层字段", { field })}`;
  if (Array.isArray(previousIssues) && previousIssues.length) {
    user += `\n\n${untrustedUserPayload("上一份相关组件被拒绝的原因；只重写本组件并逐项消除", previousIssues.slice(0, 20))}`;
  }
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
