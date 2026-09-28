/**
 * EventBoundaryDetector V1.2 — four centers + multi-impact chain recall.
 *
 * Question only: worth sending to Splitter? (boundaryReviewRecommended)
 * Does NOT decide how to split. Splitter V1 / Fact validator unchanged.
 *
 * Centers: ACTOR / GOAL_ACTION / TEMPORAL / OUTCOME + EVENT_THEN_DURATIVE
 * V1.2: multi independent impact centers (poison→chase→identity→kill→hide)
 *
 * KEEP: same scene + same murder goal continuous chain (infiltrate→knock→kill→frame)
 *
 * Tune on boundary-dev; do NOT tune on sealed held-out or 青楼 precision set.
 */

const NAMES = [
  "顾怀辰",
  "陶梦芸",
  "白初",
  "杨峥",
  "陆卿原",
  "张九孚",
  "黎小曼",
  "傅月生",
  "傅月遥",
  "陶老板",
  "朱棣",
  "荣妙珠",
  "白止",
  "侯玄星",
  "吴三桂",
  "陶文庆",
  "陆未晞",
  "李瑶",
  "白婉儿",
  "刘警探",
  "杨氏",
  "张伯储",
  "主持人"
];

/** Goal buckets for action-center comparison. */
const GOAL_PATTERNS = [
  { goal: "KILL", re: /杀|灭|夺|砸死|屠杀|误杀|处死|身亡|毒箭/ },
  { goal: "RESCUE", re: /救|劫狱|救出|救下/ },
  { goal: "ADOPT_RELOCATE", re: /收养|带回|带至|取名|接回/ },
  { goal: "RELATION_ARC", re: /情愫|相爱|相恋|渐生|情深/ },
  { goal: "IDENTITY_ENTER", re: /成为(?!空棺)|潜入朝廷|伪装成|改随|立足/ },
  { goal: "DURATIVE", re: /每月放血|从内部拖垮|拖垮清政府|韬光养晦|收敛锋芒/ },
  { goal: "CRAFT", re: /炼成|研制|作法/ },
  { goal: "CURSE", re: /下咒/ },
  { goal: "ARREST", re: /抓捕|逮捕/ },
  { goal: "ESCAPE", re: /逃出|逃离|逃跑|挖通道/ },
  { goal: "BURY_VOW", re: /葬于|安葬|立誓|立下.*祖训|守墓祖训/ },
  { goal: "JOIN", re: /加入/ },
  { goal: "INVESTIGATE", re: /调查|发现|排查|得知|找到.*档案|自我介绍/ },
  { goal: "TRAP_LOCK", re: /被困|封锁|阵法启动/ },
  { goal: "ANNOUNCE", re: /告知|通知|引发恐慌|主持人/ },
  { goal: "ENTER_TOMB", re: /进入|入墓|相继/ },
  { goal: "FIGHT", re: /厮杀|相遇厮杀/ },
  { goal: "WAKE_ELSEWHERE", re: /醒来|醒在|门前/ },
  { goal: "DEATH_CHOICE", re: /走向死门|走上死门/ },
  { goal: "SURVIVE_LEAVE", re: /生还|离开日月山庄/ },
  { goal: "FUNERAL", re: /葬礼|重病离世/ },
  { goal: "SPLIT_CLAN", re: /分裂|北上|南下长沙|驾崩后/ },
  { goal: "RISE", re: /发迹/ },
  { goal: "MURDER_LURE", re: /诱骗|引至|假借查看/ },
  { goal: "FAREWELL", re: /诀别|最后的对话|失去意识/ },
  { goal: "DISGUISE", re: /藏尸|面具|取得.*钥匙/ },
  { goal: "ATMOSPHERE", re: /红光|啼哭|乏力|瘴气消散|记忆.*恢复/ },
  { goal: "DECIDE", re: /决定|商议/ },
  { goal: "REVEAL_KNOW", re: /明白|认出|揭示|若有所思/ },
  { goal: "POISON", re: /下毒|注入.*毒|毒药|误将.*毒/ },
  { goal: "MISDRINK", re: /误饮/ },
  { goal: "LEARN_IDENTITY", re: /得知身世|身世真相|得知.*身世/ },
  { goal: "HIDE_BODY", re: /藏尸|拖至|草堆|埋尸/ },
  { goal: "FRAME", re: /嫁祸|布置嫁祸/ },
  { goal: "INFILTRATE", re: /潜入|夜潜/ },
  { goal: "KNOCKOUT", re: /迷晕|打晕/ },
  { goal: "ARRIVE", re: /到达/ },
  { goal: "RENAME", re: /改名/ }
];

