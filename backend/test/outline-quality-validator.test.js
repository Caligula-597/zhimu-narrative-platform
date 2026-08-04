import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeStoryBrief,
  mergeStoryOutlineAssembly,
  validateStoryOutlineAssemblyComponent,
  validateStoryOutlineBlueprint,
  validateOutlineBatchDiversity,
  validateStoryOutline,
  validateStorySpec
} from "../src/deepseek.js";
import {
  buildStoryOutlineAssemblyMessages,
  buildStoryOutlineAssemblyMechanicalPatchPlan,
  buildStoryOutlineAssemblyComponentMessages,
  buildStoryOutlineBlueprintMessages,
  buildStoryOutlineMessages
} from "../src/prompts/outline.js";

const brief = normalizeStoryBrief({ title: "回声庭审", chapterCount: 2, playerCount: 4 });
const spec = validateStorySpec({
  title: "回声庭审",
  playerCount: 4,
  chapterCount: 2,
  chapterKeys: ["chapter-1", "chapter-2"],
  constraints: [],
  notes: []
}, brief);

test("generation contract preserves positional duplicate contribution types", () => {
  const normalized = normalizeStoryBrief({
    playerCount: 6,
    generationContract: {
      contributionTypes: ["evidence", "authority", "task", "relationship", "commitment", "evidence"],
      resourceUsagePlans: [{
        resourceKey: "resource-review",
        chapterKeys: ["chapter-1", "chapter-3", "chapter-4"],
        operation: "lose",
        amount: 1,
        placement: "chapterBeats.resourceDeltas"
      }]
    }
  });
  assert.deepEqual(normalized.generationContract.contributionTypes, [
    "evidence",
    "authority",
    "task",
    "relationship",
    "commitment",
    "evidence"
  ]);
  assert.deepEqual(normalized.generationContract.resourceUsagePlans[0], {
    resourceKey: "resource-review",
    chapterKeys: ["chapter-1", "chapter-3", "chapter-4"],
    operation: "lose",
    amount: 1,
    placement: "chapterBeats.resourceDeltas"
  });
});

test("blueprint prompt includes a prefilled immutable contract scaffold", () => {
  const contractedBrief = normalizeStoryBrief({
    title: "回声庭审",
    playerCount: 4,
    chapterCount: 2,
    generationContract: {
      playerNames: ["甲川", "乙宁", "丙衡", "丁岚"],
      playerIdentityRequirements: ["庭审记录员", "辩护律师", "法警", "证人保护员"],
      contributionTypes: ["evidence", "authority", "task", "relationship"],
      spotlightChapterKeys: ["chapter-1", "chapter-1", "chapter-2", "chapter-2"],
      stateKeys: ["state-a", "state-b"],
      stateTypes: ["enum", "enum"],
      stateSetChapterKeys: ["chapter-1", "chapter-2"],
      resourceKeys: ["resource-review"],
      resourceContracts: [{
        key: "resource-review",
        name: "正式复核席位",
        meaning: "全组能够发起正式复核的剩余席位",
        initialValue: 3,
        minimum: 0,
        maximum: 3,
        ownerType: "group",
        ownerKey: "",
        recoverable: false
      }],
      resourceUsagePlans: [{
        resourceKey: "resource-review",
        chapterKeys: ["chapter-1", "chapter-1", "chapter-2"],
        operation: "lose",
        amount: 1,
        placement: "chapterBeats.resourceDeltas"
      }]
    }
  });
  const messages = buildStoryOutlineBlueprintMessages(contractedBrief, spec);
  assert.match(messages[1].content, /程序已预填且不可覆盖的批次合同骨架/);
  assert.match(messages[1].content, /甲川/);
  assert.match(messages[1].content, /庭审记录员/);
  assert.match(messages[1].content, /state-a/);
  assert.match(messages[1].content, /finalValueAfterMandatoryPublicDeltas[^\d-]*0/);
});

test("two-stage retries expose previous gate failures to the next generation attempt", () => {
  const blueprintMessages = buildStoryOutlineBlueprintMessages(brief, spec, ["实体类型与名称冲突"]);
  assert.match(blueprintMessages[1].content, /上一份蓝图被拒绝的原因/);
  assert.match(blueprintMessages[1].content, /实体类型与名称冲突/);

  const assemblyMessages = buildStoryOutlineAssemblyMessages(brief, spec, buildStrictOutline(), ["资源轨迹低于下限"]);
  assert.match(assemblyMessages[1].content, /上一份章节装配被拒绝的原因/);
  assert.match(assemblyMessages[1].content, /资源轨迹低于下限/);
  assert.match(assemblyMessages[1].content, /装配不可变骨架/);
  assert.match(assemblyMessages[1].content, /stateDecisionCoveragePlan/);
});

test("chapter assembly can only supply actions and beats, then merges without rewriting the blueprint", () => {
  const complete = buildStrictOutline();
  const blueprint = structuredClone(complete);
  const playerChapterActions = complete.players.map((player) => ({
    roleKey: player.key,
    chapterActions: structuredClone(player.chapterActions)
  }));
  const chapterBeats = structuredClone(complete.chapterBeats);
  const styleChapterExpressions = structuredClone(complete.styleContract.chapterExpressions);
  for (const player of blueprint.players) player.chapterActions = [];
  blueprint.chapterBeats = [];
  blueprint.styleContract.chapterExpressions = [];
  const merged = mergeStoryOutlineAssembly(
    blueprint,
    { playerChapterActions, chapterBeats, styleChapterExpressions },
    spec
  );
  assert.deepEqual(merged, complete);
  assert.throws(
    () => mergeStoryOutlineAssembly(blueprint, {
      playerChapterActions,
      chapterBeats,
      styleChapterExpressions,
      truthTimeline: "禁止第二阶段改写真相"
    }, spec),
    (error) => error.code === "DEEPSEEK_OUTPUT_INVALID"
      && error.details.issues.some((issue) => issue.includes("额外字段"))
  );
});

test("V2.3 assembly components expose one top-level field and validate independently", () => {
  const complete = buildStrictOutline();
  const blueprint = structuredClone(complete);
  for (const player of blueprint.players) player.chapterActions = [];
  blueprint.chapterBeats = [];
  blueprint.styleContract.chapterExpressions = [];
  const generationContract = {
    outlineRevision: "2.3",
    roleActionChapterKeys: complete.players.map((player) => ({
      roleKey: player.key,
      chapterKeys: player.chapterActions.map((action) => action.chapterKey)
    }))
  };
  const raw = {
    playerChapterActions: complete.players.map((player) => ({
      roleKey: player.key,
      chapterActions: structuredClone(player.chapterActions)
    }))
  };
  assert.deepEqual(
    validateStoryOutlineAssemblyComponent(raw, "playerActions", blueprint, spec, { generationContract }),
    raw
  );
  const messages = buildStoryOutlineAssemblyComponentMessages(brief, spec, blueprint, "playerActions");
  assert.match(messages[0].content, /顶层必须且只能包含 playerChapterActions/);
  assert.match(messages[0].content, /必须是 JSON 数组/);
  assert.throws(
    () => validateStoryOutlineAssemblyComponent(
      { ...raw, chapterBeats: [] },
      "playerActions",
      blueprint,
      spec,
      { generationContract }
    ),
    (error) => error.details.issues.some((issue) => issue.includes("额外字段"))
  );
  assert.throws(
    () => validateStoryOutlineAssemblyComponent(
      { playerChapterActions: Object.fromEntries(raw.playerChapterActions.map((row) => [row.roleKey, row])) },
      "playerActions",
      blueprint,
      spec,
      { generationContract }
    ),
    (error) => error.details.issues.some((issue) => issue.includes("必须是 JSON 数组"))
  );
  const invalidEvidenceEffect = structuredClone(raw);
  invalidEvidenceEffect.playerChapterActions[0].chapterActions[0].evidenceEffectKeys = ["evidence-1"];
  assert.throws(
    () => validateStoryOutlineAssemblyComponent(
      invalidEvidenceEffect,
      "playerActions",
      blueprint,
      spec,
      { generationContract }
    ),
    (error) => error.details.issues.some((issue) => issue.includes("证据开关只在 chapterBeats 记录"))
  );
  const invalidMethod = structuredClone(raw);
  invalidMethod.playerChapterActions[0].chapterActions[0].method = "看";
  assert.throws(
    () => validateStoryOutlineAssemblyComponent(
      invalidMethod,
      "playerActions",
      blueprint,
      spec,
      { generationContract }
    ),
    (error) => error.details.issues.some((issue) => issue.includes("method 缺失或过短"))
  );
});

test("V2.3 chapter component rejects object maps instead of misreporting chapter order", () => {
  const complete = buildStrictOutline();
  const blueprint = structuredClone(complete);
  for (const player of blueprint.players) player.chapterActions = [];
  blueprint.chapterBeats = [];
  blueprint.styleContract.chapterExpressions = [];
  const mapped = Object.fromEntries(complete.chapterBeats.map((beat) => [beat.chapterKey, beat]));
  assert.throws(
    () => validateStoryOutlineAssemblyComponent(
      { chapterBeats: mapped },
      "chapterBeats",
      blueprint,
      spec,
      { generationContract: { outlineRevision: "2.3" } }
    ),
    (error) => error.details.issues.some((issue) => issue.includes("chapterBeats 必须是 JSON 数组"))
      && !error.details.issues.some((issue) => issue.includes("章节顺序"))
  );
  const messages = buildStoryOutlineAssemblyComponentMessages(brief, spec, blueprint, "chapterBeats");
  assert.match(messages[0].content, /绝不能输出/);
  assert.match(messages[0].content, /章节 key 对象映射/);
});

