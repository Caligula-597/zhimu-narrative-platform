import { PRODUCT_BOUNDARY, cleanText, untrustedUserPayload } from "./shared.js";

export const SOURCE_ADAPTATION_PROMPT_VERSION = "v1.3-source-logic-before-dramatization";

/**
 * Standalone preflight: run before premise, outline, character or mechanism generation.
 * It deliberately forbids story ideation so the model cannot hide source loss behind a vivid hook.
 */
export const SOURCE_ADAPTATION_PREFLIGHT_BLOCK = `【原素材忠实改编预检 · 先保住思考运动，再允许造故事】
本轮不是摘要、主题提炼或故事创意会。禁止起案名、写 logline、发明人物、案件、世界观、象征物、反转或结局。

你的任务是把原素材还原为一条可审计的“思考—矛盾—权力—后果”链：
1. 逐段识别说话者从什么初始认识出发，被什么事实或反例逼到下一个问题；不得把最后结论倒灌成所有段落的统一含义。
2. 区分三种内容：核心矛盾、帮助理解的例子、重复或修辞。不要把每个例子机械升级成独立主题，也不要用一句中心思想吞并多个递进矛盾。
3. 每个核心矛盾必须保留一段原文连续短语作为 sourceAnchor，并说明删掉它会使后续哪一步失去因果。
4. 对每个核心矛盾写清：原文中互相抵触的两股判断或现实压力、议价权来自哪里、它在全文中负责怎样的过渡、必须保留何种权力翻转、删除后哪段后果无法成立。本阶段不设计人物欲望和剧情动作。
5. 作者的明确立场、尚未解决的问题和故意保留的偏激必须分开。不得为了“客观”磨平立场，也不得把立场伪造成故事唯一正确答案。
6. 合并两组矛盾必须证明：同一行动能分别保留二者的权力变化与后续反噬。仅仅“都与价值有关”不构成合并理由。
7. 做反事实删除测试：删除任一 mustPreserve 项后，若剩余故事仍可不受影响地成立，说明你尚未找到它的戏剧承载义务。
8. 做语义换题检查：一个新故事即使谈论相似主题，只要删除了原素材的思考顺序、反例或权力反转，也属于 semantic_substitution，不属于忠实改编。
9. 预检阶段禁止合并核心矛盾，宁可多拆，不可先压缩。只要讨论对象、议价权来源、定价机制、时间尺度、受损者或在全文中的因果功能发生变化，就必须新建 thoughtMovement 和 conflictLedger 条目，即使它们出现在同一段、都能被概括为“价值问题”。合并只能作为后续候选建议，不能从账本中删除原条目。
10. 保持原素材讨论的结构层级。素材在谈制度、市场、家庭资源或代际承诺时，不得擅自改写成“自我认同、价值虚无、内心成长”等个人心理母题；除非原文确实这样说。
11. thoughtMovement 中每个 mustPreserve 阶段必须至少由一个独立 conflictLedger 条目承载；每条 conflictLedger 在预检阶段只能引用一个 thoughtId。所有 mustPreserve 冲突必须进入 causalEdges，不能成为不影响其他部分的孤岛。
12. 若原素材后段让早先被质疑的逻辑重新变得诱人，causalEdges 必须使用 edgeType=return 标出回返，不能强行整理成单向直线。
13. 判断“例子能否省略”时使用因果铰链测试。只要一段内容引入了新的交易领域、新的议价权来源、新的定价机制、新的时间尺度、新的受损者，或负责把上一问推向下一问，它就是核心桥梁，不是可省略例子。连续列举若共同建立“数据化、排名、制度化比较”等新机制，也必须独立保留，不能因句式重复而删除。
14. questionsForAuthor 只允许询问原素材确实缺少的信息，不得反问作者“这一大段是否需要保留”。对素材中被反复解释、承担过渡或引出下一问的内容，默认必须保留。
15. 本阶段禁止填写人物欲望、心理成长、稀缺资源配方和具体案件动作。它们属于通过预检后的“人物承载设计”。不得把制度、市场、家庭资源或代际承诺改写成“稳定自我价值感”“价值虚无”“寻找内在价值”等心理母题。
16. edgeType=return 必须从后段冲突指回前面已经登记的旧冲突，表示旧逻辑重新获得吸引力；指向后面的总结或新结论不算回返。
17. thoughtMovement 必须按原素材首次出现顺序排列。后文回看或修正前文时，用 dependsOn 和 causalEdges 表达，不得把前段遗漏项补到数组末尾伪装成完整覆盖。
18. conflictLedger 中的 pressureA 与 pressureB 都必须附带原文连续 sourceAnchor。若原文只提出单向判断、尚未给出对立压力，应如实标记为 unresolved，不得为了结构好看发明“爱情对抗交易”“自我价值对抗外部评价”等通用矛盾。

只有当所有 mustPreserve 矛盾均被识别、因果依赖完整、无未解释遗漏时，coverageAudit.readyForPremise 才能为 true。`;

