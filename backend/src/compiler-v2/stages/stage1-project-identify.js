import {
  DETECTION_STATUS,
  newCompilerId,
  pushUnresolved,
  pushWarning,
  markStageComplete
} from "../state.js";
import {
  detectProjectTitle,
  guessActCountFromText,
  guessPlayerCountFromText,
  parseUploadFile
} from "../document-utils.js";
import {
  kindFromSlot,
  normalizeOpeningPackageInput
} from "../opening-package-input.js";

/**
 * Stage 1 — Project Identify from Opening Package slots.
 * Slot decides document kind. Do NOT reclassify from merged heuristics.
 */
export async function stage1ProjectIdentify(state, { inputFiles = {} } = {}) {
  let next = {
    ...state,
    job: { ...(state.job || {}), currentStage: "project_identify" }
  };
  const pack = normalizeOpeningPackageInput(inputFiles);
  const creationType = pack.creationType || next.project?.creationType || "murder_mystery";
  const documents = [];
  const characters = [];

  async function ingest(file, slot, { roleName = null } = {}) {
    if (!file?.filename && file?.text == null && !file?.contentBase64) return null;
    const filename = file.filename || `${slot}.txt`;
    const parsed = await parseUploadFile({ ...file, filename }, creationType);
    const kind = kindFromSlot(slot);
    const doc = {
      id: newCompilerId("doc"),
      kind,
      kindStatus: DETECTION_STATUS.AUTO_DETECTED,
      kindSource: "upload_slot",
      slot,
      filename,
      roleName,
      characterCount: Number(parsed.characterCount || 0),
      sectionCount: Number(parsed.sectionCount || 0),
      text: parsed.text || "",
      sections: parsed.sections || [],
      structure: parsed.structure || null
    };
    documents.push(doc);
    return doc;
  }

  if (!pack.hostHandbook) {
    next = pushUnresolved(next, {
      kind: DETECTION_STATUS.NEEDS_CONFIRMATION,
      field: "hostHandbook",
      message: "未上传主持手册（Opening Package 槽位 hostHandbook）"
    });
  } else {
    await ingest(pack.hostHandbook, "hostHandbook");
  }

  for (const file of pack.roleScripts) {
    const roleName = file.roleName || file.characterName || null;
    const doc = await ingest(file, "roleScript", { roleName });
    if (!doc) continue;
    const nameStatus = roleName
      ? DETECTION_STATUS.AUTO_DETECTED
      : DETECTION_STATUS.NEEDS_CONFIRMATION;
    const character = {
      id: newCompilerId("char"),
      name: roleName,
      nameStatus,
      nameSource: roleName ? "upload_slot" : null,
      documentId: doc.id
    };
    characters.push(character);
    doc.characterId = character.id;
    if (!roleName) {
      next = pushUnresolved(next, {
        kind: DETECTION_STATUS.NEEDS_CONFIRMATION,
        field: `character.name:${character.id}`,
        message: `角色本「${file.filename}」未提供 characterName/roleName，请确认`,
        evidence: [file.filename]
      });
    }
  }

  if (!pack.roleScripts.length) {
    next = pushUnresolved(next, {
      kind: DETECTION_STATUS.NEEDS_CONFIRMATION,
      field: "roleScripts",
      message: "未上传角色剧本槽位；不会从主持手册猜测切分角色本"
    });
  }

  for (const file of pack.clueTextFiles) {
    await ingest(file, "clueTextFile");
  }
  for (const file of pack.clueImages) {
    documents.push({
      id: newCompilerId("doc"),
      kind: "CLUE_MEDIA",
      kindStatus: DETECTION_STATUS.AUTO_DETECTED,
      kindSource: "upload_slot",
      slot: "clueImage",
      filename: file.filename || "clue-image",
      roleName: null,
      characterCount: 0,
      sectionCount: 0,
      text: "",
      sections: [],
      mediaMeta: {
        contentBase64Present: Boolean(file.contentBase64),
        matchKey: file.matchKey || null
      }
    });
  }

  if (pack.mechanismDoc) {
    await ingest(pack.mechanismDoc, "mechanismDoc");
  }

  if (pack.notes) {
    documents.push({
      id: newCompilerId("doc"),
      kind: "NOTES",
      kindStatus: DETECTION_STATUS.AUTO_DETECTED,
      kindSource: "upload_slot",
      slot: "notes",
      filename: "notes.txt",
      text: pack.notes,
      sections: [],
      characterCount: pack.notes.length,
      sectionCount: 0
    });
  }

  const host = documents.find((d) => d.kind === "HOST_BOOK");
  const hostText = host?.text || "";
  const titleHit = detectProjectTitle(hostText, host?.filename);
  const playerGuess = guessPlayerCountFromText(hostText);
  const actGuess = guessActCountFromText(hostText);

  const project = {
    ...(next.project || {}),
    creationType,
    title: titleHit.confidence === "HIGH" ? titleHit.title : null,
    titleStatus:
      titleHit.confidence === "HIGH"
        ? DETECTION_STATUS.AUTO_DETECTED
        : DETECTION_STATUS.NEEDS_CONFIRMATION,
    titleSuggestion:
      titleHit.confidence === "LOW" ? titleHit.title : titleHit.confidence === "HIGH" ? null : null,
    playerCount: playerGuess,
    playerCountStatus:
      playerGuess != null ? DETECTION_STATUS.AUTO_DETECTED : DETECTION_STATUS.NEEDS_CONFIRMATION,
    actCount: actGuess,
    actCountStatus:
      actGuess != null ? DETECTION_STATUS.AUTO_DETECTED : DETECTION_STATUS.NEEDS_CONFIRMATION
  };

  if (titleHit.confidence === "LOW" && titleHit.title) {
    project.titleSuggestion = titleHit.title;
    next = pushWarning(next, {
      code: "TITLE_LOW_CONFIDENCE",
      message: `标题仅有低置信建议「${titleHit.title}」，未自动采用`,
      evidence: [host?.filename]
    });
  }
  if (project.titleStatus === DETECTION_STATUS.NEEDS_CONFIRMATION) {
    next = pushUnresolved(next, {
      kind: DETECTION_STATUS.NEEDS_CONFIRMATION,
      field: "project.title",
      message: "剧本标题无法高置信解析（需《书名》或明确剧名标注），请确认",
      suggestedValue: project.titleSuggestion || undefined
    });
  }
  if (project.playerCountStatus === DETECTION_STATUS.NEEDS_CONFIRMATION) {
    next = pushUnresolved(next, {
      kind: DETECTION_STATUS.NEEDS_CONFIRMATION,
      field: "project.playerCount",
      message: "玩家人数无法从主持手册可靠解析，请确认",
      suggestedValue: characters.length || undefined
    });
  }
  if (project.actCountStatus === DETECTION_STATUS.NEEDS_CONFIRMATION) {
    next = pushUnresolved(next, {
      kind: DETECTION_STATUS.NEEDS_CONFIRMATION,
      field: "project.actCount",
      message: "幕数无法从主持手册可靠解析，请确认"
    });
  }

  next = { ...next, project, documents, characters };
  return markStageComplete(next, "project_identify");
}