/** Independent impact centers for multi-beat over-merge recall (generic verbs). */
const IMPACT_CENTERS = [
  { id: "POISON", re: /下毒|误将.{0,6}毒|毒药/ },
  { id: "MISDRINK", re: /误饮/ },
  { id: "CHASE", re: /追(?!兵)|追至|追上/ },
  { id: "LEARN_ID", re: /得知身世|身世/ },
  { id: "WOUND_KILL", re: /戳伤|杀死|致死|杀害|一气之下/ },
  { id: "HIDE", re: /拖至|藏尸|草堆/ },
  { id: "ADOPT", re: /收养|带回.*改名|取名/ },
  { id: "RELATION", re: /渐生情愫|暗生情愫/ },
  { id: "ARRIVE_PROBE", re: /到场排查|警探.*到场/ },
  { id: "LOCKDOWN", re: /封锁|阵法启动/ },
  { id: "PANIC", re: /引发恐慌/ }
];

export function detectEventBoundary(event = {}) {
  const title = String(event.title || "").trim();
  const summary = String(event.summary || "").trim();
  const text = `${title} ${summary}`.replace(/\s+/g, " ");
  const clauses = splitClauses(summary);
  const tagged = clauses.map((c) => tagClause(c));
  const signals = [];
  const centers = {
    actors: [],
    goals: [],
    actorShifts: 0,
    goalShifts: 0,
    temporalShift: false,
    outcomeShifts: 0,
    durativeAfterEvent: false
  };

  // --- Parallel ---
  if (/同时/.test(text) && text.length > 40) {
    signals.push({ kind: "PARALLEL_EVENT", evidence: "同时", strength: "HIGH" });
  }

  // --- TEMPORAL_CENTER ---
  const yearHits = [...text.matchAll(/(\d{4})\s*年/g)].map((m) => Number(m[1]));
  const uniqYears = [...new Set(yearHits)];
  const hardTime = /五年后|十多年后|百年|数十年|长期布局|多年布局|驾崩后/.test(text);
  const softOnly = (text.match(/两年后|多年后|数年后|次年/g) || []).length <= 1;
  if (uniqYears.length >= 2 && Math.max(...uniqYears) - Math.min(...uniqYears) >= 2) {
    signals.push({
      kind: "TEMPORAL_CENTER",
      evidence: `years=${uniqYears.join(",")}`,
      strength: "HIGH"
    });
    centers.temporalShift = true;
  } else if (hardTime) {
    signals.push({
      kind: "TEMPORAL_CENTER",
      evidence: "hard_time_or_era_shift",
      strength: "HIGH"
    });
    centers.temporalShift = true;
  } else if (/后来|之后/.test(summary) && /重病|葬礼|离世|醒来|门前/.test(summary)) {
    signals.push({
      kind: "TEMPORAL_CENTER",
      evidence: "later_life_or_wake_phase",
      strength: "HIGH"
    });
    centers.temporalShift = true;
  }

  // Year mention inside "得知…于1894" while main action is present-tense settling
  if (
    /\d{4}\s*年/.test(summary) &&
    /得知|失踪|档案/.test(summary) &&
    /立足|韬光|排挤|收敛/.test(summary)
  ) {
    signals.push({
      kind: "TEMPORAL_CENTER",
      evidence: "present_arc_plus_past_knowledge",
      strength: "HIGH"
    });
    centers.temporalShift = true;
  }

  // --- ACTOR + GOAL centers from clauses ---
  const actorSeq = [];
  const goalSeq = [];
  for (const t of tagged) {
    if (t.actor) {
      actorSeq.push(t.actor);
      centers.actors.push(t.actor);
    }
    if (t.goals.length) {
      goalSeq.push(...t.goals);
      centers.goals.push(...t.goals);
    }
  }
  const uniqActorsInOrder = compressRuns(collapseBriefHostActors(actorSeq, tagged));
  const uniqGoalsInOrder = compressRuns(
    goalSeq.filter((g) => !["ATMOSPHERE", "REVEAL_KNOW", "JOIN"].includes(g))
  );

  // Joint enrollment "A加入…B也加入" = one goal center
  const jointJoin = /加入/.test(summary) && (summary.match(/加入/g) || []).length >= 2;

  if (uniqActorsInOrder.length >= 2 && !jointJoin) {
    const shift = uniqActorsInOrder.length - 1;
    centers.actorShifts = shift;
    const majorHandoff = hasMajorActorHandoff(tagged);
    signals.push({
      kind: "ACTOR_CENTER",
      evidence: uniqActorsInOrder.join("→"),
      strength: majorHandoff || uniqActorsInOrder.length >= 3 ? "HIGH" : "MEDIUM"
    });
  }

  if (uniqGoalsInOrder.length >= 2 && !jointJoin) {
    centers.goalShifts = uniqGoalsInOrder.length - 1;
    const incompatible = incompatibleGoalPair(uniqGoalsInOrder);
    signals.push({
      kind: "GOAL_ACTION_CENTER",
      evidence: uniqGoalsInOrder.join("→"),
      strength: incompatible || uniqGoalsInOrder.length >= 3 ? "HIGH" : "MEDIUM"
    });
  }

  // --- OUTCOME_CENTER: complete result then new matter ---
  const outcomes = countOutcomeCenters(title, summary, tagged);
  centers.outcomeShifts = Math.max(0, outcomes - 1);
  if (outcomes >= 2) {
    signals.push({
      kind: "OUTCOME_CENTER",
      evidence: `outcomes>=${outcomes}`,
      strength: outcomes >= 3 ? "HIGH" : "MEDIUM"
    });
  }
  if (/，.*死|寻找.*死|苏醒.*烧毁|秘密后陷入|夺水并下咒/.test(title) && summary.length > 40) {
    signals.push({
      kind: "OUTCOME_CENTER",
      evidence: "title_compresses_multi_outcome",
      strength: "HIGH"
    });
  }

  // --- EVENT_THEN_DURATIVE ---
  if (hasEventThenDurative(summary, tagged)) {
    centers.durativeAfterEvent = true;
    signals.push({
      kind: "EVENT_THEN_DURATIVE",
      evidence: "discrete_then_ongoing_process",
      strength: "HIGH"
    });
  }

  // --- V1.2 multi independent impact centers ---
  const impacts = IMPACT_CENTERS.filter((c) => c.re.test(text)).map((c) => c.id);
  if (impacts.length >= 3) {
    signals.push({
      kind: "OUTCOME_CENTER",
      evidence: `multi_impact:${impacts.join("→")}`,
      strength: "HIGH"
    });
  } else if (impacts.length === 2 && /得知身世|误饮|藏尸|渐生情愫/.test(text)) {
    signals.push({
      kind: "OUTCOME_CENTER",
      evidence: `dual_impact:${impacts.join("→")}`,
      strength: "HIGH"
    });
  }

  // Title dual-subject often encodes two outcome threads (not same-conflict pairs)
  const dual = dualSubjectTitle(title);
  if (dual && !isSameConflictKeep(title, summary, text)) {
    signals.push({
      kind: "ACTOR_CENTER",
      evidence: `title_dual:${dual.join("+")}`,
      strength: "HIGH"
    });
  }

  // Host / multi-beat opening packs (death announced + trapped + decide investigate)
  if (
    /发现.*死亡|死亡并被困|警探到场与众人被困/.test(title) ||
    (/主持人|警探/.test(text) && /被困|封锁/.test(text) && /调查|告知|恐慌|自我介绍|回房/.test(text))
  ) {
    signals.push({
      kind: "OUTCOME_CENTER",
      evidence: "multi_beat_situation_pack",
      strength: "HIGH"
    });
  }

  // Tomb multi-party succession pack
  if (/相继|厮杀/.test(text) && /杀死|进入|入墓/.test(text) && summary.length > 50) {
    signals.push({
      kind: "OUTCOME_CENTER",
      evidence: "multi_party_tomb_sequence",
      strength: "HIGH"
    });
  }

  // Ritual / life-span / escape arcs (regression-preserving, mapped to centers)
  if (/仪式/.test(title) && /牺牲|烧毁|继承|苏醒/.test(text)) {
    signals.push({ kind: "OUTCOME_CENTER", evidence: "ritual_multi_outcome_arc", strength: "HIGH" });
  }
  if (/出生/.test(title) && /(病逝|去世|锦囊|接回)/.test(text)) {
    signals.push({ kind: "TEMPORAL_CENTER", evidence: "life_span_arc", strength: "HIGH" });
  }
  if (/接受.*身份|身份/.test(title) && /(讲述|交给|匕首|渊源)/.test(text)) {
    signals.push({ kind: "GOAL_ACTION_CENTER", evidence: "identity_plus_handoffs", strength: "HIGH" });
  }
  if (/(叛逃|逃出)/.test(title) && /(杀害|改随|叮嘱)/.test(text)) {
    signals.push({ kind: "OUTCOME_CENTER", evidence: "escape_multi_beat", strength: "HIGH" });
  }
  if (/误杀|屠杀/.test(title + summary) && /(逃脱|惊慌|杀害|屠杀)/.test(summary) && summary.length > 40) {
    signals.push({ kind: "OUTCOME_CENTER", evidence: "dense_incident_chain", strength: "HIGH" });
  }
  if (/失去/.test(title) && /(哥哥|母亲)/.test(text) && /(死讯|病重|去世|寻找|死在)/.test(text)) {
    signals.push({ kind: "OUTCOME_CENTER", evidence: "loss_multi_beat", strength: "HIGH" });
  }
  if (/设机关|机关/.test(title) && /回学堂|学堂/.test(text)) {
    signals.push({ kind: "GOAL_ACTION_CENTER", evidence: "action_then_epilogue", strength: "HIGH" });
  }

  // Deduplicate by kind+evidence
  const seen = new Set();
  const uniqSignals = [];
  for (const s of signals) {
    const k = `${s.kind}|${s.evidence}`;
    if (seen.has(k)) continue;
    seen.add(k);
    uniqSignals.push(s);
  }

  const high = uniqSignals.filter((s) => s.strength === "HIGH");
  const medium = uniqSignals.filter((s) => s.strength === "MEDIUM");
  let needsSplit = high.length >= 1 || medium.length >= 2;
  let veto = null;

  // Soft opener alone, no centers → KEEP
  if (
    softOnly &&
    !centers.temporalShift &&
    uniqSignals.length === 0
  ) {
    needsSplit = false;
    veto = "single_soft_or_clean";
  }

  // KEEP veto: same scene / same conflict / continuous / no new independent outcome
  if (needsSplit && shouldKeepSameScene(title, summary, text, centers, uniqSignals)) {
    needsSplit = false;
    veto = "SAME_SCENE_SAME_CONFLICT";
  }

  // Clock-window continuous chase stays KEEP unless parallel
  const clockWindow = /\d{1,2}\s*[:：]\s*\d{2}/.test(text);
  if (
    needsSplit &&
    clockWindow &&
    !/同时/.test(text) &&
    /(潜入|呼救|追逐|推搡)/.test(text) &&
    !high.some((s) => s.kind === "PARALLEL_EVENT" || s.kind === "TEMPORAL_CENTER")
  ) {
    needsSplit = false;
    veto = "same_scene_clock_window";
  }

  return {
    needsSplit,
    signals: uniqSignals,
    centers,
    continuousScene: Boolean(veto && /SCENE|clock/i.test(veto)),
    veto,
    confidence: needsSplit ? (high.length ? "HIGH" : "MEDIUM") : "LOW",
    detectorVersion: "event-boundary-v1.2.0"
  };
}

