/**
 * P8.1 CreationSpecCompatibility — Spec edit triggers REVIEW, never destructive regen.
 */

import {
  normalizePlayableCreationSpec,
  updatePlayableCreationSpec,
} from "./playable-creation-spec.js";

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function acceptedBlocks(state) {
  return asArray(state?.mechanismBlocks).filter((b) =>
    ["USER_ACCEPTED", "USER_MODIFIED", "LOCKED"].includes(b.status),
  );
}

/**
 * Compare previous vs next spec against existing ProjectStoryState.
 * Never deletes blocks.
 */
export function auditCreationSpecCompatibility({
  previousSpec = null,
  nextSpec = null,
  projectStoryState = null,
} = {}) {
  const prev = previousSpec ? normalizePlayableCreationSpec(previousSpec) : null;
  const next = nextSpec ? normalizePlayableCreationSpec(nextSpec) : null;
  const blocks = acceptedBlocks(projectStoryState);
  const blockIds = blocks.map((b) => b.id);

  if (!next) {
    return {
      specRevision: prev?.revision || 0,
      status: "COMPATIBLE",
      issues: [
        {
          code: "LEGACY_UNSPECIFIED",
          severity: "info",
          message: "无 PlayableCreationSpec（旧项目）；现有积木行为不变",
        },
      ],
    };
  }

  if (!prev) {
    return {
      specRevision: next.revision,
      status: blocks.length ? "REVIEW_REQUIRED" : "COMPATIBLE",
      issues: [
        {
          code: "SPEC_ATTACHED",
          severity: blocks.length ? "warn" : "info",
          message: blocks.length
            ? "已补建创作方向；请核对现有积木是否仍符合新方向"
            : "已建立创作方向",
          blockIds: blocks.length ? blockIds : undefined,
        },
      ],
    };
  }

  const issues = [];
  if (prev.playerCount !== next.playerCount) {
    issues.push({
      code: "SPEC_PLAYER_COUNT_CHANGED",
      severity: "warn",
      message: `人数 ${prev.playerCount} → ${next.playerCount}；现有积木保留，请人工复查`,
      blockIds,
    });
  }

  const prevStage =
    prev.stagePreference?.mode === "EXACT" ? prev.stagePreference.count : "AUTO";
  const nextStage =
    next.stagePreference?.mode === "EXACT" ? next.stagePreference.count : "AUTO";
  if (String(prevStage) !== String(nextStage)) {
    issues.push({
      code: "SPEC_STAGE_COUNT_CHANGED",
      severity: "warn",
      message: `幕数偏好 ${prevStage} → ${nextStage}；不自动重建大纲`,
      blockIds,
    });
  }

  if (JSON.stringify(prev.roleConfiguration) !== JSON.stringify(next.roleConfiguration)) {
    issues.push({
      code: "SPEC_ROLE_PATTERN_CHANGED",
      severity: "warn",
      message: "角色槽配置已变；现有角色/积木不删除",
      blockIds,
    });
  }

  if (JSON.stringify(prev.gameplayPreferences) !== JSON.stringify(next.gameplayPreferences)) {
    issues.push({
      code: "GAME_PREFERENCE_CHANGED",
      severity: "info",
      message: "玩法偏好已变；不影响已接受 STORY 积木",
    });
  }

  if (
    prev.setting?.era !== next.setting?.era ||
    JSON.stringify(prev.genreTags) !== JSON.stringify(next.genreTags) ||
    prev.premise?.shortIdea !== next.premise?.shortIdea
  ) {
    issues.push({
      code: "SETTING_CHANGED",
      severity: "info",
      message: "时代/题材/前提已变；内容实例化属后续层，积木保留",
      blockIds,
    });
  }

  let status = "COMPATIBLE";
  if (issues.some((i) => i.severity === "error")) status = "INCOMPATIBLE";
  else if (issues.some((i) => i.severity === "warn")) status = "REVIEW_REQUIRED";

  return {
    specRevision: next.revision,
    status,
    issues,
    preservedAcceptedBlockIds: blockIds,
  };
}

/** Apply update + compatibility; never mutates/deletes mechanismBlocks. */
export function applyCreationSpecUpdate(projectStoryState, patch) {
  const state = record(projectStoryState);
  const previous = state.creationSpec || null;
  const { spec, errors } = updatePlayableCreationSpec(previous, patch);
  if (errors.length || !spec) {
    return {
      state,
      spec: previous,
      errors: errors.length ? errors : [{ code: "SPEC_INVALID", message: "无法规范化" }],
      compatibility: null,
    };
  }
  const compatibility = auditCreationSpecCompatibility({
    previousSpec: previous,
    nextSpec: spec,
    projectStoryState: state,
  });
  return {
    state: {
      ...state,
      creationSpec: spec,
    },
    spec,
    errors: [],
    compatibility,
  };
}
