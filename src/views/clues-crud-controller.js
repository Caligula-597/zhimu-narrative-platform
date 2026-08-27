import { refreshClueAudit } from "./clues-audit.js";
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { loadCloudData } from "../runtime/runtime-facade.js";
import { studioStore, uiStore, worldStore } from "../state/index.js";
import * as F from "../utils/format.js";
import * as M from "../components/modal.js";
import * as S from "../components/ui-semantics.js";

const escapeHtml = F.escapeHtml || ((value = "") => String(value));
const studioModal = M.studioModal || (() => {});
const closeModal = M.closeModal || (() => {});
const showError = S.showError;

function formatClueDeleteRefs(refs) {
    const parts = [];
    if (refs.edgeCount) parts.push(`${refs.edgeCount} 条剧情连线`);
    if (refs.clueGrantCount) parts.push(`${refs.clueGrantCount} 个调查点会停止发放此线索`);
    if (refs.ruleReferenceCount) parts.push(`${refs.ruleReferenceCount} 条规则仍引用此线索`);
    return parts.length ? `<p>检测到 ${parts.join("、")}。删除后运行房可能受影响。</p>` : "";
  }

export async function confirmDeleteClue(clueId) {
    const data = studioStore.get().cloudStudio;
    const clue = data?.clues?.find((item) => item.id === clueId);
    if (!clue) return showToast("线索不存在或已删除");
    try {
      const refs = await zhimuApi.getStudioNodeReferences("clue", clueId);
      studioModal(
        "确认删除线索",
        `${formatClueDeleteRefs(refs)}<p>删除后无法恢复；已入房玩家若曾获得此线索，相关记录也会一并清除。</p><div class="rule-block"><strong>${escapeHtml(clue.name)}</strong></div>`,
        "确认删除",
        async () => {
          try {
            await zhimuApi.deleteStudioNode("clue", clueId);
            const ui = uiStore.get();
            uiStore.set({ cluesBulkSelection: (ui.cluesBulkSelection || []).filter((id) => id !== clueId) });
            if (ui.cluesSelectedId === clueId) uiStore.set({ cluesSelectedId: null });
            closeModal();
            await loadCloudData();
            void refreshClueAudit({ silent: true });
            showToast("线索已删除");
          } catch (error) {
            showError(error);
          }
        }
      );
    } catch (error) {
      showError(error);
    }
  }

export function batchBindCluePaths() {
    const ids = uiStore.get().cluesBulkSelection || [];
    if (!ids.length) return showToast("请先勾选要绑定路径的线索");
    const segments = worldStore.get().cloudSegments || [];
    const segmentOptions = M.studioOptionsHtml([
      { id: "", name: "不绑定剧情段落" },
      ...segments.map((segment) => ({
        id: segment.segmentKey || segment.segment_key,
        name: `${segment.segmentKey || segment.segment_key} · ${segment.title || "未命名段落"}`
      }))
    ]);
    studioModal(
      `批量绑定 ${ids.length} 条线索`,
      `<p>一次事务更新全部线索；任一引用无效时整批回滚。</p>
       <label>剧情段落</label><select class="field" data-clue-bulk-segment>${segmentOptions}</select>
       <label class="check-label"><input type="checkbox" data-clue-bulk-unbound><span>明确允许游离（会清空剧情段落）</span></label>`,
      "保存批量绑定",
      async () => {
        const segmentKey = document.querySelector("[data-clue-bulk-segment]")?.value || null;
        const allowUnbound = Boolean(document.querySelector("[data-clue-bulk-unbound]")?.checked);
        if (!allowUnbound && !segmentKey) {
          return showToast("请选择剧情段落，或明确允许游离");
        }
        try {
          await zhimuApi.bindCluePaths({
            clueIds: ids,
            segmentKey: allowUnbound ? null : segmentKey,
            allowUnbound
          });
          uiStore.set({ cluesBulkSelection: [] });
          closeModal();
          await loadCloudData();
          void refreshClueAudit({ silent: true });
          showToast(`已更新 ${ids.length} 条线索的玩家发现路径`);
        } catch (error) {
          showError(error);
        }
      }
    );
  }

  export async function batchDeleteClues() {
    const ui = uiStore.get();
    const ids = ui.cluesBulkSelection || [];
    if (!ids.length) return showToast("请先勾选要删除的线索");
    const data = studioStore.get().cloudStudio;
    const names = ids.map((id) => data?.clues?.find((item) => item.id === id)?.name || "未命名线索");
    studioModal(
      `确认删除 ${ids.length} 条线索`,
      `<p>以下线索将被永久删除，且无法恢复：</p><ul class="clues-delete-list">${names.map((name) => `<li>${escapeHtml(name)}</li>`).join("")}</ul><p>关联的剧情连线会一并移除；调查点将不再发放这些线索。</p>`,
      "确认删除",
      async () => {
        try {
          for (const clueId of ids) {
            await zhimuApi.deleteStudioNode("clue", clueId);
          }
          uiStore.set({ cluesBulkSelection: [] });
          if (ui.cluesSelectedId && ids.includes(ui.cluesSelectedId)) uiStore.set({ cluesSelectedId: null });
          closeModal();
          await loadCloudData();
          void refreshClueAudit({ silent: true });
          showToast(`已删除 ${ids.length} 条线索`);
        } catch (error) {
          showError(error);
        }
      }
    );
  }