function splitClauses(summary) {
  return String(summary || "")
    .split(/[，,；;。]/)
    .map((c) => c.trim())
    .filter((c) => c.length > 2);
}

function tagClause(clause) {
  let actor = null;
  let best = Infinity;
  for (const name of NAMES) {
    const i = clause.indexOf(name);
    if (i < 0 || i > 14 || i >= best) continue;
    // Skip object positions: 将/把/向/为…Name, Name茶/房间 as possession
    const before = clause.slice(Math.max(0, i - 2), i);
    const after = clause.slice(i + name.length, i + name.length + 2);
    if (/[将把向被]/.test(before)) continue;
    if (/[的茶房]/.test(after)) continue;
    best = i;
    actor = name;
  }
  const goals = [];
  for (const { goal, re } of GOAL_PATTERNS) {
    if (re.test(clause)) goals.push(goal);
  }
  return { clause, actor, goals: [...new Set(goals)] };
}

function compressRuns(arr) {
  const out = [];
  for (const x of arr) {
    if (out[out.length - 1] !== x) out.push(x);
  }
  return out;
}

function hasMajorActorHandoff(tagged) {
  // e.g. 陶老板…杀 → 张九孚…救
  for (let i = 0; i < tagged.length; i += 1) {
    for (let j = i + 1; j < tagged.length; j += 1) {
      const a = tagged[i];
      const b = tagged[j];
      if (!a.actor || !b.actor || a.actor === b.actor) continue;
      const aKill = a.goals.includes("KILL");
      const bRescue = b.goals.includes("RESCUE") || b.goals.includes("ADOPT_RELOCATE");
      const aArrest = a.goals.includes("ARREST");
      const bRescue2 = b.goals.includes("RESCUE");
      const aCraft = a.goals.includes("CRAFT");
      const bKill = b.goals.includes("KILL");
      if ((aKill && bRescue) || (aArrest && bRescue2) || (aCraft && bKill)) return true;
    }
  }
  return false;
}

