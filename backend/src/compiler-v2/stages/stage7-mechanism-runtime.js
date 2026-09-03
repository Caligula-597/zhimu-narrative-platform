import {
  markStageComplete,
  pushUnresolved,
  pushWarning
} from "../state.js";
import { matchMechanismAgainstCatalog } from "../mechanism-matcher.js";
import { MECHANISM_MATCH, newCompilerId } from "../state.js";

/**
 * Stage 7 — Mechanism Runtime Compiler.
 * Only runs catalog matching on MECHANISM_FILE slot (or explicitly tagged mechanism source).
 * Does NOT keyword-scan host copyright / author notes.
 */
export async function stage7MechanismRuntimeCompiler(state) {
  let next = {
    ...state,
    job: { ...(state.job || {}), currentStage: "mechanism_runtime" }
  };

  const mechanisms = [];
  const mechDocs = (state.documents || []).filter((d) => d.kind === "MECHANISM_FILE");

  if (!mechDocs.length) {
    next = pushUnresolved(next, {
      kind: "NEEDS_LLM",
      field: "mechanisms",
      message:
        "未上传 mechanismDoc 槽位；不会对主持册全文做 Catalog 关键词扫描。后续应从主持册「机制/规则」章节提取后再匹配。"
    });
    next = { ...next, mechanisms: [] };
    return markStageComplete(next, "mechanism_runtime");
  }

  for (const doc of mechDocs) {
    const text = String(doc.text || "").trim();
    if (!text) continue;
    if (/版权所有|翻版必究|作者想对您说|严禁盲开/.test(text.slice(0, 200)) && text.length < 800) {
      next = pushWarning(next, {
        code: "MECHANISM_SOURCE_SUSPICIOUS",
        message: `机制槽位文件「${doc.filename}」开头像版权/作者声明，请确认源章节`,
        evidence: [doc.id]
      });
    }
    const match = matchMechanismAgainstCatalog(text);
    mechanisms.push({
      id: newCompilerId("mech"),
      title: match.label || doc.filename || "机制",
      participants: [],
      resources: [],
      actions: [],
      conditions: [],
      stateChanges: [],
      rewards: [],
      penalties: [],
      phases: [],
      visibilityRules: [],
      linkedClues: [],
      linkedScenes: [],
      matchStatus: match.status,
      matchedTemplateKey: match.templateKey || null,
      matchedFamily: match.family || null,
      customNote: match.note || null,
      sourceDocumentId: doc.id,
      sourceExcerpt: text.slice(0, 500)
    });
    if (match.status === MECHANISM_MATCH.CUSTOM_MECHANISM) {
      next = pushWarning(next, {
        code: "MECHANISM_CUSTOM",
        message: `机制「${doc.filename}」未匹配 Catalog`,
        evidence: [doc.id]
      });
    }
  }

  next = { ...next, mechanisms };
  return markStageComplete(next, "mechanism_runtime");
}
