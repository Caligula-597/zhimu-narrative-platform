import { markStageComplete, pushUnresolved, pushWarning } from "../state.js";

/**
 * Stage 8 — Integrity Validator.
 * Does not auto-commit. Leaves status decision to job runner (needs_review).
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

  for (const clue of state.clues || []) {
    if (clue.sceneId) {
      const ok = (state.scenes || []).some((s) => s.id === clue.sceneId);
      if (!ok) {
        next = pushUnresolved(next, {
          kind: "INTEGRITY",
          field: `clue.sceneId:${clue.id}`,
          message: `线索「${clue.title}」引用不存在的场景`,
          evidence: [clue.sceneId]
        });
      }
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
    for (const sceneId of mech.linkedScenes || []) {
      if (!(state.scenes || []).some((s) => s.id === sceneId)) {
        next = pushUnresolved(next, {
          kind: "INTEGRITY",
          field: `mechanism.scene:${mech.id}`,
          message: `机制引用缺失场景 ${sceneId}`,
          evidence: [mech.id, sceneId]
        });
      }
    }
  }

  for (const ev of state.timelineEvents || []) {
    if (ev.locationId && !(state.scenes || []).some((s) => s.id === ev.locationId)) {
      next = pushUnresolved(next, {
        kind: "INTEGRITY",
        field: `timeline.locationId:${ev.id}`,
        message: `时间线事件引用不存在的场景`,
        evidence: [ev.id, ev.locationId]
      });
    }
    if (ev.locationId && !ev.locationHint) {
      next = pushWarning(next, {
        code: "TIMELINE_LOCATION_WITHOUT_HINT",
        message: `事件 ${ev.id} 有 locationId 但无 locationHint（应先 hint 再 resolve）`,
        evidence: [ev.id]
      });
    }
  }

  if (!(state.sourceSections || []).length) {
    next = pushWarning(next, {
      code: "PROVENANCE_EMPTY",
      message: "缺少 SourceSection provenance，审查时无法跳转原文"
    });
  }

  return markStageComplete(next, "integrity_check");
}