function incompatibleGoalPair(goals) {
  const set = new Set(goals);
  const pairs = [
    ["KILL", "RESCUE"],
    ["KILL", "RELATION_ARC"],
    ["ADOPT_RELOCATE", "DURATIVE"],
    ["IDENTITY_ENTER", "DURATIVE"],
    ["CRAFT", "KILL"],
    ["CRAFT", "CURSE"],
    ["KILL", "CURSE"],
    ["ARREST", "RESCUE"],
    ["SURVIVE_LEAVE", "FUNERAL"],
    ["DEATH_CHOICE", "WAKE_ELSEWHERE"],
    ["RISE", "SPLIT_CLAN"],
    ["ENTER_TOMB", "KILL"],
    ["ANNOUNCE", "TRAP_LOCK"],
    ["TRAP_LOCK", "INVESTIGATE"],
    ["POISON", "LEARN_IDENTITY"],
    ["POISON", "HIDE_BODY"],
    ["POISON", "KILL"],
    ["MISDRINK", "LEARN_IDENTITY"],
    ["LEARN_IDENTITY", "KILL"],
    ["KILL", "HIDE_BODY"],
    ["ADOPT_RELOCATE", "RELATION_ARC"],
    ["ARRIVE", "ANNOUNCE"]
  ];
  return pairs.some(([a, b]) => set.has(a) && set.has(b));
}

