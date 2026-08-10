import { api, getPlayerJoinUrl } from "../api.js";
import { formatApiError } from "../errors.js";
import { state } from "../state.js";
import {
  applyRuntimeTabletopCheckOutcome,
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
import {
  buildRuntimePresentationPatch,
  hasRuntimePresentationMutation,
  matchesRuntimeControl
} from "./runtime-presentation-control.js";
export function createDirectorActionHandler({ render, showToast }) {
  let runtimePresentationQueue = Promise.resolve();

  async function runCommand(command, successMessage, fallbackMessage, { refresh = true } = {}) {
    try {
      await command();
      if (successMessage) showToast(successMessage);
      if (refresh) await loadHostData(false, true);
    } catch (error) {
      showToast(formatApiError(error, fallbackMessage));
    }
  }

  function saveRuntimePresentation(patchOrFactory, successMessage) {
    const queued = runtimePresentationQueue.then(() => {
      const presentation = state.currentState?.presentation || {};
      const patch = typeof patchOrFactory === "function"
        ? patchOrFactory(presentation)
        : patchOrFactory;
      if (!hasRuntimePresentationMutation(patch)) return false;
      return runCommand(
        () => api.updateHostRoomSettings({
          runtimePresentation: buildRuntimePresentationPatch(patch)
        }),
        successMessage,
        "同步运行流程失败"
      );
    });
    runtimePresentationQueue = queued.catch(() => {});
    return queued;
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
          const selectedActKey = state.hostSelectedActKey;
          saveRuntimePresentation((presentation) => {
            const map = presentation.map || {};
            const matchedLocation = map.host?.locations?.find(
              (location) => location.segmentKey && location.segmentKey === selectedActKey
            );
            const revealed = new Set(map.revealedLocationIds || []);
            if (matchedLocation?.id) revealed.add(matchedLocation.id);
            return {
              activeSegmentKey: selectedActKey,
              activeCheck: null,
              activeEncounter: null,
              ...(matchedLocation?.id ? {
                activeLocationId: matchedLocation.id,
                revealedLocationIds: [...revealed]
              } : {})
            };
          }, "当前幕已同步到玩家端");
        }
        return true;
      case "host-tabletop-select-location": {
        const locationId = el?.dataset?.locationId || "";
        saveRuntimePresentation((presentation) => {
          const revealed = new Set(presentation.map?.revealedLocationIds || []);
          if (locationId) revealed.add(locationId);
          return {
            activeLocationId: locationId,
            activeCheck: null,
            activeEncounter: null,
            revealedLocationIds: [...revealed]
          };
        }, "当前地点已同步到玩家端");
        return true;
      }
      case "host-tabletop-toggle-map":
        saveRuntimePresentation((presentation) => ({
          mapVisible: !presentation.map?.visible
        }), state.currentState?.presentation?.map?.visible ? "玩家地图已隐藏" : "玩家地图已公开");
        return true;
      case "host-tabletop-toggle-location": {
        const locationId = el?.dataset?.locationId || "";
        const map = state.currentState?.presentation?.map;
        if (!locationId || locationId === map?.activeLocationId) {
          showToast("当前地点必须保持公开");
          return true;
        }
        saveRuntimePresentation((presentation) => {
          const revealed = new Set(presentation.map?.revealedLocationIds || []);
          if (revealed.has(locationId) && locationId !== presentation.map?.activeLocationId) revealed.delete(locationId);
          else revealed.add(locationId);
          return { revealedLocationIds: [...revealed] };
        }, "地点可见范围已同步");
        return true;
      }
      case "host-tabletop-start-encounter": {
        const map = state.currentState?.presentation?.map;
        const location = map?.host?.locations?.find((item) => item.id === map.activeLocationId);
        const npcIds = [...new Set((location?.encounterNpcIds || []).map(String).filter(Boolean))];
        if (!location || !npcIds.length) {
          showToast("当前地点没有可触发的遭遇，请回到创作端配置 NPC");
          return true;
        }
        const locationId = location.id;
        saveRuntimePresentation((presentation) => {
          const currentMap = presentation.map || {};
          const currentLocation = currentMap.host?.locations?.find((item) => item.id === locationId);
          const currentNpcIds = [...new Set((currentLocation?.encounterNpcIds || []).map(String).filter(Boolean))];
          if (currentMap.activeLocationId !== locationId || !currentLocation || !currentNpcIds.length) return null;
          const revealed = new Set(currentMap.revealedLocationIds || []);
          revealed.add(locationId);
          return {
            activeEncounter: {
              locationId,
              npcIds: currentNpcIds,
              status: "active",
              startedAt: new Date().toISOString()
            },
            activeCheck: null,
            mapVisible: true,
            revealedLocationIds: [...revealed]
          };
        }, "地点遭遇已触发并同步到玩家端");
        return true;
      }
      case "host-tabletop-end-encounter": {
        const activeEncounter = state.currentState?.presentation?.map?.activeEncounter;
        if (!activeEncounter) {
          showToast("当前没有进行中的遭遇");
          return true;
        }
        saveRuntimePresentation((presentation) => matchesRuntimeControl(
          presentation.map?.activeEncounter,
          activeEncounter,
          ["locationId", "startedAt"]
        ) ? { activeEncounter: null } : null, "地点遭遇已结束");
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
        const checkId = template.id;
        const locationId = location.id;
        saveRuntimePresentation((presentation) => {
          const currentMap = presentation.map || {};
          if (currentMap.activeLocationId !== locationId) return null;
          const currentLocation = currentMap.host?.locations?.find((item) => item.id === locationId);
          const currentTemplate = currentLocation?.checks?.find((check) => check.id === checkId);
          if (!currentTemplate) return null;
          return {
            activeCheck: createRuntimeTabletopCheck(currentTemplate, {
              locationId,
              dice: currentMap.dice || map.dice
            })
          };
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
        const locationId = map?.activeLocationId || "";
        saveRuntimePresentation((presentation) => {
          if ((presentation.map?.activeLocationId || "") !== locationId) return null;
          return {
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
              locationId,
              dice: presentation.map?.dice || map?.dice
            })
          };
        }, "临场判定已发到玩家端");
        return true;
      }
      case "host-tabletop-roll-check": {
        const activeCheck = state.currentState?.presentation?.map?.activeCheck;
        if (!activeCheck) {
          showToast("当前没有等待结算的判定");
          return true;
        }
        saveRuntimePresentation((presentation) => {
          const currentCheck = presentation.map?.activeCheck;
          if (!matchesRuntimeControl(currentCheck, activeCheck, ["id", "locationId", "startedAt", "resolvedAt"])) return null;
          return { activeCheck: resolveRuntimeTabletopCheck(currentCheck) };
        }, "判定结果已公开");
        return true;
      }
      case "host-tabletop-apply-check-outcome": {
        const map = state.currentState?.presentation?.map;
        if (!map?.activeCheck?.result || map.activeCheck.appliedAt) {
          showToast(map?.activeCheck?.appliedAt ? "这次判定的数值变化已经应用" : "请先公开掷骰结果");
          return true;
        }
        const activeCheck = map.activeCheck;
        saveRuntimePresentation((presentation) => {
          const currentMap = presentation.map || {};
          const currentCheck = currentMap.activeCheck;
          if (!matchesRuntimeControl(
            currentCheck,
            activeCheck,
            ["id", "locationId", "startedAt", "resolvedAt"]
          ) || currentCheck.appliedAt) return null;
          const applied = applyRuntimeTabletopCheckOutcome(
            currentCheck,
            currentMap.host?.variables || map.host?.variables || []
          );
          return applied ? {
            activeCheck: applied.activeCheck,
            variableValues: applied.variableValues,
            publishedEnding: null
          } : null;
        }, "数值变化已应用，结局候选已重新计算");
        return true;
      }
      case "host-tabletop-publish-ending": {
        const endingId = String(el?.dataset?.endingId || "");
        const candidate = state.currentState?.presentation?.map?.host?.endingCandidates
          ?.find((ending) => ending.id === endingId);
        if (!candidate) {
          showToast("该结局尚未满足条件，不能公开");
          return true;
        }
        saveRuntimePresentation((presentation) => {
          const currentCandidate = presentation.map?.host?.endingCandidates
            ?.find((ending) => ending.id === endingId);
          if (!currentCandidate || presentation.map?.publishedEnding?.id === endingId) return null;
          return { publishedEnding: { id: endingId, publishedAt: new Date().toISOString() } };
        }, `结局导向「${candidate.name}」已公开给玩家`);
        return true;
      }
      case "host-tabletop-unpublish-ending": {
        const publishedEnding = state.currentState?.presentation?.map?.publishedEnding;
        if (!publishedEnding) {
          showToast("当前没有已公开的结局导向");
          return true;
        }
        saveRuntimePresentation((presentation) => matchesRuntimeControl(
          presentation.map?.publishedEnding,
          publishedEnding,
          ["id", "publishedAt"]
        ) ? { publishedEnding: null } : null, "结局导向已收回，仅主持端可见");
        return true;
      }
      case "host-tabletop-clear-check": {
        const activeCheck = state.currentState?.presentation?.map?.activeCheck;
        if (!activeCheck) {
          showToast("当前没有可收起的判定");
          return true;
        }
        saveRuntimePresentation((presentation) => matchesRuntimeControl(
          presentation.map?.activeCheck,
          activeCheck,
          ["id", "locationId", "startedAt", "resolvedAt"]
        ) ? { activeCheck: null } : null, "判定已收起，可以继续推进");
        return true;
      }
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
