import { PRODUCT_BOUNDARY, cleanText, untrustedUserPayload } from "./shared.js";

/**
 * Read all per-role act outlines and reconstruct truth; compare with truth bible.
 */
export function buildTruthReconstructionMessages({ truthBible, actOutlines, config, characterArchives }) {
  const system = `你是本格悬疑「真相还原审计员」。你**只能**根据各角色分幕大纲推断案件真相，再与标准答案比对。

${PRODUCT_BOUNDARY}

【任务】
1. 从 actOutlines 推断：凶手（roleKey）、手法、动机、关键时间线、误导线收束。
2. 与 truthBible 比对：killer 是否一致、method 是否等价、timeline 是否冲突。
3. 标记大纲中的 fairness 风险：是否存在「仅一人大纲出现、且无 knowledgeSource 解释」的关键事实。

【注意】
- 你是审计员，不是作者；不得补充大纲里没有的信息来「凑对」。
- killer 必须输出 roleKey（如 role-3）。

【认罪契约 — 硬性】
- 对 truthBible.killer 以外的每个 roleKey，检查 ch3（及终幕）大纲。
- 若出现第一人称完整杀人供述（如：我注射/投毒/刺杀/勒杀、密室是我所设、通过机关进入并杀害），标记 fairnessFlags severity=high，verdict 不得为 pass。
- 非凶手仅可承认：偷窃/私会/撒谎/非致死蠢事（如代客安眠药、藏物证）；不可复述完整作案手法链。

【输出 schema】
{
  "inferred": {
    "killer": "role-N",
    "method": "推断的手法",
    "motive": "推断的动机",
    "timeline": [{"time":"…","event":"…"}],
    "confidence": 0.0
  },
  "comparison": {
    "killerMatch": true,
    "methodMatch": true,
    "timelineConsistent": true,
    "overallAligned": true,
    "gaps": ["大纲不足以推断的点"],
    "conflicts": ["与 truthBible 冲突处"],
    "fairnessFlags": [{"roleKey":"…","actKey":"…","issue":"…"}]
  },
  "verdict": "pass|revise_outlines|revise_novel",
  "suggestions": ["修改建议"]
}`;

  const outlineDigest = Object.entries(actOutlines || {}).flatMap(([roleKey, acts]) =>
    Object.entries(acts || {}).map(([actKey, o]) => ({
      roleKey,
      actKey,
      outline: o?.outline?.slice(0, 800),
      knowledgeSources: o?.knowledgeSources?.slice(0, 8)
    }))
  );

  const user = `请还原并比对。幕 keys：${JSON.stringify(config?.chapterKeys || [])}。

${untrustedUserPayload("各角色分幕大纲", outlineDigest)}
${untrustedUserPayload("标准真相 Bible", {
  killer: truthBible.killer,
  method: truthBible.method,
  motive: truthBible.motive,
  summary: truthBible.summary?.slice(0, 1200),
  timeline: truthBible.timeline,
  misdirections: truthBible.misdirections
})}
${untrustedUserPayload("角色 keys", (characterArchives?.roles || []).map((r) => ({ key: r.key, name: r.name })))}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export function validateTruthReconstruction(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const inferred = value.inferred && typeof value.inferred === "object" ? value.inferred : {};
  const comparison = value.comparison && typeof value.comparison === "object" ? value.comparison : {};
  return {
    inferred: {
      killer: cleanText(inferred.killer, 32),
      method: cleanText(inferred.method, 600),
      motive: cleanText(inferred.motive, 400),
      timeline: Array.isArray(inferred.timeline) ? inferred.timeline.slice(0, 12) : [],
      confidence: Math.max(0, Math.min(1, Number(inferred.confidence) || 0))
    },
    comparison: {
      killerMatch: Boolean(comparison.killerMatch),
      methodMatch: Boolean(comparison.methodMatch),
      timelineConsistent: Boolean(comparison.timelineConsistent),
      overallAligned: Boolean(comparison.overallAligned),
      gaps: Array.isArray(comparison.gaps) ? comparison.gaps.map((g) => cleanText(g, 200)) : [],
      conflicts: Array.isArray(comparison.conflicts) ? comparison.conflicts.map((c) => cleanText(c, 200)) : [],
      fairnessFlags: Array.isArray(comparison.fairnessFlags) ? comparison.fairnessFlags.slice(0, 16) : []
    },
    verdict: ["pass", "revise_outlines", "revise_novel"].includes(value.verdict) ? value.verdict : "revise_outlines",
    suggestions: Array.isArray(value.suggestions) ? value.suggestions.map((s) => cleanText(s, 300)) : []
  };
}

/** Mechanical pre-check before/alongside LLM audit. */
export function mechanicalTruthCompare(reconstruction, truthBible) {
  const inferredKiller = cleanText(reconstruction?.inferred?.killer, 32);
  const truthKiller = cleanText(truthBible?.killer, 32);
  const killerMatch = inferredKiller === truthKiller;
  return {
    killerMatch,
    inferredKiller,
    truthKiller,
    passed: killerMatch && Boolean(reconstruction?.comparison?.overallAligned)
  };
}