/** 黎小曼到达→陶老板接待→黎小曼下毒：中间短接待不构成换主角 */
function collapseBriefHostActors(actorSeq, tagged) {
  if (actorSeq.length < 3) return actorSeq;
  const out = [...actorSeq];
  // If first===last and middle only appears in 接待/望着 clauses, drop middle
  if (out[0] === out[out.length - 1]) {
    const mid = out[1];
    const midIsHost = tagged.some(
      (t) => t.actor === mid && /接待|望着|神情|面容/.test(t.clause) && t.goals.length === 0
    );
    if (midIsHost) return [out[0]];
  }
  return out;
}

function countOutcomeCenters(title, summary, tagged) {
  let n = 0;
  // Explicit complete-result markers in sequence
  const marks = [
    /炼成/,
    /夺水|杀死杨氏|杀死.*巫医/,
    /下咒/,
    /抓捕/,
    /劫狱|救出/,
    /中.*箭而死|而死|身亡/,
    /临终约定|下世/,
    /灭.*满门|杀.*全家/,
    /救下/,
    /带回.*改名|取名/,
    /渐生情愫/,
    /成为.*总督/,
    /拖垮/,
    /发迹/,
    /分裂/,
    /生还|离开日月山庄/,
    /重病离世|葬礼/,
    /走向死门|走上死门/,
    /醒来.*门前|门前/
  ];
  for (const re of marks) {
    if (re.test(summary) || re.test(title)) n += 1;
  }
  // Cap using clause density
  if (tagged.length >= 5 && n >= 2) return Math.max(n, 3);
  return n;
}

