import { api } from "../api.js";
import { formatApiError } from "../errors.js";
import { getRoomId } from "../session.js";
import { state } from "../state.js";
import { resolveHostStuckIntervention } from "../../../shared/host-stuck-intervention.js";
import {
  HOST_OPERATION_KINDS,
  createHostOperation,
  hostOperationContextIsCurrent,
  hostOperationIsPending,
  hostOperationIsSubmitting,
  joinedHostPlayers,
  sectionOptionsForRole,
  updateHostOperationField
} from "./host-operation-model.js";
import { pendingEventRoleIds } from "./host-event-queue.js";
import { createHostOperationCommandService } from "./host-operation-command-service.js";
import { hostRunbooks } from "../views/host-layout.js";

function currentOperation(id) {
  const operation = state.hostOperation;
  if (!operation || operation.id !== id) return null;
  return hostOperationContextIsCurrent(operation, getRoomId()) ? operation : null;
}

export function createHostOperationController({ render, showToast }) {
  let detailRequestSequence = 0;
  let commands;
  let openerDescriptor = null;

  function afterRender(callback) {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(callback);
    else queueMicrotask(callback);
  }

  function rememberOpener(element) {
    if (!element?.dataset?.action) return;
    openerDescriptor = {
      action: element.dataset.action,
      role: element.dataset.role || "",
      clue: element.dataset.clue || "",
      actKey: element.dataset.actKey || ""
    };
  }

  function focusMatchingOpener() {
    if (!openerDescriptor || typeof document === "undefined") return;
    const candidates = [...document.querySelectorAll(`[data-action="${openerDescriptor.action}"]`)];
    const target = candidates.find((element) =>
      (!openerDescriptor.role || element.dataset.role === openerDescriptor.role)
      && (!openerDescriptor.clue || element.dataset.clue === openerDescriptor.clue)
      && (!openerDescriptor.actKey || element.dataset.actKey === openerDescriptor.actKey)
    ) || candidates[0];
    target?.focus?.();
  }

  function revealWorkspace() {
    if (typeof document === "undefined") return;
    const workspace = document.querySelector("[data-host-operation-workspace]");
    workspace?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    workspace?.querySelector?.("select, input, textarea, button")?.focus?.({ preventScroll: true });
  }

  function close() {
    if (hostOperationIsSubmitting(state.hostOperation)) {
      showToast("操作仍在进行，请等待服务端返回");
      return;
    }
    state.hostOperation = null;
    render();
    afterRender(focusMatchingOpener);
  }

  async function loadPlayerDetail(operationId) {
    const operation = currentOperation(operationId);
    if (!operation) return;
    const roleSlotId = operation.options.roleSlotId;
    const requestSequence = ++detailRequestSequence;
    operation.status = "loading";
    operation.message = "正在加载玩家当前状态…";
    render();
    try {
      const detail = await api.getHostPlayerDetail(roleSlotId);
      const current = currentOperation(operationId);
      if (!current || requestSequence !== detailRequestSequence) return;
      current.detail = detail;
      current.draft.hostNotes = String(detail.role?.host_notes || "");
      current.status = "ready";
      current.message = "";
      const confirmCommand = current.options.confirmCommand;
      delete current.options.confirmCommand;
      render();
      if (confirmCommand) {
        commands.requestDetailCommand({
          dataset: { command: confirmCommand, role: roleSlotId }
        });
      }
    } catch (error) {
      const current = currentOperation(operationId);
      if (!current || requestSequence !== detailRequestSequence) return;
      current.status = "error";
      current.message = formatApiError(error, "无法加载玩家详情");
      render();
    }
  }

  commands = createHostOperationCommandService({
    render,
    showToast,
    reloadPlayer: loadPlayerDetail
  });

  async function loadMaterialBooklets(operationId) {
    const operation = currentOperation(operationId);
    if (!operation || operation.kind !== HOST_OPERATION_KINDS.GRANT_BOOKLET) return;
    try {
      const payload = await api.listHostMaterialBooklets();
      const current = currentOperation(operationId);
      if (!current) return;
      state.hostMaterialBooklets = payload?.booklets || [];
      if (!current.draft.bookletId && state.hostMaterialBooklets[0]?.id) {
        current.draft.bookletId = String(state.hostMaterialBooklets[0].id);
      }
      render();
    } catch (error) {
      const current = currentOperation(operationId);
      if (!current) return;
      showToast(formatApiError(error, "无法加载物料册"));
    }
  }

  function open(kind, options = {}) {
    if (hostOperationIsSubmitting(state.hostOperation)) {
      showToast("当前操作仍在提交，请等待服务端返回");
      return;
    }
    const roomId = getRoomId();
    if (!roomId) {
      showToast("请先选择运行房");
      return;
    }
    state.hostOperation = createHostOperation({
      kind,
      roomId,
      stateRef: state,
      options,
      runbooks: hostRunbooks()
    });
    render();
    afterRender(revealWorkspace);
    if (kind === HOST_OPERATION_KINDS.PLAYER) {
      void loadPlayerDetail(state.hostOperation.id);
    }
    if (kind === HOST_OPERATION_KINDS.GRANT_BOOKLET) {
      void loadMaterialBooklets(state.hostOperation.id);
    }
  }

  function openNudge(roleSlotId = "", mode = "waiting") {
    const allPlayers = joinedHostPlayers(state);
    const waitingIds = pendingEventRoleIds();
    const isStuck = mode === "stuck";
    const players = isStuck
      ? allPlayers.filter((player) => player.maybe_stuck && (!roleSlotId || String(player.role_slot_id) === String(roleSlotId)))
      : allPlayers.filter((player) => !waitingIds.size || waitingIds.has(String(player.role_slot_id)));
    if (!players.length) {
      showToast(isStuck ? "当前没有需要干预的卡关玩家" : "当前没有已入房且可能在等待的玩家");
      return;
    }
    open(HOST_OPERATION_KINDS.NUDGE, {
      roleSlotIds: players.map((player) => String(player.role_slot_id)),
      message: isStuck
        ? players[0]?.suggested_nudge || "当前剧情似乎停住了，可以查看「现在」页的建议下一步，或联系主持人获取提示。"
        : "主持人正在处理待确认事件，请稍候 — 确认后新内容会自动解锁。"
    });
  }

  function openStuckIntervention(roleSlotId = "") {
    const resolved = resolveHostStuckIntervention(state.cloudHostPlayers || [], roleSlotId);
    if (!resolved.ok) {
      showToast(resolved.reason || "当前没有需要干预的卡关玩家");
      return;
    }
    const { action, target } = resolved;
    if (action === "unlock_section") {
      open(HOST_OPERATION_KINDS.UNLOCK_SECTION, { roleSlotId: target.role_slot_id });
    } else if (action === "inspect") {
      open(HOST_OPERATION_KINDS.PLAYER, { roleSlotId: target.role_slot_id });
    } else if (action === "invite") {
      showToast("该席位尚未有玩家加入，请分享邀请链接");
    } else {
      openNudge(roleSlotId, "stuck");
    }
  }

  function handleField(element) {
    const operation = state.hostOperation;
    if (!operation || !element?.dataset?.hostOperationField) return false;
    if (hostOperationIsPending(operation)) return true;
    const field = element.dataset.hostOperationField;
    updateHostOperationField(operation, field, element.value, element.checked);
    if (operation.kind === HOST_OPERATION_KINDS.UNLOCK_SECTION && field === "roleSlotId") {
      const options = sectionOptionsForRole(
        state.studio?.sections || [],
        operation.draft.roleSlotId,
        operation.options.actKey || ""
      );
      operation.draft.sectionId = options[0]?.id || "";
      render();
    } else if (operation.kind === HOST_OPERATION_KINDS.LOG && field === "message") {
      const submit = element.closest("[data-host-operation-workspace]")?.querySelector('[data-action="host-operation-submit"]');
      if (submit) submit.disabled = !String(element.value || "").trim();
    }
    return true;
  }

  async function handleAction(action, element) {
    if (action.startsWith("host-") && !action.startsWith("host-operation-")) {
      rememberOpener(element);
    }
    switch (action) {
      case "host-player-detail":
        open(HOST_OPERATION_KINDS.PLAYER, { roleSlotId: element?.dataset?.role });
        return true;
      case "host-kick-player":
        open(HOST_OPERATION_KINDS.PLAYER, {
          roleSlotId: element?.dataset?.role,
          confirmCommand: "kick-player"
        });
        return true;
      case "host-manual-grant-clue":
        open(HOST_OPERATION_KINDS.GRANT_CLUE, {
          actKey: element?.dataset?.actKey || "",
          clueId: element?.dataset?.clueId || "",
          roleKey: element?.dataset?.roleKey || ""
        });
        return true;
      case "host-manual-grant-booklet":
        open(HOST_OPERATION_KINDS.GRANT_BOOKLET, {
          bookletId: element?.dataset?.bookletId || ""
        });
        return true;
      case "host-manual-grant-item":
        open(HOST_OPERATION_KINDS.GRANT_ITEM);
        return true;
      case "host-manual-unlock-section":
        open(HOST_OPERATION_KINDS.UNLOCK_SECTION, { actKey: element?.dataset?.actKey || "" });
        return true;
      case "host-manual-unlock-scene":
        open(HOST_OPERATION_KINDS.UNLOCK_SCENE);
        return true;
      case "host-manual-log":
        open(HOST_OPERATION_KINDS.LOG);
        return true;
      case "host-clue-note":
        open(HOST_OPERATION_KINDS.CLUE_NOTE, {
          clueId: element?.dataset?.clue,
          roleSlotId: element?.dataset?.role
        });
        return true;
      case "host-nudge-waiting":
        openNudge();
        return true;
      case "host-stuck-intervene":
        openStuckIntervention(element?.dataset?.role || "");
        return true;
      case "host-operation-close":
        close();
        return true;
      case "host-operation-switch":
        open(element?.dataset?.operationKind || HOST_OPERATION_KINDS.LOG);
        return true;
      case "host-operation-submit":
        commands.submitCurrent();
        return true;
      case "host-operation-detail-command":
        commands.requestDetailCommand(element);
        return true;
      case "host-operation-confirm-cancel":
        if (state.hostOperation) state.hostOperation.confirm = null;
        render();
        return true;
      case "host-operation-confirm-execute":
        commands.executeConfirmedDetailCommand();
        return true;
      case "host-operation-save-player-notes":
        commands.savePlayerNotes();
        return true;
      case "host-operation-reload-player":
        if (state.hostOperation) void loadPlayerDetail(state.hostOperation.id);
        return true;
      default:
        return false;
    }
  }

  return {
    handleAction,
    handleField,
    open
  };
}
