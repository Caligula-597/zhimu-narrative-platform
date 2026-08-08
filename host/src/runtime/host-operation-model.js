import { resolveSectionSegmentKey } from "../../../shared/segment-contract.js";
import { secureRandomId } from "../../../shared/secure-random.js";

export const HOST_OPERATION_KINDS = Object.freeze({
  PLAYER: "player",
  GRANT_CLUE: "grant-clue",
  GRANT_ITEM: "grant-item",
  UNLOCK_SECTION: "unlock-section",
  UNLOCK_SCENE: "unlock-scene",
  LOG: "log",
  NUDGE: "nudge",
  CLUE_NOTE: "clue-note"
});

export const HOST_OPERATION_TABS = Object.freeze([
  { kind: HOST_OPERATION_KINDS.GRANT_CLUE, label: "发线索" },
  { kind: HOST_OPERATION_KINDS.GRANT_ITEM, label: "发物品" },
  { kind: HOST_OPERATION_KINDS.UNLOCK_SECTION, label: "解锁分幕" },
  { kind: HOST_OPERATION_KINDS.UNLOCK_SCENE, label: "开放场景" },
  { kind: HOST_OPERATION_KINDS.NUDGE, label: "提醒玩家" },
  { kind: HOST_OPERATION_KINDS.LOG, label: "主持日志" }
]);

export const HOST_OPERATION_LIMITS = Object.freeze({
  CLUE_TARGETS: 20,
  NUDGE_TARGETS: 32,
  HOST_LOG_LENGTH: 1000,
  PLAYER_NOTES_LENGTH: 2000
});

export function grantModeLabel(mode) {
  return { auto: "自动发放", host_confirm: "主持确认", explore: "探索获得" }[mode] || "";
}

export function joinedHostPlayers(stateRef) {
  return (stateRef.cloudHostPlayers || []).filter((player) => player.joined);
}

export function grantTargetMatchesPlayer(player, roleKey) {
  if (!roleKey) return true;
  return [player.role_key, player.roleKey, player.role_slot_id, player.role_name, player.name]
    .filter(Boolean)
    .some((value) => String(value) === String(roleKey));
}

export function hostActClueIds(runbooks, actKey) {
  if (!actKey) return [];
  const book = (runbooks || []).find((item) =>
    [item.actKey, item.segmentKey, item.key]
      .filter(Boolean)
      .some((value) => String(value) === String(actKey))
  );
  return (book?.clueGrants || []).map((grant) => grant.clueId || grant.clue_id).filter(Boolean);
}

export function sectionMatchesAct(section, actKey) {
  if (!actKey) return false;
  return String(resolveSectionSegmentKey(section, section.sequence || 1)) === String(actKey);
}

export function sectionOptionsForRole(sections, roleId, actKey) {
  return (sections || [])
    .filter((section) => String(section.role_slot_id) === String(roleId))
    .slice()
    .sort((a, b) =>
      Number(sectionMatchesAct(b, actKey)) - Number(sectionMatchesAct(a, actKey))
      || (a.sequence || 0) - (b.sequence || 0)
    )
    .map((section) => ({
      id: String(section.id),
      name: `${sectionMatchesAct(section, actKey) ? "本幕 · " : ""}${section.sequence}. ${section.title}`
    }));
}

export function resolveInitialUnlockRoleId(players, sections, options = {}) {
  const requested = options.roleSlotId;
  if (requested && players.some((player) => String(player.role_slot_id) === String(requested))) {
    return String(requested);
  }
  const matching = players.find((player) => sections.some((section) =>
    String(section.role_slot_id) === String(player.role_slot_id)
    && sectionMatchesAct(section, options.actKey || "")
  ));
  return String(matching?.role_slot_id || players[0]?.role_slot_id || "");
}

function firstId(items = []) {
  return String(items[0]?.id || "");
}

