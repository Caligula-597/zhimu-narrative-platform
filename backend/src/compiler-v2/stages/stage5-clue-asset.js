import {
  newCompilerId,
  markStageComplete,
  pushWarning
} from "../state.js";

/**
 * Stage 5 — Clue Asset Import (deterministic from clue doc sections).
 */
export async function stage5ClueAssetImport(state) {
  let next = {
    ...state,
    job: { ...(state.job || {}), currentStage: "clue_asset" }
  };

  const clues = [...(state.clues || [])];
  const clueDocs = (state.documents || []).filter((d) => d.kind === "CLUE_FILE");
  let sourceSections = [...(state.sourceSections || [])];

  for (const doc of clueDocs) {
    const sections = Array.isArray(doc.sections) && doc.sections.length
      ? doc.sections
      : [{ title: doc.filename, body: doc.text }];
    for (const [index, section] of sections.entries()) {
      const body = String(section.body || "").trim();
      if (!body) continue;
      const sectionId = newCompilerId("src");
      sourceSections.push({
        id: sectionId,
        documentId: doc.id,
        characterId: null,
        actId: null,
        headingPath: [String(section.title || `线索 ${index + 1}`)],
        originalText: body,
        startOffset: null,
        endOffset: null
      });
      clues.push({
        id: newCompilerId("clue"),
        title: String(section.title || `线索 ${index + 1}`).trim(),
        content: body,
        media: [],
        actId: null,
        sceneId: null,
        unlockCondition: null,
        visibleTo: null,
        distributionMode: "HOST_RELEASE",
        sourceFile: doc.filename,
        sourceSectionIds: [sectionId]
      });
    }
  }

  if (!clues.length) {
    next = pushWarning(next, {
      code: "CLUE_EMPTY",
      message: "未整理出线索资产（可无线索文件，审查时确认）"
    });
  }

  next = { ...next, clues, sourceSections };
  return markStageComplete(next, "clue_asset");
}
