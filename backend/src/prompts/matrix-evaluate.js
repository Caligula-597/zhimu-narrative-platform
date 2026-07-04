import { PRODUCT_BOUNDARY, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";

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
        closingHook: script.closingHook
      });
    }
  }
  return rows;
}

export function buildMatrixEvaluationMessages(pipeline) {
  const system = `你是剧本杀「矩阵一致性」质检编辑。重点查信息泄露、公平性、矩阵与正文一致性。

${PRODUCT_BOUNDARY}

【剧透安全 checklist】
- 各幕正文是否违反 spoilerGates.forbiddenFacts（含同义改写）？
- 第一幕是否指认真凶或写穿核心手法？
- misdirections 是否在收束幕之前被写穿？

【公平推理 checklist】
- 是否存在「仅某一角色剧本出现、且其它角色无法通过线索/公聊获得」的关键事实？
- 角色名是否与档案一致？

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
    "targetLayer": "scripts",
    "targetKey": "role-1_ch1",
    "priority": "must_fix|should_fix|optional",
    "problem": "…",
    "direction": "…",
    "promptHint": "下轮生成提示"
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
${untrustedUserPayload("信息矩阵", {
  actTitles: pipeline.infoMatrix?.actTitles,
  clueCount: pipeline.infoMatrix?.clues?.length,
  rows: (pipeline.infoMatrix?.rows || []).map((r) => ({
    roleKey: r.roleKey,
    actKey: r.actKey,
    newClueIds: r.newClueIds,
    forbidden: r.forbidden,
    tasks: r.tasks
  }))
})}
${untrustedUserPayload("全部剧本", buildScriptCorpus(pipeline.scripts, pipeline.config))}

readyForSync 仅当 spoilerSafety≥8 且 fairness≥7 且无明显 matrix 矛盾时为 true。

若真凶位 ch1/ch2 使用 innocent_witness + 规则注入破绽模式，应检查：① 无内心认罪 ② 无 forbiddenFacts ③ 破绽为行为/措辞矛盾而非手法自白。

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