function defaultDraft(kind, stateRef, options, runbooks) {
  const players = joinedHostPlayers(stateRef);
  const clues = stateRef.studio?.clues || [];
  const items = stateRef.studio?.items || [];
  const scenes = stateRef.studio?.scenes || [];
  const sections = stateRef.studio?.sections || [];
  const actKey = options.actKey || "";
  const actClueIds = hostActClueIds(runbooks, actKey);
  const selectedClueId = String(options.clueId || actClueIds[0] || clues[0]?.id || "");
  const roleSlotId = resolveInitialUnlockRoleId(players, sections, options);
  const sectionId = firstId(sectionOptionsForRole(sections, roleSlotId, actKey));
  const targetRoleIds = players
    .filter((player) => grantTargetMatchesPlayer(player, options.roleKey || ""))
    .map((player) => String(player.role_slot_id));

  switch (kind) {
    case HOST_OPERATION_KINDS.GRANT_CLUE:
      return {
        clueId: selectedClueId,
        roleSlotIds: (targetRoleIds.length ? targetRoleIds : players.slice(0, 1).map((player) => String(player.role_slot_id)))
          .slice(0, HOST_OPERATION_LIMITS.CLUE_TARGETS),
        message: actKey ? "主持人按当前幕手册发放线索" : "主持人手动发放线索"
      };
    case HOST_OPERATION_KINDS.GRANT_ITEM:
      return {
        roleSlotId: String(players[0]?.role_slot_id || ""),
        itemId: firstId(items),
        quantity: "1",
        message: "主持人手动发放物品"
      };
    case HOST_OPERATION_KINDS.UNLOCK_SECTION:
      return {
        roleSlotId,
        sectionId,
        message: actKey ? "主持人按当前幕手动解锁分幕" : "主持人手动解锁分幕"
      };
    case HOST_OPERATION_KINDS.UNLOCK_SCENE:
      return { sceneId: firstId(scenes) };
    case HOST_OPERATION_KINDS.LOG:
      return { roleSlotId: String(options.roleSlotId || ""), message: "" };
    case HOST_OPERATION_KINDS.NUDGE:
      return {
        roleSlotIds: (options.roleSlotIds?.map(String) || players.map((player) => String(player.role_slot_id)))
          .slice(0, HOST_OPERATION_LIMITS.NUDGE_TARGETS),
        message: options.message || "主持人正在处理待确认事件，请稍候 — 确认后新内容会自动解锁。"
      };
    case HOST_OPERATION_KINDS.CLUE_NOTE: {
      const matrix = stateRef.cloudHostClueMatrix;
      return {
        clueId: String(options.clueId || ""),
        roleSlotId: String(options.roleSlotId || ""),
        hostNote: String(matrix?.cells?.[options.clueId]?.[options.roleSlotId]?.hostNote || "")
      };
    }
    case HOST_OPERATION_KINDS.PLAYER:
      return { hostNotes: "" };
    default:
      return {};
  }
}

export function createHostOperation({ kind, roomId, stateRef, options = {}, runbooks = [] }) {
  return {
    id: secureRandomId("host-operation"),
    roomId: String(roomId || ""),
    kind,
    options: { ...options },
    draft: defaultDraft(kind, stateRef, options, runbooks),
    status: kind === HOST_OPERATION_KINDS.PLAYER ? "loading" : "ready",
    message: "",
    detail: null,
    confirm: null
  };
}

export function updateHostOperationField(operation, field, value, checked) {
  if (!operation || !field) return operation;
  if (field === "roleSlotIds") {
    const current = new Set((operation.draft.roleSlotIds || []).map(String));
    if (checked) current.add(String(value));
    else current.delete(String(value));
    operation.draft.roleSlotIds = [...current];
  } else {
    operation.draft[field] = String(value ?? "");
  }
  operation.status = "ready";
  operation.message = "";
  operation.confirm = null;
  return operation;
}

export function hostOperationIsPending(operation) {
  return operation?.status === "loading" || operation?.status === "submitting";
}

export function hostOperationIsSubmitting(operation) {
  return operation?.status === "submitting";
}

export function hostOperationContextIsCurrent(operation, roomId) {
  return Boolean(operation?.roomId && String(operation.roomId) === String(roomId || ""));
}
