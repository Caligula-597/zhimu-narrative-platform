/** Story bible actions — truth view tabs, core trick, timeline, foreshadow, role archives. */
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { normalizeError } from "../components/status-ui.js";
import { render } from "./runtime-facade.js";
import { callView } from "./view-registry.js";
import { bibleField, loadTruthBibleTab } from "../views/truth-bible.js";
import { readAppearanceStatesFromRoot } from "../views/role-archive-panel.js";
import { ownsBibleAction } from "./action-ownership.js";

const showError = (error, fallback = "操作失败") => showToast(normalizeError(error, fallback));

(function (window) {
  function field(name, prefix) {
    return document.querySelector(`[${prefix}="${name}"]`)?.value?.trim?.() ?? "";
  }

  async function handleBibleAction(action, el) {
    if (!ownsBibleAction(action)) return false;
    const worldId = zhimuApi.context.worldId;
    if (!worldId && !action.startsWith("truth-tab")) {
      showToast("请先选择剧本");
      return true;
    }

    switch (action) {
      case "truth-tab-claims":
        void loadTruthBibleTab("claims");
        return true;
      case "truth-tab-core-trick":
        void loadTruthBibleTab("core-trick");
        return true;
      case "truth-tab-timeline":
        void loadTruthBibleTab("timeline");
        return true;
      case "truth-tab-foreshadow":
        void loadTruthBibleTab("foreshadow");
        return true;
      case "truth-tab-materials":
        void loadTruthBibleTab("materials");
        return true;
      case "truth-tab-relations":
        void loadTruthBibleTab("relations");
        return true;

      case "save-core-trick":
        try {
          await zhimuApi.patchCoreTrick({
            summary: bibleField("summary"),
            killerRoleSlotId: bibleField("killerRoleSlotId") || null,
            method: bibleField("method"),
            motive: bibleField("motive"),
            victim: bibleField("victim"),
            hostNotes: bibleField("hostNotes")
          }, worldId);
          showToast("核心谜底已保存");
          void loadTruthBibleTab("core-trick");
        } catch (error) {
          showError(error);
        }
        return true;

      case "add-timeline-event":
        try {
          await zhimuApi.createTimelineEvent({
            timeLabel: field("timeLabel", "data-timeline-field"),
            eventSummary: field("eventSummary", "data-timeline-field"),
            alibiNotes: field("alibiNotes", "data-timeline-field")
          }, worldId);
          showToast("时间线事件已添加");
          void loadTruthBibleTab("timeline");
        } catch (error) {
          showError(error);
        }
        return true;

      case "delete-timeline-event":
        try {
          await zhimuApi.deleteTimelineEvent(el?.dataset?.eventId, worldId);
          showToast("已删除");
          void loadTruthBibleTab("timeline");
        } catch (error) {
          showError(error);
        }
        return true;

      case "add-foreshadow-beat":
        try {
          await zhimuApi.createForeshadowBeat({
            title: field("title", "data-foreshadow-field"),
            plantSummary: field("plantSummary", "data-foreshadow-field"),
            surfaceMeaning: field("surfaceMeaning", "data-foreshadow-field"),
            trueMeaning: field("trueMeaning", "data-foreshadow-field"),
            payoffSummary: field("payoffSummary", "data-foreshadow-field")
          }, worldId);
          showToast("伏笔已添加");
          void loadTruthBibleTab("foreshadow");
        } catch (error) {
          showError(error);
        }
        return true;

      case "delete-foreshadow-beat":
        try {
          await zhimuApi.deleteForeshadowBeat(el?.dataset?.beatId, worldId);
          showToast("已删除");
          void loadTruthBibleTab("foreshadow");
        } catch (error) {
          showError(error);
        }
        return true;

      case "add-material-booklet": {
        try {
          const pageBody = field("pageBody", "data-material-field");
          await zhimuApi.createMaterialBooklet({
            kind: field("kind", "data-material-field") || "diary",
            title: field("title", "data-material-field"),
            summary: field("summary", "data-material-field"),
            ownerRoleSlotId: field("ownerRoleSlotId", "data-material-field") || null,
            phaseLabel: field("phaseLabel", "data-material-field"),
            pages: pageBody ? [{ title: "首页", body: pageBody, sequence: 1 }] : []
          }, worldId);
          showToast("物料册已添加");
          void loadTruthBibleTab("materials");
        } catch (error) {
          showError(error);
        }
        return true;
      }

      case "delete-material-booklet":
        try {
          await zhimuApi.deleteMaterialBooklet(el?.dataset?.bookletId, worldId);
          showToast("已删除");
          void loadTruthBibleTab("materials");
        } catch (error) {
          showError(error);
        }
        return true;

      case "delete-truth-claim":
        try {
          await zhimuApi.deleteTruthClaim(el?.dataset?.claimId, worldId);
          showToast("核心事实已删除");
          void loadTruthBibleTab("claims");
        } catch (error) {
          showError(error);
        }
        return true;

      case "save-role-archive": {
        const roleId = el?.dataset?.roleId;
        const root = document.querySelector(`[data-role-archive="${roleId}"]`);
        if (!roleId || !root) return true;
        const read = (name) => root.querySelector(`[data-archive-field="${name}"]`)?.value?.trim() || "";
        const arc = {};
        ["start", "conflict", "turn", "end"].forEach((key) => {
          arc[key] = root.querySelector(`[data-arc-field="${key}"]`)?.value?.trim() || "";
        });
        try {
          await zhimuApi.patchRoleArchive(roleId, {
            publicIdentity: read("publicIdentity"),
            hiddenIdentity: read("hiddenIdentity"),
            externalGoal: read("externalGoal"),
            internalNeed: read("internalNeed"),
            secret: read("secret"),
            actionLine: read("actionLine"),
            innerConflict: read("innerConflict"),
            voiceHints: read("voiceHints"),
            appearanceStates: readAppearanceStatesFromRoot(root),
            arc
          }, worldId);
          showToast("角色档案已保存");
          void callView("writer", "loadWriterRoleArchives", { force: true });
        } catch (error) {
          showError(error);
        }
        return true;
      }

      case "add-appearance-state": {
        const roleId = el?.dataset?.roleId;
        const list = document.querySelector(`[data-role-archive="${roleId}"] [data-appearance-list]`);
        if (!list) return true;
        const index = list.querySelectorAll("[data-appearance-index]").length;
        list.insertAdjacentHTML("beforeend", `
          <div class="appearance-state-row" data-appearance-index="${index}">
            <label class="cockpit-field compact"><span>阶段（幕/日）</span>
              <input class="field" data-appearance-field="phaseLabel" value="" placeholder="如 D1 / 第二幕"></label>
            <label class="cockpit-field compact"><span>此时外形 / 状态</span>
              <input class="field" data-appearance-field="appearance" value="" placeholder="玩家当天看到的外形"></label>
            <label class="cockpit-field compact"><span>备注</span>
              <input class="field" data-appearance-field="notes" value=""></label>
          </div>`);
        return true;
      }

      default:
        return false;
    }
  }

  document.addEventListener("click", (event) => {
    const tabBtn = event.target.closest("[data-truth-tab]");
    if (tabBtn) {
      event.preventDefault();
      void loadTruthBibleTab(tabBtn.dataset.truthTab);
    }
  });

  window.zhimuActionsBible = { handleBibleAction };
})(window);

export function handleBibleAction(action, el) {
  return window.zhimuActionsBible?.handleBibleAction?.(action, el) || false;
}
