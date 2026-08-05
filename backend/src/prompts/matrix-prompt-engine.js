/**
 * Matrix pipeline — shared prompt contracts for spoiler safety & fairness.
 * Pure functions; no API calls.
 */
import { cleanText } from "./shared.js";
import { resolveKillerAwareness, buildKillerAwarenessContract } from "./matrix-killer-awareness.js";
import { buildPersonalSignatureGuidance } from "./matrix-fairness-model.js";
import { buildMatrixModeProfile } from "./matrix-2-mode.js";
import { buildEntityUnlockContract } from "./matrix-entity-unlock.js";

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
    publicIdentity: cleanText(r.publicIdentity, 120),
    pronouns: cleanText(r.pronouns, 8) || "TA"
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
  matrixRow,
  setting
}) {
  const idx = actIndex(config, actKey);
  const gate = spoilerGateForAct(truthBible, actKey);
  const killerKey = resolveKillerRoleKey(truthBible, characterArchives);
  const killerAwareness = resolveKillerAwareness(setting);
  const finalIdx = Math.max(0, (config?.chapterKeys?.length || 1) - 1);
  const awareness = buildKillerAwarenessContract({
    killerAwareness,
    roleKey,
    killerRoleKey: killerKey,
    actIndex: idx,
    finalActIndex: finalIdx
  });
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
      "第一幕：不得描写核心诡计的完整运作，也不得交代实施者、受害者与全部步骤。"
    );
  } else if (idx === 1) {
    rules.push(
      "第二幕：可讨论矛盾与动机，但仍不得写死真凶身份；手法只可写「假设」不可写「确证」。"
    );
  }

  if (killerKey && killerKey === roleKey && idx < (config?.chapterKeys?.length || 1) - 1) {
    if (killerAwareness === "self-aware") {
      rules.push(
        "你是真凶位且**自知**：私人本（心理/规定情绪）可直白写「我是凶手、必须瞒住」— 仅本人可见，**不**作剧透门禁重点。",
        "对外段落（公聊台词）仍禁止向其他玩家公开自白；forbiddenFacts 手法名词仍禁。"
      );
    } else {
      rules.push(
        "你是真凶位但**不自知**：与无辜者相同标准，禁止任何作案确证式内心或回忆。",
        "禁止担心杀人败露；只允许担心被怀疑与死者有过节。",
        "不得写碰凶器、设置机关等 forbiddenFacts。"
      );
    }
  }

  rules.push(...awareness.rules);

  if (killerKey && idx < 2) {
    forbidden.push(`明确指认 ${killerKey} 为凶手`);
  }

  return {
    actKey,
    actIndex: idx,
    forbiddenFacts: forbidden,
    narrativeRules: rules,
    killerRoleKey: killerKey,
    killerAwareness,
    killerAwarenessContract: awareness
  };
}

/** Fairness — clue cards + mandatory personal signature beats per script. */
export function buildFairnessContract({
  infoMatrix,
  actKey,
  matrixRow,
  config,
  setting,
  characterArchives,
  truthBible,
  roleKey
}) {
  const idx = actIndex(config, actKey);
  const killerAwareness = resolveKillerAwareness(setting);
  const modeProfile = buildMatrixModeProfile(setting);
  const actClues = (infoMatrix?.clues || []).filter((c) => c.actKey === actKey);
  const myClueIds = matrixRow?.newClueIds || [];
  const characterArchive = (characterArchives?.roles || []).find((r) => r.key === roleKey);
  const personalSignature = buildPersonalSignatureGuidance({ roleKey, characterArchive });

  const rules = [
    "【Matrix 2.0 · 信息分工】",
    "L2 公共池（clueLedger + publicEnvironment）：推理主路径；主持可发线索卡。",
    "L3 个人本：时间线声称 + 1～2 条特色线索/secret；玩家自行决定是否公聊。",
    "L5 表层任务：对质/公开/辩护；**禁止**在 tasks 中独家发放推理必需事实。",
    "他人 secret/误导须可圆（动机/时间线/物证）；禁止凭空栽赃。",
    "【公平红线】仅当核心真相只锁一人本且永远无法经 L2/L3 交叉获得 — 才算违规。",
    "tasks 须与 matrixRow.tasks（表层目标）一致，可微调措辞。"
  ];

  if (modeProfile.key === "henkaku") {
    rules.push("变格：L3 幻觉 reliability 可低，但定罪须 L2 或多视角交叉；L4 触发器不得被 task 替代。");
  } else {
    rules.push("本格：L3 仅 Personal_Secret / Subjective_Misread；禁止不可解释超自然。");
  }

  if (killerAwareness === "self-aware") {
    const killerKey = resolveKillerRoleKey(truthBible, characterArchives);
    if (killerKey && matrixRow?.roleKey !== killerKey) {
      rules.push("非凶位：除 clue 卡外，须有本角色**读剧本才能发现**的特色细节；并可含指向嫌疑人的表象矛盾。");
    }
    if (killerKey && matrixRow?.roleKey === killerKey) {
      rules.push("真凶自知：私人本可直白写隐瞒任务与作案者内心；**不**因「只有凶手本知道自己是凶手」扣 fairness。");
    }
  } else {
    rules.push("凶手不自知：私人本与其他人同标准；禁止内心确证「我是凶手」。");
  }

  if (idx >= 1) {
    rules.push("第二幕起：若提到共享线索卡内容，须在 newClueIds 中或标注为听他人转述/已公开。");
  }

  return {
    actKey,
    thisRowClueIds: myClueIds,
    cluesThisAct: actClues.map((c) => ({ key: c.key, name: c.name, grantMode: c.grantMode })),
    personalSignature,
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
    matrixModeProfile: buildMatrixModeProfile(setting),
    entityUnlockContract: buildEntityUnlockContract(infoMatrix, actKey, config),
    roleContinuity: buildSameRoleContinuity(existingScripts, roleKey, actKey, config, input.setting),
    spoilerContract: buildSpoilerContract({
      truthBible,
      config,
      actKey,
      roleKey,
      characterArchives,
      matrixRow,
      setting
    }),
    fairnessContract: buildFairnessContract({
      infoMatrix,
      actKey,
      matrixRow,
      config,
      setting,
      characterArchives,
      truthBible,
      roleKey
    }),
    misdirectionPreservation: buildMisdirectionPreservationBlock(truthBible, config, actKey),
    clueLedger: buildClueLedger(infoMatrix, actKey),
    peerScriptDigest: buildPeerScriptDigest(existingScripts, actKey, roleKey, config),
    authoritativeTasks: matrixRow?.tasks || []
  };
}
