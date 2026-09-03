import {
  newCompilerId,
  markStageComplete,
  pushWarning
} from "../state.js";
import { splitReadableChunks } from "../document-utils.js";

/**
 * Stage 5 — Clue Asset Import.
 * ONLY from CLUE_FILE / CLUE_MEDIA upload slots. Never mine host/role prose for "clue-like" text.
 */
export async function stage5ClueAssetImport(state) {
  let next = {
    ...state,
    job: { ...(state.job || {}), currentStage: "clue_asset" }
  };

  const clues = [];
  let sourceSections = [...(state.sourceSections || [])];
  const clueDocs = (state.documents || []).filter(
    (d) => d.kind === "CLUE_FILE" || d.slot === "clueTextFile" || d.slot === "clueTextDoc"
  );
  const clueMedia = (state.documents || []).filter((d) => d.kind === "CLUE_MEDIA");

  for (const doc of clueDocs) {
    const rawSections =
      Array.isArray(doc.sections) && doc.sections.length
        ? doc.sections
        : [{ title: doc.filename, body: doc.text }];

    for (const [index, section] of rawSections.entries()) {
      const body = String(section.body || "").trim();
      if (!body) continue;
      // Skip author/legal notices accidentally placed in clue files
      if (/严禁盲开|版权所有|翻版必究|发行方/.test(body.slice(0, 80)) && body.length < 400) {
        next = pushWarning(next, {
          code: "CLUE_SKIP_NON_CLUE",
          message: `线索文件段落疑似非线索（版权/盲开提示），已跳过`,
          evidence: [doc.filename, String(section.title || index)]
        });
        continue;
      }

      for (const piece of splitReadableChunks(body, String(section.title || `线索 ${index + 1}`))) {
        const sectionId = newCompilerId("src");
        sourceSections.push({
          id: sectionId,
          documentId: doc.id,
          characterId: null,
          actId: null,
          headingPath: ["线索", piece.heading],
          originalText: piece.body,
          startOffset: null,
          endOffset: null
        });
        clues.push({
          id: newCompilerId("clue"),
          title: piece.heading,
          content: piece.body,
          media: [],
          actId: null,
          sceneId: null,
          unlockCondition: null,
          visibleTo: null,
          distributionMode: "HOST_RELEASE",
          sourceFile: doc.filename,
          sourceSectionIds: [sectionId],
          sourceSlot: "clueText"
        });
      }
    }
  }

  for (const media of clueMedia) {
    clues.push({
      id: newCompilerId("clue"),
      title: media.filename,
      content: "",
      media: [{ filename: media.filename, ...(media.mediaMeta || {}) }],
      actId: null,
      sceneId: null,
      distributionMode: "HOST_RELEASE",
      sourceFile: media.filename,
      sourceSectionIds: [],
      sourceSlot: "clueImage"
    });
  }

  if (!clues.length) {
    next = pushWarning(next, {
      code: "CLUE_EMPTY",
      message: "线索槽位为空或未解析出线索卡（不会从主持/角色正文猜测线索）"
    });
  }

  next = { ...next, clues, sourceSections };
  return markStageComplete(next, "clue_asset");
}
