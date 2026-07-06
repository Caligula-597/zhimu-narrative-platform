/**
 * Matrix 2.0 — five-layer information ecology with honkaku / henkaku mode profiles.
 * Design-time mode selects which layers are active and how prompts/scoring behave.
 */
import { cleanText } from "./shared.js";
import { formatEraSettingBlock, buildEraSettingCard } from "./matrix-era-setting.js";
import { formatLiteraryStyleBlock } from "./matrix-literary-styles.js";

export const MATRIX_MODE_KEYS = ["honkaku", "henkaku"];

export const MATRIX_LAYER_IDS = {
  L1: "objective_ground_truth",
  L2: "public_information_pool",
  L3: "character_perception",
  L4: "mechanical_triggers",
  L5: "objectives_with_masks"
};

const MODE_ALIASES = {
  本格: "honkaku",
  honkaku: "honkaku",
  classic: "honkaku",
  logical: "honkaku",
  变格: "henkaku",
  henkaku: "henkaku",
  supernatural: "henkaku",
  mechanized: "henkaku"
};

/** @type {Record<string, object>} */
export const MATRIX_MODE_PROFILES = {
  honkaku: {
    key: "honkaku",
    label: "本格",
    labelEn: "Honkaku",
    description: "物理可解释、无超自然；推理靠公共锚点 + 多视角个人线索 + 可圆 secret。",
    layers: {
      L1: { enabled: true, visibility: "HOST_ONLY", includesSupernatural: false },
      L2: { enabled: true, required: true, sources: ["Environment", "Public_Witness", "ClueCard"] },
      L3: {
        enabled: true,
        types: ["Personal_Secret", "Subjective_Misread", "Personal_Signature"],
        minReliability: 0.5,
        allowHallucination: false,
        crossValidationRequired: true
      },
      L4: { enabled: false },
      L5: { enabled: true, surfaceOnly: true, allowHiddenObjective: false }
    },
    truthRules: [
      "禁止超自然、时空穿越、无法复盘的神谕",
      "L1 仅记录物理事件与可验证时间线",
      "定罪级事实必须经 L2 或 ≥2 角色 L3 交叉验证"
    ],
    taskRules: [
      "表层目标：对质时间线、公开/隐瞒 secret、辩护、追问",
      "禁止「收集 N 条线索」式任务",
      "任务不得独家发放推理必需事实"
    ],
    scoringWeights: {
      logicalCoherence: 1.2,
      informationSymmetry: 1.2,
      immersiveMisdirection: 0.6,
      mechanismRunnable: 0.5,
      roleBehaviorEntropy: 0.8
    }
  },
  henkaku: {
    key: "henkaku",
    label: "变格",
    labelEn: "Henkaku",
    description: "允许超自然法则、主观幻觉、机制触发；揭晓须情理之中。",
    layers: {
      L1: { enabled: true, visibility: "HOST_ONLY", includesSupernatural: true },
      L2: { enabled: true, required: true, sources: ["Environment", "Public_Witness", "ClueCard", "Ritual_State"] },
      L3: {
        enabled: true,
        types: ["Subjective_Hallucination", "Memory_Flashback", "Personal_Secret", "Personal_Signature"],
        minReliability: 0.1,
        allowHallucination: true,
        crossValidationRequired: true
      },
      L4: { enabled: true, required: true },
      L5: { enabled: true, surfaceOnly: false, allowHiddenObjective: true }
    },
    truthRules: [
      "L1 区分 physicalTimeline 与 supernaturalRules，均 HOST_ONLY",
      "超自然规则须在 L1 自洽且 L2/L4 给出可观察触发",
      "主观幻觉 reliability 可低于 0.5，但定罪须 L2 或多 L3 交叉"
    ],
    taskRules: [
      "表层：公开可说的目标（逃离、找出凶手、完成仪式）",
      "深层：仅 HOST 或 sealed segment 可见的隐藏目标（身份面具等）",
      "机制触发由 L4 定义，任务不替代触发器"
    ],
    scoringWeights: {
      logicalCoherence: 1.0,
      informationSymmetry: 1.0,
      immersiveMisdirection: 1.2,
      mechanismRunnable: 1.2,
      roleBehaviorEntropy: 0.8
    }
  }
};