function hasEventThenDurative(summary, tagged) {
  // Ceremonial 立誓世代 / 祖训世代 = still one node; only ongoing exploitation counts
  const hasDurative = /每月放血|从内部拖垮|拖垮清政府|韬光养晦/.test(summary);
  if (!hasDurative) return false;
  const hasDiscrete = tagged.some((t) =>
    t.goals.some((g) =>
      ["ADOPT_RELOCATE", "IDENTITY_ENTER", "KILL", "RENAME", "ESCAPE", "RISE"].includes(g)
    )
  );
  return hasDiscrete || /收养|成为.*总督|潜入朝廷/.test(summary);
}

function dualSubjectTitle(title) {
  for (let i = 0; i < NAMES.length; i += 1) {
    for (let j = i + 1; j < NAMES.length; j += 1) {
      const a = NAMES[i];
      const b = NAMES[j];
      if (title.includes(a) && title.includes(b) && /[，,]/.test(title)) return [a, b];
    }
  }
  // Also "A死，B幸存" / "A与B"
  for (let i = 0; i < NAMES.length; i += 1) {
    for (let j = i + 1; j < NAMES.length; j += 1) {
      const a = NAMES[i];
      const b = NAMES[j];
      if (title.includes(a) && title.includes(b) && /死|幸存|劫狱|夺水/.test(title)) return [a, b];
    }
  }
  return null;
}

function isSameConflictKeep(title, summary, text) {
  if (/诱骗|杀害|假借查看/.test(text) && /白初/.test(text) && !/同时/.test(text)) return true;
  if (/生门|死门|诀别|失去意识/.test(text) && !/醒来时在|门前/.test(summary)) return true;
  if (/潜入|呼救|追逐/.test(text) && !/同时/.test(text)) return true;
  if (/对峙/.test(title) && summary.length < 60) return true;
  return false;
}

/**
 * KEEP when still one dramatic unit despite multiple clauses/names/places mentioned.
 * Location names as result-state do NOT count as center shifts.
 */
