import { PRODUCT_BOUNDARY, cleanText, untrustedUserPayload } from "./shared.js";

/**
 * Phase 1: Infer truth from innocent players' scripts ONLY — no truth bible input.
 */
export function buildInnocentScriptsInferenceMessages({ scripts, config, characterArchives, killerRoleKey }) {
  const keys = config?.chapterKeys || [];
  const innocentDigest = [];
  for (const [roleKey, acts] of Object.entries(scripts || {})) {
    if (roleKey === killerRoleKey) continue;
    for (const actKey of keys) {
      const script = acts?.[actKey];
      if (!script?.body) continue;
      const role = characterArchives?.roles?.find((r) => r.key === roleKey);
      innocentDigest.push({
        roleKey,
        roleName: role?.name,
        actKey,
        title: script.title,
        body: String(script.body).slice(0, 5500),
        tasks: script.tasks,
        closingHook: script.closingHook
      });
    }
  }

  const system = `你是本格悬疑「公平推理审计员」。你**没有**读过上帝视角真相文档。

${PRODUCT_BOUNDARY}

【输入】
- 仅三位**非凶手**玩家的私人剧本（凶手位已全部排除）。
- 你不得假设存在任何未出现在这些正文里的隐藏信息。

【任务】
1. 仅根据上述正文，推断：凶手（roleKey）、手法概要、动机、关键时间线、主要误导线。
2. 列出你的**推理链**：每条结论必须指向正文中的依据（roleKey + actKey + 引述要点）。
3. 标注信息缺口：哪些关键点无法从三份 innocent 本推出。
4. killer 必须输出 roleKey（role-1 … role-N）。

【输出 schema】
{
  "inferred": {
    "killer": "role-N",
    "method": "推断手法",
    "motive": "推断动机",
    "timeline": [{"time":"相对/模糊","event":"…"}],
    "confidence": 0.0
  },
  "reasoningChain": [{"conclusion":"…","evidence":[{"roleKey":"…","actKey":"…","quote":"…"}]}],
  "redHerringsSpotted": ["…"],
  "gaps": ["无法从 innocent 本推出的点"],
  "suspectRanking": [{"roleKey":"role-1","score":0.0,"why":"…"}]
}`;

  const user = `请从非凶手剧本推断真相。已排除凶手位：${killerRoleKey || "（未知）"}。

${untrustedUserPayload("非凶手私人剧本（唯一信息源）", innocentDigest)}
${untrustedUserPayload("角色 roster", (characterArchives?.roles || []).map((r) => ({ key: r.key, name: r.name })))}

**禁止**使用任何标准答案或主持手册。只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

/** Phase 2: Compare innocent inference with truth bible (audit side only). */
export function buildInnocentInferenceCompareMessages({ inference, truthBible, killerRoleKey }) {
  const system = `你是案件复盘审计员。将「仅从非凶手剧本推断的结果」与「标准真相」比对。

${PRODUCT_BOUNDARY}

【输出 schema】
{
  "killerMatch": true,
  "methodMatch": true,
  "motiveMatch": true,
  "overallDeducible": true,
  "fairnessVerdict": "pass|weak|fail",
  "fairnessNote": "若 innocent 本足以推出真凶则 pass；若需凶手本信息才能破案则 fail",
  "conflicts": ["…"],
  "gaps": ["…"],
  "suggestions": ["…"]
}`;

  const user = `凶手 key（标准答案）：${truthBible?.killer}

${untrustedUserPayload("非凶手推断", inference)}
${untrustedUserPayload("标准真相", {
  killer: truthBible.killer,
  method: truthBible.method,
  motive: truthBible.motive,
  summary: truthBible.summary?.slice(0, 1000)
})}

真凶位 ${killerRoleKey} 的剧本**未**参与推断。评估：公平推理是否成立？

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export function validateInnocentScriptsInference(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const inferred = value.inferred && typeof value.inferred === "object" ? value.inferred : {};
  return {
    inferred: {
      killer: cleanText(inferred.killer, 32),
      method: cleanText(inferred.method, 800),
      motive: cleanText(inferred.motive, 400),
      timeline: Array.isArray(inferred.timeline) ? inferred.timeline.slice(0, 12) : [],
      confidence: Math.max(0, Math.min(1, Number(inferred.confidence) || 0))
    },
    reasoningChain: Array.isArray(value.reasoningChain) ? value.reasoningChain.slice(0, 16) : [],
    redHerringsSpotted: Array.isArray(value.redHerringsSpotted) ? value.redHerringsSpotted.map((s) => cleanText(s, 200)) : [],
    gaps: Array.isArray(value.gaps) ? value.gaps.map((g) => cleanText(g, 300)) : [],
    suspectRanking: Array.isArray(value.suspectRanking) ? value.suspectRanking.slice(0, 8) : []
  };
}

export function validateInnocentInferenceCompare(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  return {
    killerMatch: Boolean(value.killerMatch),
    methodMatch: Boolean(value.methodMatch),
    motiveMatch: Boolean(value.motiveMatch),
    overallDeducible: Boolean(value.overallDeducible),
    fairnessVerdict: ["pass", "weak", "fail"].includes(value.fairnessVerdict) ? value.fairnessVerdict : "weak",
    fairnessNote: cleanText(value.fairnessNote, 600),
    conflicts: Array.isArray(value.conflicts) ? value.conflicts.map((c) => cleanText(c, 300)) : [],
    gaps: Array.isArray(value.gaps) ? value.gaps.map((g) => cleanText(g, 300)) : [],
    suggestions: Array.isArray(value.suggestions) ? value.suggestions.map((s) => cleanText(s, 300)) : []
  };
}

export function mechanicalInnocentInferenceCompare(inference, truthBible) {
  const inferredKiller = cleanText(inference?.inferred?.killer, 32);
  const truthKiller = cleanText(truthBible?.killer, 32);
  return {
    inferredKiller,
    truthKiller,
    killerMatch: inferredKiller === truthKiller,
    confidence: inference?.inferred?.confidence ?? 0
  };
}

export function collectInnocentScripts(scripts, config, killerRoleKey) {
  const keys = config?.chapterKeys || [];
  const out = [];
  for (const [roleKey, acts] of Object.entries(scripts || {})) {
    if (roleKey === killerRoleKey) continue;
    for (const actKey of keys) {
      if (acts?.[actKey]?.body) out.push({ roleKey, actKey });
    }
  }
  return out;
}

export function renderInnocentInferenceMarkdown({ inference, comparison, mechanical, killerRoleKey, characterArchives }) {
  const roles = Object.fromEntries((characterArchives?.roles || []).map((r) => [r.key, r.name]));
  const lines = [
    "# 非凶手剧本 · 真相推断审计",
    "",
    "> 推断阶段**未读**真相 Bible，**未读**凶手位剧本。",
    `> 排除：${killerRoleKey}（${roles[killerRoleKey] || "真凶"}）`,
    "",
    "## 1. 推断结果（仅 innocent 本）",
    "",
    `- **凶手**：${inference?.inferred?.killer || "—"}（置信度 ${inference?.inferred?.confidence ?? "—"}）`,
    `- **手法**：${inference?.inferred?.method || "—"}`,
    `- **动机**：${inference?.inferred?.motive || "—"}`,
    "",
    "### 推理链",
    ...(inference?.reasoningChain?.length
      ? inference.reasoningChain.map(
          (r, i) =>
            `${i + 1}. **${r.conclusion || "结论"}**\n${(r.evidence || [])
              .map((e) => `   - ${e.roleKey}/${e.actKey}：${e.quote || ""}`)
              .join("\n")}`
        )
      : ["（无）"]),
    "",
    "### 信息缺口",
    ...(inference?.gaps?.length ? inference.gaps.map((g) => `- ${g}`) : ["- （无）"]),
    "",
    "## 2. 与标准真相比对",
    "",
    `- 机械核对凶手：${mechanical?.killerMatch ? "✓ 一致" : "✗ 不一致"}（推断 ${mechanical?.inferredKiller} vs 真相 ${mechanical?.truthKiller}）`,
    `- LLM methodMatch：${comparison?.methodMatch ? "✓" : "✗"}`,
    `- **公平推理 verdict**：**${comparison?.fairnessVerdict || "—"}** — ${comparison?.fairnessNote || ""}`,
    "",
    "### 冲突",
    ...(comparison?.conflicts?.length ? comparison.conflicts.map((c) => `- ${c}`) : ["- （无）"]),
    "",
    "### 建议",
    ...(comparison?.suggestions?.length ? comparison.suggestions.map((s) => `- ${s}`) : ["- （无）"])
  ];
  return lines.join("\n");
}
