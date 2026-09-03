import {
  DETECTION_STATUS,
  newCompilerId,
  pushUnresolved,
  markStageComplete
} from "../state.js";
import {
  filenameStem,
  guessActCountFromText,
  guessPlayerCountFromText,
  guessTitleFromText,
  parseDocxFile
} from "../document-utils.js";

function classifyByHint({ filename, roleName, slot }) {
  if (slot === "hostHandbook") return "HOST_BOOK";
  if (slot === "roleScript") return "CHARACTER_BOOK";
  if (slot === "clueTextDoc") return "CLUE_FILE";
  if (slot === "mechanismDoc") return "MECHANISM_FILE";
  if (slot === "sceneDoc") return "SCENE_FILE";
  const name = `${filename || ""} ${roleName || ""}`;
  if (/主持|DM|GM|手册|复盘/.test(name)) return "HOST_BOOK";
  if (/线索/.test(name)) return "CLUE_FILE";
  if (/机制|规则|玩法/.test(name)) return "MECHANISM_FILE";
  if (/地图|场景|地点/.test(name)) return "SCENE_FILE";
  if (roleName) return "CHARACTER_BOOK";
  return "OTHER";
}

/**
 * Stage 1 — Project Identify.
 * Parses uploads, classifies documents. Uncertain metadata → NEEDS_CONFIRMATION (no hard guess).
 */
export async function stage1ProjectIdentify(state, { inputFiles = {} } = {}) {
  let next = {
    ...state,
    job: { ...(state.job || {}), currentStage: "project_identify" }
  };
  const creationType = next.project?.creationType || "murder_mystery";
  const documents = [];
  const characters = [];

  async function ingestSlot(file, slot, extra = {}) {
    if (!file?.filename || !file?.contentBase64) return null;
    const parsed = await parseDocxFile(file, creationType);
    const kind = classifyByHint({
      filename: file.filename,
      roleName: file.roleName || extra.roleName,
      slot
    });
    const kindStatus =
      kind === "OTHER" ? DETECTION_STATUS.NEEDS_CONFIRMATION : DETECTION_STATUS.AUTO_DETECTED;
    const doc = {
      id: newCompilerId("doc"),
      kind,
      kindStatus,
      slot,
      filename: file.filename,
      roleName: file.roleName || extra.roleName || null,
      characterCount: Number(parsed.characterCount || 0),
      sectionCount: Number(parsed.sectionCount || 0),
      text: parsed.text || "",
      sections: parsed.sections || [],
      structure: parsed.structure || null
    };
    documents.push(doc);
    if (kindStatus === DETECTION_STATUS.NEEDS_CONFIRMATION) {
      next = pushUnresolved(next, {
        kind: DETECTION_STATUS.NEEDS_CONFIRMATION,
        field: `document.kind:${doc.id}`,
        message: `无法确定文件「${file.filename}」类型，请确认`,
        evidence: [file.filename],
        suggestedValue: kind
      });
    }
    return doc;
  }

  if (inputFiles.hostHandbook) {
    await ingestSlot(inputFiles.hostHandbook, "hostHandbook");
  } else {
    next = pushUnresolved(next, {
      kind: DETECTION_STATUS.NEEDS_CONFIRMATION,
      field: "hostHandbook",
      message: "未上传主持手册"
    });
  }

  for (const file of inputFiles.roleScripts || []) {
    const doc = await ingestSlot(file, "roleScript");
    if (!doc) continue;
    const name = file.roleName || filenameStem(file.filename) || null;
    const nameStatus = name
      ? DETECTION_STATUS.AUTO_DETECTED
      : DETECTION_STATUS.NEEDS_CONFIRMATION;
    const character = {
      id: newCompilerId("char"),
      name,
      nameStatus,
      documentId: doc.id
    };
    characters.push(character);
    doc.characterId = character.id;
    if (nameStatus === DETECTION_STATUS.NEEDS_CONFIRMATION) {
      next = pushUnresolved(next, {
        kind: DETECTION_STATUS.NEEDS_CONFIRMATION,
        field: `character.name:${character.id}`,
        message: `角色名无法从「${file.filename}」确定`,
        evidence: [file.filename]
      });
    }
  }

  if (inputFiles.clueTextDoc) {
    await ingestSlot(inputFiles.clueTextDoc, "clueTextDoc");
  }
  if (inputFiles.mechanismDoc) {
    await ingestSlot(inputFiles.mechanismDoc, "mechanismDoc");
  }
  for (const file of inputFiles.sceneDocs || []) {
    await ingestSlot(file, "sceneDoc");
  }
  if (inputFiles.notes) {
    documents.push({
      id: newCompilerId("doc"),
      kind: "OTHER",
      kindStatus: DETECTION_STATUS.AUTO_DETECTED,
      slot: "notes",
      filename: "notes.txt",
      text: String(inputFiles.notes),
      sections: [],
      characterCount: String(inputFiles.notes).length,
      sectionCount: 0
    });
  }

  const host = documents.find((d) => d.kind === "HOST_BOOK");
  const hostText = host?.text || "";
  const titleGuess = guessTitleFromText(hostText, host?.filename);
  const playerGuess = guessPlayerCountFromText(hostText);
  const actGuess = guessActCountFromText(hostText);

  const project = {
    ...(next.project || {}),
    title: titleGuess,
    titleStatus: titleGuess
      ? DETECTION_STATUS.AUTO_DETECTED
      : DETECTION_STATUS.NEEDS_CONFIRMATION,
    playerCount: playerGuess,
    playerCountStatus: playerGuess != null
      ? DETECTION_STATUS.AUTO_DETECTED
      : DETECTION_STATUS.NEEDS_CONFIRMATION,
    actCount: actGuess,
    actCountStatus: actGuess != null
      ? DETECTION_STATUS.AUTO_DETECTED
      : DETECTION_STATUS.NEEDS_CONFIRMATION
  };

  if (project.titleStatus === DETECTION_STATUS.NEEDS_CONFIRMATION) {
    next = pushUnresolved(next, {
      kind: DETECTION_STATUS.NEEDS_CONFIRMATION,
      field: "project.title",
      message: "剧本标题无法从主持手册可靠解析，请确认"
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

  next = {
    ...next,
    project,
    documents,
    characters
  };
  return markStageComplete(next, "project_identify");
}
