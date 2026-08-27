import { requestDeepseekJson } from "./deepseek-client.js";
import {
  AI_PLAYER_ARCHETYPES,
  AI_PLAYER_ARCHETYPE_IDS
} from "../../shared/ai-playtest.js";

export { AI_PLAYER_ARCHETYPES } from "../../shared/ai-playtest.js";

export const AI_PLAYTEST_VERSION = 1;
export const AI_PLAYTEST_PROMPT_VERSION = "multi-agent-playtest-v1";

const ARCHETYPE_INSTRUCTIONS = {
  logical: "优先建立时间线、验证证据之间的因果关系，并主动排除替代解释。",
  emotional: "优先理解关系、动机和情绪变化，可能相信符合人物情感的解释。",
  social: "主动交换信息、结盟和提问，通过其他玩家的反应修正判断。",
  silent: "很少主动分享信息，只在证据充分或被直接询问时表达判断。",
  skeptic: "持续质疑显眼答案、证词和主持提示，优先寻找反证与叙事陷阱。",
  dominant: "快速提出结论并推动全组行动，容易压过他人的信息和不同意见。",
  secretive: "保护角色秘密和私人目标，即使共享信息有助于破案也会谨慎权衡。",
  skimmer: "阅读速度快但容易遗漏限定词、时间和物证细节，依赖标题与显眼描述。",
  brute_force: "倾向枚举答案、反复尝试和跳过中间推理步骤，测试机制是否能被绕过。",
  wanderer: "容易被支线、气氛和次要人物吸引，测试主线在非理想路径下是否仍可恢复。"
};
const SEVERITIES = new Set(["danger", "warning", "info"]);
const ISSUE_CATEGORIES = new Set([
  "comprehension",
  "information",
  "fairness",
  "pacing",
  "agency",
  "communication",
  "intent"
]);

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function rows(value) {
  return Array.isArray(value) ? value : [];
}

