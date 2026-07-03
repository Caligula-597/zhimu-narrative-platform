import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";

export function buildMatrixEvaluationMessages(pipeline) {
  const system = `你是剧本杀「矩阵一致性」质检编辑。重点查信息泄露、公平性、矩阵与正文一致性，不评文学奖项。

${PRODUCT_BOUNDARY}

【评判维度】（1-10）
matrixConsistency · spoilerSafety · fairness · taskCompleteness · importReady

【targetLayer 只能是】setup | truth | characters | matrix | host | scripts | sync | evaluate

【输出 schema】
{
  "overallScore": 7.5,
  "verdict": "一句话总评",
  "scores": {
    "matrixConsistency": 8,
    "spoilerSafety": 8,
    "fairness": 7,
    "taskCompleteness": 8,
    "importReady": 8
  },
  "issues": [{"severity":"high|medium|low","area":"…","detail":"…"}],
  "revisions": [{
    "targetLayer": "matrix",
    "targetKey": "ch2|role-1",
    "priority": "must_fix|should_fix|optional",
    "problem": "…",
    "direction": "…",
    "promptHint": "下轮生成提示"
  }],
  "readyForSync": false,
  "suggestions": []
}`;
  const sampleScripts = [];
  for (const [roleKey, acts] of Object.entries(pipeline.scripts || {})) {
    for (const [actKey, script] of Object.entries(acts || {})) {
      sampleScripts.push({
        roleKey,
        actKey,
        title: script.title,
        preview: String(script.body || "").slice(0, 600),
        tasks: script.tasks
      });
      if (sampleScripts.length >= 6) break;
    }
    if (sampleScripts.length >= 6) break;
  }
  const user = `请评判以下矩阵流水线产物。

${pipeline.setting && pipeline.synopsis ? creativeInputUserBlocks(pipeline.setting, pipeline.synopsis) : ""}
${untrustedUserPayload("真相 Bible 摘要", { summary: pipeline.truthBible?.summary, killer: pipeline.truthBible?.killer, spoilerGates: pipeline.truthBible?.spoilerGates })}
${untrustedUserPayload("信息矩阵统计", {
  clueCount: pipeline.infoMatrix?.clues?.length,
  rowCount: pipeline.infoMatrix?.rows?.length
})}
${untrustedUserPayload("剧本抽样", sampleScripts)}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
