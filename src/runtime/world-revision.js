/** Optimistic-lock conflict UI + unsaved editor guard for world content_revision / If-Match. */
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { uiStore, worldStore, studioStore } from "../state/index.js";
import { loadCloudData, render } from "./runtime-facade.js";
import * as F from "../utils/format.js";
import { closeModal } from "../components/modal.js";
import { setHtml } from "../../shared/safe-dom.js";

(function (window) {

  const escapeHtml = F.escapeHtml || ((v = "") => String(v));

  let editorDirty = false;

  /** After a version conflict, block writes until the user refreshes. */
  let conflictBlocked = false;

  let draftTimer = null;

  const DRAFT_DEBOUNCE_MS = 800;



  const INPUT_SELECTOR = [

    "#settings-world-name",

    "#settings-world-summary",

    "#settings-recap-truth",

    "[data-studio-field]",

    ".studio-inspector textarea",

    ".studio-inspector input.field"

  ].join(",");



  function markEditorDirty() {

    editorDirty = true;

  }



  function clearEditorDirty() {

    editorDirty = false;

  }



  function isEditorDirty() {

    return editorDirty;

  }



  function activeWorldId(worldId) {

    return worldId || zhimuApi?.context?.worldId || "";

  }



  function resolveDraftScope() {

    const view = uiStore.get().view;

    if (view === "settings") return "settings";

    if (view === "studio") {

      const selected = studioStore.get().studioSelectedNode;

      if (selected) {

        const { type, id } = selected;

        return `studio:${type}:${id}`;

      }

    }

    if (view === "writer") return "writer";

    return null;

  }



  function draftStorageKey(scope) {

    const worldId = activeWorldId();

    if (!worldId || !scope) return null;

    return `zhimu_draft:${worldId}:${scope}`;

  }



  function collectInputSnapshot(root = document) {

    const snapshot = {};

    root.querySelectorAll(INPUT_SELECTOR).forEach((el) => {

      if (el.readOnly || el.disabled) return;

      const key = el.id || el.dataset.studioField || el.name;

      if (!key) return;

      snapshot[key] = el.type === "checkbox" ? el.checked : el.value;

    });

    return snapshot;

  }



  function snapshotsMatch(a = {}, b = {}) {

    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

    for (const key of keys) {

      if (String(a[key] ?? "") !== String(b[key] ?? "")) return false;

    }

    return true;

  }



  function persistDraft(scope, root = document) {

    const key = draftStorageKey(scope);

    if (!key) return;

    try {

      localStorage.setItem(

        key,

        JSON.stringify({ savedAt: Date.now(), fields: collectInputSnapshot(root) })

      );

    } catch {

      /* quota or private mode */

    }

  }



  function scheduleDraftSave(scope, root = document) {

    clearTimeout(draftTimer);

    draftTimer = setTimeout(() => persistDraft(scope, root), DRAFT_DEBOUNCE_MS);

  }



  function loadDraft(scope) {

    const key = draftStorageKey(scope);

    if (!key) return null;

    try {

      const raw = localStorage.getItem(key);

      return raw ? JSON.parse(raw) : null;

    } catch {

      return null;

    }

  }



  function clearDraft(scope) {

    const key = draftStorageKey(scope || resolveDraftScope());

    if (key) localStorage.removeItem(key);

  }



  function restoreDraftToInputs(scope, root = document) {

    const draft = loadDraft(scope);

    if (!draft?.fields) return false;

    Object.entries(draft.fields).forEach(([key, value]) => {

      const byId = root.querySelector(`#${CSS.escape(key)}`);

      const byField = root.querySelector(`[data-studio-field="${CSS.escape(key)}"]`);

      const el = byId || byField;

      if (!el || el.readOnly || el.disabled) return;

      if (el.type === "checkbox") el.checked = Boolean(value);

      else el.value = value;

    });

    markEditorDirty();

    return true;

  }



  function promptDraftRestore(root = document, scope = resolveDraftScope()) {

    if (!scope) return;

    const draft = loadDraft(scope);

    if (!draft?.fields || !Object.keys(draft.fields).length) return;

    if (snapshotsMatch(draft.fields, collectInputSnapshot(root))) {

      clearDraft(scope);

      return;

    }

    const modal = document.getElementById("modal");

    const backdrop = document.getElementById("modal-backdrop");

    if (!modal || !backdrop) {

      if (window.confirm("检测到未同步的本地草稿，是否恢复？")) {

        restoreDraftToInputs(scope, root);

        showToast("已恢复本地草稿");

      } else {

        clearDraft(scope);

      }

      return;

    }

    setHtml(modal, `<h2>本地草稿</h2>

<p class="wizard-intro">检测到上次编辑未保存的本地草稿。恢复将覆盖当前表单内容；放弃将删除草稿。</p>

<div class="modal-actions">

  <button type="button" class="secondary-btn" data-draft-discard>放弃草稿</button>

  <button type="button" class="primary-btn" data-draft-restore>恢复草稿</button>

      </div>`);

    backdrop.classList.add("show");

    modal.querySelector("[data-draft-discard]").onclick = () => {

      clearDraft(scope);

      clearEditorDirty();

      closeModal();

    };

    modal.querySelector("[data-draft-restore]").onclick = () => {

      restoreDraftToInputs(scope, root);

      closeModal();

      showToast("已恢复本地草稿");

    };

  }



  function showConflict(details = {}) {

    const modal = document.getElementById("modal");

    const backdrop = document.getElementById("modal-backdrop");

    if (!modal || !backdrop) {

      showToast("保存冲突：其他协作者已更新此剧本，请刷新后重试");

      return;

    }

    const current = details.currentRevision ?? "?";

    const expected = details.expectedRevision ?? "?";

    conflictBlocked = true;

    setHtml(modal, `<h2>保存冲突</h2>

<p class="wizard-intro">剧本已有较新版本（当前 revision ${escapeHtml(String(current))}，你持有 ${escapeHtml(String(expected))}）。请刷新后再编辑；关闭弹窗后仍会阻止保存，直到刷新成功。</p>

<div class="modal-actions">

  <button type="button" class="secondary-btn" data-revision-close>稍后刷新</button>

  <button type="button" class="primary-btn" data-revision-reload>刷新并重新编辑</button>

      </div>`);

    backdrop.classList.add("show");

    modal.querySelector("[data-revision-close]").onclick = () => {

      closeModal();

      showToast("已暂停保存：请点「刷新并重新编辑」后再改");

    };

    modal.querySelector("[data-revision-reload]").onclick = async () => {

      closeModal();

      clearEditorDirty();

      clearDraft();

      try {

        await loadCloudData(true, true);

        conflictBlocked = false;

        render();

        showToast("已刷新剧本数据");

      } catch (error) {

        showToast(error.message || "刷新失败");

      }

    };

  }

  function isConflictBlocked() {

    return conflictBlocked;

  }

  function clearConflictBlock() {

    conflictBlocked = false;

  }



  function trackRevision(world) {

    if (!world || world.content_revision == null) return;

    const rev = Number(world.content_revision);

    const worldId = world.id || activeWorldId();

    const studioSnap = studioStore.get();

    if (studioSnap.cloudStudio?.world?.id === worldId) {

      studioStore.set({

        cloudStudio: {

          ...studioSnap.cloudStudio,

          world: { ...studioSnap.cloudStudio.world, content_revision: rev }

        }

      });

    }

    const worldSnap = worldStore.get();

    const cloudWorlds = worldSnap.cloudWorlds || [];

    const idx = cloudWorlds.findIndex((w) => w.id === worldId);

    if (idx >= 0) {

      worldStore.set({

        cloudWorlds: cloudWorlds.map((w, i) =>

          i === idx ? { ...w, content_revision: rev } : w

        )

      });

    }

  }



  function currentRevision(worldId) {

    const id = activeWorldId(worldId);

    const studioSnap = studioStore.get();

    if (studioSnap.cloudStudio?.world?.id === id && studioSnap.cloudStudio.world.content_revision != null) {

      return Number(studioSnap.cloudStudio.world.content_revision);

    }

    const worldSnap = worldStore.get();

    const listed = (worldSnap.cloudWorlds || []).find((w) => w.id === id);

    if (listed && listed.content_revision != null) {

      return Number(listed.content_revision);

    }

    return null;

  }



  function applySavedRevision(worldId, revision) {

    if (revision == null) return;

    const id = activeWorldId(worldId);

    const rev = Number(revision);

    const studioSnap = studioStore.get();

    if (studioSnap.cloudStudio?.world?.id === id) {

      studioStore.set({

        cloudStudio: {

          ...studioSnap.cloudStudio,

          world: { ...studioSnap.cloudStudio.world, content_revision: rev }

        }

      });

    }

    const worldSnap = worldStore.get();

    const cloudWorlds = worldSnap.cloudWorlds || [];

    const idx = cloudWorlds.findIndex((w) => w.id === id);

    if (idx >= 0) {

      worldStore.set({

        cloudWorlds: cloudWorlds.map((w, i) =>

          i === idx ? { ...w, content_revision: rev } : w

        )

      });

    }

  }



  function watchDirtyInputs(root = document, scope = resolveDraftScope()) {

    root.querySelectorAll(INPUT_SELECTOR).forEach((el) => {

      if (el.readOnly || el.disabled || el.dataset.dirtyBound) return;

      el.dataset.dirtyBound = "1";

      const onChange = () => {

        markEditorDirty();

        if (scope) scheduleDraftSave(scope, root);

      };

      el.addEventListener("input", onChange);

      el.addEventListener("change", onChange);

    });

  }



  window.addEventListener("beforeunload", (event) => {

    if (!editorDirty) return;

    event.preventDefault();

    event.returnValue = "";

  });



  window.zhimuWorldRevision = {

    showConflict,

    isConflictBlocked,

    clearConflictBlock,

    trackRevision,

    currentRevision,

    applySavedRevision,

    markEditorDirty,

    clearEditorDirty,

    isEditorDirty,

    watchDirtyInputs,

    promptDraftRestore,

    clearDraft,

    resolveDraftScope

  };

})(window);

export {};