export function resolveMatrixMode(raw) {
  const key = cleanText(typeof raw === "string" ? raw : raw?.matrixMode || raw?.mode, 32).toLowerCase();
  return MODE_ALIASES[key] || MODE_ALIASES[cleanText(raw?.matrixModeLabel, 16)] || "honkaku";
}

export function buildMatrixModeProfile(setting) {
  const key = resolveMatrixMode(setting?.matrixMode || setting);
  const profile = MATRIX_MODE_PROFILES[key] || MATRIX_MODE_PROFILES.honkaku;
  return {
    ...profile,
    promptVersion: "matrix-2.0",
    matrixModeLabel: `${profile.label}（${profile.labelEn}）`
  };
}

export function isLayerEnabled(profile, layerId) {
  const layer = profile?.layers?.[layerId];
  return Boolean(layer?.enabled);
}

export function formatMatrixModeBlock(profile) {
  if (!profile) return "";
  const lines = [
    `【Matrix 2.0 · 模式】${profile.matrixModeLabel || profile.label}`,
    profile.description,
    "",
    "【激活层级】",
    `- L1 客观底层（HOST_ONLY）：${profile.layers.L1?.enabled ? "✓" : "—"}${profile.layers.L1?.includesSupernatural ? "（含超自然法则）" : "（仅物理）"}`,
    `- L2 公共信息池：${profile.layers.L2?.enabled ? "✓ 必填" : "—"}`,
    `- L3 角色专属感知：${profile.layers.L3?.enabled ? `✓ 类型 ${(profile.layers.L3.types || []).join(" / ")}` : "—"}`,
    `- L4 机制触发器：${profile.layers.L4?.enabled ? "✓ 必填" : "—（本格可省略）"}`,
    `- L5 博弈目标：${profile.layers.L5?.enabled ? (profile.layers.L5.allowHiddenObjective ? "表层+深层" : "仅表层") : "—"}`,
    "",
    "【L1 真相规则】",
    ...(profile.truthRules || []).map((r) => `- ${r}`),
    "",
    "【L5 任务规则】",
    ...(profile.taskRules || []).map((r) => `- ${r}`)
  ];
  return lines.join("\n");
}

export function formatMatrixOutlineInstructions(profile) {
  const blocks = [
    "【分幕大纲 · Matrix 2.0 四段模板】",
    "1. publicAnchors（L2）：本幕所有人可见的环境锚点、公开对话、线索卡对应物证 — 不得写入仅 HOST 知的 L1 结论。",
    "2. characterPerception（L3）：仅本角色可见的主观信息；须标注 type 与 reliability（0～1）。"
  ];
  if (profile.layers.L3?.allowHallucination) {
    blocks.push(
      "   - 变格可用 Subjective_Hallucination / Memory_Flashback；reliability 可低至 0.2。",
      "   - trigger 可选：Location | Keyword | ActStart。"
    );
  } else {
    blocks.push(
      "   - 本格仅用 Personal_Secret / Subjective_Misread / Personal_Signature；reliability 建议 ≥0.5。",
      "   - 不得写不可解释的超自然目击。"
    );
  }
  if (profile.layers.L4?.enabled) {
    blocks.push(
      "3. mechanicalTriggers（L4）：if_condition → then_activate（解锁片段/线索/状态）；主持可执行。",
      "4. observableBehaviors：他人可观察的物理动作（供 Public_Witness 引用）。"
    );
  } else {
    blocks.push(
      "3. mechanicalTriggers：本格留空数组 []。",
      "4. observableBehaviors：他人可观察的物理动作（供 Public_Witness 引用）。"
    );
  }
  blocks.push(
    "5. personalTimeline：本角色本幕时间线声称（可含对外谎言；相对顺序，少 HH:MM）。",
    "6. surfaceObjectives（L5 表层）：对质/公开/辩护类，禁止「找 N 条线索」。",
    "",
    "【知识边界 · 纲要必写】",
    "- 每位角色只知道 L2 公共池 + 本幕 L3；**精力有限，不可能同步掌握所有细节**。",
    "- 分幕 outline 须显式列出 unknowns（未亲见/未核实/故意隐瞒不说的他人行动）。",
    "- 玩家任务靠**错位视角**在公聊中拼齐，不是单人本写全。"
  );
  if (profile.layers.L5?.allowHiddenObjective) {
    blocks.push("7. hiddenObjective（L5 深层，HOST_ONLY 摘要）：仅一句，不对玩家正文直写。");
  }
  return blocks.join("\n");
}