function buildStrictOutline() {
  const names = ["沈砚", "陆遥", "周既白", "唐岚"];
  const players = names.map((name, index) => ({
    key: `role-${index + 1}`,
    name,
    identity: `掌握第 ${index + 1} 类程序权限的庭审参与者`,
    publicGoal: "证明数字证词的来源能够被独立复核",
    hiddenGoal: "保护自己曾经绕过审计程序的事实",
    coreSecret: "曾为救人修改过一段采集流程，因此留下了主线所需的时间偏差",
    exclusiveAnchorKey: index < 2
      ? `evidence-${index + 1}`
      : (index === 2 ? "state-responsibility" : "state-frozen-source"),
    activePlan: `${name}将冻结自己掌管的第 ${index + 1} 类原始载体，并以个人审计权限换取一次不可撤销的交叉质证`,
    arc: "从保护个人名誉转向承担程序责任，并决定是否公开自己的违规行为",
    spotlightChapterKey: index < 2 ? "chapter-1" : "chapter-2",
    contribution: {
      anchorType: index < 2 ? "evidence" : (index === 2 ? "authority" : "task"),
      anchorKeys: index < 2
        ? [`evidence-${index + 1}`]
        : [index === 2 ? "state-responsibility" : "state-frozen-source"],
      turnChapterKeys: [index < 2 ? "chapter-1" : "chapter-2"],
      affectsRoleKeys: [`role-${((index + 1) % names.length) + 1}`]
    },
    chapterActions: [
      {
        chapterKey: "chapter-1",
        action: `${name}冻结第 ${index + 1} 号证词载体并封存其校时参数`,
        actionTarget: `第 ${index + 1} 号证词载体与校时参数`,
        actionTargetKey: `evidence-${index + 1}`,
        method: `使用第 ${index + 1} 类个人审计权限生成不可覆盖快照`,
        consequence: `role-${((index + 1) % names.length) + 1} 失去修改该载体的权限并暴露访问顺序`,
        stateWriteKeys: index < 2 ? ["state-frozen-source"] : [],
        resourceKeys: [],
        evidenceEffectKeys: [],
        affectsRoleKeys: [`role-${((index + 1) % names.length) + 1}`],
        evidenceKeys: [`evidence-${index + 1}`]
      },
      {
        chapterKey: "chapter-2",
        action: `${name}提交第 ${index + 1} 类权限日志并接受来源资格质证`,
        actionTarget: `第 ${index + 1} 类权限日志与本人程序责任`,
        actionTargetKey: `evidence-${index + 1}`,
        method: "用日志签名、保管链与纸本校时记录完成三向核对",
        consequence: `role-${((index + 1) % names.length) + 1} 的证词资格被重新排序，${name}的违规进入正式记录`,
        stateWriteKeys: index >= 2 ? ["state-responsibility"] : [],
        resourceKeys: [],
        evidenceEffectKeys: [],
        affectsRoleKeys: [`role-${((index + 1) % names.length) + 1}`],
        evidenceKeys: [`evidence-${index + 1}`]
      }
    ]
  }));
  const evidence = [
    ["evidence-1", "签名时间戳", "密码学签名", "role-1", "chapter-1", ["conclusion-1"]],
    ["evidence-2", "机房温控曲线", "环境物证", "role-2", "chapter-1", ["conclusion-1"]],
    ["evidence-3", "法警门禁记录", "制度记录", "role-3", "chapter-2", ["conclusion-2"]],
    ["evidence-4", "速记员纸本压痕", "纸质物证", "role-4", "chapter-2", ["conclusion-2"]]
  ].map(([key, label, sourceType, sourceOwnerRoleKey, availableChapterKey, supportsConclusionKeys]) => ({
    key,
    label,
    sourceType,
    provenanceGroup: `independent-origin-${key}`,
    originActorKey: sourceOwnerRoleKey,
    collectionMethod: `由玩家现场读取 ${label} 的原始载体并校验保管链`,
    derivedFromEvidenceKeys: [],
    sourceOwnerRoleKey,
    availableChapterKey,
    obtainedBy: "玩家用题材规则完成质证并承担公开自身日志的代价后取得",
    supportsConclusionKeys,
    alsoExplains: "同时解释证词显示顺序与实际采集顺序为何不一致"
  }));
  return {
    outlineVersion: 2,
    outlineRevision: "2.2",
    logline: "四名庭审参与者发现死者的数字证词正在实时改写尚未发生的交叉质证。",
    truthTimeline: "两年前，证词系统把采集时间与提交时间错误地合并。沈砚为保护证人冻结过快照，陆遥修改过温控告警阈值，二者共同制造了看似来自未来的显示顺序。如今周既白试图用旧漏洞撤销案件，唐岚保留的纸本压痕证明原始发言早已存在。核心责任玩家：沈砚、陆遥、周既白与唐岚的四次程序行动共同让漏洞获得法律效力，删除任一行动都不会形成当前危机。NPC边界：法官与系统管理员只提供程序压力和公开接口，没有制造异常、灭证或给出最终解释。四人的违规彼此咬合，必须通过独立来源重建时间线，才能证明异常来自时间语义而非预言，同时决定谁承担程序责任。",
    sourceFidelity: {
      briefTitle: "回声庭审",
      premiseElements: [
        { element: "数字证词", implementation: "数字证词的采集时间和提交时间被错误合并，构成可由玩家复原的核心异常。", chapterKeys: ["chapter-1"], supportKeys: ["evidence-1"] },
        { element: "交叉质证", implementation: "玩家必须通过交叉质证赋予材料资格，选择会持续改变后续证据链。", chapterKeys: ["chapter-2"], supportKeys: ["evidence-3"] }
      ]
    },
    hookPromises: [{
      key: "promise-1",
      promise: "数字证词为何能实时写出尚未发生的质证内容",
      payoff: "系统把预先录入的证人保护问答按错误的提交时间重新排序；玩家通过签名时间戳与温控曲线复原物理采集时刻，异常的每个可观察细节都得到解释。",
      supportKeys: ["evidence-1", "evidence-2"]
    }],
    genreMechanic: {
      name: "证据资格交叉质证",
      playerFacingRule: "一项材料只有在来源、采集时刻和保管链三项中至少两项被独立确认后才能进入讨论。",
      playerOperation: "玩家可以质疑一项资格、提交自己持有的来源证明，或用个人违规换取一次强制复核。",
      trigger: "任一玩家申请把一项原始材料提交为正式证据时触发资格交叉质证。",
      resolutionProcedure: "先核验来源签名，再比对采集时刻，最后检查保管链；三项中至少两项独立成立才算成功。",
      successEffect: "成功后解锁对应证据并保留该材料的程序资格。",
      failureEffect: "失败后锁定对应证据，并把责任状态写为有限披露。",
      limits: "质证只能判断材料能否被采用，不能自动判断陈述内容为真，也不能读取未提交的私人信息。",
      chapterKeys: ["chapter-1", "chapter-2"],
      payoff: "最终结论取决于哪些材料获得资格以及玩家是否愿意让自己的违规记录同时进入证据链。"
    },
    styleContract: {
      signatureDevices: ["庭审速记中的删改痕迹", "程序术语与私人停顿的反差", "证物投影时间码"],
      forbiddenDrift: "禁止写成普通机房搜证或全能黑客破解；所有冲突必须在法庭程序与可采资格中发生。",
      chapterExpressions: [
        { chapterKey: "chapter-1", device: "证物投影时间码", sceneOrDialogue: "投影幕上两个时间码同时跳动，沈砚必须在法官追问下逐字说明自己冻结的是哪一个时刻。" },
        { chapterKey: "chapter-2", device: "庭审速记中的删改痕迹", sceneOrDialogue: "唐岚朗读纸本压痕时，速记员把四人的停顿原样记录，使未说出口的责任成为可见程序事实。" }
      ]
    },
    genreProfile: {
      mode: "mystery",
      chapterProgressRule: "每章通过两种独立来源取得证据资格，并把资格结果写入后续状态。",
      decisionCadence: "两章都是法庭推理节点，因此每章都有改变证据资格或责任分配的实质决策。"
    },
    entities: evidence.map((entry) => ({
      key: entry.provenanceGroup,
      type: "system",
      name: `${entry.label}原始来源`,
      aliases: [],
      meaning: `独立保存 ${entry.label} 的原始设备或载体`
    })),
    resources: [],
    players,
    centralResponsibilityRoleKeys: ["role-1", "role-2", "role-3", "role-4"],
    evidenceGraph: {
      evidence,
      conclusions: [
        { key: "conclusion-1", statement: "未来证词是时间字段错配而非预言或剪辑", evidenceKeys: ["evidence-1", "evidence-2"] },
        { key: "conclusion-2", statement: "四名玩家的程序性违规共同使漏洞能够持续存在", evidenceKeys: ["evidence-3", "evidence-4"] }
      ]
    },
    misdirections: [
      {
        key: "misdirection-1",
        kind: "suspicion",
        apparentInterpretation: "门禁晚到记录证明周既白事后进入机房伪造了全部证词",
        trueCause: "门禁记录使用服务器时间，而机房终端使用冻结后的本地时间",
        mainlineImpact: "时间基准差异正是核心漏洞能够长期未被发现的制度原因",
        supportKeys: ["evidence-3"],
        disproofKeys: ["evidence-1"],
        lastingConsequence: "周既白虽洗脱伪造嫌疑，却必须承认自己利用漏洞申请过延期"
      },
      {
        key: "misdirection-2",
        kind: "evidence",
        apparentInterpretation: "纸本压痕说明唐岚提前拿到剧本并操纵证人发言",
        trueCause: "压痕来自证人保护流程中预先登记的问题清单而非回答",
        mainlineImpact: "问题清单成为校准原始采集顺序的第二套物理时钟",
        supportKeys: ["evidence-4"],
        disproofKeys: ["evidence-2"],
        lastingConsequence: "唐岚保住证词资格，但失去对问题清单保密的职业信誉"
      }
    ],
    chapterBeats: [
      {
        chapterKey: "chapter-1",
        title: "资格冻结",
        goal: "在证词再次覆盖前决定冻结哪一种来源并建立第一条时间基准",
        turn: "沈砚或陆遥必须公开一项违规，玩家的选择决定哪套时间被保留",
        hostNotes: "只裁定证据资格，不替玩家选择公开哪份日志",
        triggerRoleKeys: ["role-1", "role-2"],
        playerAction: "玩家交叉质证签名时间戳和温控曲线，并选择冻结其中一套",
        actionObject: "签名快照、环境温控曲线及其校时基准",
        actionTargetKey: "evidence-1",
        irreversibleConsequence: "未被冻结的来源被系统覆盖，相关角色失去自证捷径",
        nextState: "第二章可用的质证顺序与角色联盟由被冻结的来源决定",
        progressMode: "evidence",
        stateReads: [],
        entryConditionMode: "none",
        onReadPass: {},
        onReadFail: {},
        stateWrites: [],
        unlocksEvidenceKeys: ["evidence-3"],
        locksEvidenceKeys: [],
        resourceDeltas: [],
        evidenceKeys: ["evidence-1", "evidence-2"],
        genreMechanicUse: "触发：沈砚提交签名快照；判定：依次核验签名、温控与保管链；成功：解锁evidence-3；失败：锁定未冻结来源并失去后续自证捷径",
        sharedSpotlightConflict: "",
        decision: {
          stateKey: "state-frozen-source",
          question: "保留签名快照还是保留环境曲线作为第一时间基准？",
          options: [
            { key: "signature", choice: "冻结签名快照", setsValue: "signature", immediateConsequence: "沈砚的违规立即公开，陆遥暂时保留信誉" },
            { key: "temperature", choice: "冻结温控曲线", setsValue: "temperature", immediateConsequence: "陆遥的阈值修改被公开，沈砚保留一次后续质证权" }
          ]
        }
      },
      {
        chapterKey: "chapter-2",
        title: "责任入链",
        goal: "决定是否让个人违规与核心证词一起成为正式证据",
        turn: "玩家公开自己的记录后真相闭合，但公开顺序决定责任如何分配",
        hostNotes: "根据上一章状态开放不同证据，不发放总结性答案文件",
        triggerRoleKeys: ["role-3", "role-4"],
        playerAction: "玩家以门禁记录和纸本压痕互相质证，并选择承担或隔离程序责任",
        actionObject: "法警门禁原始记录、速记员纸本压痕和四人的程序责任",
        actionTargetKey: "evidence-3",
        irreversibleConsequence: "进入证据链的违规无法撤回，至少一人的职业身份永久改变",
        nextState: "累计状态直接锁定可达结局与责任分配方式",
        progressMode: "evidence",
        stateReads: [{ stateKey: "state-frozen-source", operator: "includes", value: "signature" }],
        entryConditionMode: "all",
        onReadPass: {
          variantKey: "responsibility-open",
          effectSummary: "签名时间基准保留，玩家可以直接质证完整责任链"
        },
        onReadFail: {
          variantKey: "responsibility-restricted",
          fallbackAction: "通过纸本压痕重建最低限度责任链并放弃一项职业抗辩",
          additionalCosts: [],
          stateWrites: [{ stateKey: "state-responsibility", operation: "set", value: "limited" }],
          locksEvidenceKeys: ["evidence-4"],
          unlocksEvidenceKeys: []
        },
        stateWrites: [],
        unlocksEvidenceKeys: [],
        locksEvidenceKeys: [],
        resourceDeltas: [],
        evidenceKeys: ["evidence-3", "evidence-4"],
        genreMechanicUse: "触发：周既白申请责任记录入链；判定：对照门禁与纸本压痕；成功：写入shared责任；失败：锁定evidence-4并写入limited责任",
        sharedSpotlightConflict: "",
        decision: {
          stateKey: "state-responsibility",
          question: "将四人的违规共同入链，还是只提交最低限度的事实证据？",
          options: [
            { key: "shared", choice: "共同入链", setsValue: "shared", immediateConsequence: "真相完整但四人共同接受调查" },
            { key: "limited", choice: "最低披露", setsValue: "limited", immediateConsequence: "案件可纠正但漏洞仍可能被再次利用" }
          ]
        }
      }
    ],
    endingLogic: {
      stateVariables: [
        {
          key: "state-frozen-source",
          valueType: "enum",
          initialValue: "unresolved",
          allowedValues: ["unresolved", "signature", "temperature"],
          setInChapterKey: "chapter-1",
          meaning: "决定哪套时间基准存活并影响最终责任证据"
        },
        {
          key: "state-responsibility",
          valueType: "enum",
          initialValue: "unresolved",
          allowedValues: ["unresolved", "shared", "limited"],
          setInChapterKey: "chapter-2",
          meaning: "决定违规是否完整进入正式证据链"
        }
      ],
      defaultRouteKey: "ending-default",
      conflictResolution: "highest-priority",
      routes: [
        {
          key: "ending-signature-shared",
          title: "公开的校时者",
          priority: 20,
          isDefault: false,
          requirementMode: "all",
          requirements: [
            { targetType: "state", targetKey: "state-frozen-source", operator: "equals", value: "signature" },
            { targetType: "state", targetKey: "state-responsibility", operator: "equals", value: "shared" }
          ],
          consequence: "数字证词被纠正，四人共同承担违规，沈砚成为重建审计制度的公开证人。"
        },
        {
          key: "ending-temperature-limited",
          title: "有限纠错",
          priority: 10,
          isDefault: false,
          requirementMode: "all",
          requirements: [
            { targetType: "state", targetKey: "state-frozen-source", operator: "equals", value: "temperature" },
            { targetType: "state", targetKey: "state-responsibility", operator: "equals", value: "limited" }
          ],
          consequence: "案件得到撤销但完整漏洞没有公开，陆遥保住职位并承担持续监控的义务。"
        },
        {
          key: "ending-default",
          title: "证据资格悬置",
          priority: 0,
          isDefault: true,
          requirementMode: "all",
          requirements: [],
          consequence: "没有条件路线完整命中时，案件被暂缓复核，四人的权限全部被冻结。"
        }
      ]
    },
    batchFingerprint: {
      storyEngine: "证据资格改变可用时间基准",
      antagonistType: "互相咬合的程序性违规",
      finalChoiceType: "个人违规是否共同进入证据链",
      themeExpression: "纠正事实是否必须同时公开纠错者的过失",
      mysteryObjectType: "实时改写提交时间的数字证词",
      truthRevealMethod: "密码学时间戳与环境曲线交叉校时",
      playerRelationshipTopology: "四名权限持有人构成相互审计的责任环",
      chapterCausalPattern: "冻结时间基准后重排证据资格并写入责任状态",
      evidenceModalityMix: "密码签名、环境曲线、门禁制度记录与纸本压痕",
      powerStructure: "四类互斥权限无人能单独完成完整校时",
      endingMechanism: "存活时间基准与责任披露状态按优先级共同触发",
      existenceStatusMechanism: "证词内容真实存在，但提交时间字段被程序错误重排",
      truthKnowledgeDistribution: "四人各知一段程序违规，没有外部NPC掌握完整真相"
    },
    suggestions: ["扩写时可用庭审速记格式强化质证节奏"]
  };
}

