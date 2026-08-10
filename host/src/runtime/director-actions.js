import { api, getPlayerJoinUrl } from "../api.js";
import { formatApiError } from "../errors.js";
import { state } from "../state.js";
import {
  createRuntimeTabletopCheck,
  resolveRuntimeTabletopCheck
} from "../../../shared/tabletop-flow.js";
import { loadHostData, refreshHostAuditLog, refreshHostClueMatrix, refreshHostEvents, refreshHostPlayers, refreshHostRoom } from "./data.js";
import { resetPaceTimer, switchPaceMode, togglePaceTimer } from "./host-pace-timer.js";
import {
  batchHostEventsAction,
  syncHostEventSelectAll,
  toggleHostEventSelection
} from "./host-event-queue.js";
import {
  refreshRulesPreview,
  triggerManualRuleFromDirector
} from "./host-rules-controller.js";
import {
  copyInviteCode,
  copyPlayLink,
  openRoomInviteModal
} from "./invite.js";
export function createDirectorActionHandler({ render, showToast }) {
  async function runCommand(command, successMessage, fallbackMessage, { refresh = true } = {}) {
    try {
      await command();
      if (successMessage) showToast(successMessage);
      if (refresh) await loadHostData(false, true);
    } catch (error) {
      showToast(formatApiError(error, fallbackMessage));
    }
  }

  function runtimePresentationPatch(patch = {}) {
    const presentation = state.currentState?.presentation || {};
    const map = presentation.map || {};
    return {
      activeSegmentKey: String(patch.activeSegmentKey ?? presentation.activeSegmentKey ?? ""),
      activeLocationId: String(patch.activeLocationId ?? map.activeLocationId ?? ""),
      revealedLocationIds: Array.isArray(patch.revealedLocationIds)
        ? [...new Set(patch.revealedLocationIds.map(String).filter(Boolean))]
        : [...new Set((map.revealedLocationIds || []).map(String).filter(Boolean))],
      mapVisible: patch.mapVisible == null ? Boolean(map.visible) : Boolean(patch.mapVisible),
      activeCheck: patch.activeCheck !== undefined ? patch.activeCheck : map.activeCheck || null,
      updatedAt: new Date().toISOString()
    };
  }

  function saveRuntimePresentation(patch, successMessage) {
    void runCommand(
      () => api.updateHostRoomSettings({ runtimePresentation: runtimePresentationPatch(patch) }),
      successMessage,
      "同步运行流程失败"
    );
  }

  return function handleDirectorAction(action, el) {
    switch (action) {
      case "rules-preview": refreshRulesPreview(); return true;
      case "rule-manual-trigger": triggerManualRuleFromDirector(el?.dataset?.rule); return true;
      case "host-event-toggle": toggleHostEventSelection(el?.dataset?.event, el?.checked); return true;
      case "host-event-select-all": syncHostEventSelectAll(el?.checked); return true;
      case "batch-execute-host-events": batchHostEventsAction("execute"); return true;
      case "batch-dismiss-host-events": batchHostEventsAction("dismiss"); return true;
      case "room-invite-current": openRoomInviteModal(); return true;
      case "copy-invite-code": copyInviteCode(el?.dataset?.inviteCode); return true;
      case "copy-play-link": copyPlayLink(el?.dataset?.inviteCode); return true;
      case "refresh-host-room": refreshHostRoom(true); return true;
      case "refresh-host-events": refreshHostEvents(true); return true;
      case "refresh-host-players": refreshHostPlayers(true); return true;
      case "refresh-host-clue-matrix": refreshHostClueMatrix(true); return true;
      case "refresh-host-audit": refreshHostAuditLog(true); return true;
      case "host-review-testimony":
        void runCommand(
          () => api.reviewHostTestimony(el?.dataset?.testimony, { hostFlag: el?.dataset?.flag }),
          "口供已更新",
          "更新失败"
        );
        return true;
      case "host-apply-remedy":
        void runCommand(
          () => api.applyHostSegmentRemedy(el?.dataset?.remedy),
          "补救话术已执行",
          "执行失败"
        );
        return true;
      case "host-vote-status":
        void runCommand(
          () => api.hostUpdateVoteStatus(el?.dataset?.voteId, el?.dataset?.status),
          "投票状态已更新",
          "更新失败"
        );
        return true;
      case "host-review-private-action":
        void runCommand(
          () => api.hostUpdatePrivateAction(el?.dataset?.actionId, { status: el?.dataset?.status }),
          "秘密行动已处理",
          "处理失败"
        );
        return true;
      case "host-load-run-report":
        void runCommand(
          async () => {
            state.cloudRunReport = await api.getRoomRunReport();
            render();
          },
          "本场报告已生成",
          "生成失败",
          { refresh: false }
        );
        return true;
      case "host-select-act":
        state.hostSelectedActKey = el?.dataset?.actKey || "";
        render();
        {
          const matchedLocation = state.currentState?.presentation?.map?.host?.locations?.find(
            (location) => location.segmentKey && location.segmentKey === state.hostSelectedActKey
          );
          const revealed = new Set(state.currentState?.presentation?.map?.revealedLocationIds || []);
          if (matchedLocation?.id) revealed.add(matchedLocation.id);
          saveRuntimePresentation({
            activeSegmentKey: state.hostSelectedActKey,
            activeCheck: null,
            ...(matchedLocation?.id ? {
              activeLocationId: matchedLocation.id,
              revealedLocationIds: [...revealed]
            } : {})
          }, "当前幕已同步到玩家端");
        }
        return true;
      case "host-tabletop-select-location": {
        const locationId = el?.dataset?.locationId || "";
        const revealed = new Set(state.currentState?.presentation?.map?.revealedLocationIds || []);
        if (locationId) revealed.add(locationId);
        saveRuntimePresentation({
          activeLocationId: locationId,
          activeCheck: null,
          revealedLocationIds: [...revealed]
        }, "当前地点已同步到玩家端");
        return true;
      }
      case "host-tabletop-toggle-map":
        saveRuntimePresentation({
          mapVisible: !state.currentState?.presentation?.map?.visible
        }, state.currentState?.presentation?.map?.visible ? "玩家地图已隐藏" : "玩家地图已公开");
        return true;
      case "host-tabletop-toggle-location": {
        const locationId = el?.dataset?.locationId || "";
        const map = state.currentState?.presentation?.map;
        if (!locationId || locationId === map?.activeLocationId) {
          showToast("当前地点必须保持公开");
          return true;
        }
        const revealed = new Set(map?.revealedLocationIds || []);
        if (revealed.has(locationId)) revealed.delete(locationId);
        else revealed.add(locationId);
        saveRuntimePresentation({ revealedLocationIds: [...revealed] }, "地点可见范围已同步");
        return true;
      }
      case "host-tabletop-start-check": {
        const map = state.currentState?.presentation?.map;
        const location = map?.host?.locations?.find((item) => item.id === map.activeLocationId);
        const template = location?.checks?.find((check) => check.id === el?.dataset?.checkId);
        if (!template) {
          showToast("没有找到这项判定，请回到创作端检查地点配置");
          return true;
        }
        saveRuntimePresentation({
          activeCheck: createRuntimeTabletopCheck(template, {
            locationId: location.id,
            dice: map.dice
          })
        }, "判定已发到玩家端");
        return true;
      }
      case "host-tabletop-start-custom-check": {
        const map = state.currentState?.presentation?.map;
        const panel = el?.closest?.("[data-host-tabletop-check-builder]");
        const label = panel?.querySelector?.("[data-host-check-label]")?.value?.trim() || "临场判定";
        const target = Number(panel?.querySelector?.("[data-host-check-target]")?.value ?? map?.dice?.defaultTarget ?? 12);
        const bonus = Number(panel?.querySelector?.("[data-host-check-bonus]")?.value || 0);
        const rollMode = panel?.querySelector?.("[data-host-check-mode]")?.value || "normal";
        saveRuntimePresentation({
          activeCheck: createRuntimeTabletopCheck({
            id: "ad-hoc",
            label,
            instruction: `请描述如何完成「${label}」，主持人随后公开掷骰。`,
            target,
            bonus,
            rollMode,
            successText: "行动成功，故事获得预期进展。",
            failureText: "行动未能如愿，但故事将带着代价继续。"
          }, {
            locationId: map?.activeLocationId || "",
            dice: map?.dice
          })
        }, "临场判定已发到玩家端");
        return true;
      }
      case "host-tabletop-roll-check": {
        const activeCheck = state.currentState?.presentation?.map?.activeCheck;
        if (!activeCheck) {
          showToast("当前没有等待结算的判定");
          return true;
        }
        saveRuntimePresentation({
          activeCheck: resolveRuntimeTabletopCheck(activeCheck)
        }, "判定结果已公开");
        return true;
      }
      case "host-tabletop-clear-check":
        saveRuntimePresentation({ activeCheck: null }, "判定已收起，可以继续推进");
        return true;
      case "refresh-host-data": loadHostData(true, true); return true;
      case "host-pace-toggle": togglePaceTimer(); return true;
      case "host-pace-reset": resetPaceTimer(); return true;
      case "host-pace-switch-mode":
        switchPaceMode(el?.dataset?.mode || "count-up", Number(el?.dataset?.targetMs || 0));
        return true;
      case "onboarding-go-player": {
        const code = state.room?.invite_code || "";
        window.open(getPlayerJoinUrl(code), "_blank", "noopener,noreferrer");
        return true;
      }
      default:
        return false;
    }
  };
}