export function buildMatrix20OutlineSchema(profile, roleKey, actKey) {
  const perceptionItem = profile.layers.L3?.allowHallucination
    ? {
        type: "Subjective_Hallucination|Memory_Flashback|Personal_Secret|Personal_Signature",
        detail: "…",
        reliability: 0.3,
        trigger: "Location|Keyword|ActStart|null"
      }
    : {
        type: "Personal_Secret|Subjective_Misread|Personal_Signature",
        detail: "…",
        reliability: 0.7,
        trigger: null
      };

  const schema = {
    roleKey,
    actKey,
    matrix20: {
      publicAnchors: ["L2 公共锚点"],
      characterPerception: [perceptionItem],
      mechanicalTriggers: profile.layers.L4?.enabled
        ? [{ if: "说出关键词「…」", then: "unlock_clue_X|activate_segment_Y|state_change_Z" }]
        : [],
      observableBehaviors: ["可观察动作"],
      personalTimeline: ["相对时间：…"],
      surfaceObjectives: ["表层任务，不含独家线索"],
      hiddenObjective: profile.layers.L5?.allowHiddenObjective ? "HOST_ONLY 深层目标或 null" : null
    },
    outline: "300～450 字串联 narrative（从 matrix20 四段提炼，POV 限制）",
    signatureClues: [{ detail: "特色线索", whyPersonal: "为何独有" }],
    knowledgeSources: [{ fact: "…", source: "亲眼所见|对话|线索卡|私人专有条目|推断|听说(未核实)", clueId: null }],
    unknowns: ["本幕尚未知/未亲见：…", "仅听说未核实：…"],
    tasksHint: ["与 surfaceObjectives 呼应"]
  };
  return schema;
}

export function listMatrixModeOptions() {
  return MATRIX_MODE_KEYS.map((key) => ({
    key,
    label: MATRIX_MODE_PROFILES[key].label,
    labelEn: MATRIX_MODE_PROFILES[key].labelEn,
    description: MATRIX_MODE_PROFILES[key].description
  }));
}

export function formatMatrixCreativePromptBlock(setting, styleCard) {
  const modeProfile = buildMatrixModeProfile(setting);
  const eraBlock = formatEraSettingBlock(buildEraSettingCard(setting));
  const styleBlock = formatLiteraryStyleBlock(styleCard);
  return [formatMatrixModeBlock(modeProfile), eraBlock, styleBlock].filter(Boolean).join("\n\n");
}

export function validateMatrix20Outline(raw, profile) {
  const value = raw && typeof raw === "object" ? raw : {};
  const m20 = value.matrix20 && typeof value.matrix20 === "object" ? value.matrix20 : {};
  const perception = Array.isArray(m20.characterPerception) ? m20.characterPerception.slice(0, 6) : [];
  return {
    publicAnchors: Array.isArray(m20.publicAnchors) ? m20.publicAnchors.map((s) => cleanText(s, 200)).slice(0, 8) : [],
    characterPerception: perception.map((p) => ({
      type: cleanText(p.type, 48),
      detail: cleanText(p.detail, 300),
      reliability: Math.max(0, Math.min(1, Number(p.reliability) || 0.5)),
      trigger: p.trigger ? cleanText(p.trigger, 80) : null
    })),
    mechanicalTriggers: Array.isArray(m20.mechanicalTriggers)
      ? m20.mechanicalTriggers.slice(0, 8).map((t) => ({
          if: cleanText(t.if, 200),
          then: cleanText(t.then, 200)
        }))
      : [],
    observableBehaviors: Array.isArray(m20.observableBehaviors)
      ? m20.observableBehaviors.map((b) => cleanText(b, 120)).slice(0, 12)
      : [],
    personalTimeline: Array.isArray(m20.personalTimeline)
      ? m20.personalTimeline.map((t) => cleanText(t, 160)).slice(0, 8)
      : [],
    surfaceObjectives: Array.isArray(m20.surfaceObjectives)
      ? m20.surfaceObjectives.map((o) => cleanText(o, 160)).slice(0, 5)
      : [],
    hiddenObjective: profile?.layers?.L5?.allowHiddenObjective ? cleanText(m20.hiddenObjective, 200) || null : null
  };
}
