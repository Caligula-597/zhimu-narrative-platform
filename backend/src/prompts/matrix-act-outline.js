import { PRODUCT_BOUNDARY, cleanText } from "./shared.js";
import { formatPromptBlock } from "./matrix-prompt-engine.js";
import {
  buildMatrixModeProfile,
  buildMatrix20OutlineSchema,
  formatMatrixCreativePromptBlock,
  formatMatrixOutlineInstructions,
  validateMatrix20Outline
} from "./matrix-2-mode.js";

export const OUTLINE_TARGET_WORDS = 450;
export const OUTLINE_LAYER_VERSION = "matrix-2.0";

/**
 * Extract per-role per-act POV-limited outline — Matrix 2.0 four-block template.
 */
export function buildActOutlineMessages({
  setting,
  reasoningNovel,
  characterArchive,
  matrixRow,
  roleKey,
  actKey,
  styleCard,
  spoilerContract,
  fairnessContract,
  clueLedger,
  killerAwarenessContract,
  publicEnvironment
}) {
  const modeProfile = buildMatrixModeProfile(setting);
  const creativeBlock = formatMatrixCreativePromptBlock(setting, styleCard);
  const outlineInstructions = formatMatrixOutlineInstructions(modeProfile);
  const schemaExample = buildMatrix20OutlineSchema(modeProfile, roleKey, actKey);
  const actBody = reasoningNovel?.acts?.find((a) => a.actKey === actKey)?.body || "";

  const system = `你是剧本杀「分幕大纲编辑 · Matrix 2.0」。从推理长篇中**摘取**一位角色本幕私人视角大纲。

${PRODUCT_BOUNDARY}

${creativeBlock}

${outlineInstructions}

【摘取规则】
1. matrix20.publicAnchors 须与 L2 线索卡/公共环境一致，不得超出 clueLedger。
2. matrix20.characterPerception = L3；特色线索放 signatureClues 与 perception 呼应。
3. 推理必需事实不得只出现在本角色 perception 且 reliability<0.5 且无 L2 交叉。
4. 遵守 spoilerContract；误导须可解释。
5. tasksHint / surfaceObjectives 禁止「收集线索」式表述。

【输出 schema 示例】
${JSON.stringify(schemaExample, null, 2)}`;

  const user = `摘取 ${roleKey} / ${actKey} 分幕大纲。

${formatPromptBlock("reasoningNovelAct", { actKey, body: actBody.slice(0, 6000) })}
${publicEnvironment ? formatPromptBlock("publicEnvironment", publicEnvironment) : ""}
${formatPromptBlock("characterArchive", {
  key: characterArchive?.key,
  name: characterArchive?.name,
  publicIdentity: characterArchive?.publicIdentity,
  voiceHints: characterArchive?.voiceHints
})}
${formatPromptBlock("matrixRow", {
  tasks: matrixRow?.tasks,
  newClueIds: matrixRow?.newClueIds,
  suspicion: matrixRow?.suspicion,
  forbidden: matrixRow?.forbidden
})}
${formatPromptBlock("spoilerContract", spoilerContract)}
${formatPromptBlock("fairnessContract", fairnessContract)}
${killerAwarenessContract ? formatPromptBlock("killerAwarenessContract", killerAwarenessContract) : ""}
${formatPromptBlock("clueLedger", clueLedger)}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export function validateActOutline(raw, roleKey, actKey, setting) {
  const value = raw && typeof raw === "object" ? raw : {};
  const modeProfile = buildMatrixModeProfile(setting || {});
  const matrix20 = validateMatrix20Outline(value, modeProfile);
  return {
    roleKey: cleanText(value.roleKey || roleKey, 32),
    actKey: cleanText(value.actKey || actKey, 16),
    matrix20,
    outline: cleanText(value.outline, 2000),
    signatureClues: Array.isArray(value.signatureClues)
      ? value.signatureClues.slice(0, 4).map((s) => ({
          detail: cleanText(s.detail, 200),
          whyPersonal: cleanText(s.whyPersonal, 120)
        }))
      : [],
    knowledgeSources: Array.isArray(value.knowledgeSources)
      ? value.knowledgeSources.slice(0, 24).map((k) => ({
          fact: cleanText(k.fact, 200),
          source: cleanText(k.source, 80),
          clueId: k.clueId ? cleanText(k.clueId, 32) : null
        }))
      : [],
    observableBehaviors:
      matrix20.observableBehaviors.length > 0
        ? matrix20.observableBehaviors
        : Array.isArray(value.observableBehaviors)
          ? value.observableBehaviors.map((b) => cleanText(b, 120)).slice(0, 12)
          : [],
    tasksHint: Array.isArray(value.tasksHint)
      ? value.tasksHint.map((t) => cleanText(t, 120)).slice(0, 6)
      : matrix20.surfaceObjectives.slice(0, 6)
  };
}
