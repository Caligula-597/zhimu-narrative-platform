import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";
import { buildMatrixModeProfile, formatMatrixModeBlock } from "./matrix-2-mode.js";

function buildScriptCorpus(scripts, config) {
  const keys = config?.chapterKeys || [];
  const rows = [];
  for (const [roleKey, acts] of Object.entries(scripts || {})) {
    for (const actKey of keys) {
      const script = acts?.[actKey];
      if (!script?.body) continue;
      rows.push({
        roleKey,
        actKey,
        title: script.title,
        bodyLength: script.body.length,
        body: String(script.body).slice(0, 6000),
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

export function buildMatrixEvaluationMessages(pipeline) {
  const modeProfile = buildMatrixModeProfile(pipeline.setting || {});
  const modeBlock = formatMatrixModeBlock(modeProfile);
  const isHenkaku = modeProfile.key === "henkaku";

  const system = `你是剧本杀「Matrix 2.0 质检编辑」。评判多人私人本 + 信息矩阵是否可玩、可推理。

${PRODUCT_BOUNDARY}

${modeBlock}

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

【兼容字段 — 同时输出 legacy scores】
matrixConsistency≈logicalCoherence；fairness≈informationSymmetry；spoilerSafety：本格查 forbiddenFacts，变格查过早写穿 resolution；taskCompleteness≈roleBehaviorEntropy；importReady≈mechanismRunnable。

【readyForSync】
本格：informationSymmetry≥7 且 logicalCoherence≥8 且无明显 L2 独占核心真相。
变格：另需 mechanismRunnable≥7。

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
    "matrixConsistency": 8,
    "spoilerSafety": 8,
    "fairness": 7,
    "taskCompleteness": 8,
    "importReady": 8
  },
  "issues": [{"severity":"high|medium|low","area":"…","detail":"…"}],
  "revisions": [{
    "targetLayer": "scripts|matrix|truth|host",
    "targetKey": "role-1_ch1",
    "priority": "must_fix|should_fix|optional",
    "problem": "…",
    "direction": "…",
    "promptHint": "…"
  }],
  "readyForSync": false,
  "suggestions": []
}`;
  const user = `请评判以下矩阵流水线产物（含全部已生成剧本）。

${pipeline.setting && pipeline.synopsis ? creativeInputUserBlocks(pipeline.setting, pipeline.synopsis) : ""}
${untrustedUserPayload("真相 Bible", {
  summary: pipeline.truthBible?.summary,
  killer: pipeline.truthBible?.killer,
  method: pipeline.truthBible?.method,
  misdirections: pipeline.truthBible?.misdirections,
  spoilerGates: pipeline.truthBible?.spoilerGates
})}
${untrustedUserPayload("信息矩阵 · L2", {
  actTitles: pipeline.infoMatrix?.actTitles,
  publicEnvironmentByAct: pipeline.infoMatrix?.publicEnvironmentByAct,
  clueCount: pipeline.infoMatrix?.clues?.length,
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