function shouldKeepSameScene(title, summary, text, centers, signals) {
  // Continuous same-goal murder chain: infiltrate → knockout → kill → frame (KEEP)
  if (
    /潜入|夜潜/.test(text) &&
    /(迷晕|打晕)/.test(text) &&
    /(杀|杀害)/.test(text) &&
    !/得知身世|误饮|收养|渐生情愫/.test(text)
  ) {
    return true;
  }

  // Continuous murder lure→kill (sample 10)
  if (
    /诱骗|引至|假借查看/.test(text) &&
    /砸死|杀害|杀死/.test(text) &&
    !/同时|后来|每月|拖垮/.test(text) &&
    centers.actorShifts <= 1
  ) {
    return true;
  }

  // Farewell on life/death gates (sample 11) — exclude wake-elsewhere endings (19)
  if (
    /生门|死门/.test(text) &&
    /对话|失去意识|诀别/.test(text) &&
    !/醒来|门前|葬礼|重病/.test(summary)
  ) {
    return true;
  }

  // Disguise prep chain (sample 18)
  if (/藏尸|面具|伪装/.test(text) && /钥匙/.test(text) && !/同时|每月/.test(text)) {
    return true;
  }

  // Burial + vow as one ceremonial node; 明长陵空棺 is result state (sample 23)
  if (/葬/.test(text) && /立誓|寻找长生水使其复活/.test(text) && !/每月放血|拖垮|分裂/.test(text)) {
    return true;
  }

  // Rename + ancestral vow = one inheritance node (regression VALID)
  if (/改名/.test(text) && /祖训|守墓/.test(text) && !/每月放血|拖垮|分裂/.test(text)) {
    return true;
  }

  // Arrive + poison in one short beat (regression VALID)
  if (/到达/.test(text) && /毒药|下毒|注入/.test(text) && !/同时|后来|每月/.test(text) && summary.length < 80) {
    return true;
  }

  // Joint join expedition (regression VALID)
  if (/加入/.test(text) && (text.match(/加入/g) || []).length >= 2 && !/杀|劫狱|下咒|炼成/.test(text)) {
    return true;
  }

  // Atmosphere / memory restore / decide / single discovery (15,17,13,20,4,25)
  if (
    /红光|啼哭|乏力/.test(text) &&
    !/杀|救|收养|总督|分裂/.test(text)
  ) {
    return true;
  }
  if (/瘴气消散|记忆逐渐恢复|都记起来了|恢复记忆/.test(text) && !/杀|收养|每月/.test(text)) {
    return true;
  }
  if (/决定探索|商议后决定/.test(text) && summary.length < 40) return true;
  if (/灭门档案|87口|86具/.test(text) && !/救|杀全家|情愫/.test(text)) return true;
  if (/若有所思|明白了自己守护/.test(text) && summary.length < 50) return true;

  // Escape with prep (sample 8)
  if (/挖通道|携.*地图逃出|预先挖通道/.test(text) && !/分裂|每月|拖垮/.test(text)) {
    return true;
  }

  // Dispatch mission with background emotion (sample 3)
  if (/派遣/.test(text) && /寻找长生水/.test(text) && !/抓捕|劫狱|下咒|炼成/.test(text)) {
    return true;
  }

  // Static confrontation tableau (sample 22)
  if (/对峙/.test(title) && /望着|面容|神情/.test(summary) && summary.length < 55) {
    return true;
  }

  return false;
}

export function detectNeedsSplitViaBoundary(event = {}) {
  const r = detectEventBoundary(event);
  return {
    needsSplit: r.needsSplit,
    reasons: r.signals.map((s) => s.kind),
    signals: r.signals,
    centers: r.centers,
    continuousScene: r.continuousScene,
    veto: r.veto,
    confidence: r.confidence,
    detectorVersion: r.detectorVersion,
    exempt: r.veto
  };
}