function buildV23Outline() {
  const raw = buildStrictOutline();
  raw.outlineRevision = "2.3";
  raw.truthTimeline = raw.truthTimeline
    .replace("核心责任玩家：", "责任链：沈砚制造错误冻结，陆遥主动扩大校时偏差，周既白维持漏洞效力，唐岚只掌握最终纠正权。");
  raw.centralResponsibilityRoleKeys = ["role-1", "role-2", "role-3"];
  raw.responsibilityRoles = [
    { roleKey: "role-1", responsibilityType: "cause", action: "沈砚绕过审计冻结错误时间快照", causalEffect: "错误快照成为后来全部证词排序的起点" },
    { roleKey: "role-2", responsibilityType: "escalation", action: "陆遥修改温控告警阈值以掩护快照", causalEffect: "物理时钟与服务器时钟的偏差被主动扩大" },
    { roleKey: "role-3", responsibilityType: "maintenance", action: "周既白继续引用旧漏洞申请程序延期", causalEffect: "漏洞获得持续的法律效力并影响当前案件" },
    { roleKey: "role-4", responsibilityType: "resolution", action: "唐岚保管能纠正顺序的纸本压痕", causalEffect: "她拥有不可替代的解决权但没有制造危机" }
  ];
  raw.causalTimeline = [
    { key: "event-freeze", order: 1, event: "沈砚绕过审计冻结了错误的证词时间快照", actorKeys: ["role-1"], preconditionKeys: [], outcomeStateKeys: ["state-frozen-source"] },
    { key: "event-threshold", order: 2, event: "陆遥修改温控阈值以掩盖物理时钟偏差", actorKeys: ["role-2"], preconditionKeys: ["event-freeze"], outcomeStateKeys: [] },
    { key: "event-delay", order: 3, event: "周既白引用错误快照取得程序延期并维持漏洞效力", actorKeys: ["role-3"], preconditionKeys: ["event-threshold"], outcomeStateKeys: ["state-responsibility"] }
  ];
  const entityRows = [
    ["system", "证词签名服务", "独立保存密码学签名与签发时刻的认证系统"],
    ["device", "第七码机房温控探头", "独立采集环境曲线的现场硬件"],
    ["system", "法警门禁主机", "保存法警门禁制度记录的独立主机"],
    ["physicalObject", "速记员纸本记录", "带有原始压痕且可现场检验的纸本物件"]
  ];
  raw.entities = raw.entities.map((entity, index) => ({
    ...entity,
    type: entityRows[index][0],
    name: entityRows[index][1],
    meaning: entityRows[index][2]
  }));
  for (const beat of raw.chapterBeats) {
    beat.decision.options = beat.decision.options.map((option) => ({
      key: option.key,
      choiceText: option.choice,
      sets: { stateKey: beat.decision.stateKey, value: option.setsValue },
      immediateConsequence: option.immediateConsequence
    }));
  }
  for (const state of raw.endingLogic.stateVariables) {
    state.valueSemantics = state.allowedValues.map((value) => ({
      value,
      worldMeaning: `${state.meaning}在“${value}”取值下对应的明确世界内结果`,
      incompatibleClaims: [`${state.key} 已经处于与“${value}”相反的结果`]
    }));
  }
  return raw;
}

