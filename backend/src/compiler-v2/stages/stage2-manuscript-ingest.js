import {
  newCompilerId,
  markStageComplete,
  pushWarning
} from "../state.js";
import { sectionsFromParsedDocument } from "../document-utils.js";

/**
 * Stage 2 — Lossless Manuscript Ingest + SourceSection provenance.
 * No LLM. Preserves original text and offsets for later "查看原文出处".
 */
export async function stage2ManuscriptIngest(state) {
  let next = {
    ...state,
    job: { ...(state.job || {}), currentStage: "manuscript_ingest" }
  };

  const characterScripts = [];
  const sourceSections = [];
  const sourceRefs = [...(state.sourceRefs || [])];
  const actsByTitle = new Map();

  function ensureAct(title) {
    const key = String(title || "未分幕").trim() || "未分幕";
    if (actsByTitle.has(key)) return actsByTitle.get(key);
    const act = {
      id: newCompilerId("act"),
      title: key,
      order: actsByTitle.size
    };
    actsByTitle.set(key, act);
    return act;
  }

  for (const doc of state.documents || []) {
    if (doc.kind !== "CHARACTER_BOOK" && doc.kind !== "HOST_BOOK") continue;

    const chunks = sectionsFromParsedDocument(
      { text: doc.text, sections: doc.sections },
      {
        characterId: doc.characterId || null,
        sourceKey: doc.id,
        filename: doc.filename,
        roleName: doc.roleName
      }
    );

    let offset = 0;
    const fullText = String(doc.text || "");

    for (const chunk of chunks) {
      const act = ensureAct(chunk.title);
      const startOffset = fullText.indexOf(chunk.body, offset);
      const endOffset =
        startOffset >= 0 ? startOffset + chunk.body.length : null;
      if (startOffset >= 0) offset = endOffset;

      const sectionId = newCompilerId("src");
      const sourceSection = {
        id: sectionId,
        documentId: doc.id,
        characterId: chunk.characterId,
        actId: act.id,
        headingPath: chunk.headingPath || [chunk.title],
        originalText: chunk.body,
        startOffset: startOffset >= 0 ? startOffset : null,
        endOffset
      };
      sourceSections.push(sourceSection);

      const refId = newCompilerId("ref");
      sourceRefs.push({
        id: refId,
        sourceSectionId: sectionId,
        label: `${doc.filename} › ${chunk.title}`
      });

      if (doc.kind === "CHARACTER_BOOK") {
        characterScripts.push({
          id: newCompilerId("cscript"),
          characterId: chunk.characterId,
          actId: act.id,
          documentId: doc.id,
          title: chunk.title,
          originalContent: chunk.body,
          sourceSectionIds: [sectionId],
          sourceRefIds: [refId]
        });
      }
    }
  }

  if (!characterScripts.length) {
    next = pushWarning(next, {
      code: "NO_CHARACTER_SCRIPTS",
      message: "未拆分出角色剧本段落；请确认已上传角色本"
    });
  }

  next = {
    ...next,
    acts: [...actsByTitle.values()],
    characterScripts,
    sourceSections,
    sourceRefs
  };
  return markStageComplete(next, "manuscript_ingest");
}