function text(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function uniqueStrings(value, maxItems = 12, maxLength = 600) {
  return [...new Set(rows(value).map((item) => text(item, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function numberInRange(value, min, max, fallback = min) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(min, Math.min(max, Math.round(numeric))) : fallback;
}

function reference(value = {}) {
  const source = object(value);
  const type = text(source.type, 60);
  const id = text(source.id, 120);
  if (!type || !id) return null;
  return { type, id, label: text(source.label, 200) || id };
}

function references(value, maxItems = 12) {
  return rows(value).map(reference).filter(Boolean).slice(0, maxItems);
}

function roleIdOf(value = {}) {
  return text(value.roleSlotId ?? value.role_slot_id ?? value.id, 120);
}

function roleNameOf(value = {}) {
  return text(value.name ?? value.title ?? value.label, 200) || "未命名角色";
}

function roleRef(role) {
  return { type: "role", id: roleIdOf(role), label: roleNameOf(role) };
}

function itemRef(type, value = {}) {
  const id = text(value.id, 120);
  if (!id) return null;
  return {
    type,
    id,
    label: text(value.name ?? value.title ?? value.label ?? value.segment_key, 200) || id
  };
}

function compactItem(type, value = {}) {
  const ref = itemRef(type, value);
  if (!ref) return null;
  return {
    ref,
    sequence: Number(value.sequence) || null,
    chapterId: text(value.chapter_id ?? value.chapterId, 120) || null,
    roleSlotId: text(value.role_slot_id ?? value.roleSlotId, 120) || null,
    visibility: text(value.visibility, 40) || null,
    publicText: text(
      value.public_text
      ?? value.publicText
      ?? value.summary
      ?? value.description
      ?? value.body,
      1800
    ),
    playerText: text(value.player_text ?? value.playerText ?? value.content, 2600),
    metadata: object(value.metadata)
  };
}

function compactItems(type, value, maxItems = 40) {
  return rows(value).slice(0, maxItems).map((item) => compactItem(type, item)).filter(Boolean);
}

function truthVisibleToRole(claim, roleId) {
  const visibility = object(claim.role_visibility ?? claim.roleVisibility);
  const direct = visibility[roleId];
  if (direct === true || direct === "visible" || direct === "known") return true;
  const roleIds = rows(visibility.roleIds ?? visibility.roles);
  return roleIds.includes(roleId);
}

function compactTruthClaim(claim = {}) {
  const ref = itemRef("truth_claim", claim);
  if (!ref) return null;
  return {
    ref,
    claim: text(claim.claim ?? claim.summary ?? claim.title, 2400),
    revealStage: text(claim.reveal_stage ?? claim.revealStage, 120),
    confidence: text(claim.confidence, 40),
    evidence: references(claim.evidence, 20),
    contradictions: references(claim.contradictions, 12)
  };
}

function normalizeProfile(profile, index, roleMap) {
  const source = object(profile);
  const roleSlotId = text(source.roleSlotId ?? source.role_slot_id, 120);
  const role = roleMap.get(roleSlotId);
  if (!role) {
    const error = new Error(`测试席位 ${index + 1} 引用了不存在的角色`);
    error.code = "VALIDATION_ERROR";
    error.statusCode = 422;
    throw error;
  }
  const archetype = AI_PLAYER_ARCHETYPE_IDS.includes(source.archetype)
    ? source.archetype
    : AI_PLAYER_ARCHETYPE_IDS[index % AI_PLAYER_ARCHETYPE_IDS.length];
  return {
    seatId: text(source.seatId, 80) || `seat-${index + 1}`,
    roleSlotId,
    roleName: roleNameOf(role),
    archetype,
    archetypeLabel: AI_PLAYER_ARCHETYPES[archetype].label,
    customBehavior: text(source.customBehavior, 800)
  };
}

export function normalizeAiPlaytestConfig(value = {}, roles = []) {
  const source = object(value);
  const roleMap = new Map(rows(roles).map((role) => [roleIdOf(role), role]).filter(([id]) => id));
  const profiles = rows(source.profiles).slice(0, 8).map((profile, index) => normalizeProfile(profile, index, roleMap));
  if (profiles.length < 2) {
    const error = new Error("多 AI 试跑至少需要两个测试席位");
    error.code = "VALIDATION_ERROR";
    error.statusCode = 422;
    throw error;
  }
  return {
    depth: source.depth === "deep" ? "deep" : "quick",
    focus: text(source.focus, 2000),
    profiles
  };
}

export function buildPlayerContext(snapshot = {}, profile = {}) {
  const roleId = profile.roleSlotId;
  const roles = rows(snapshot.roles);
  const role = roles.find((item) => roleIdOf(item) === roleId) ?? {};
  const archive = rows(snapshot.roleArchives).find((item) => roleIdOf(item) === roleId) ?? {};
  const chapters = compactItems("chapter", snapshot.chapters, 16);
  const segments = compactItems("segment", snapshot.segments, 20);
  const ownSections = rows(snapshot.sections).filter((item) => roleIdOf(item) === roleId);
  const publicScenes = rows(snapshot.scenes).filter((item) => {
    const visibility = text(item.visibility, 40);
    return !visibility || ["public", "role", "player"].includes(visibility);
  });
  const visibleClues = rows(snapshot.clues).filter((item) => {
    const assignedRole = text(item.role_slot_id ?? item.roleSlotId, 120);
    const visibility = text(item.visibility, 40);
    return assignedRole === roleId || !assignedRole || ["public", "all", "player"].includes(visibility);
  });
  const visibleTruth = rows(snapshot.truthClaims)
    .filter((claim) => truthVisibleToRole(claim, roleId))
    .map(compactTruthClaim)
    .filter(Boolean);
  return {
    world: {
      name: text(snapshot.world?.name, 200),
      summary: text(snapshot.world?.summary, 2200)
    },
    seat: profile,
    role: {
      ref: roleRef(role),
      publicProfile: text(role.public_profile ?? role.publicProfile ?? role.description, 2400),
      privateProfile: text(role.private_profile ?? role.privateProfile, 3000),
      archive: {
        publicIdentity: text(archive.public_identity ?? archive.publicIdentity, 1800),
        hiddenIdentity: text(archive.hidden_identity ?? archive.hiddenIdentity, 2200),
        externalGoal: text(archive.external_goal ?? archive.externalGoal, 1800),
        internalNeed: text(archive.internal_need ?? archive.internalNeed, 1800),
        secret: text(archive.secret, 2200),
        actionLine: text(archive.action_line ?? archive.actionLine, 2200)
      }
    },
    chapters,
    segments,
    privateSections: compactItems("script_section", ownSections, 24),
    publicScenes: compactItems("scene", publicScenes, 32),
    visibleClues: compactItems("clue", visibleClues, 50),
    visibleTruth
  };
}

function playerSystemPrompt(profile) {
  const archetype = AI_PLAYER_ARCHETYPES[profile.archetype];
  return `你正在参加一次互动推理作品的隔离玩家试跑。
你只能使用“玩家材料”中明确给你的信息；不知道作者真相，也不能补写世界事实。
你的测试人格是「${archetype.label}」：${ARCHETYPE_INSTRUCTIONS[profile.archetype]}
${profile.customBehavior ? `额外行为约束：${profile.customBehavior}` : ""}

请模拟可观察的玩家行为，不要输出隐藏思维链。每个阶段只记录：
1. 当前公开判断与置信度；
2. 使用或忽略了哪些已给材料；
3. 做出的行动、分享或保密决定；
4. 遇到的歧义、卡点和是否需要主持提示。
返回严格 JSON。`;
}

function playerUserPrompt(context, config) {
  return `试跑深度：${config.depth === "deep" ? "完整压力测试" : "快速主流程"}
作者关注点：${config.focus || "理解、信息交换、误判、卡关与角色主动性"}

玩家材料：
${JSON.stringify(context)}

返回结构：
{
  "objectiveUnderstanding": "玩家如何理解自己的目标",
  "timeline": [{
    "stageId": "章节或阶段 ID",
    "stageLabel": "阶段名",
    "belief": "当时公开相信的结论",
    "confidence": 0,
    "evidenceUsed": [{"type":"clue","id":"...","label":"..."}],
    "evidenceIgnored": [{"type":"clue","id":"...","label":"..."}],
    "action": "可观察行动",
    "communication": "分享、隐瞒或结盟行为",
    "confusion": "歧义或卡点，没有则空字符串",
    "hostHelp": false
  }],
  "finalBelief": "最终结论",
  "truthConfidence": 0,
  "stalledAt": "首次明显卡住的阶段，没有则空字符串",
  "earlySolve": false,
  "hostInterventions": 0,
  "highlight": "该角色最有参与感的时刻",
  "frustration": "最大困惑或空转时刻",
  "missedRefs": [{"type":"clue","id":"...","label":"..."}]
}`;
}

function normalizeTimeline(value) {
  return rows(value).slice(0, 12).map((entry, index) => {
    const source = object(entry);
    return {
      stageId: text(source.stageId, 120) || `stage-${index + 1}`,
      stageLabel: text(source.stageLabel, 200) || `阶段 ${index + 1}`,
      belief: text(source.belief, 1600),
      confidence: numberInRange(source.confidence, 0, 100, 0),
      evidenceUsed: references(source.evidenceUsed, 12),
      evidenceIgnored: references(source.evidenceIgnored, 12),
      action: text(source.action, 1200),
      communication: text(source.communication, 1200),
      confusion: text(source.confusion, 1200),
      hostHelp: Boolean(source.hostHelp)
    };
  });
}

export function normalizePlayerReport(value = {}, profile = {}) {
  const source = object(value);
  const timeline = normalizeTimeline(source.timeline);
  const hostInterventions = numberInRange(
    source.hostInterventions,
    0,
    99,
    timeline.filter((entry) => entry.hostHelp).length
  );
  return {
    seatId: profile.seatId,
    role: { type: "role", id: profile.roleSlotId, label: profile.roleName },
    archetype: profile.archetype,
    archetypeLabel: profile.archetypeLabel,
    objectiveUnderstanding: text(source.objectiveUnderstanding, 1800),
    timeline,
    finalBelief: text(source.finalBelief, 1800),
    truthConfidence: numberInRange(source.truthConfidence, 0, 100, 0),
    stalledAt: text(source.stalledAt, 200),
    earlySolve: Boolean(source.earlySolve),
    hostInterventions,
    highlight: text(source.highlight, 1400),
    frustration: text(source.frustration, 1400),
    missedRefs: references(source.missedRefs, 16)
  };
}

function buildObserverContext(snapshot, config, players) {
  return {
    world: {
      name: text(snapshot.world?.name, 200),
      summary: text(snapshot.world?.summary, 2200)
    },
    config,
    authoredTruth: rows(snapshot.truthClaims).slice(0, 30).map(compactTruthClaim).filter(Boolean),
    coreTrick: object(snapshot.coreTrick),
    chapters: compactItems("chapter", snapshot.chapters, 16),
    segments: compactItems("segment", snapshot.segments, 20),
    clues: compactItems("clue", snapshot.clues, 60),
    scenes: compactItems("scene", snapshot.scenes, 40),
    players
  };
}

function observerSystemPrompt() {
  return `你是互动推理作品的试跑观察员。你会得到作者真相与多个彼此隔离的 AI 玩家报告。
你的职责是比较他们的可观察行为，定位作品问题，而不是评价玩家聪明与否。
任何问题必须引用输入中真实存在的创作对象；无法定位时 refs 留空，不得伪造 ID。
不要输出隐藏思维链。返回严格 JSON。`;
}

function observerUserPrompt(context) {
  return `请生成一次可用于改稿的多玩家试跑报告。

完整上下文：
${JSON.stringify(context)}

重点检查：
- 每个阶段玩家相信什么、为什么改变；
- 被忽略或过早暴露的线索；
- 描述歧义与合理误解；
- 长期无事可做、决策权失衡与交流单点；
- 首次卡住时间、主持干预次数和提前猜中真相；
- 结构是否支持玩家按信息逐步推进，而非依赖场外知识。

返回结构：
{
  "headline": "一句话结论",
  "summary": "2-4 句综合观察",
  "score": 0,
  "truthSolved": false,
  "consensusStage": "形成共同结论的阶段，没有则空",
  "hostInterventions": 0,
  "metrics": {
    "clarity": 0,
    "fairness": 0,
    "agency": 0,
    "pacing": 0,
    "communication": 0,
    "intentAlignment": 0
  },
  "groupTimeline": [{
    "stageId": "...",
    "stageLabel": "...",
    "consensus": "当时共识",
    "split": "主要分歧",
    "momentum": "推进/停滞原因"
  }],
  "issues": [{
    "severity": "danger|warning|info",
    "category": "comprehension|information|fairness|pacing|agency|communication|intent",
    "title": "问题标题",
    "detail": "可观察证据",
    "recommendation": "可执行改法",
    "refs": [{"type":"clue","id":"...","label":"..."}],
    "seatIds": ["seat-1"]
  }],
  "missedClues": [{"ref":{"type":"clue","id":"...","label":"..."},"seatIds":["seat-1"],"reason":"原因"}],
  "inactiveRoles": [{"ref":{"type":"role","id":"...","label":"..."},"reason":"原因"}],
  "dominantRoles": [{"ref":{"type":"role","id":"...","label":"..."},"reason":"原因"}]
}`;
}

function normalizeMetrics(value = {}) {
  const source = object(value);
  return {
    clarity: numberInRange(source.clarity, 0, 100, 0),
    fairness: numberInRange(source.fairness, 0, 100, 0),
    agency: numberInRange(source.agency, 0, 100, 0),
    pacing: numberInRange(source.pacing, 0, 100, 0),
    communication: numberInRange(source.communication, 0, 100, 0),
    intentAlignment: numberInRange(source.intentAlignment, 0, 100, 0)
  };
}

function normalizeIssue(value = {}, index) {
  const source = object(value);
  const severity = SEVERITIES.has(source.severity) ? source.severity : "warning";
  const category = ISSUE_CATEGORIES.has(source.category) ? source.category : "comprehension";
  return {
    id: text(source.id, 100) || `playtest-issue-${index + 1}`,
    severity,
    category,
    title: text(source.title, 240) || "待作者复核",
    detail: text(source.detail, 2200),
    recommendation: text(source.recommendation, 1800),
    refs: references(source.refs, 12),
    seatIds: uniqueStrings(source.seatIds, 8, 80)
  };
}

function normalizeGroupTimeline(value) {
  return rows(value).slice(0, 12).map((entry, index) => {
    const source = object(entry);
    return {
      stageId: text(source.stageId, 120) || `stage-${index + 1}`,
      stageLabel: text(source.stageLabel, 200) || `阶段 ${index + 1}`,
      consensus: text(source.consensus, 1600),
      split: text(source.split, 1600),
      momentum: text(source.momentum, 1600)
    };
  });
}

function normalizeRefFinding(value) {
  const source = object(value);
  const ref = reference(source.ref);
  if (!ref) return null;
  return {
    ref,
    seatIds: uniqueStrings(source.seatIds, 8, 80),
    reason: text(source.reason, 1400)
  };
}

export function normalizeAiPlaytestReport(value = {}, { config, players, snapshot } = {}) {
  const source = object(value);
  const issues = rows(source.issues).slice(0, 40).map(normalizeIssue);
  const metrics = normalizeMetrics(source.metrics);
  const metricValues = Object.values(metrics);
  const inferredScore = metricValues.length
    ? Math.round(metricValues.reduce((sum, value) => sum + value, 0) / metricValues.length)
    : 0;
  return {
    version: AI_PLAYTEST_VERSION,
    promptVersion: AI_PLAYTEST_PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    depth: config?.depth || "quick",
    focus: config?.focus || "",
    headline: text(source.headline, 320) || "多 AI 玩家试跑已完成",
    summary: text(source.summary, 2600),
    score: numberInRange(source.score, 0, 100, inferredScore),
    truthSolved: Boolean(source.truthSolved),
    consensusStage: text(source.consensusStage, 200),
    hostInterventions: numberInRange(
      source.hostInterventions,
      0,
      999,
      rows(players).reduce((sum, player) => sum + (Number(player.hostInterventions) || 0), 0)
    ),
    metrics,
    groupTimeline: normalizeGroupTimeline(source.groupTimeline),
    players: rows(players),
    issues,
    missedClues: rows(source.missedClues).map(normalizeRefFinding).filter(Boolean).slice(0, 24),
    inactiveRoles: rows(source.inactiveRoles).map(normalizeRefFinding).filter(Boolean).slice(0, 16),
    dominantRoles: rows(source.dominantRoles).map(normalizeRefFinding).filter(Boolean).slice(0, 16),
    summaryCounts: {
      players: rows(players).length,
      danger: issues.filter((issue) => issue.severity === "danger").length,
      warning: issues.filter((issue) => issue.severity === "warning").length,
      earlySolves: rows(players).filter((player) => player.earlySolve).length,
      stalledPlayers: rows(players).filter((player) => player.stalledAt).length
    },
    limitations: [
      "AI 试跑用于压力测试理解与交互路径，不能替代真实玩家的情绪、社交关系和现场行为。",
      "报告只依据当前结构化世界快照，不会伪造未录入平台的运行状态。"
    ]
  };
}

async function mapWithConcurrency(items, limit, task) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function runMultiAgentPlaytest(snapshot, value, {
  requestJson = requestDeepseekJson,
  requestId = "manual"
} = {}) {
  const config = normalizeAiPlaytestConfig(value, snapshot.roles);
  const players = await mapWithConcurrency(config.profiles, 3, async (profile) => {
    const context = buildPlayerContext(snapshot, profile);
    const result = await requestJson([
      { role: "system", content: playerSystemPrompt(profile) },
      { role: "user", content: playerUserPrompt(context, config) }
    ], {
      maxTokens: config.depth === "deep" ? 5600 : 3600,
      temperature: 0.72,
      phase: "ai-playtest-player",
      context: { seatId: profile.seatId, roleSlotId: profile.roleSlotId, archetype: profile.archetype },
      idempotencyKey: `ai-playtest:${requestId}:${profile.seatId}`
    });
    return normalizePlayerReport(result.value, profile);
  });

  const observerContext = buildObserverContext(snapshot, config, players);
  const synthesis = await requestJson([
    { role: "system", content: observerSystemPrompt() },
    { role: "user", content: observerUserPrompt(observerContext) }
  ], {
    maxTokens: config.depth === "deep" ? 9000 : 6500,
    temperature: 0.35,
    phase: "ai-playtest-observer",
    context: { players: players.length, depth: config.depth },
    idempotencyKey: `ai-playtest:${requestId}:observer`
  });

  return normalizeAiPlaytestReport(synthesis.value, { config, players, snapshot });
}