function buildV24Outline() {
  const raw = buildV23Outline();
  raw.outlineRevision = "2.4";
  raw.causalTimeline = raw.causalTimeline.map((event, index) => ({
    ...event,
    actionType: ["freeze-audit-snapshot", "alter-sensor-threshold", "invoke-obsolete-procedure"][index],
    targetKey: raw.entities[index].key,
    parameterKey: ["collection-clock", "temperature-threshold", "appeal-window"][index],
    purposeKey: ["evidence-ordering", "witness-protection", "procedural-delay"][index],
    beforeValue: ["live", "strict", "expired"][index],
    afterValue: ["frozen", "relaxed", "extended"][index],
    authorizationGrantKey: index === 0 ? "grant-snapshot-protection" : "",
    authorizationStatus: index === 0 ? "exceeded" : "not-required",
    factKeys: [`fact-${index + 1}`],
    responsibilityTypes: [["cause"], ["escalation"], ["maintenance"]][index],
    actorResponsibilities: [{
      actorKey: `role-${index + 1}`,
      responsibilityType: ["cause", "escalation", "maintenance"][index]
    }]
  }));
  raw.responsibilityRoles = raw.responsibilityRoles.map((responsibility, index) => ({
    ...responsibility,
    eventKeys: index < 3 ? [raw.causalTimeline[index].key] : ["event-resolution"]
  }));
  raw.causalTimeline.push({
    key: "event-resolution",
    order: 4,
    event: "唐岚提交纸本压痕顺序并启动最终证据资格复核程序",
    actorKeys: ["role-4"],
    preconditionKeys: ["event-delay"],
    outcomeStateKeys: [],
    actionType: "submit-physical-order",
    targetKey: raw.entities[3].key,
    parameterKey: "pressure-mark-sequence",
    purposeKey: "admissibility-review",
    beforeValue: "sealed",
    afterValue: "submitted",
    authorizationGrantKey: "",
    authorizationStatus: "not-required",
    factKeys: ["fact-3"],
    responsibilityTypes: ["resolution"],
    actorResponsibilities: [{ actorKey: "role-4", responsibilityType: "resolution" }]
  });
  raw.semanticConstitution = {
    facts: [
      {
        key: "fact-1",
        subjectKey: "role-1",
        predicate: "froze",
        objectKey: raw.entities[0].key,
        scopeKey: "audit-sequence",
        truthValue: true,
        validFromEventKey: "event-freeze",
        validToEventKey: "",
        evidenceKeys: ["evidence-1"]
      },
      {
        key: "fact-2",
        subjectKey: "role-2",
        predicate: "altered",
        objectKey: raw.entities[1].key,
        scopeKey: "audit-sequence",
        truthValue: true,
        validFromEventKey: "event-threshold",
        validToEventKey: "",
        evidenceKeys: ["evidence-2"]
      },
      {
        key: "fact-3",
        subjectKey: "role-3",
        predicate: "invoked",
        objectKey: raw.entities[2].key,
        scopeKey: "appeal-procedure",
        truthValue: true,
        validFromEventKey: "event-delay",
        validToEventKey: "",
        evidenceKeys: ["evidence-3"]
      }
    ],
    authorizationGrants: [{
      key: "grant-snapshot-protection",
      grantorKey: raw.entities[2].key,
      granteeKey: "role-1",
      assetKey: raw.entities[0].key,
      allowedPurposeKeys: ["witness-protection"],
      forbiddenPurposeKeys: ["evidence-ordering"],
      validFromEventKey: "",
      validToEventKey: "event-threshold",
      evidenceKeys: ["evidence-3"]
    }],
    worldRules: [{
      key: "rule-admissibility",
      statement: "只有签名快照和独立环境曲线同时通过复核，程序责任才能作为正式证据进入裁决。",
      evaluationChapterKey: "chapter-2",
      triggerEventKeys: ["event-freeze", "event-threshold"],
      authorizedActorKeys: ["role-3", "role-4"],
      preconditions: [
        { targetType: "fact", targetKey: "fact-1", operator: "equals", value: true },
        { targetType: "fact", targetKey: "fact-2", operator: "equals", value: true }
      ],
      effects: [{
        targetType: "evidence",
        targetKey: "evidence-4",
        operation: "unlock",
        consequence: "两套独立时钟均成立后，纸本压痕获准进入正式证据链。"
      }],
      auditEvidenceKeys: ["evidence-1", "evidence-2"],
      failureMode: "任一来源复核失败时，只能采用有限披露程序，不能直接认定完整责任链。"
    }]
  };
  raw.evidenceGraph.evidence = raw.evidenceGraph.evidence.map((entry, index) => ({
    ...entry,
    originRootKeys: [raw.entities[index].key],
    storageEntityKey: raw.entities[index].key,
    commonCauseKeys: [],
    independenceDomain: ["signature-authority", "physical-environment", "access-control", "paper-custody"][index],
    methodDomain: ["cryptographic-forensics", "environmental-forensics", "access-audit", "physical-document-examination"][index],
    methodOperation: ["verify signed timestamp chain", "compare calibrated sensor curves", "replay access-control journal", "inspect pressure marks and ink order"][index],
    artifactProduced: ["signed timestamp verification report", "calibrated curve comparison", "access journal reconstruction", "pressure-mark sequence chart"][index]
  }));
  raw.endingLogic.stateVariables = raw.endingLogic.stateVariables.map((state, index) => ({
    ...state,
    subjectKey: index === 0 ? raw.entities[0].key : raw.entities[2].key,
    dimension: index === 0 ? "surviving-time-baseline" : "responsibility-disclosure-scope",
    controlMode: "player-decision",
    derivedFromFactKeys: [],
    derivedByRuleKey: ""
  }));
  raw.chapterBeats = raw.chapterBeats.map((beat, chapterIndex) => ({
    ...beat,
    decision: {
      ...beat.decision,
      key: `decision-${chapterIndex + 1}`,
      options: beat.decision.options.map((option) => ({
        ...option,
        effects: [{
          targetType: "state",
          targetKey: beat.decision.stateKey,
          operation: "set",
          value: option.sets.value,
          consequence: option.immediateConsequence
        }]
      }))
    }
  }));
  raw.players = raw.players.map((player, playerIndex) => ({
    ...player,
    secretFactKeys: [["fact-1"], ["fact-2"], ["fact-3"], ["fact-3"]][playerIndex],
    authorizationGrantKeys: playerIndex === 0 ? ["grant-snapshot-protection"] : [],
    chapterActions: player.chapterActions.map((action, chapterIndex) => ({
      ...action,
      commitmentMode: "conditional",
      decisionKey: `decision-${chapterIndex + 1}`,
      optionKeys: raw.chapterBeats[chapterIndex].decision.options.map((option) => option.key),
      eventKeys: []
    }))
  }));
  raw.endingLogic.routes = raw.endingLogic.routes.map((route, index) => ({
    ...route,
    preconditionFactKeys: route.isDefault ? [] : (index === 0 ? ["fact-1", "fact-2"] : ["fact-2", "fact-3"]),
    preconditionRuleKeys: route.isDefault ? [] : (index === 0 ? ["rule-admissibility"] : [])
  }));
  return raw;
}

