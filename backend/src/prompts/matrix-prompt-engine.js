/**
 * Matrix pipeline — shared prompt contracts for spoiler safety & fairness.
 * Pure functions; no API calls.
 */
import { cleanText } from "./shared.js";

export function actIndex(config, actKey) {
  const keys = config?.chapterKeys || [];
  const idx = keys.indexOf(actKey);
  return idx >= 0 ? idx : 0;
}

export function resolveKillerRoleKey(truthBible, characterArchives) {
  const killer = cleanText(truthBible?.killer, 120);
  const roles = characterArchives?.roles || [];
  const byKey = roles.find((r) => killer.includes(r.key));
  if (byKey) return byKey.key;
  const byName = roles.find((r) => r.name && killer.includes(r.name.split("·")[0].trim()));
  if (byName) return byName.key;
  const m = killer.match(/role-\d+/);
  return m ? m[0] : null;
}

export function spoilerGateForAct(truthBible, actKey) {
  return (truthBible?.spoilerGates || []).find((g) => g.actKey === actKey) || { actKey, forbiddenFacts: [] };
}

export function buildRoleRosterBlock(characterArchives) {
  const roles = (characterArchives?.roles || []).map((r) => ({
    key: r.key,
    name: r.name,
    publicIdentity: cleanText(r.publicIdentity, 120)
  }));
  return {
    roles,
    rule: "正文与对话中只能使用上表 name，禁止自创新人名或改姓改名。"
  };
}

export function buildClueLedger(infoMatrix, actKey, { includeFutureActs = false } = {}) {
  const keys = [...new Set((infoMatrix?.clues || []).map((c) => c.actKey))];
  const currentIdx = keys.indexOf(actKey);
  return (infoMatrix?.clues || [])
    .filter((c) => {
      if (includeFutureActs) return true;
      const idx = keys.indexOf(c.actKey);
      if (currentIdx < 0) return c.actKey === actKey;
      return idx >= 0 && idx <= currentIdx;
    })
    .map((c) => ({
      key: c.key,
      name: c.name,
      actKey: c.actKey,
      grantMode: c.grantMode,
      hint: cleanText(c.description, 160)
    }));
}

export function buildPeerScriptDigest(existingScripts, actKey, roleKey, config) {
  const keys = config?.chapterKeys || [];
  const actIdx = keys.indexOf(actKey);
  const digest = [];
  for (const [rk, acts] of Object.entries(existingScripts || {})) {
    if (rk === roleKey) continue;
    for (const [ak, script] of Object.entries(acts || {})) {
      const akIdx = keys.indexOf(ak);
      if (akIdx < 0 || akIdx > actIdx) continue;
      if (rk === roleKey && ak === actKey) continue;
      const body = cleanText(script?.body, 2000);
      if (!body) continue;
      digest.push({
        roleKey: rk,
        actKey: ak,
        title: script.title,
        excerpt: body.slice(0, 280),
        tasks: (script.tasks || []).slice(0, 3)
      });
    }
  }
  return digest.slice(0, 8);
}

/** Same-role previous acts — demo 短篇按 ch1→ch2→ch3 连续阅读。 */
export function buildSameRoleContinuity(existingScripts, roleKey, actKey, config, setting) {
  const keys = config?.chapterKeys || [];
  const actIdx = keys.indexOf(actKey);
  if (actIdx <= 0) {
    return {
      actIndex: actIdx,
      isDemoShortForm: setting?.volumeTier === "demo",
      hasPrevious: false,
      previousActs: [],
      continuityRules: ["第一幕：建立角色处境与基调，为后续幕留 closingHook。"]
    };
  }
  const isDemo = setting?.volumeTier === "demo";
  const previousActs = [];
  for (let i = 0; i < actIdx; i++) {
    const ak = keys[i];
    const script = existingScripts?.[roleKey]?.[ak];
    if (!script?.body) continue;
    const body = cleanText(script.body, isDemo ? 1400 : 900);
    previousActs.push({
      actKey: ak,
      actIndex: i,
      title: script.title,
      closingHook: script.closingHook,
      tasks: script.tasks,
      body: isDemo ? body : body.slice(-520),
      bodyMode: isDemo ? "full_for_demo_chain" : "tail_excerpt"
    });
  }
  return {
    actIndex: actIdx,
    isDemoShortForm: isDemo,
    hasPrevious: previousActs.length > 0,
    previousActs,
    continuityRules: [
      "本幕是同一角色的连续经历：时间、情绪、身体状态须与上一幕衔接。",
      "开头 1～3 句必须自然承接上一幕 closingHook 或末尾情境，不要重置场景。",
      "禁止大段复制上一幕正文；本幕须推进 matrixRow 的新信息与任务。",
      isDemo
        ? "demo 短篇：玩家会连续阅读 ch1→ch2→ch3，保持人称、语态、秘密知情范围一致，像一篇分节长篇小说。"
        : "标准/完整档：单幕可相对独立，但仍需明确时间线承接。"
    ]
  };
}

