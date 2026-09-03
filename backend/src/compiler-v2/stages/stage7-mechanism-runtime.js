import {
  MECHANISM_MATCH,
  newCompilerId,
  markStageComplete,
  pushWarning
} from "../state.js";
import { matchMechanismAgainstCatalog } from "../mechanism-matcher.js";

/**
 * Stage 7 — Mechanism Runtime Compiler.
 * Prefer existing catalog (shared kits + M-family index). No second template system.
 * Full LLM structuring of raw rules is queued when mechanism text exists but no match.
 */
export async function stage7MechanismRuntimeCompiler(state) {
  let next = {
    ...state,
    job: { ...(state.job || {}), currentStage: "mechanism_runtime" }
  };

  const mechanisms = [...(state.mechanisms || [])];
  const mechDocs = (state.documents || []).filter(
    (d) => d.kind === "MECHANISM_FILE" || (d.kind === "HOST_BOOK" && /机制|规则|玩法/.test(d.text || ""))
  );

  for (const doc of mechDocs) {
    const text = String(doc.text || "").slice(0, 8000);
    if (!text.trim()) continue;
    const match = matchMechanismAgainstCatalog(text);
    const def = {
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
    };

    // Bind only ids that exist in state
    const clueIds = new Set((state.clues || []).map((c) => c.id));
    const sceneIds = new Set((state.scenes || []).map((s) => s.id));
    def.linkedClues = (match.suggestedClueIds || []).filter((id) => clueIds.has(id));
    def.linkedScenes = (match.suggestedSceneIds || []).filter((id) => sceneIds.has(id));

    mechanisms.push(def);

    if (match.status === MECHANISM_MATCH.CUSTOM_MECHANISM) {
      next = pushWarning(next, {
        code: "MECHANISM_CUSTOM",
        message: `机制「${def.title}」未匹配 Catalog，需人工配置`,
        evidence: [doc.id]
      });
    }
  }

  if (!mechanisms.length) {
    next = pushWarning(next, {
      code: "MECHANISM_EMPTY",
      message: "未识别到机制定义（可后续手工配置）"
    });
  }

  next = { ...next, mechanisms };
  return markStageComplete(next, "mechanism_runtime");
}