test("V2.2 prompt exposes the dynamic action formula and declares every example state", () => {
  const fiveChapterSpec = {
    ...spec,
    chapterCount: 5,
    chapterKeys: ["chapter-1", "chapter-2", "chapter-3", "chapter-4", "chapter-5"]
  };
  const messages = buildStoryOutlineMessages(brief, fiveChapterSpec);
  assert.match(messages[1].content, /ceil\(5 × 0\.6\) = 3/);
  assert.doesNotMatch(messages[1].content, /固定“2章”处理。[\s\S]*当前最低覆盖数为[^3]/);
  assert.match(messages[0].content, /"key":"state-contract-access"/);
  assert.match(messages[0].content, /"amount":1/);
  assert.doesNotMatch(messages[0].content, /"amount":"1"/);
});

test("strict outline V2.2 passes registries, fallback variants and ending influence gates", () => {
  const outline = validateStoryOutline(buildStrictOutline(), spec, { strict: true });
  assert.equal(outline.outlineVersion, 2);
  assert.equal(outline.outlineRevision, "2.2");
  assert.equal(outline.players.length, 4);
  assert.equal(outline.readiness.readyForExpansion, true);
  assert.equal(outline.readiness.checks.independentEvidence, true);
  assert.equal(outline.readiness.checks.stateCausality, true);
});

test("strict outline V2.3 accepts responsibility types, causal timeline and hidden decision mappings", () => {
  const outline = validateStoryOutline(buildV23Outline(), spec, { strict: true });
  assert.equal(outline.outlineRevision, "2.3");
  assert.equal(outline.readiness.checks.responsibilityTypeSeparation, true);
  assert.equal(outline.chapterBeats[0].decision.options[0].choiceText, "冻结签名快照");
  assert.deepEqual(outline.chapterBeats[0].decision.options[0].sets, {
    stateKey: "state-frozen-source",
    value: "signature"
  });
  assert.equal("choice" in outline.chapterBeats[0].decision.options[0], false);
  assert.equal("setsValue" in outline.chapterBeats[0].decision.options[0], false);
});

test("strict outline V2.4 accepts a semantic constitution and jointly reachable branches", () => {
  const outline = validateStoryOutline(buildV24Outline(), spec, { strict: true });
  assert.equal(outline.outlineRevision, "2.4");
  assert.equal(outline.readiness.factConsistencyPassed, true);
  assert.equal(outline.readiness.branchConsistencyPassed, true);
  assert.equal(outline.readiness.provenanceIndependencePassed, true);
  assert.equal(outline.readiness.checks.optionScopedEffects, true);
  assert.equal(outline.readiness.checks.responsibilityEventDerivation, true);
});

test("V2.4 blueprint rejects a world rule that writes a state before its registered chapter", () => {
  const raw = buildV24Outline();
  const delayedState = raw.endingLogic.stateVariables.find((state) => state.setInChapterKey === "chapter-2");
  raw.semanticConstitution.worldRules[0].evaluationChapterKey = "chapter-1";
  raw.semanticConstitution.worldRules[0].effects = [{
    targetType: "state",
    targetKey: delayedState.key,
    operation: "set",
    amount: null,
    value: delayedState.allowedValues[0],
    consequence: "规则在登记章节之前错误改写了尚未建立的裁决状态。"
  }];
  const v24Brief = normalizeStoryBrief({
    title: "回声庭审",
    playerCount: 4,
    chapterCount: 2,
    generationContract: { outlineRevision: "2.4", resourcePolicies: [] }
  });
  assert.throws(
    () => validateStoryOutlineBlueprint(raw, spec, { brief: v24Brief }),
    (error) => error?.details?.issues?.some((issue) => issue.includes("提前写入状态"))
  );
});

test("V2.4 blueprint rejects evidence effects that impersonate a final adjudication", () => {
  const raw = buildV24Outline();
  raw.semanticConstitution.worldRules[0].effects[0].consequence = "材料解锁后，授权有效性被确认并立即成为最终裁决。";
  const v24Brief = normalizeStoryBrief({
    title: "回声庭审",
    playerCount: 4,
    chapterCount: 2,
    generationContract: { outlineRevision: "2.4", resourcePolicies: [] }
  });
  assert.throws(
    () => validateStoryOutlineBlueprint(raw, spec, { brief: v24Brief }),
    (error) => error?.details?.issues?.some((issue) => issue.includes("效果语义冲突"))
  );
});

test("V2.4 blueprint rejects populated style assembly instead of silently deleting it", () => {
  const raw = buildV24Outline();
  for (const player of raw.players) player.chapterActions = [];
  raw.chapterBeats = [];
  const originalExpressions = structuredClone(raw.styleContract.chapterExpressions);
  const v24Brief = normalizeStoryBrief({
    title: "回声庭审",
    playerCount: 4,
    chapterCount: 2,
    generationContract: { outlineRevision: "2.4", resourcePolicies: [] }
  });
  assert.throws(
    () => validateStoryOutlineBlueprint(raw, spec, { brief: v24Brief }),
    (error) => error?.details?.issues?.some(
      (issue) => issue.includes("styleContract.chapterExpressions 必须为空数组")
    )
  );
  assert.deepEqual(raw.styleContract.chapterExpressions, originalExpressions);
});

test("V2.4 prompts expose per-actor responsibility, rule timing and option-scoped effects", () => {
  const v24Brief = normalizeStoryBrief({
    title: "回声庭审",
    playerCount: 4,
    chapterCount: 2,
    generationContract: { outlineRevision: "2.4", resourcePolicies: [] }
  });
  const blueprintMessages = buildStoryOutlineBlueprintMessages(v24Brief, spec);
  assert.match(blueprintMessages[0].content, /actorResponsibilities/);
  assert.match(blueprintMessages[0].content, /evaluationChapterKey/);
  assert.match(blueprintMessages[0].content, /semanticConstitution/);
  assert.match(blueprintMessages[0].content, /branchEvents/);

  const assemblyMessages = buildStoryOutlineAssemblyMessages(v24Brief, spec, buildV24Outline());
  assert.match(assemblyMessages[0].content, /options\[\]\.effects/);
  assert.match(assemblyMessages[0].content, /derivedByRuleKey/);
  assert.doesNotMatch(assemblyMessages[0].content, /必须逐项执行 generationContract\.resourceUsagePlans/);
});

test("V2.4 rejects an event that labels a forbidden purpose as authorized", () => {
  const raw = buildV24Outline();
  raw.causalTimeline[0].authorizationStatus = "authorized";
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.details.outlineRevision === "2.4"
      && error.details.repairMode === "regenerate-current-stage"
      && error.details.generationAcceptanceMode === "reject-and-regenerate-current-stage-from-scratch"
      && error.details.issues.some((issue) => issue.includes("声称 authorized") && issue.includes("不在授权范围内"))
  );
});

test("V2.4 rejects authorized status when the event text explicitly says the actor exceeded authority", () => {
  const raw = buildV24Outline();
  const event = raw.causalTimeline[0];
  const grant = raw.semanticConstitution.authorizationGrants.find((entry) => entry.key === event.authorizationGrantKey);
  event.event = "沈砚擅自越权冻结审计快照，并把有限保护权限扩大到证据排序。";
  event.authorizationStatus = "authorized";
  event.purposeKey = grant.allowedPurposeKeys[0];
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.details.issues.some((issue) => issue.includes("世界内叙述声称越权"))
  );
});

test("V2.4 requires responsibility to be mapped per actor instead of using ambiguous parallel arrays", () => {
  const raw = buildV24Outline();
  raw.causalTimeline[0].actorKeys.push("role-2");
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.details.issues.some((issue) => issue.includes("role-2") && issue.includes("缺少 actorResponsibilities"))
  );
});

test("V2.4 requires player secrets and authorization use to reference the semantic constitution", () => {
  const missingFact = buildV24Outline();
  missingFact.players[1].secretFactKeys = [];
  assert.throws(
    () => validateStoryOutline(missingFact, spec, { strict: true }),
    (error) => error.details.issues.some((issue) => issue.includes("secretFactKeys"))
  );

  const missingGrant = buildV24Outline();
  missingGrant.players[0].authorizationGrantKeys = [];
  assert.throws(
    () => validateStoryOutline(missingGrant, spec, { strict: true }),
    (error) => error.details.issues.some((issue) => issue.includes("未在 authorizationGrantKeys 登记所用授权"))
  );
});

