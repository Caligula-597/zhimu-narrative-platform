import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";
import { buildMatrixModeProfile, formatMatrixModeBlock } from "./matrix-2-mode.js";
import { HUMAN_REVIEW_BLOCK } from "./human-authorship.js";
import { playStructureProfile } from "../../../shared/play-structure.js";

function buildScriptCorpus(scripts, config, { fullBody = false } = {}) {
  const keys = config?.chapterKeys || [];
  const rows = [];
  for (const [roleKey, acts] of Object.entries(scripts || {})) {
    for (const actKey of keys) {
      const script = acts?.[actKey];
      if (!script?.body) continue;
      const body = String(script.body);
      rows.push({
        roleKey,
        actKey,
        title: script.title,
        bodyLength: body.length,
        body: fullBody ? body : body.slice(0, 6000),
        tasks: script.tasks,
        closingHook: script.closingHook,
        structured: script.structured
          ? {
              actionLen: script.structured.actionLog?.narrative?.length || 0,
              dialogueLen: script.structured.dialogueLog?.narrative?.length || 0,
              feelings: [
                ...(script.structured.feelingsPack?.puzzles || []),
                ...(script.structured.feelingsPack?.emotions || [])
              ]
            }
          : null
      });
    }
  }
  return rows;
}

/** Group full script text by role for holistic readthrough scoring. */
export function buildScriptReadthroughCorpus(scripts, config, characterArchives) {
  const keys = config?.chapterKeys || Object.keys(Object.values(scripts || {})[0] || {});
  const roleName = (roleKey) =>
    characterArchives?.roles?.find((r) => r.key === roleKey)?.name || roleKey;
  const acts = [];
  for (const [roleKey, roleActs] of Object.entries(scripts || {})) {
    const chapters = [];
    for (const actKey of keys) {
      const script = roleActs?.[actKey];
      if (!script?.body) continue;
      chapters.push({
        actKey,
        title: script.title,
        body: String(script.body),
        tasks: script.tasks,
        closingHook: script.closingHook
      });
    }
    if (!chapters.length) continue;
    acts.push({
      roleKey,
      roleName: roleName(roleKey),
      chapters
    });
  }
  return acts;
}

export function validateMatrixScriptReadthroughEvaluation(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const clamp = (n, fb = 7) => Math.min(10, Math.max(1, Number(n) || fb));
  const scores = value.scores && typeof value.scores === "object" ? value.scores : {};
  const dims = [
    "immersion",
    "voiceDistinctness",
    "perspectiveLimit",
    "dialogueNaturalness",
    "antiAiFlavor",
    "thesisPredictability",
    "subtext",
    "livedExperience",
    "playableOutline",
    "crossRolePlayability",
    "dramaticTension"
  ];
  const normalizedScores = Object.fromEntries(dims.map((k) => [k, clamp(scores[k], k === "dramaticTension" ? 1 : 7)]));
  const hasHigh = Array.isArray(value.issues) && value.issues.some((issue) => issue?.severity === "high");
  const normCell = (item) => ({
    cell: String(item?.cell || "").slice(0, 40),
    excerpt: String(item?.excerpt || "").slice(0, 200),
    why: String(item?.why || "").slice(0, 500)
  });
  return {
    overallScore: clamp(value.overallScore),
    verdict: String(value.verdict || "").slice(0, 600),
    scoringMode: "script-readthrough",
    scores: normalizedScores,
    standoutCells: Array.isArray(value.standoutCells) ? value.standoutCells.slice(0, 8).map(normCell) : [],
    weakCells: Array.isArray(value.weakCells) ? value.weakCells.slice(0, 12).map(normCell) : [],
    issues: Array.isArray(value.issues)
      ? value.issues.slice(0, 12).map((i) => ({
          severity: ["high", "medium", "low"].includes(i?.severity) ? i.severity : "medium",
          area: String(i?.area || "").slice(0, 80),
          detail: String(i?.detail || "").slice(0, 500),
          cells: Array.isArray(i?.cells) ? i.cells.slice(0, 6).map((c) => String(c).slice(0, 40)) : []
        }))
      : [],
    revisions: Array.isArray(value.revisions)
      ? value.revisions.slice(0, 12).map((r) => ({
          targetKey: String(r?.targetKey || "").slice(0, 40),
          priority: ["must_fix", "should_fix", "optional"].includes(r?.priority) ? r.priority : "should_fix",
          problem: String(r?.problem || "").slice(0, 400),
          direction: String(r?.direction || "").slice(0, 500)
        }))
      : [],
    readyForPlayers:
      Boolean(value.readyForPlayers) &&
      normalizedScores.perspectiveLimit >= 7 &&
      normalizedScores.antiAiFlavor >= 7 &&
      normalizedScores.thesisPredictability >= 7 &&
      normalizedScores.subtext >= 6 &&
      normalizedScores.livedExperience >= 7 &&
      normalizedScores.playableOutline >= 7 &&
      normalizedScores.dramaticTension >= 7 &&
      !hasHigh,
    suggestions: Array.isArray(value.suggestions) ? value.suggestions.slice(0, 8).map((s) => String(s).slice(0, 300)) : []
  };
}

