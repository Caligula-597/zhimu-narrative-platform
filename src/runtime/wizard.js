/** Minimal world creation: choose a product type, provide one name, then create an empty workspace. */
import * as zhimuApi from "../api/index.js";
import { closeModal } from "../components/modal.js";
import { normalizeError } from "../components/status-ui.js";
import { showToast } from "../components/toast.js";
import { modal, modalBackdrop } from "../dom.js";
import { wizardStore } from "../state/index.js";
import { escapeHtml } from "../utils/format.js";
import { setHtml } from "../../shared/safe-dom.js";
import {
  normalizeCreationType,
  normalizeNarrativeProfile,
  normalizeNarrativeSettings
} from "../../shared/narrative-profile.js";
import { ACTIVE_PRODUCT_TYPES, productDomainDefinition } from "../../shared/product-domains/registry.js";
import { go, loadCloudData, registerRuntime } from "./runtime-facade.js";
import { callView } from "./view-registry.js";

const PRIMARY_CREATION_TYPES = ACTIVE_PRODUCT_TYPES;

let creating = false;
let lockedCreationType = "";

function currentDraft() {
  const source = wizardStore.get().wizardDraft || {};
  return {
    worldName: String(source.worldName || ""),
    creationType: PRIMARY_CREATION_TYPES.includes(source.creationType)
      ? source.creationType
      : ""
  };
}

function collectDraft() {
  const draft = currentDraft();
  const input = modal.querySelector("[data-world-create-name]");
  if (input) draft.worldName = input.value.trim();
  wizardStore.set({ wizardDraft: draft });
  return draft;
}

function creationChoice(type, selected) {
  const copy = productDomainDefinition(type);
  return `<button type="button" class="world-type-choice ${selected ? "selected" : ""}" data-world-create-type="${type}" aria-pressed="${selected ? "true" : "false"}">
    <span class="world-type-icon" aria-hidden="true">${copy.icon}</span>
    <span><strong>${copy.label}</strong><small>${copy.description}</small></span>
    <i aria-hidden="true">${selected ? "✓" : ""}</i>
  </button>`;
}

function worldCreationHtml() {
  const draft = currentDraft();
  const selectedCopy = draft.creationType ? productDomainDefinition(draft.creationType) : null;
  const lockedCopy = lockedCreationType ? productDomainDefinition(lockedCreationType) : null;
  const locked = Boolean(lockedCopy);
  return `<div class="world-create-shell">
    <aside class="world-create-context">
      <div class="brand-mark">织</div>
      <h2>${locked ? `新建空白${lockedCopy.label}` : "先建一个空项目"}</h2>
      <p>${locked ? `只建立${lockedCopy.label}项目与专属工作区，不创建或复用其他产品内容。${lockedCopy.description}` : "先选择产品类型和名称，再进入对应的独立工作区。"}</p>
      <ol>
        <li class="active"><span>01</span>${locked ? `${lockedCopy.label}项目` : "选择创作类型"}</li>
        <li class="active"><span>02</span>给项目命名</li>
        <li><span>→</span>进入对应工作区</li>
      </ol>
    </aside>
    <form class="world-create-main" data-world-create-form>
      <div>
        <h2>${locked ? `创建新${lockedCopy.label}` : "创建新项目"}</h2>
        <p class="wizard-intro">${locked ? `创建后直接进入${lockedCopy.label}专属工作区。` : "不同产品进入不同创作中心，工具与术语不会混用。"}</p>
      </div>
      ${locked ? "" : `<fieldset class="world-type-fieldset">
        <legend>你准备创作什么？</legend>
        <div class="world-type-grid">${PRIMARY_CREATION_TYPES.map((type) => creationChoice(type, type === draft.creationType)).join("")}</div>
      </fieldset>`}
      <label class="world-name-field" for="world-create-name"><span>${locked ? `${lockedCopy.label}名称` : "项目名称"}</span><input class="field" id="world-create-name" data-world-create-name maxlength="120" autocomplete="off" placeholder="输入一个名称即可" value="${escapeHtml(draft.worldName)}" autofocus></label>
      <div class="world-create-result"><span>${selectedCopy?.icon || "?"}</span><p>${selectedCopy ? `创建后直接进入<strong>${selectedCopy.label}</strong>专属工作区；项目内容保持空白。` : "请先选择剧本杀、跑团或桌游；三种产品互不继承内容与工具。"}</p></div>
      <footer class="world-create-actions">
        <button type="button" class="secondary-btn" data-world-create-cancel>取消</button>
        <button type="submit" class="primary-btn" data-world-create-submit ${creating || !selectedCopy ? "disabled" : ""}>${creating ? "正在创建…" : selectedCopy ? `创建空白${selectedCopy.label}` : "先选择产品类型"}</button>
      </footer>
    </form>
  </div>`;
}

export function openWizard(creationType = "") {
  creating = false;
  lockedCreationType = PRIMARY_CREATION_TYPES.includes(creationType) ? creationType : "";
  if (lockedCreationType) {
    wizardStore.set({ wizardDraft: { ...currentDraft(), creationType: lockedCreationType } });
  }
  modal.className = "modal wizard-modal world-create-modal";
  setHtml(modal, worldCreationHtml());
  modalBackdrop.classList.add("show");
  bindWorldCreation();
}

function bindWorldCreation() {
  modal.querySelector("[data-world-create-cancel]")?.addEventListener("click", closeModal);
  modal.querySelectorAll("[data-world-create-type]").forEach((button) => button.addEventListener("click", () => {
    const draft = collectDraft();
    draft.creationType = normalizeCreationType(button.dataset.worldCreateType);
    wizardStore.set({ wizardDraft: draft });
    setHtml(modal, worldCreationHtml());
    bindWorldCreation();
    modal.querySelector("[data-world-create-name]")?.focus();
  }));
  modal.querySelector("[data-world-create-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void finishWizard();
  });
}

export async function finishWizard() {
  if (creating) return;
  const draft = collectDraft();
  if (!PRIMARY_CREATION_TYPES.includes(draft.creationType)) {
    showToast("请先选择剧本杀、跑团或桌游");
    return;
  }
  if (!draft.worldName) {
    showToast("给这个世界起一个名字即可");
    modal.querySelector("[data-world-create-name]")?.focus();
    return;
  }
  creating = true;
  setHtml(modal, worldCreationHtml());
  bindWorldCreation();
  try {
    const narrativeProfile = normalizeNarrativeProfile({ creationType: draft.creationType });
    const settings = normalizeNarrativeSettings({ narrativeProfile });
    const world = await zhimuApi.createWorld({ name: draft.worldName, summary: "", settings });
    zhimuApi.selectWorld(world.id);
    await loadCloudData(true);
    closeModal();
    const postCreateJourney = wizardStore.get().postCreateJourney || "";
    wizardStore.set({
      wizardDraft: { worldName: "", creationType: "" },
      postCreateJourney: ""
    });
    go(productDomainDefinition(draft.creationType).homeView);
    if (postCreateJourney === "upload") {
      void callView("writer", "openOpeningPackage");
    }
    showToast(`已创建空白${productDomainDefinition(draft.creationType).label}「${draft.worldName}」`);
  } catch (error) {
    creating = false;
    setHtml(modal, worldCreationHtml());
    bindWorldCreation();
    showToast(normalizeError(error, "项目创建失败，请稍后重试"));
  }
}

registerRuntime({ openWizard, finishWizard });
