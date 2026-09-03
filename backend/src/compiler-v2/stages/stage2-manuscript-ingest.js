import {
  ACT_STATUS,
  DETECTION_STATUS,
  newCompilerId,
  markStageComplete,
  pushUnresolved,
  pushWarning
} from "../state.js";
import { splitActSectionTree } from "../document-utils.js";

/**
 * Stage 2 — Lossless Manuscript Ingest + provenance.
 * - Character content ONLY from that character's CHARACTER_BOOK upload.
 * - Acts only when explicit 幕 semantics; otherwise actId=null / UNASSIGNED.
 * - Never create fallback Acts named「主持手册」or「未分幕」.
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

  function ensureExplicitAct(title) {
    const key = String(title || "").trim();
    if (!key) return null;
    if (actsByTitle.has(key)) return actsByTitle.get(key);
    const act = {
      id: newCompilerId("act"),
      title: key,
      explicit: true,
      order: actsByTitle.size
    };
    actsByTitle.set(key, act);
    return act;
  }

  function resolveAct(sec) {
    if (!sec.actTitle) return null;
    return ensureExplicitAct(sec.actTitle);
  }

  function ingestDocument(doc, { asCharacterScript }) {
    const tree = splitActSectionTree(doc.text || "");

    for (const a of tree.acts) {
      if (a.explicit) ensureExplicitAct(a.title);
    }

    /** @type {Map<string, object[]>} */
    const buckets = new Map();

    for (const sec of tree.sections) {
      const act = resolveAct(sec);
      const actId = act?.id ?? null;
      const actStatus = actId ? ACT_STATUS.ASSIGNED : ACT_STATUS.UNASSIGNED;
      const startOffset = String(doc.text || "").indexOf(sec.body);
      const endOffset = startOffset >= 0 ? startOffset + sec.body.length : null;
      const sectionId = newCompilerId("src");
      sourceSections.push({
        id: sectionId,
        documentId: doc.id,
        characterId: doc.characterId || null,
        actId,
        actStatus,
        headingPath: sec.headingPath,
        originalText: sec.body,
        startOffset: startOffset >= 0 ? startOffset : null,
        endOffset
      });
      const refId = newCompilerId("ref");
      sourceRefs.push({
        id: refId,
        sourceSectionId: sectionId,
        label: `${doc.filename} › ${sec.headingPath.join(" / ")}`
      });

      if (!asCharacterScript) continue;
      const bucketKey = actId || "__UNASSIGNED__";
      if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
      buckets.get(bucketKey).push({
        sectionId,
        refId,
        body: sec.body,
        title: sec.title,
        actId,
        actStatus
      });
    }

    if (!asCharacterScript) return;

    for (const [, parts] of buckets) {
      const actId = parts[0]?.actId ?? null;
      const act = actId ? [...actsByTitle.values()].find((a) => a.id === actId) : null;
      characterScripts.push({
        id: newCompilerId("cscript"),
        characterId: doc.characterId,
        actId,
        actStatus: actId ? ACT_STATUS.ASSIGNED : ACT_STATUS.UNASSIGNED,
        // UI grouping label only — not an Act entity
        title: act?.title || "未分幕",
        documentId: doc.id,
        originalContent: parts.map((p) => p.body).join("\n\n"),
        sourceSectionIds: parts.map((p) => p.sectionId),
        sourceRefIds: parts.map((p) => p.refId)
      });
    }
  }

  for (const doc of state.documents || []) {
    if (doc.kind === "HOST_BOOK") {
      ingestDocument(doc, { asCharacterScript: false });
    }
  }

  for (const doc of state.documents || []) {
    if (doc.kind !== "CHARACTER_BOOK") continue;
    if (!doc.characterId) {
      next = pushWarning(next, {
        code: "CHARACTER_BOOK_NO_ID",
        message: `角色本 ${doc.filename} 缺少 characterId，跳过剧本拆分`,
        evidence: [doc.id]
      });
      continue;
    }
    const owner = (state.characters || []).find((c) => c.id === doc.characterId);
    if (owner && doc.roleName && owner.name && doc.roleName !== owner.name) {
      next = pushWarning(next, {
        code: "CHARACTER_SLOT_MISMATCH",
        message: `槽位角色名「${doc.roleName}」与 character.name「${owner.name}」不一致`,
        evidence: [doc.id]
      });
    }
    ingestDocument(doc, { asCharacterScript: true });
  }

  const acts = [...actsByTitle.values()].filter((a) => a.explicit);

  if (!characterScripts.length && (state.characters || []).length) {
    next = pushWarning(next, {
      code: "NO_CHARACTER_SCRIPTS",
      message: "有角色槽位但未拆出 CharacterScript"
    });
  }

  const unassignedScripts = characterScripts.filter((s) => s.actStatus === ACT_STATUS.UNASSIGNED);
  if (unassignedScripts.length) {
    next = pushWarning(next, {
      code: "ACT_UNASSIGNED_SCRIPTS",
      message: `${unassignedScripts.length} 段角色剧本未检出明确幕标题（actId=null，未造假幕）`
    });
  }

  if (!acts.length) {
    next = pushUnresolved(next, {
      kind: DETECTION_STATUS.NEEDS_CONFIRMATION,
      field: "acts",
      message: "未识别到明确幕结构（不造 fallback Act）"
    });
  }

  next = {
    ...next,
    acts,
    characterScripts,
    sourceSections,
    sourceRefs
  };
  return markStageComplete(next, "manuscript_ingest");
}
