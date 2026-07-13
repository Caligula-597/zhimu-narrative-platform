import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { modal } from "../dom.js";
import { go, loadCloudData } from "../runtime/runtime-facade.js";
import { assetStore, studioStore, uiStore } from "../state/index.js";
import * as M from "../components/modal.js";
import * as S from "../components/ui-semantics.js";
import { CLUE_IMPORTANCE_OPTIONS, CLUE_KIND_OPTIONS, CLUE_TYPE_OPTIONS } from "./clues-catalog.js";

const studioField = M.studioField || (() => "");
const studioSelect = M.studioSelect || (() => "");
const studioValues = M.studioValues || (() => ({}));
const studioModal = M.studioModal || (() => {});
const closeModal = M.closeModal || (() => {});
const showError = S.showError;

export function openClueInStudio(clueId) {
    uiStore.set({ searchFocus: { view: "studio", type: "clue", id: clueId, nodeType: "clue" } });
    go("studio");
  }

  export function openCluesEditor(clueId = "") {
    const data = studioStore.get().cloudStudio;
    if (!data) return showToast("请先选择剧本世界");
    const clue = clueId ? data.clues.find((item) => item.id === clueId) : null;
    const assets = [{ id: "", name: "不关联附件" }, ...(assetStore.get().cloudAssets || []).map((asset) => ({ id: asset.id, name: asset.original_filename }))];
    const meta = clue?.metadata || {};
    studioModal(
      clue ? `编辑线索 · ${clue.name}` : "新建线索",
      studioField("线索名称", "name", "input", clue?.name || "") +
        studioField("获得后可见内容", "publicText", "textarea", clue?.public_text || "") +
        studioField("主持解释", "hostText", "textarea", clue?.host_text || "") +
        studioSelect("默认可见性", "visibility", [
          { id: "role", name: "私密 · 仅获得角色可见" },
          { id: "public", name: "房间公开" },
          { id: "host", name: "主持可见" }
        ], clue?.visibility || "role") +
        studioSelect("发放模式", "grantMode", [
          { id: "auto", name: "自动发放" },
          { id: "host_confirm", name: "主持确认后发放" },
          { id: "explore", name: "探索调查获得" }
        ], meta.grantMode || "auto") +
        studioSelect("线索形态", "clueType", CLUE_TYPE_OPTIONS, meta.clueType || "text") +
        studioSelect("线索类型", "clueKind", CLUE_KIND_OPTIONS, clue?.clue_kind || clue?.clueKind || "general") +
        studioSelect("关联资产", "assetId", assets, meta.assetId || "") +
        studioSelect("重要程度", "importance", CLUE_IMPORTANCE_OPTIONS, meta.importance || "normal") +
        studioField("触发条件说明", "triggerNote", "textarea", meta.triggerNote || ""),
      clue ? "保存修改" : "写入云端",
      async () => {
        try {
          const values = studioValues();
          if (clue) {
            await zhimuApi.updateClue(clue.id, {
              name: values.name,
              publicText: values.publicText,
              hostText: values.hostText,
              visibility: values.visibility || "role",
              clueKind: values.clueKind || "general",
              metadata: {
                ...(clue.metadata || {}),
                clueType: values.clueType || "text",
                assetId: values.assetId || null,
                importance: values.importance || "normal",
                grantMode: values.grantMode || "auto",
                triggerNote: values.triggerNote || ""
              }
            });
          } else {
            await zhimuApi.createClue({
              name: values.name,
              publicText: values.publicText,
              hostText: values.hostText,
              visibility: values.visibility || "role",
              clueKind: values.clueKind || "general",
              metadata: {
                clueType: values.clueType || "text",
                assetId: values.assetId || null,
                importance: values.importance || "normal",
                grantMode: values.grantMode || "auto",
                triggerNote: values.triggerNote || ""
              }
            });
          }
          closeModal();
          await loadCloudData();
          showToast(clue ? "线索已更新" : "线索已创建");
        } catch (error) {
          showError(error);
        }
      }
    );
    if (clue) {
      modal.querySelector('[data-studio-field="visibility"]').value = clue.visibility || "role";
      modal.querySelector('[data-studio-field="grantMode"]').value = meta.grantMode || "auto";
      modal.querySelector('[data-studio-field="clueType"]').value = meta.clueType || "text";
      modal.querySelector('[data-studio-field="clueKind"]').value = clue.clue_kind || clue.clueKind || "general";
      modal.querySelector('[data-studio-field="importance"]').value = meta.importance || "normal";
    }
  }
