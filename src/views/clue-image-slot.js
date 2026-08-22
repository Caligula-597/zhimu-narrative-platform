/**
 * Clue card image slot — upload/preview without relying on OCR text.
 */
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import * as S from "../components/ui-semantics.js";
import { loadCloudData, render } from "../runtime/runtime-facade.js";
import { assetStore, studioStore, uiStore } from "../state/index.js";
import { escapeHtml } from "../utils/format.js";

const showError = S.showError;
const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function clueAssetFor(clue) {
  const assetId = clue?.metadata?.assetId;
  if (!assetId) return null;
  return (assetStore.get().cloudAssets || []).find((asset) => asset.id === assetId) || null;
}

export function renderClueImageSlot(clue, asset = clueAssetFor(clue)) {
  const clueId = escapeHtml(clue?.id || "");
  const hasAsset = Boolean(asset || clue?.metadata?.assetId);
  const label = hasAsset ? "线索卡图片" : "上传线索卡图片";
  const hint = hasAsset ? "点击可更换 · 发放时可直接展示原图" : "建议直接上传卡面原图，比 OCR 更清晰可靠";
  return `<div class="clue-preview-image ${hasAsset ? "has-asset" : "is-empty"}" data-clue-image-slot="${clueId}">
    <img class="clue-preview-photo" alt="" hidden data-clue-image-preview="${clueId}">
    <div class="clue-preview-overlay">
      <span>${escapeHtml(label)}</span>
      <small>${escapeHtml(hint)}</small>
      <div class="clue-preview-actions">
        <label class="clue-preview-upload-btn">
          ${hasAsset ? "更换图片" : "选择图片"}
          <input type="file" accept="${IMAGE_ACCEPT}" data-clue-image-upload data-clue="${clueId}" hidden>
        </label>
        ${hasAsset ? `<button type="button" class="text-btn clue-preview-clear" data-action="clue-image-clear" data-clue="${clueId}">移除</button>` : ""}
      </div>
    </div>
  </div>`;
}

export async function hydrateClueImagePreviews(root = document) {
  const slots = [...(root.querySelectorAll?.("[data-clue-image-slot]") || [])];
  await Promise.all(slots.map((slot) => hydrateOneSlot(slot)));
}

async function hydrateOneSlot(slot) {
  const clueId = slot.dataset.clueImageSlot;
  const img = slot.querySelector("[data-clue-image-preview]");
  if (!clueId || !img) return;
  const clue = (studioStore.get().cloudStudio?.clues || []).find((item) => item.id === clueId);
  const assetId = clue?.metadata?.assetId;
  if (!assetId) {
    img.hidden = true;
    img.removeAttribute("src");
    slot.classList.remove("has-photo");
    return;
  }
  try {
    const ticket = await zhimuApi.getAssetDownloadUrl(assetId);
    const url = ticket?.downloadUrl;
    if (!url) return;
    img.onload = () => {
      img.hidden = false;
      slot.classList.add("has-photo");
    };
    img.onerror = () => {
      img.hidden = true;
      slot.classList.remove("has-photo");
    };
    img.src = url;
    img.alt = clue?.name || "线索卡";
  } catch {
    img.hidden = true;
    slot.classList.remove("has-photo");
  }
}

export async function uploadClueImage(clueId, file) {
  if (!clueId || !file) return;
  if (!/^image\//.test(file.type || "")) {
    showToast("请选择图片文件（PNG / JPG / WebP）");
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    showToast("图片请不超过 10 MB");
    return;
  }
  const clue = (studioStore.get().cloudStudio?.clues || []).find((item) => item.id === clueId);
  if (!clue) return showToast("线索不存在");
  const scroll = uiStore.get().clueFlowScroll;
  try {
    showToast("正在上传线索卡图片…");
    const asset = await zhimuApi.uploadAsset(file, { visibility: "public" });
    if (!asset?.id) throw new Error("上传成功但未返回附件 ID");
    await zhimuApi.updateClue(clue.id, {
      name: clue.name,
      publicText: clue.public_text || "",
      hostText: clue.host_text || "",
      visibility: clue.visibility || "role",
      metadata: {
        ...(clue.metadata || {}),
        assetId: asset.id,
        clueType: "image"
      }
    });
    await loadCloudData(false, true);
    if (scroll) uiStore.set({ clueFlowScroll: scroll });
    uiStore.set({ cluesSelectedId: clueId });
    render();
    showToast("线索卡图片已上传，发放时可直接展示");
  } catch (error) {
    showError(error);
  }
}

export async function clearClueImage(clueId) {
  const clue = (studioStore.get().cloudStudio?.clues || []).find((item) => item.id === clueId);
  if (!clue?.metadata?.assetId) return;
  const scroll = uiStore.get().clueFlowScroll;
  try {
    const { assetId: _removed, ...rest } = clue.metadata || {};
    await zhimuApi.updateClue(clue.id, {
      name: clue.name,
      publicText: clue.public_text || "",
      hostText: clue.host_text || "",
      visibility: clue.visibility || "role",
      metadata: {
        ...rest,
        assetId: null,
        clueType: rest.clueType === "image" ? "text" : rest.clueType || "text"
      }
    });
    await loadCloudData(false, true);
    if (scroll) uiStore.set({ clueFlowScroll: scroll });
    uiStore.set({ cluesSelectedId: clueId });
    render();
    showToast("已移除线索卡图片");
  } catch (error) {
    showError(error);
  }
}
