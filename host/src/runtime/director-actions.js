import { api, getPlayerJoinUrl } from "../api.js";
import { formatApiError } from "../errors.js";
import { state } from "../state.js";
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