/** Injected into premise/outline generation after a preflight ledger exists, or used as an internal fallback. */
export const SOURCE_ADAPTATION_GENERATION_BLOCK = `【原素材改编门禁 · 禁止用高概念换题】
- 在生成 logline 之前，先读取原素材与已有 sourceConflictLedger；若没有账本，在内部按“思考阶段—核心矛盾—依赖关系—权力翻转—延迟后果”完成同等预检，禁止直接概括中心思想。
- 原素材有多组递进矛盾时，必须让它们发生在同一批人物的共同历史中。前一组冲突要制造后一组冲突所需的债务、资格、羞辱、资源、权力或不信任，不能并列成议题清单。
- 一组矛盾只有同时具备“人物行动、议价权变化、即时得失、后续反噬、玩家可改变的现实”才算被改编。只复用名词、台词、场景、象征物或相似主题，一律不计覆盖。
- 禁止 high-loss compression：不得为了一个更好卖的一句话钩子，只保留最醒目、最残酷或最容易视觉化的冲突。
- 禁止 semantic substitution：不得另造一个内部完整、语义相近的故事，替换原素材真正的思考推进。故事自身成立不能抵消素材背叛。
- “尖锐”首先来自同一套规则换手后反噬先前赢家，而不是死亡、暴力、贫困等极端意象本身。冲击性事件若不承载原素材的递进关系，必须删除。
- sourceFidelity.premiseElements 不是凑满两条的引用栏。原素材每组不可合并的核心矛盾都必须有独立条目；implementation 必须同时写出人物行动、权力变化、延迟后果，并引用实际 chapterKeys 与 supportKeys。
- 允许压缩篇幅，不允许压缩逻辑。若章节容量不足，应减少支线和装饰，而不是删除原素材的关键反例、立场转折或代际后果。`;

/** Kept shorter because it is repeated for every narrative and player-script generation call. */
export const SOURCE_ADAPTATION_CONTINUITY_BLOCK = `【原素材连续性 · 正文扩写不得二次换题】
- 当前章节必须兑现纲要已登记的原素材矛盾后果；不得只重复观点名词或安排角色代替作者复述口播。
- 冲突只有在行动改变资源、权限、关系、债务或下一幕选择时才算推进。
- 不得用新出现的强意象、案件奇观或温暖和解覆盖先前已经建立的权力反转。
- 若本章容量不足，保留因果与人物关系，先删解释、象征和支线。`;

/** Evaluation gate: source fidelity is judged before prose quality or internal coherence. */
export const SOURCE_ADAPTATION_REVIEW_BLOCK = `【原素材忠实度红队 · 先查有没有换题】
评判前必须并排比较完整原素材、矛盾账本（若有）和当前成稿。不要只比较主题词是否相似。

逐项检查：
1. high_loss_compression：是否把多组递进矛盾压成一个中心命题或一句话钩子；
2. semantic_substitution：是否写出了一个内部完整但只在语义上相邻的新故事；
3. shock_substitution：是否用死亡、暴力、贫困、牺牲等强意象冒充原素材的逻辑锋利；
4. debate_listing：是否保留了所有议题名词，却只让角色轮流讨论，没有改变后续现实；
5. stance_neutralization：是否把作者的鲜明判断安全地配平成“每个人都有道理”；
6. causal_isolation：某组矛盾删掉后，其他剧情是否完全不受影响；
7. reversal_loss：原素材中规则换手、赢家变输家或承诺反噬是否被删除；
8. source_truncation：输入是否疑似被截断，尤其是后半部分的反例、转折与结论是否缺失。

前六项任一严重成立，必须产生 high severity 的 sourceFidelity issue、setup 层 must_fix，readyForImport=false。不要用“主题相符、文笔不错、故事自洽”抵消。若 source_truncation 成立，停止文学评判并要求补齐原素材。`;