test("V2.4 rejects discontinuous edits to the same target parameter", () => {
  const raw = buildV24Outline();
  raw.causalTimeline[1].targetKey = raw.causalTimeline[0].targetKey;
  raw.causalTimeline[1].parameterKey = raw.causalTimeline[0].parameterKey;
  raw.causalTimeline[1].beforeValue = "unexpected-value";
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.details.issues.some((issue) => issue.includes("beforeValue") && issue.includes("上一事件 afterValue 不连续"))
  );
});

test("V2.4 rejects evidence pairs that use different labels but share one origin root", () => {
  const raw = buildV24Outline();
  raw.evidenceGraph.evidence[1].originRootKeys = [...raw.evidenceGraph.evidence[0].originRootKeys];
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.details.issues.some((issue) => issue.includes("不同根") && issue.includes("独立域"))
  );
});

test("V2.4 rejects mandatory public resource spending even when the resource is otherwise valid", () => {
  const raw = buildV24Outline();
  const resource = {
    key: "resource-review-seat",
    name: "正式复核席位",
    valueType: "integer",
    initialValue: 2,
    minimum: 0,
    maximum: 2,
    ownerType: "group",
    ownerKey: "",
    recoverable: false,
    meaning: "全组可以向法庭申请调取独立原始载体的剩余正式复核次数"
  };
  raw.resources = [resource];
  raw.chapterBeats[0].resourceDeltas = [{
    resourceKey: resource.key,
    operation: "lose",
    amount: 1,
    affectsRoleKeys: ["role-1"],
    consequence: "法庭在玩家作出选择前自动占用一次正式复核席位。"
  }];
  raw.chapterBeats[0].decision.options[0].effects.push({
    targetType: "resource",
    targetKey: resource.key,
    operation: "lose",
    amount: 1,
    consequence: "玩家申请调取完整签名链，消耗一次正式复核席位。"
  });
  raw.endingLogic.routes[0].requirements.push({
    targetType: "resource",
    targetKey: resource.key,
    operator: "gte",
    value: 0
  });
  const resourceBrief = normalizeStoryBrief({
    title: "回声庭审",
    playerCount: 4,
    chapterCount: 2,
    generationContract: {
      outlineRevision: "2.4",
      resourceKeys: [resource.key],
      resourceContracts: [{ ...resource }],
      resourcePolicies: [{
        resourceKey: resource.key,
        minimumOptionalUses: 1,
        maximumMandatoryUses: 0,
        placement: "chapterBeats.decision.options.effects"
      }],
      resourceUsagePlans: []
    }
  });
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true, brief: resourceBrief }),
    (error) => error.details.issues.some((issue) => issue.includes("公共必然变化") && issue.includes("应挂在具体玩家选项"))
  );
});

test("V2.4 rejects endings whose requirements are reachable only on different branches", () => {
  const raw = buildV24Outline();
  raw.chapterBeats[1].decision.options[0].effects.push({
    targetType: "state",
    targetKey: "state-frozen-source",
    operation: "set",
    value: "temperature",
    consequence: "共同入链会保留环境曲线并覆盖先前冻结的签名快照。"
  });
  raw.chapterBeats[1].decision.options[1].effects.push({
    targetType: "state",
    targetKey: "state-frozen-source",
    operation: "set",
    value: "signature",
    consequence: "有限披露会保留签名快照并放弃环境曲线。"
  });
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.details.issues.some((issue) => issue.includes("不存在同一条分支路径"))
  );
});

test("V2.4 branch reachability executes world-rule effects at their declared chapter", () => {
  const raw = buildV24Outline();
  raw.semanticConstitution.worldRules[0].effects = [{
    targetType: "state",
    targetKey: "state-frozen-source",
    operation: "set",
    value: "temperature",
    consequence: "规则成立后只保留环境曲线作为最终时间基准。"
  }];
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.details.issues.some((issue) => issue.includes("不存在同一条分支路径"))
  );
});

test("V2.4 does not treat a rule as fired when its condition becomes true after evaluation", () => {
  const raw = buildV24Outline();
  const rule = raw.semanticConstitution.worldRules[0];
  rule.evaluationChapterKey = "chapter-1";
  rule.preconditions.push({
    targetType: "state",
    targetKey: "state-responsibility",
    operator: "equals",
    value: "shared"
  });
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.details.issues.some((issue) => issue.includes("不存在同一条分支路径"))
  );
});

test("V2.4 prevents player options from directly assigning a derived state", () => {
  const raw = buildV24Outline();
  const state = raw.endingLogic.stateVariables.find((entry) => entry.key === "state-responsibility");
  state.controlMode = "derived";
  state.derivedByRuleKey = "rule-admissibility";
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.details.issues.some((issue) => issue.includes("不能由玩家选项直接改写 derived 状态"))
  );
});

test("V2.4 accepts a registered conditional event and rejects retriggering established history", () => {
  const valid = buildV24Outline();
  valid.semanticConstitution.branchEvents = [{
    key: "branch-public-hearing",
    chapterKey: "chapter-2",
    description: "玩家公开完整责任链后，法庭启动追加听证。"
  }];
  valid.chapterBeats[1].decision.options[0].choiceText = "公开完整责任链并申请追加听证";
  valid.chapterBeats[1].decision.options[0].effects.push({
    targetType: "event",
    targetKey: "branch-public-hearing",
    operation: "trigger",
    consequence: "法庭当场登记追加听证并通知全部责任人到场。"
  });
  assert.doesNotThrow(() => validateStoryOutline(valid, spec, { strict: true }));

  const duplicate = structuredClone(valid);
  duplicate.chapterBeats[1].decision.options[1].effects.push({
    targetType: "event",
    targetKey: "branch-public-hearing",
    operation: "trigger",
    consequence: "第二个互斥选项也错误启动了同一场追加听证。"
  });
  assert.throws(
    () => validateStoryOutline(duplicate, spec, { strict: true }),
    (error) => error.details.issues.some((issue) => issue.includes("必须恰好由一个玩家选项触发"))
  );
  const duplicatePlan = buildStoryOutlineAssemblyMechanicalPatchPlan(
    duplicate,
    {
      playerChapterActions: duplicate.players.map((player) => ({ roleKey: player.key, chapterActions: player.chapterActions })),
      chapterBeats: duplicate.chapterBeats,
      styleChapterExpressions: duplicate.styleContract.chapterExpressions
    },
    "分支事件 branch-public-hearing 必须恰好由一个玩家选项触发，当前由 2 个选项重复触发",
    spec
  );
  assert.equal(duplicatePlan.length, 1);
  assert.equal(duplicatePlan[0].op, "remove");

  const denied = structuredClone(valid);
  const eventEffect = denied.chapterBeats[1].decision.options[0].effects.find((effect) => effect.targetKey === "branch-public-hearing");
  eventEffect.consequence = "玩家选择后没有触发追加听证，程序维持原状。";
  assert.throws(
    () => validateStoryOutline(denied, spec, { strict: true }),
    (error) => error.details.issues.some((issue) => issue.includes("却在 consequence 中否认触发结果"))
  );

  const invalid = buildV24Outline();
  invalid.chapterBeats[0].decision.options[0].effects.push({
    targetType: "event",
    targetKey: "event-freeze",
    operation: "trigger",
    consequence: "玩家选择让两年前的冻结行为再次发生。"
  });
  assert.throws(
    () => validateStoryOutline(invalid, spec, { strict: true }),
    (error) => error.details.issues.some((issue) => issue.includes("不能重新触发既成 causalTimeline 事件"))
  );
});

test("V2.4 rejects player action chains that precommit an unresolved ending choice", () => {
  const raw = buildV24Outline();
  const action = raw.players[0].chapterActions[1];
  action.commitmentMode = "committed";
  action.decisionKey = "";
  action.optionKeys = [];
  action.action = "沈砚最终决定发起公开裁决并进入胜诉结局路线";
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.details.issues.some((issue) => issue.includes("提前写死结局"))
  );
});

test("V2.4 rejects physical magnetic-particle inspection applied to digital evidence", () => {
  const raw = buildV24Outline();
  raw.evidenceGraph.evidence[0].methodOperation = "对服务器签名日志执行磁粉断点检验";
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.details.issues.some((issue) => issue.includes("磁粉检测") && issue.includes("数字系统"))
  );
});

test("V2.4 remains readable without silently downgrading to the legacy outline shape", () => {
  const raw = buildV24Outline();
  const delivered = validateStoryOutline(raw, spec);
  assert.equal(delivered.outlineRevision, "2.4");
  assert.ok(delivered.semanticConstitution);
});

test("V2.3 rejects player-facing internal state-machine language", () => {
  const raw = buildV23Outline();
  raw.chapterBeats[0].decision.options[0].choiceText = "把 state-frozen-source 写入 verified";
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.code === "DEEPSEEK_OUTPUT_INVALID"
      && error.details.issues.some((issue) => issue.includes("暴露内部状态"))
  );

  const hookLeak = buildV23Outline();
  hookLeak.hookPromises[0].payoff = "玩家恢复原始证据后，把 state-frozen-source 写成 verified，从而进入下一条结局路线。";
  assert.throws(
    () => validateStoryOutline(hookLeak, spec, { strict: true }),
    (error) => error.code === "DEEPSEEK_OUTPUT_INVALID"
      && error.details.issues.some((issue) => issue.includes("世界内语言"))
  );
});