/** Spoiler contract injected into player-script & upstream layers. */
export function buildSpoilerContract({
  truthBible,
  config,
  actKey,
  roleKey,
  characterArchives,
  matrixRow
}) {
  const idx = actIndex(config, actKey);
  const gate = spoilerGateForAct(truthBible, actKey);
  const killerKey = resolveKillerRoleKey(truthBible, characterArchives);
  const forbidden = [
    ...new Set([
      ...(gate.forbiddenFacts || []),
      cleanText(matrixRow?.forbidden, 500)
    ].filter(Boolean))
  ];

  const rules = [
    "本幕正文是玩家视角：只写该角色此时此地能感知、能推断的内容，禁止全知叙述。",
    "禁止在正文中写「真凶是…」「凶手就是…」或等价结论；第三幕前尤其禁止指认具体角色为凶手。",
    "禁止提前解开 truthBible.misdirections 中尚未到收束幕的误导（见 misdirectionPreservation）。",
    "禁止描写其它角色未公开的秘密（只能写外表、对话、谣言、猜测）。"
  ];

  if (idx === 0) {
    rules.push(
      "第一幕：closingHook 只能怀疑「方向」（如时间线对不上、某人在撒谎），不得点名真凶或核心手法。",
      "第一幕：不得描写核心诡计机关的完整运作（如暗格如何联动、谁诱谁坠亡）。"
    );
  } else if (idx === 1) {
    rules.push(
      "第二幕：可讨论矛盾与动机，但仍不得写死真凶身份；手法只可写「假设」不可写「确证」。"
    );
  }

  if (killerKey && killerKey === roleKey && idx < (config?.chapterKeys?.length || 1) - 1) {
    rules.push(
      "你是真凶位：本幕不得自白或内心承认作案，只能防守性隐瞒或转移怀疑。",
      "真凶位禁止在回忆/内心独白中写作案动作（设置机关、改频走私、配钥匙作案、推/杀/灭口、用细线反锁等）。",
      "真凶位回忆与死者冲突时：只写「争吵/被威胁/情绪失控」，不得写导致死亡的具体动作或机关细节。",
      "真凶位可写：对外撒谎、掩饰紧张、把怀疑引向他人、隐瞒与案件无关的小秘密。",
      "真凶位禁止「担心杀人败露」式内心独白；改为「担心被怀疑与死者有过节」等模糊焦虑。"
    );
  }

  if (killerKey && idx < 2) {
    forbidden.push(`明确指认 ${killerKey} 为凶手`);
  }

  return { actKey, actIndex: idx, forbiddenFacts: forbidden, narrativeRules: rules, killerRoleKey: killerKey };
}

/** Fairness contract — no exclusive inference-critical facts in one private script. */
export function buildFairnessContract({ infoMatrix, actKey, matrixRow, config }) {
  const idx = actIndex(config, actKey);
  const actClues = (infoMatrix?.clues || []).filter((c) => c.actKey === actKey);
  const myClueIds = matrixRow?.newClueIds || [];
  const rules = [
    "公平推理：玩家本只能包含「本角色亲身经历」+「本幕已发放线索卡（newClueIds）」+「公开讨论中已知的信息」。",
    "禁止写入仅本角色知道、且其它玩家永远无法通过线索/公聊获得的「关键物理事实」（如独家目击核心机关、独家目击真凶动作）。",
    "若需暗示某线索，用感官细节（听见金属声、闻到柴油）而非直接命名机关或结论；完整线索由主持发放 clue 卡。",
    "对他人的怀疑必须基于可观察行为（说谎、时间对不上、情绪异常），禁止写「你明知他是凶手」。",
    "tasks 必须与 matrixRow.tasks 完全一致（可微调措辞，不得增删条目）。"
  ];

  if (idx >= 1) {
    rules.push(
      "第二幕起：若正文提到某条线索，必须在 newClueIds 中或明确为「听他人转述/看到公开线索卡」。"
    );
  }

  return {
    actKey,
    thisRowClueIds: myClueIds,
    cluesThisAct: actClues.map((c) => ({ key: c.key, name: c.name, grantMode: c.grantMode })),
    fairnessRules: rules
  };
}

export function buildMisdirectionPreservationBlock(truthBible, config, actKey) {
  const idx = actIndex(config, actKey);
  const total = (config?.chapterKeys || []).length;
  const items = (truthBible?.misdirections || []).map((m, i) => {
    const resolveAct = Math.min(total - 1, Math.max(idx, i + 1));
    const locked = idx < resolveAct - 1;
    return {
      layer: m.layer,
      surface: m.surface,
      lockedUntilActIndex: resolveAct - 1,
      rule: locked
        ? `本幕不得写穿「${m.surface}」的真相（${m.resolution}）`
        : `本幕可收束「${m.surface}」`
    };
  });
  return items;
}

export function formatPromptBlock(title, payload) {
  return `【${title}】\n${JSON.stringify(payload, null, 2)}`;
}

export function buildMatrixScriptPromptBundle(input) {
  const {
    truthBible,
    infoMatrix,
    characterArchives,
    config,
    actKey,
    roleKey,
    matrixRow,
    existingScripts,
    setting
  } = input;

  return {
    roleRoster: buildRoleRosterBlock(characterArchives),
    roleContinuity: buildSameRoleContinuity(existingScripts, roleKey, actKey, config, input.setting),
    spoilerContract: buildSpoilerContract({
      truthBible,
      config,
      actKey,
      roleKey,
      characterArchives,
      matrixRow
    }),
    fairnessContract: buildFairnessContract({ infoMatrix, actKey, matrixRow, config }),
    misdirectionPreservation: buildMisdirectionPreservationBlock(truthBible, config, actKey),
    clueLedger: buildClueLedger(infoMatrix, actKey),
    peerScriptDigest: buildPeerScriptDigest(existingScripts, actKey, roleKey, config),
    authoritativeTasks: matrixRow?.tasks || []
  };
}