export function buildSourceAdaptationPreflightMessages({
  title = "",
  sourceType = "口播/文章/创作笔记",
  sourceMaterial = "",
  authorNotes = "",
  intendedFormat = "多人视角剧本杀"
} = {}) {
  const system = `你是原素材忠实改编编辑。你只做改编前的矛盾与因果预检，不生成故事。

${PRODUCT_BOUNDARY}

${SOURCE_ADAPTATION_PREFLIGHT_BLOCK}

【唯一允许的输出 schema】
{
  "version": "1.0",
  "sourceIdentity": {
    "workingTitle": "原素材标题",
    "sourceType": "口播/文章/创作笔记",
    "intendedFormat": "多人视角剧本杀"
  },
  "authorCore": {
    "declaredStances": [{"sourceAnchor":"原文连续短语", "stance":"作者明确坚持的判断", "limit":"原文为这个判断保留的边界，禁止擅自绝对化"}],
    "unresolvedQuestions": [{"sourceAnchor":"原文连续短语", "question":"作者仍在追问、不得提前封口的问题"}],
    "sharpnessMechanism": "原素材的锋利来自怎样的逻辑推进或回旋镖",
    "nonThemePrivateMaterial": ["属于生活、关系或个人经验而非议题证明的内容"]
  },
  "thoughtMovement": [{
    "id": "thought-1",
    "sourceAnchor": "逐字摘取原文连续短语（8～80字）",
    "startsFrom": "这一阶段的初始认识",
    "complicatedBy": "什么反例或现实使它不够用",
    "turnsIntoQuestion": "它把作者逼向什么新问题",
    "dependsOn": [],
    "mustPreserve": true,
    "lossIfRemoved": "删除后哪段后续推理或戏剧反噬会失去根"
  }],
  "conflictLedger": [{
    "id": "conflict-1",
    "thoughtIds": ["thought-1（预检阶段恰好一个）"],
    "sourceAnchor": "这一矛盾对应的原文连续短语",
    "surfaceTopic": "表层话题",
    "structuralLevel": "interpersonal|family|institution|market|technology|intergenerational|moral_boundary",
    "pressureA": {"sourceAnchor":"原文连续短语", "claimOrPressure":"原文中的第一股判断或现实压力"},
    "pressureB": {"sourceAnchor":"原文连续短语；若原文没有则为空", "claimOrPressure":"第二股压力，或明确写 unresolved"},
    "powerBasis": "当前议价权来自哪里",
    "causalFunction": "它在全文中负责 bridge|counterexample|escalation|return|synthesis 中哪一种推进",
    "requiredFutureReversal": "未来改编必须保留的规则换手或反噬；只写义务，不发明情节",
    "sourceConsequence": "原文已经指出的后果",
    "adaptationObligation": "未来人物设计必须兑现什么因果，不写具体人物、案件或结局",
    "forbiddenShortcut": "最容易把这一项缩成什么廉价主题或心理母题"
  }],
  "causalEdges": [{
    "fromConflictId": "conflict-1",
    "toConflictId": "conflict-2",
    "edgeType": "escalation|counterexample|reversal|return|synthesis",
    "because": "前者具体制造了后者的什么条件"
  }],
  "authorialBoundaries": {
    "mustNotNeutralize": ["不得磨平的立场"],
    "mustRemainOpen": ["应留给玩家解释的动机或判断"],
    "forbiddenSubstitutions": ["看似相关、实际会换题的廉价替代方案"]
  },
  "coverageAudit": {
    "mustPreserveThoughtIds": ["thought-1"],
    "mustPreserveConflictIds": ["conflict-1"],
    "omittedSourceSegments": [{"sourceAnchor":"原文片段", "reason":"为何可以省略"}],
    "mergeCandidates": [{"conflictIds":["conflict-1","conflict-2"], "reason":"未来为何可能共用场景或人物，但当前仍保留为两条", "preservedDifferences":["不可被吞掉的差异"]}],
    "highLossCompressionRisk": "low|medium|high",
    "semanticSubstitutionRisks": ["最可能出现的换题方式"],
    "readyForPremise": false
  },
  "questionsForAuthor": ["只有素材确实无法判断时才提出的问题"]
}`;

  const user = `请对原素材执行忠实改编预检。不要生成任何故事创意。

${untrustedUserPayload("素材元信息", {
  title: cleanText(title, 200),
  sourceType: cleanText(sourceType, 120),
  intendedFormat: cleanText(intendedFormat, 120),
  authorNotes: cleanText(authorNotes, 6000)
})}

${untrustedUserPayload("完整原素材", cleanText(sourceMaterial, 30000))}

只返回 JSON。`;

  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export function buildSourceAdaptationPreflightRepairMessages({
  title = "",
  sourceType = "口播/文章/创作笔记",
  sourceMaterial = "",
  authorNotes = "",
  intendedFormat = "多人视角剧本杀",
  rejectedDraft = {},
  audit = {}
} = {}) {
  const messages = buildSourceAdaptationPreflightMessages({
    title,
    sourceType,
    sourceMaterial,
    authorNotes,
    intendedFormat
  });
  messages[0].content += `

【退回修复轮 · 只修账本，不得趁机生成故事】
上一版预检已被机械门禁拒绝。本轮必须逐条修复 audit 中列出的缺失、提前合并、因果断点和非原文锚点；已经正确的条目尽量保留。
- missingSemanticGroups 表示原素材中的独立机制尚无 conflictLedger 承载。必须回到完整原文寻找连续 sourceAnchor，新增独立 thoughtMovement、conflictLedger 与 causalEdges，禁止只在旧条目里补一个关键词骗过检查。
- 非原文连续锚点必须换成真正连续的原句，不能跳过中间段落拼接。
- 若某个 edgeType=return，必须明确指回更早出现的旧冲突。
- 不得删除其他已通过条目来降低数量，也不得把漏项塞进 existing conflict 的 surfaceTopic。
- 只有审计问题全部修复、每项漏失机制都有独立承载时，才能把 readyForPremise 设为 true。`;
  messages[1].content += `

${untrustedUserPayload("被拒绝的上一版预检", rejectedDraft)}

${untrustedUserPayload("机械审计失败项（必须逐条修复）", audit)}

返回完整修复版 JSON，不要只返回 patch。`;
  return messages;
}

const list = (value) => (Array.isArray(value) ? value : []);
const record = (value) => (value && typeof value === "object" ? value : {});
const normalizedAnchor = (value) => String(value || "")
  .normalize("NFKC")
  .replace(/\*\*|__|`/g, "")
  .replace(/\s+/g, "")
  .trim();

/**
 * Mechanical integrity gate for preflight output. It cannot judge literary quality,
 * but it prevents the model from declaring itself ready after dropping or merging rows.
 */
export function validateSourceAdaptationPreflight(raw, sourceMaterial = "") {
  const value = record(raw);
  const thoughtMovement = list(value.thoughtMovement);
  const conflictLedger = list(value.conflictLedger);
  const causalEdges = list(value.causalEdges);
  const coverageAudit = record(value.coverageAudit);
  const issues = [];
  const source = normalizedAnchor(sourceMaterial);
  const sourceAnchorPositions = [];
  const forbiddenPsychologicalSubstitutions = /稳定的?自我价值感|寻找内在价值|身份危机|价值虚无|重新定义自我|心理成长/u;

  const thoughtIds = new Set();
  for (const [index, thought] of thoughtMovement.entries()) {
    const id = String(thought?.id || "").trim();
    if (!id) issues.push(`thoughtMovement[${index}] 缺少 id`);
    if (thoughtIds.has(id)) issues.push(`thoughtMovement id 重复：${id}`);
    if (id) thoughtIds.add(id);
    const anchor = normalizedAnchor(thought?.sourceAnchor);
    if (!anchor || (source && !source.includes(anchor))) {
      issues.push(`thoughtMovement[${index}].sourceAnchor 不是原素材连续文本`);
    } else if (source) {
      sourceAnchorPositions.push({ index, position: source.indexOf(anchor) });
    }
  }
  for (let index = 1; index < sourceAnchorPositions.length; index += 1) {
    if (sourceAnchorPositions[index].position < sourceAnchorPositions[index - 1].position) {
      issues.push(`thoughtMovement[${sourceAnchorPositions[index].index}] 未按原素材出现顺序排列`);
    }
  }

  const mustThoughtIds = new Set(list(coverageAudit.mustPreserveThoughtIds).map(String));
  for (const id of mustThoughtIds) {
    if (!thoughtIds.has(id)) issues.push(`mustPreserveThoughtId 未登记：${id}`);
  }

  const conflictIds = new Set();
  const conflictOrder = new Map();
  const coveredThoughtIds = new Set();
  for (const [index, conflict] of conflictLedger.entries()) {
    const id = String(conflict?.id || "").trim();
    if (!id) issues.push(`conflictLedger[${index}] 缺少 id`);
    if (conflictIds.has(id)) issues.push(`conflictLedger id 重复：${id}`);
    if (id) {
      conflictIds.add(id);
      conflictOrder.set(id, index);
    }
    const refs = list(conflict?.thoughtIds).map(String).filter(Boolean);
    if (refs.length !== 1) {
      issues.push(`conflictLedger[${index}] 预检阶段必须恰好引用一个 thoughtId，禁止提前合并`);
    }
    for (const ref of refs) {
      coveredThoughtIds.add(ref);
      if (!thoughtIds.has(ref)) issues.push(`conflictLedger[${index}] 引用了未知 thoughtId：${ref}`);
    }
    const anchor = normalizedAnchor(conflict?.sourceAnchor);
    if (!anchor || (source && !source.includes(anchor))) {
      issues.push(`conflictLedger[${index}].sourceAnchor 不是原素材连续文本`);
    }
    for (const pressureKey of ["pressureA", "pressureB"]) {
      const pressure = record(conflict?.[pressureKey]);
      const pressureAnchor = normalizedAnchor(pressure.sourceAnchor);
      const isUnresolved = String(pressure.claimOrPressure || "").trim().toLowerCase() === "unresolved";
      if (!isUnresolved && (!pressureAnchor || (source && !source.includes(pressureAnchor)))) {
        issues.push(`conflictLedger[${index}].${pressureKey}.sourceAnchor 不是原素材连续文本`);
      }
    }
    for (const field of ["powerBasis", "causalFunction", "requiredFutureReversal", "sourceConsequence", "adaptationObligation", "forbiddenShortcut"]) {
      if (String(conflict?.[field] || "").trim().length < 4) {
        issues.push(`conflictLedger[${index}].${field} 缺失或过短`);
      }
    }
    const groundedFields = [
      conflict?.powerBasis,
      conflict?.requiredFutureReversal,
      conflict?.sourceConsequence,
      conflict?.adaptationObligation
    ].join(" ");
    if (forbiddenPsychologicalSubstitutions.test(groundedFields)) {
      issues.push(`conflictLedger[${index}] 把结构矛盾擅自改写成心理母题`);
    }
  }

  for (const id of mustThoughtIds) {
    if (!coveredThoughtIds.has(id)) issues.push(`mustPreserve 思考阶段没有独立冲突承载：${id}`);
  }
  const mustConflictIds = new Set(list(coverageAudit.mustPreserveConflictIds).map(String));
  for (const id of mustConflictIds) {
    if (!conflictIds.has(id)) issues.push(`mustPreserveConflictId 未登记：${id}`);
  }

  const adjacency = new Map([...mustConflictIds].map((id) => [id, new Set()]));
  for (const [index, edge] of causalEdges.entries()) {
    const from = String(edge?.fromConflictId || "").trim();
    const to = String(edge?.toConflictId || "").trim();
    if (!conflictIds.has(from) || !conflictIds.has(to)) {
      issues.push(`causalEdges[${index}] 引用了未知冲突`);
      continue;
    }
    if (!String(edge?.edgeType || "").trim()) issues.push(`causalEdges[${index}] 缺少 edgeType`);
    if (edge?.edgeType === "return" && conflictOrder.get(to) >= conflictOrder.get(from)) {
      issues.push(`causalEdges[${index}] 的 return 必须指回更早登记的冲突`);
    }
    if (adjacency.has(from) && adjacency.has(to)) {
      adjacency.get(from).add(to);
      adjacency.get(to).add(from);
    }
  }
  const first = [...mustConflictIds][0];
  const visited = new Set();
  const queue = first ? [first] : [];
  while (queue.length) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    for (const next of adjacency.get(id) || []) queue.push(next);
  }
  for (const id of mustConflictIds) {
    if (!visited.has(id)) issues.push(`核心冲突未进入同一因果图：${id}`);
  }

  const readyForPremise = coverageAudit.readyForPremise === true && issues.length === 0;
  return {
    passed: issues.length === 0,
    readyForPremise,
    modelDeclaredReady: coverageAudit.readyForPremise === true,
    issues,
    counts: {
      thoughtStages: thoughtMovement.length,
      conflicts: conflictLedger.length,
      causalEdges: causalEdges.length,
      mustThoughts: mustThoughtIds.size,
      mustConflicts: mustConflictIds.size
    }
  };
}