/**
 * Holistic LLM readthrough — all role scripts, no matrix/truth/mechanical gates.
 */
export function buildMatrixScriptReadthroughMessages(pipeline) {
  const modeProfile = buildMatrixModeProfile(pipeline.setting || {});
  const modeBlock = formatMatrixModeBlock(modeProfile);
  const corpus = buildScriptReadthroughCorpus(
    pipeline.scripts,
    pipeline.config,
    pipeline.characterArchives
  );
  const roleList = (pipeline.characterArchives?.roles || []).map((r) => ({
    key: r.key,
    name: r.name,
    publicIdentity: r.publicIdentity
  }));

  const system = `你是剧本杀「玩家本通读编辑」。请**完整通读**下方全部角色的私人剧本（按角色、按幕），像真实玩家拿到本后那样评判。

${PRODUCT_BOUNDARY}

${modeBlock}

${HUMAN_REVIEW_BLOCK}

【评判方式】
- **只读剧本正文**：不对照信息矩阵、线索表、真相 Bible；你不应「验机制」，只评「读起来像不像可玩的私人本」。
- **通读交叉**：横向对比各角色口吻、信息错位是否合理；纵向看每幕任务/hook 是否可执行。
- **字数偏短可接受**：demo 档每幕 ~800 字、纲要体（场景顺序 + 简练对白 + 任务）不算扣分项；“简练”不等于连续电报式短答，扣分理由包括「写成了全场摘要/快剪蒙太奇/字段问答」。

【勿误扣分】
- 心理描写、相对时间、按 setting.pov 锁定的第一或第二人称叙述—正常；“我/你”混用才是问题。
- 某角色本里独有的细节 — 正常（错位视角）。
- 真凶私人本内心直白 — 不扣分（别人看不见）。
- 缺少 HH:MM 精确钟点 — 不扣分。

【重点抓的坏味道】
- **心中X 偷懒**：心中冷笑/暗惊/疑云/忐忑/一紧 — LLM 只标情绪不让人看见人；应改成嗅觉触觉听觉动作（范本：韩铁「满手铜锈和机油味」）。
- **上帝视角快剪**：「A 哭诉…B 取出…C 翻…D 惹疑」式并行 roster。
- **凶手犯罪报告**：「我确实试图毒死他但未成功」式事后复盘；真凶应处于记不清/握不住/不敢确认的混沌。
- **AI 标签词**：惹疑、行档、令人费解、不禁想起 等摘要腔。
- **口吻同质化**：六个角色内心独白句式相同。
- **任务悬空**：tasks/closingHook 在正文里找不到抓手。
- **命题先行**：前 10% 已把社会议题、阵营和道德终点说完，后文只剩人物举例。
- **观点席位**：角色可被直接翻译成理性方、感性方、中立方、受害者或既得利益者。
- **过度解释与象征**：动作/旧物之后旁白立刻解释意义，每幕都用金句或象征物封口。
- **任务文学包装**：删掉“你必须/你需要”后正文没有人物关系推动的自发行动理由。

【评判维度】（1-10，须全部输出）
- immersion：代入感与场景画面感。
- voiceDistinctness：角色口吻、职业滤镜是否可区分。
- perspectiveLimit：是否守住有限视角/错位信息（人的精力有限，不可能全知）。
- dialogueNaturalness：对白是否口语化、可念出来；公共场景是否有实对白而非纯叙述。
- antiAiFlavor：少 AI 腔、少标签词、少流水账汇报。
- thesisPredictability：10 分表示开场没有宣布答案，主题从行动后果中迟到浮现；1 分表示读者前段即可预测完整道德路径。
- subtext：人物是否有没说完、说错和延迟理解的空间，旁白是否克制解释。
- livedExperience：正文是否像被角色活过的人生，而非任务、立场和线索的文学包装。
- playableOutline：纲要体是否仍可玩（任务、hook、对质点清楚）。
- crossRolePlayability：通读全部本后，是否像一场能开局的剧本杀（不要求你验证推理真值）。
- dramaticTension：全局是否存在足够尖锐、会真实伤人的主动选择与反制；不要求每一场都对抗，探索、暂时合作和恢复场景本身不扣分，但若连续多幕只有协商、表态、共同投票与平均分配则不得超过 4 分。

【readyForPlayers】
perspectiveLimit≥7、antiAiFlavor≥7、thesisPredictability≥7、subtext≥6、livedExperience≥7、playableOutline≥7、dramaticTension≥7，且无 high severity issues。命题先行、观点席位或公平配平导致无人能真正伤害他人时，即使语句自然也不得通过。

【输出 schema】
{
  "overallScore": 7.5,
  "verdict": "通读总评，2-3 句",
  "scores": {
    "immersion": 8,
    "voiceDistinctness": 7,
    "perspectiveLimit": 6,
    "dialogueNaturalness": 7,
    "antiAiFlavor": 5,
    "thesisPredictability": 5,
    "subtext": 5,
    "livedExperience": 6,
    "playableOutline": 8,
    "crossRolePlayability": 7,
    "dramaticTension": 6
  },
  "standoutCells": [{"cell":"role-6_ch2","excerpt":"…","why":"…"}],
  "weakCells": [{"cell":"role-1_ch2","excerpt":"…","why":"…"}],
  "issues": [{"severity":"high|medium|low","area":"perspectiveLimit|…","detail":"…","cells":["role-6_ch2"]}],
  "revisions": [{"targetKey":"role-6_ch2","priority":"must_fix|should_fix|optional","problem":"…","direction":"…"}],
  "readyForPlayers": false,
  "suggestions": []
}`;

  const user = `请通读并打分（只看剧本，不看矩阵/真相）。

${pipeline.setting && pipeline.synopsis ? creativeInputUserBlocks(pipeline.setting, pipeline.synopsis) : ""}
${untrustedUserPayload("角色列表（仅身份，非剧透）", roleList)}
${untrustedUserPayload("全部私人剧本（按角色分组，全文）", corpus)}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export function buildMatrixEvaluationMessages(pipeline) {
  const modeProfile = buildMatrixModeProfile(pipeline.setting || {});
  const modeBlock = formatMatrixModeBlock(modeProfile);
  const isHenkaku = modeProfile.key === "henkaku";
  const playProfile = playStructureProfile(pipeline.setting?.playStructure);

  const system = `你是剧本杀「Matrix 2.0 质检编辑」。评判多人私人本 + 信息矩阵是否可玩、可推理。

${PRODUCT_BOUNDARY}

${modeBlock}

${HUMAN_REVIEW_BLOCK}

【勿误扣分】
- 私人本心理描写、相对时间 — 正常，不扣分。
- 本格不因「前期误导」扣沉浸分；变格可因误导设计加分。
- 真凶自知私人内心 — 不扣 spoiler（别人看不见）。

【Matrix 2.0 评判维度】（1-10，须全部输出）
- logicalCoherence：L1 物理${isHenkaku ? "+超自然" : ""}是否自洽？
- informationSymmetry：关键推理是否可经 L2 公共锚点 + 多角色 L3 拼接？（允许 secret/误导，但须可圆）
- immersiveMisdirection：${isHenkaku ? "幻觉/机制误导是否在揭晓时合理？" : "红鲱鱼是否可解释且未提前写穿真凶？"}
- mechanismRunnable：${isHenkaku ? "L4 触发器是否清晰可主持？" : "主持流程+公共环境是否可跑？"}
- roleBehaviorEntropy：每幕是否有可观察行为/对质空间（非单线任务）？
- readability：私人本可读性、沉浸感。
- humanAuthorship：是否摆脱命题先行、角色观点席位、对称配方与过度象征。
- consequenceContinuity：上一幕玩家行为是否真实改变下一幕的权限、关系、资源或合作，而非只累计终局分数。
- roleAgency：每位玩家能否凭人物身份、关系、能力、资源或误认主动改变别人的局面，并有明确失败代价；不得把“每人一项独占决策权”当成能动性模板。
- materialOperability：实体物料是否能被签署、转让、隐瞒、公开、质押或销毁，并真实参与结算，而非只供阅读。
- sharedSceneConsistency：主持手册与所有角色本是否遵守同一份 actContracts，地点、期限、公共决定和离场状态没有各写各的。
- clueTopology：线索是否以 private/pair/group 为主形成局部关系与桥接结构，只有真正影响全桌现实的内容才是 public_anchor；不得把所有线索串成一条顺序链或强行关联所有角色。
- clueResilience：critical truthNode 是否至少有两条独立还原路径；线索被藏、毁、换时是否有代价与可追踪痕迹，缺失是否只提高成本/关闭支线而非卡死整局。
- cooperationRhythm：每幕是否有可执行的探索、暂时合作或恢复目标，让人物状态与联盟发生变化；合作之后仍应保留私人利益和后续冲突。
- dramaticTension：全局是否有足够尖锐的受益、受损与反制窗口；不要求每个选项和每个场景都彼此对抗。若连续多幕只有协商、表态、平均分配或无代价投票，最高 4 分。

【兼容字段 — 同时输出 legacy scores】
matrixConsistency≈logicalCoherence；fairness≈informationSymmetry；spoilerSafety：本格查 forbiddenFacts，变格查过早写穿 resolution；taskCompleteness≈roleBehaviorEntropy；importReady≈mechanismRunnable。

【readyForSync】
本格：informationSymmetry≥7 且 logicalCoherence≥8 且无明显 L2 独占核心真相。
变格：另需 mechanismRunnable≥7。
所有模式还必须 humanAuthorship≥7、consequenceContinuity≥7、dramaticTension≥7、clueTopology≥7、clueResilience≥7、cooperationRhythm≥7；${playProfile.requiresPlayableDecision ? "阵营/机制/混合结构还必须 roleAgency、materialOperability、sharedSceneConsistency 均≥7；" : ""}严重命题先行、全员线索泛滥、冲突被公平配平或连续多幕只有讨论投票时不得通过。

【红队桌测 — 不能只做顺从阅读】
- 利己玩家：拒绝主动公开自己的关键信息，是否仍有代价、旁路或他人反制，而不是直接卡死。
- 沉默玩家：某角色整幕少说话，公共场景是否仍能靠动作、物料和别人对他的需求推进。
- 搅局玩家：藏、换、毁一条允许干扰的线索，代价与痕迹模式是否按登记生效；无痕不等于自动留下“缺口”。
- 错误共识：全桌共同相信一条合理误读时，后续是否存在可观察的反证机会，而不是主持人口头纠正。
- 新手主持：只看主持手册与共享幕合同，能否确定地点、先后、发放和失败推进，不依赖作者临场补设定。
- 删除角色：逐个移除角色后，记录 Agency / Dependency / Exposure 哪一项断裂；若没有具体影响，该角色尚未进入游戏结构。
对每项输出 redTeamFindings。high 或 blocked 未修复时 readyForSync 必须为 false。

【输出 schema】
{
  "overallScore": 7.5,
  "verdict": "一句话总评",
  "matrixMode": "${modeProfile.key}",
  "scores": {
    "logicalCoherence": 8,
    "informationSymmetry": 7,
    "immersiveMisdirection": 8,
    "mechanismRunnable": 8,
    "roleBehaviorEntropy": 8,
    "readability": 8,
    "humanAuthorship": 7,
    "consequenceContinuity": 7,
    "roleAgency": 8,
    "materialOperability": 8,
    "sharedSceneConsistency": 8,
    "clueTopology": 8,
    "clueResilience": 8,
    "cooperationRhythm": 8,
    "dramaticTension": 7,
    "matrixConsistency": 8,
    "spoilerSafety": 8,
    "fairness": 7,
    "taskCompleteness": 8,
    "importReady": 8
  },
  "issues": [{"severity":"high|medium|low","area":"…","detail":"…"}],
  "revisions": [{
    "targetLayer": "scripts|matrix|clues|truth|host",
    "targetKey": "role-1_ch1",
    "priority": "must_fix|should_fix|optional",
    "problem": "…",
    "direction": "…",
    "promptHint": "…"
  }],
  "redTeamFindings": [{
    "scenario": "selfish_withholder|silent_player|clue_saboteur|false_consensus|novice_host|remove_role",
    "targetKey": "角色/幕/线索 key",
    "severity": "high|medium|low",
    "result": "passed|fragile|blocked",
    "observedFailure": "按现有规则实际会怎样失败",
    "repairLayer": "characters|clues|matrix|scripts|host"
  }],
  "readyForSync": false,
  "suggestions": []
}`;
  const user = `请评判以下矩阵流水线产物（含全部已生成剧本）。

${pipeline.setting && pipeline.synopsis ? creativeInputUserBlocks(pipeline.setting, pipeline.synopsis) : ""}
${untrustedUserPayload("真相 Bible", {
  summary: pipeline.truthBible?.summary,
  playStructure: pipeline.truthBible?.playStructure,
  centralQuestion: pipeline.truthBible?.centralQuestion,
  publicCrisis: pipeline.truthBible?.publicCrisis,
  irreversibleDeadline: pipeline.truthBible?.irreversibleDeadline,
  objectiveFacts: pipeline.truthBible?.objectiveFacts,
  truthNodes: pipeline.truthBible?.truthNodes,
  sharedObjective: pipeline.truthBible?.sharedObjective,
  endingAxes: pipeline.truthBible?.endingAxes,
  endingRoutes: pipeline.truthBible?.endingRoutes,
  killer: pipeline.truthBible?.killer,
  method: pipeline.truthBible?.method,
  misdirections: pipeline.truthBible?.misdirections,
  spoilerGates: pipeline.truthBible?.spoilerGates
})}
${untrustedUserPayload("独立线索网络", {
  publicAnchorKeys: pipeline.clueNetwork?.publicAnchorKeys,
  clues: pipeline.clueNetwork?.clues,
  truthCoverage: pipeline.clueNetwork?.truthCoverage,
  links: pipeline.clueNetwork?.links
})}
${untrustedUserPayload("信息矩阵 · L2", {
  actTitles: pipeline.infoMatrix?.actTitles,
  publicEnvironmentByAct: pipeline.infoMatrix?.publicEnvironmentByAct,
  clueCount: pipeline.infoMatrix?.clues?.length,
  physicalMaterials: (pipeline.infoMatrix?.clues || []).filter((clue) => clue.physicalForm),
  decisions: pipeline.infoMatrix?.decisions,
  actContracts: pipeline.infoMatrix?.actContracts,
  mechanicalTriggers: pipeline.infoMatrix?.mechanicalTriggers?.length,
  rows: (pipeline.infoMatrix?.rows || []).map((r) => ({
    roleKey: r.roleKey,
    actKey: r.actKey,
    newClueIds: r.newClueIds,
    forbidden: r.forbidden,
    tasks: r.tasks
  }))
})}
${untrustedUserPayload("全部剧本", buildScriptCorpus(pipeline.scripts, pipeline.config))}

readyForSync 标准见上。**勿**因正常心理描写或缺少精确钟点而设 readyForSync=false。

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