test("V2.3 rejects source-shell entities and semantic entity type mismatches", () => {
  const shell = buildV23Outline();
  shell.entities[0].name = "来源01-1·签名时间戳原始来源";
  assert.throws(
    () => validateStoryOutline(shell, spec, { strict: true }),
    (error) => error.details.issues.some((issue) => issue.includes("来源壳"))
  );

  const wrongType = buildV23Outline();
  wrongType.entities[0].type = "physicalObject";
  assert.throws(
    () => validateStoryOutline(wrongType, spec, { strict: true }),
    (error) => error.details.issues.some((issue) => issue.includes("语义冲突"))
  );

  const personnelAsOrganization = buildV23Outline();
  personnelAsOrganization.entities.push({
    key: "entity-league-staff",
    type: "organization",
    name: "联盟人员",
    aliases: [],
    meaning: "负责联络和现场执行的多人工作集合"
  });
  assert.throws(
    () => validateStoryOutline(personnelAsOrganization, spec, { strict: true }),
    (error) => error.details.issues.some((issue) => issue.includes("type=organization") && issue.includes("应为 group"))
  );
});

test("V2.3 entity typing does not turn a technical officer into a system from the job description alone", () => {
  const raw = buildV23Outline();
  raw.entities.push({
    key: "npc-technical-officer",
    type: "npc",
    name: "林渡",
    aliases: ["联盟技术官"],
    meaning: "联盟技术官，提供服务器镜像和日志，但本人不解释授权语义。"
  });
  assert.doesNotThrow(() => validateStoryOutline(raw, spec, { strict: true }));
});

test("V2.3 rejects resolution-only players masquerading as core responsibility", () => {
  const raw = buildV23Outline();
  raw.responsibilityRoles = raw.responsibilityRoles.map((entry) => ({ ...entry, responsibilityType: "resolution" }));
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.details.issues.some((issue) => issue.includes("受害者、钥匙或最终裁决者"))
  );
});

test("V2.3 rejects an ending consequence that contradicts its state value semantics", () => {
  const raw = buildV23Outline();
  raw.endingLogic.stateVariables[0].valueSemantics.find((entry) => entry.value === "signature").incompatibleClaims = ["签名快照被永久销毁"];
  raw.endingLogic.routes[0].consequence = "签名快照被永久销毁，但系统仍宣告该路线成立。";
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.details.issues.some((issue) => issue.includes("语义冲突"))
  );
});

test("batch gate rejects a shared-middle-name matrix even when every name is unique", () => {
  const outline = buildV23Outline();
  outline.players = ["沈砚川", "闻砚宁", "秦砚衡", "梁砚岚", "季砚昭", "萧砚野"].map((name, index) => ({
    key: `role-${index + 1}`,
    name,
    identity: "互不属于同一家族的现代职业角色",
    contribution: { anchorType: ["evidence", "authority", "task", "relationship", "commitment", "resource"][index] }
  }));
  const report = validateOutlineBatchDiversity([outline], { throwOnFailure: false });
  assert.ok(report.issues.some((issue) => issue.includes("机械姓名矩阵")));
});

test("non-strict reader remains available for inspecting rejected drafts, while strict acceptance rejects them", () => {
  const raw = buildStrictOutline();
  raw.players[0].activePlan = "调查真相";
  const delivered = validateStoryOutline(raw, spec);
  assert.equal(delivered.outlineRevision, "2.2");
  assert.equal(delivered.players[0].activePlan, "调查真相");
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.code === "DEEPSEEK_OUTPUT_INVALID"
  );
});

test("legacy outline stays readable but is not expansion-ready", () => {
  const outline = validateStoryOutline({
    logline: "旧版测试大纲",
    truthTimeline: "旧版真相",
    redHerrings: [],
    chapterBeats: [{ chapterKey: "chapter-1", title: "开场", goal: "集合", turn: "门被锁上", hostNotes: "控制节奏" }]
  }, spec);
  assert.equal(outline.outlineVersion, 1);
  assert.equal(outline.readiness.readyForExpansion, false);
});

test("strict outline rejects fake dual-source evidence", () => {
  const raw = buildStrictOutline();
  raw.evidenceGraph.evidence[1].sourceType = "密码学签名";
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.code === "DEEPSEEK_OUTPUT_INVALID" && error.details.issues.some((issue) => issue.includes("两类真正独立"))
  );
});

test("strict outline rejects evidence labels that share one provenance root", () => {
  const raw = buildStrictOutline();
  raw.evidenceGraph.evidence[1].provenanceGroup = raw.evidenceGraph.evidence[0].provenanceGroup;
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.code === "DEEPSEEK_OUTPUT_INVALID"
      && error.details.repairMode === "rebuild"
      && error.details.issues.some((issue) => issue.includes("伪双源"))
  );
});

test("strict outline rejects generic filler actions and requests a rebuild", () => {
  const raw = buildStrictOutline();
  raw.players[0].chapterActions[0].action = "调查线索";
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.code === "DEEPSEEK_OUTPUT_INVALID"
      && error.details.repairMode === "rebuild"
      && error.details.issues.some((issue) => issue.includes("泛化行动"))
  );
});

test("strict outline rejects unreachable ending requirements", () => {
  const raw = buildStrictOutline();
  raw.endingLogic.routes[0].requirements[0].value = "never-written";
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.code === "DEEPSEEK_OUTPUT_INVALID"
      && error.details.issues.some((issue) => issue.includes("不可达条件"))
  );
});

test("mandatory public resource deltas cannot be skipped to fake an ending route", () => {
  const raw = buildStrictOutline();
  raw.resources = [{
    key: "resource-review",
    name: "正式复核席位",
    valueType: "integer",
    initialValue: 2,
    minimum: 0,
    maximum: 2,
    ownerType: "group",
    ownerKey: "",
    recoverable: false,
    meaning: "全组能够发起正式复核的剩余席位"
  }];
  for (const beat of raw.chapterBeats) {
    beat.resourceDeltas = [{
      resourceKey: "resource-review",
      operation: "lose",
      amount: 1,
      affectsRoleKeys: ["role-1"],
      consequence: "执行本章正式复核后永久消耗一个席位"
    }];
  }
  raw.endingLogic.routes[0].requirements.push({
    targetType: "resource",
    targetKey: "resource-review",
    operator: "gte",
    value: 1
  });
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.code === "DEEPSEEK_OUTPUT_INVALID"
      && error.details.issues.some((issue) => issue.includes("resource:resource-review gte 1"))
  );
});

test("strict outline rejects contradictory AND requirements in one route", () => {
  const raw = buildStrictOutline();
  raw.endingLogic.routes[0].requirements.push({
    targetType: "state",
    targetKey: "state-frozen-source",
    operator: "equals",
    value: "temperature"
  });
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.code === "DEEPSEEK_OUTPUT_INVALID"
      && error.details.issues.some((issue) => issue.includes("互相冲突的 AND 条件"))
  );
});

test("strict outline rejects evidence derivation cycles", () => {
  const raw = buildStrictOutline();
  raw.evidenceGraph.evidence[0].derivedFromEvidenceKeys = ["evidence-2"];
  raw.evidenceGraph.evidence[1].derivedFromEvidenceKeys = ["evidence-1"];
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.code === "DEEPSEEK_OUTPUT_INVALID"
      && error.details.issues.some((issue) => issue.includes("证据派生循环"))
  );
});

test("strict outline rejects generic final-choice fingerprints", () => {
  const raw = buildStrictOutline();
  raw.batchFingerprint.finalChoiceType = "是否公开真相与接受道德抉择";
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.code === "DEEPSEEK_OUTPUT_INVALID" && error.details.issues.some((issue) => issue.includes("批量生成泛化模板"))
  );
});

test("strict outline classifies a missing local field as a patch repair", () => {
  const raw = buildStrictOutline();
  raw.players[0].chapterActions[0].method = "";
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.code === "DEEPSEEK_OUTPUT_INVALID"
      && error.details.repairMode === "patch"
      && error.details.issues.some((issue) => issue.includes(".method"))
  );
});

