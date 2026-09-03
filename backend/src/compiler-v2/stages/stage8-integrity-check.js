import { markStageComplete, pushUnresolved, pushWarning } from "../state.js";
import { isActTitle } from "../document-utils.js";

/**
 * Stage 8 — Integrity + structural plausibility warnings.
 */
export async function stage8IntegrityValidator(state) {
  let next = {
    ...state,
    job: { ...(state.job || {}), currentStage: "integrity_check" }
  };

  const characters = state.characters || [];
  const scripts = state.characterScripts || [];
  const scriptCharIds = new Set(scripts.map((s) => s.characterId).filter(Boolean));

  for (const ch of characters) {
    if (!scriptCharIds.has(ch.id)) {
      next = pushUnresolved(next, {
        kind: "INTEGRITY",
        field: `character.script:${ch.id}`,
        message: `角色「${ch.name || ch.id}」缺少私人剧本段落`,
        evidence: [ch.id]
      });
    }
  }

  // Cross-talk guard: script document must belong to character
  for (const s of scripts) {
    const doc = (state.documents || []).find((d) => d.id === s.documentId);
    if (doc && doc.characterId && doc.characterId !== s.characterId) {
      next = pushUnresolved(next, {
        kind: "INTEGRITY",
        field: `characterScript.crossTalk:${s.id}`,
        message: "CharacterScript 文档归属与角色不一致（串台）",
        evidence: [s.id, doc.id]
      });
    }
    if (doc && /主持人每轮|武器每轮可用一次|防具为消耗品/.test(s.originalContent?.slice(0, 200) || "")) {
      next = pushWarning(next, {
        code: "SCRIPT_HOST_LANGUAGE",
        message: `角色剧本「${s.title}」开头含主持/规则口吻，请确认未串入公共规则`,
        evidence: [s.id, s.characterId]
      });
    }
  }

  for (const act of state.acts || []) {
    if (act.explicit === false) {
      next = pushWarning(next, {
        code: "ACT_NON_EXPLICIT",
        message: `Act「${act.title}」非明确幕标题，不应进入 acts[]`,
        evidence: [act.id]
      });
    }
    if (act.title && act.title.length > 30) {
      next = pushWarning(next, {
        code: "ACT_TITLE_TOO_LONG",
        message: `Act 标题过长，可能是小节而非幕：${act.title.slice(0, 40)}…`,
        evidence: [act.id]
      });
    }
    if (act.title && !isActTitle(act.title)) {
      next = pushWarning(next, {
        code: "ACT_TITLE_NOT_SEMANTIC",
        message: `Act「${act.title}」不符合第N幕/序幕等幕语义`,
        evidence: [act.id]
      });
    }
    if (act.title === "主持手册" || act.title === "未分幕") {
      next = pushUnresolved(next, {
        kind: "INTEGRITY",
        field: `act.fallbackForbidden:${act.id}`,
        message: "禁止将「主持手册/未分幕」登记为正式 Act",
        evidence: [act.id]
      });
    }
  }

  if (state.project?.titleStatus === "NEEDS_CONFIRMATION") {
    next = pushWarning(next, {
      code: "PROJECT_TITLE_UNCONFIRMED",
      message: "项目标题仍待确认"
    });
  }

  const clueDocs = (state.documents || []).filter((d) => d.kind === "CLUE_FILE" || d.kind === "CLUE_MEDIA");
  if (clueDocs.length && !(state.clues || []).length) {
    next = pushWarning(next, {
      code: "CLUE_SLOT_EMPTY_RESULT",
      message: "已上传线索槽位但未产出 ClueAsset"
    });
  }
  if (!clueDocs.length && (state.clues || []).length) {
    next = pushWarning(next, {
      code: "CLUE_WITHOUT_SLOT",
      message: "存在线索结果但无线索上传槽位（异常）"
    });
  }

  const mechKeys = new Set();
  for (const m of state.mechanisms || []) {
    const key = `${m.matchedTemplateKey || m.title}`;
    if (mechKeys.has(key)) {
      next = pushWarning(next, {
        code: "MECHANISM_DUPLICATE",
        message: `重复机制候选：${key}`,
        evidence: [m.id]
      });
    }
    mechKeys.add(key);
  }

  for (const clue of state.clues || []) {
    if (clue.sceneId && !(state.scenes || []).some((s) => s.id === clue.sceneId)) {
      next = pushUnresolved(next, {
        kind: "INTEGRITY",
        field: `clue.sceneId:${clue.id}`,
        message: `线索「${clue.title}」引用不存在的场景`,
        evidence: [clue.sceneId]
      });
    }
  }

  for (const mech of state.mechanisms || []) {
    for (const clueId of mech.linkedClues || []) {
      if (!(state.clues || []).some((c) => c.id === clueId)) {
        next = pushUnresolved(next, {
          kind: "INTEGRITY",
          field: `mechanism.clue:${mech.id}`,
          message: `机制引用缺失线索 ${clueId}`,
          evidence: [mech.id, clueId]
        });
      }
    }
  }

  for (const ev of state.timelineEvents || []) {
    if (ev.locationId && !(state.scenes || []).some((s) => s.id === ev.locationId)) {
      next = pushUnresolved(next, {
        kind: "INTEGRITY",
        field: `timeline.locationId:${ev.id}`,
        message: "时间线事件引用不存在的场景",
        evidence: [ev.id, ev.locationId]
      });
    }
  }

  if (!(state.sourceSections || []).length) {
    next = pushWarning(next, {
      code: "PROVENANCE_EMPTY",
      message: "缺少 SourceSection provenance"
    });
  } else {
    const huge = (state.sourceSections || []).filter((s) => (s.originalText || "").length > 8000);
    if (huge.length) {
      next = pushWarning(next, {
        code: "SOURCE_SECTION_TOO_COARSE",
        message: `${huge.length} 条 SourceSection 超过 8000 字，provenance 过粗`,
        evidence: huge.slice(0, 3).map((s) => s.id)
      });
    }
  }

  return markStageComplete(next, "integrity_check");
}
