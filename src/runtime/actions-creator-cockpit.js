/** Creator cockpit actions — native CRUD, navigation, refresh. */
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { normalizeError } from "../components/status-ui.js";
import { worldStore } from "../state/index.js";
import { LOGLINE_TEMPLATE, newSparkId } from "../views/creator-cockpit-model.js";
import { clueGrantsFromText } from "../views/creator-cockpit-segment.js";
import { normalizeSegmentOperations } from "shared/segment-contract.js";
import { callView } from "./view-registry.js";
import { ownsCreatorCockpitAction } from "./action-ownership.js";
import { callRuntime } from "./runtime-facade.js";

const showError = (error, fallback = "操作失败") => showToast(normalizeError(error, fallback));

(function (window) {
  function cockpitRoot() {
    return document.querySelector(".creator-cockpit");
  }

  function field(name, attr = "data-cockpit-truth") {
    return cockpitRoot()?.querySelector(`[${attr}="${name}"]`)?.value?.trim?.() ?? cockpitRoot()?.querySelector(`[${attr}="${name}"]`)?.value ?? "";
  }

  function workspacePreview() {
    return worldStore.get().cloudWorkspacePreview;
  }

  async function reloadCockpitAfterWrite() {
    callRuntime("invalidateStudioSnapshot", { clear: true });
    callView("creatorCockpit", "invalidateCockpitData");
    await callView("creatorCockpit", "refreshCockpitData", { force: true });
  }

  function maybeAutoLoadCockpit(view) {
    if (view !== "creatorCockpit") return;
    const worldId = zhimuApi.context.worldId;
    const worldValidated = (worldStore.get().cloudWorlds || []).some((world) => world.id === worldId);
    if (!worldId || !worldValidated) return;
    // Enter-once load; refreshCockpitData no-ops when already loaded for this world.
    void callView("creatorCockpit", "refreshCockpitData");
  }

  async function handleCreatorCockpitAction(action, el) {
    if (!ownsCreatorCockpitAction(action)) return false;
    const worldId = zhimuApi.context.worldId;
    if (!worldId && action !== "cockpit-refresh") {
      showToast("请先选择剧本");
      return true;
    }

    switch (action) {
      case "cockpit-refresh":
        callView("creatorCockpit", "invalidateCockpitData");
        void callView("creatorCockpit", "refreshCockpitData", { force: true });
        return true;

      case "cockpit-goto-target":
        callView("creatorCockpit", "navigateCockpit", { target: el?.dataset?.cockpitTarget });
        return true;

      case "cockpit-open-mechanism-workbench":
        await (await import("../views/creator-mechanism-workbench.js"))
          .openCurrentCreatorMechanismWorkbench();
        return true;

      case "cockpit-open-story-mechanism-workbench":
        await (await import("../views/creator-story-mechanism-workbench.js"))
          .openCurrentCreatorStoryMechanismWorkbench();
        return true;

      case "cockpit-open-master-outline":
        await (await import("../views/creator-master-outline-workbench.js"))
          .openCurrentCreatorMasterOutlineWorkbench();
        return true;

      case "cockpit-open-document-import":
        callView("writer", "openOpeningPackage");
        return true;

      case "cockpit-fill-logline-template": {
        callView("creatorCockpit", "patchCockpitDraft", {
          logline: LOGLINE_TEMPLATE,
          activeCanvas: "logline",
          activeItem: "logline"
        });
        callView("creatorCockpit", "scheduleSummarySave");
        callView("creatorCockpit", "rerenderCockpit");
        return true;
      }

      case "cockpit-add-spark": {
        const draft = callView("creatorCockpit", "getCockpitDraft") || {};
        const text = String(draft.sparkDraft || "").trim();
        if (!text) return showToast("先写一句灵感"), true;
        const sparks = [...(draft.sparks || []), { id: newSparkId(), text, tag: draft.sparkTag || "灵感", at: Date.now() }];
        callView("creatorCockpit", "patchCockpitDraft", { sparks, sparkDraft: "" });
        callView("creatorCockpit", "scheduleBriefSave");
        callView("creatorCockpit", "rerenderCockpit");
        showToast("灵感已记录");
        return true;
      }

      case "cockpit-remove-spark": {
        const draft = callView("creatorCockpit", "getCockpitDraft") || {};
        const sparks = (draft.sparks || []).filter((s) => s.id !== el?.dataset?.sparkId);
        callView("creatorCockpit", "patchCockpitDraft", { sparks });
        callView("creatorCockpit", "scheduleBriefSave");
        callView("creatorCockpit", "rerenderCockpit");
        return true;
      }

      case "cockpit-adopt-spark": {
        const draft = callView("creatorCockpit", "getCockpitDraft") || {};
        const spark = (draft.sparks || []).find((s) => s.id === el?.dataset?.sparkId);
        if (!spark) return true;
        const logline = draft.logline?.trim() ? `${draft.logline.trim()}\n${spark.text}` : spark.text;
        callView("creatorCockpit", "patchCockpitDraft", { logline, activeStage: "concept", activeItem: "logline", activeCanvas: "logline" });
        callView("creatorCockpit", "scheduleSummarySave");
        callView("creatorCockpit", "rerenderCockpit");
        showToast("已写入梗概");
        return true;
      }

      case "cockpit-add-truth-claim": {
        const title = field("title");
        const claim = field("claim");
        const confidence = cockpitRoot()?.querySelector('[data-cockpit-truth="confidence"]')?.value || "canon";
        if (!title || !claim) return showToast("请填写标题与断言"), true;
        try {
          await zhimuApi.createTruthClaim({ title, claim, confidence }, worldId);
          await reloadCockpitAfterWrite();
          showToast("核心事实已添加");
        } catch (error) {
          showError(error);
        }
        return true;
      }

      case "cockpit-add-relationship": {
        const from = field("from", "data-cockpit-rel");
        const to = field("to", "data-cockpit-rel");
        const label = field("label", "data-cockpit-rel");
        const strengthRaw = cockpitRoot()?.querySelector('[data-cockpit-rel="strength"]')?.value;
        if (!from || !to || from === to) return showToast("请选择两个不同角色"), true;
        try {
          await zhimuApi.createRoleRelationship({
            fromRoleSlotId: from,
            toRoleSlotId: to,
            label,
            strength: strengthRaw === "" || strengthRaw == null ? undefined : Number(strengthRaw)
          }, worldId);
          await reloadCockpitAfterWrite();
          showToast("关系已添加");
        } catch (error) {
          showError(error);
        }
        return true;
      }

      case "cockpit-add-chapter": {
        const title = field("title", "data-cockpit-chapter");
        const summary = cockpitRoot()?.querySelector('[data-cockpit-chapter="summary"]')?.value?.trim() || "";
        if (!title) return showToast("请填写章节标题"), true;
        const chapters = workspacePreview()?.chapters || [];
        try {
          await zhimuApi.createChapter(worldId, { title, summary, sequence: chapters.length + 1 });
          await reloadCockpitAfterWrite();
          showToast("章节已添加");
        } catch (error) {
          showError(error);
        }
        return true;
      }

      case "cockpit-add-role": {
        const name = field("name", "data-cockpit-role");
        if (!name) return showToast("请填写角色名"), true;
        const roles = workspacePreview()?.roles || [];
        try {
          await zhimuApi.createRole(worldId, { name, sequence: roles.length + 1 });
          await reloadCockpitAfterWrite();
          showToast("角色已添加");
        } catch (error) {
          showError(error);
        }
        return true;
      }

      case "cockpit-add-section": {
        const roleId = cockpitRoot()?.querySelector('[data-cockpit-section="role"]')?.value;
        const chapterId = cockpitRoot()?.querySelector('[data-cockpit-section="chapter"]')?.value;
        const title = field("title", "data-cockpit-section");
        if (!roleId || !chapterId || !title) return showToast("请选择角色、章节并填写分幕标题"), true;
        try {
          await zhimuApi.createSection(worldId, roleId, {
            title,
            chapterId,
            body: `# ${title}\n\n（在此撰写私人分幕正文）`,
            sequence: (workspacePreview()?.sections || []).filter((s) => s.role_slot_id === roleId).length + 1
          });
          await reloadCockpitAfterWrite();
          showToast("分幕已添加，可在创作台编辑正文");
        } catch (error) {
          showError(error);
        }
        return true;
      }

      case "cockpit-sync-segments":
        try {
          await zhimuApi.syncWorldSegmentsFromGraph(worldId);
          await reloadCockpitAfterWrite();
          showToast("已从章节同步运行段落");
        } catch (error) {
          showError(error);
        }
        return true;

      case "cockpit-save-segment": {
        const segmentId = el?.dataset?.segmentId;
        const segment = (worldStore.get().cloudSegments || []).find((s) => s.id === segmentId);
        if (!segmentId || !segment) return showToast("请选择运行段落"), true;
        const root = cockpitRoot()?.querySelector(`[data-cockpit-segment-editor="${segmentId}"]`);
        if (!root) return true;
        const flow = root.querySelector('[data-cockpit-seg="flow"]')?.value || "";
        const hostTruth = root.querySelector('[data-cockpit-seg="hostTruth"]')?.value || "";
        const clueGrants = clueGrantsFromText(root.querySelector('[data-cockpit-seg="clueGrants"]')?.value || "");
        const operations = normalizeSegmentOperations({
          ...(segment.operations || {}),
          flow,
          hostTruth,
          clueGrants
        });
        try {
          await zhimuApi.updateWorldSegment(segmentId, {
            title: segment.title,
            sequence: segment.sequence,
            story: segment.story || {},
            operations
          }, worldId);
          await reloadCockpitAfterWrite();
          showToast("运行段落的主持手册已保存");
        } catch (error) {
          showError(error);
        }
        return true;
      }

      case "cockpit-add-clue": {
        const name = field("name", "data-cockpit-clue");
        const publicText = cockpitRoot()?.querySelector('[data-cockpit-clue="publicText"]')?.value?.trim() || "";
        if (!name) return showToast("请填写线索名称"), true;
        try {
          await zhimuApi.createClue({ name, publicText: publicText || undefined });
          await reloadCockpitAfterWrite();
          showToast("线索已添加");
        } catch (error) {
          showError(error);
        }
        return true;
      }

      case "cockpit-save-chapter-summary": {
        const chapterId = el?.dataset?.chapterId;
        const summary = cockpitRoot()?.querySelector(`[data-cockpit-chapter-summary="${chapterId}"]`)?.value?.trim() || "";
        if (!chapterId) return true;
        const chapter = workspacePreview()?.chapters?.find((c) => c.id === chapterId);
        if (!chapter) return true;
        try {
          await zhimuApi.updateChapter(chapterId, {
            title: chapter.title,
            summary
          });
          await reloadCockpitAfterWrite();
          showToast("章节摘要已保存");
        } catch (error) {
          showError(error);
        }
        return true;
      }

      case "cockpit-analyze-draft": {
        const draft = callView("creatorCockpit", "getCockpitDraft") || {};
        const text = String(draft.copilotQuery || draft.logline || "").trim();
        if (!text) return showToast("请先输入或粘贴文本"), true;
        try {
          const result = await zhimuApi.analyzeStoryDraft(text);
          callView("creatorCockpit", "patchCockpitDraft", { lastAnalysis: result, lastAiNote: "" });
          callView("creatorCockpit", "rerenderCockpit");
          showToast(`结构识别完成 · ${result.nodes?.length || 0} 个节点`);
        } catch (error) {
          showError(error);
        }
        return true;
      }

      default:
        return false;
    }
  }

  async function handleSectionStatusChange(selectEl) {
    const roleId = selectEl?.dataset?.roleId;
    const sectionId = selectEl?.dataset?.sectionId;
    const publicationStatus = selectEl?.value;
    const studio = await callRuntime("ensureStudioSnapshot");
    const section = studio?.sections?.find((s) => s.id === sectionId);
    if (!roleId || !sectionId || !section) return;
    try {
      await zhimuApi.updateSection(roleId, sectionId, {
        title: section.title,
        body: section.body,
        chapterId: section.chapter_id || section.chapterId || null,
        sequence: section.sequence,
        publicationStatus
      });
      await reloadCockpitAfterWrite();
      showToast("分幕状态已更新");
    } catch (error) {
      showError(error);
    }
  }

  document.addEventListener("change", (event) => {
    const selectEl = event.target.closest(".creator-cockpit select[data-section-id]");
    if (!selectEl) return;
    void handleSectionStatusChange(selectEl);
  });

  window.zhimuActionsCreatorCockpit = { handleCreatorCockpitAction, maybeAutoLoadCockpit };
})(window);

export function maybeAutoLoadCockpit(view) {
  window.zhimuActionsCreatorCockpit?.maybeAutoLoadCockpit?.(view);
}

export function handleCreatorCockpitAction(action, el) {
  return window.zhimuActionsCreatorCockpit?.handleCreatorCockpitAction?.(action, el) || false;
}