test("emotional outlines can pass without an evidence graph", () => {
  const raw = buildStrictOutline();
  raw.genreProfile.mode = "emotional";
  raw.genreProfile.chapterProgressRule = "每章通过承诺、关系或记忆状态改变人物可选择的关系路线。";
  raw.genreProfile.decisionCadence = "两章都位于关系转折点，因此本例仍保留两次实质承诺选择。";
  raw.players = raw.players.map((player, index) => ({
    ...player,
    exclusiveAnchorKey: index < 2 ? "state-frozen-source" : "state-responsibility",
    contribution: {
      ...player.contribution,
      anchorType: "relationship",
      anchorKeys: [index < 2 ? "state-frozen-source" : "state-responsibility"]
    },
    chapterActions: player.chapterActions.map((action) => ({
      ...action,
      actionTargetKey: index < 2 ? "state-frozen-source" : "state-responsibility",
      evidenceKeys: [],
      evidenceEffectKeys: []
    }))
  }));
  raw.misdirections[0].kind = "memory";
  raw.misdirections[1].kind = "relationship";
  raw.misdirections[0].supportKeys = ["state-frozen-source"];
  raw.misdirections[0].disproofKeys = ["state-responsibility"];
  raw.misdirections[1].supportKeys = ["state-responsibility"];
  raw.misdirections[1].disproofKeys = ["state-frozen-source"];
  raw.sourceFidelity.premiseElements[0].supportKeys = ["state-frozen-source"];
  raw.sourceFidelity.premiseElements[1].supportKeys = ["state-responsibility"];
  raw.hookPromises[0].supportKeys = ["state-frozen-source", "state-responsibility"];
  raw.evidenceGraph = { evidence: [], conclusions: [] };
  raw.chapterBeats[0].progressMode = "commitment";
  raw.chapterBeats[1].progressMode = "relationship";
  raw.chapterBeats[0].actionTargetKey = "state-frozen-source";
  raw.chapterBeats[1].actionTargetKey = "state-responsibility";
  raw.chapterBeats[0].unlocksEvidenceKeys = [];
  raw.chapterBeats[1].onReadFail.locksEvidenceKeys = [];
  raw.chapterBeats[0].evidenceKeys = [];
  raw.chapterBeats[1].evidenceKeys = [];
  const outline = validateStoryOutline(raw, spec, { strict: true });
  assert.equal(outline.genreProfile.mode, "emotional");
  assert.deepEqual(outline.evidenceGraph.evidence, []);
  assert.deepEqual(outline.chapterBeats[1].evidenceKeys, []);
});

test("strict outline rejects drift from the original premise", () => {
  const raw = buildStrictOutline();
  assert.throws(
    () => validateStoryOutline(raw, spec, {
      strict: true,
      brief: { title: "回声庭审", premise: "海堤听证会的潮位表提前写出表决结果" }
    }),
    (error) => error.code === "DEEPSEEK_OUTPUT_INVALID" && error.details.issues.some((issue) => issue.includes("必须原样取自 brief.premise"))
  );
});

test("strict outline rejects registering a player again as an NPC", () => {
  const raw = buildStrictOutline();
  raw.entities.push({ key: "npc-shen-yan", type: "npc", name: "沈砚" });
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.code === "DEEPSEEK_OUTPUT_INVALID"
      && error.details.issues.some((issue) => issue.includes("玩家不得再次登记"))
  );
});

test("a non-evidence contribution may still own a separate exclusive evidence clue", () => {
  const raw = buildStrictOutline();
  raw.players[2].exclusiveAnchorKey = "evidence-1";
  const outline = validateStoryOutline(raw, spec, { strict: true });
  assert.equal(outline.players[2].contribution.anchorType, "authority");
  assert.equal(outline.players[2].exclusiveAnchorKey, "evidence-1");
});

test("strict outline rejects mixing numeric state declarations with enum values", () => {
  const raw = buildStrictOutline();
  raw.endingLogic.stateVariables[0] = {
    ...raw.endingLogic.stateVariables[0],
    valueType: "number",
    initialValue: 0,
    allowedValues: []
  };
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.code === "DEEPSEEK_OUTPUT_INVALID"
      && error.details.issues.some((issue) => issue.includes("数值状态") && issue.includes("JSON 数字"))
  );
});

test("strict outline rejects modeling the same concept as both state and resource", () => {
  const raw = buildStrictOutline();
  raw.resources.push({
    key: "frozen-source",
    valueType: "integer",
    initialValue: 2,
    minimum: 0,
    maximum: 3,
    ownerType: "group",
    meaning: "与 state-frozen-source 重复的错误资源"
  });
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.code === "DEEPSEEK_OUTPUT_INVALID"
      && error.details.issues.some((issue) => issue.includes("同时登记为状态") && issue.includes("资源"))
  );
});

test("strict outline rejects generic trust states and missing style execution", () => {
  const raw = buildStrictOutline();
  raw.endingLogic.stateVariables.push({
    key: "state-trust",
    valueType: "number",
    initialValue: 0,
    allowedValues: [],
    setInChapterKey: "chapter-1",
    meaning: "万能信任值"
  });
  raw.styleContract.chapterExpressions = raw.styleContract.chapterExpressions.slice(0, 1);
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.code === "DEEPSEEK_OUTPUT_INVALID"
      && error.details.issues.some((issue) => issue.includes("禁止使用批量模板状态"))
      && error.details.issues.some((issue) => issue.includes("styleContract.chapterExpressions"))
  );
});

test("strict outline rejects a decorative genre mechanic without executable outcomes", () => {
  const raw = buildStrictOutline();
  raw.genreMechanic.trigger = "";
  raw.genreMechanic.successEffect = "";
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.code === "DEEPSEEK_OUTPUT_INVALID"
      && error.details.issues.some((issue) => issue.includes("genreMechanic.trigger"))
      && error.details.issues.some((issue) => issue.includes("genreMechanic.successEffect"))
  );
});

test("batch validator reports repeated names and engines", () => {
  const outlines = [buildStrictOutline(), buildStrictOutline(), buildStrictOutline()];
  const report = validateOutlineBatchDiversity(outlines, { throwOnFailure: false });
  assert.equal(report.pass, false);
  assert.ok(report.issues.some((issue) => issue.includes("沈砚")));
  assert.ok(report.issues.some((issue) => issue.includes("storyEngine")));
});

test("batch validator reports provisional similarity as review warnings by default", () => {
  const current = buildStrictOutline();
  current.players = current.players.map((player, index) => ({ ...player, name: `当前角色${index + 1}` }));
  const historical = buildStrictOutline();
  historical.players = historical.players.map((player, index) => ({ ...player, name: `历史角色${index + 1}` }));
  historical.batchFingerprint = Object.fromEntries(
    Object.entries(historical.batchFingerprint).map(([key, value]) => [key, `${value}历史变体`])
  );
  const report = validateOutlineBatchDiversity([current], {
    throwOnFailure: false,
    historicalItems: [historical]
  });
  assert.equal(report.pass, true);
  assert.equal(report.similarity.enforcement, "review");
  assert.ok(report.warnings.some((issue) => issue.includes("历史") || issue.includes("复核")));
});

test("batch validator can enforce a calibrated similarity policy", () => {
  const current = buildStrictOutline();
  const historical = buildStrictOutline();
  const report = validateOutlineBatchDiversity([current], {
    throwOnFailure: false,
    historicalItems: [historical],
    similarityPolicy: { enforcement: "reject", compositeThreshold: 0.72 }
  });
  assert.equal(report.pass, false);
  assert.ok(report.issues.some((issue) => issue.includes("十一维字符相似度")));
});

test("strict outline requires executable read-failure variants", () => {
  const raw = buildStrictOutline();
  raw.chapterBeats[1].onReadFail = {
    variantKey: "empty-fallback",
    fallbackAction: "绕路继续",
    additionalCosts: [],
    stateWrites: [],
    locksEvidenceKeys: [],
    unlocksEvidenceKeys: []
  };
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.code === "DEEPSEEK_OUTPUT_INVALID"
      && error.details.issues.some((issue) => issue.includes("onReadFail"))
  );
});

test("strict outline rejects string resource amounts", () => {
  const raw = buildStrictOutline();
  raw.chapterBeats[0].resourceDeltas = [{
    resourceKey: "appeal-token",
    operation: "lose",
    amount: "1",
    affectsRoleKeys: ["role-2"],
    consequence: "失去一次正式复核机会"
  }];
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.code === "DEEPSEEK_OUTPUT_INVALID"
      && error.details.issues.some((issue) => issue.includes("不能使用字符串"))
  );
});

test("strict outline rejects overloaded and undistributed spotlight chapters", () => {
  const raw = buildStrictOutline();
  raw.players = raw.players.map((player) => ({
    ...player,
    spotlightChapterKey: "chapter-1",
    contribution: {
      ...player.contribution,
      turnChapterKeys: [...new Set([...player.contribution.turnChapterKeys, "chapter-1"])]
    }
  }));
  raw.chapterBeats[0].triggerRoleKeys = raw.players.map((player) => player.key);
  assert.throws(
    () => validateStoryOutline(raw, spec, { strict: true }),
    (error) => error.code === "DEEPSEEK_OUTPUT_INVALID"
      && error.details.issues.some((issue) => issue.includes("聚光"))
  );
});

test("V2.1 remains readable but cannot enter V2.2 expansion", () => {
  const raw = buildStrictOutline();
  raw.outlineRevision = "2.1";
  const outline = validateStoryOutline(raw, spec);
  assert.equal(outline.outlineRevision, "2.1");
  assert.equal(outline.readiness.protocol, "legacy-outline-v2.1");
  assert.equal(outline.readiness.readyForExpansion, false);
});

test("non-strict reader keeps V2.0 readable without marking it expansion-ready", () => {
  const raw = buildStrictOutline();
  raw.outlineRevision = "2.0";
  const outline = validateStoryOutline(raw, spec);
  assert.equal(outline.outlineVersion, 2);
  assert.equal(outline.outlineRevision, "2.0");
  assert.equal(outline.readiness.protocol, "legacy-outline-v2.0");
  assert.equal(outline.readiness.readyForExpansion, false);
  assert.ok(outline.chapterBeats.length > 0);
});
