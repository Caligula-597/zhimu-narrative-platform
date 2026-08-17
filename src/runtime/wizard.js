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
import { go, loadCloudData, registerRuntime } from "./runtime-facade.js";

const PRIMARY_CREATION_TYPES = ["murder_mystery", "tabletop_rpg", "board_game"];
const CREATE_COPY = Object.freeze({
  murder_mystery: {
    icon: "谜",
    title: "剧本杀",
    description: "角色本、公共幕、线索与主持流程",
    destination: "creatorCockpit"
  },
  tabletop_rpg: {
    icon: "骰",
    title: "跑团",
    description: "角色卡、地图、判定与长线状态",
    destination: "tabletopMap"
  },
  board_game: {
    icon: "棋",
    title: "桌游",
    description: "棋盘、牌堆、资源、轨道与自定义组件",
    destination: "boardGame"
  }
});

let creating = false;
let lockedCreationType = "";

function currentDraft() {
  const source = wizardStore.get().wizardDraft || {};
  return {
    worldName: String(source.worldName || ""),
    creationType: PRIMARY_CREATION_TYPES.includes(source.creationType)
      ? source.creationType
      : "murder_mystery"
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
  const copy = CREATE_COPY[type];
  return `<button type="button" class="world-type-choice ${selected ? "selected" : ""}" data-world-create-type="${type}" aria-pressed="${selected ? "true" : "false"}">
    <span class="world-type-icon" aria-hidden="true">${copy.icon}</span>
    <span><strong>${copy.title}</strong><small>${copy.description}</small></span>
    <i aria-hidden="true">${selected ? "✓" : ""}</i>
  </button>`;
}

function worldCreationHtml() {
  const draft = currentDraft();
  const selectedCopy = CREATE_COPY[draft.creationType];
  const boardOnly = lockedCreationType === "board_game";
  return `<div class="world-create-shell">
    <aside class="world-create-context">
      <div class="brand-mark">织</div>
      <h2>${boardOnly ? "新建空白桌游" : "先建一个空项目"}</h2>
      <p>${boardOnly ? "只建立桌游项目与编辑器，不创建剧情、章节或角色剧本。组件、地图、规则和试玩内容由你继续搭建。" : "先选择产品类型和名称，再进入对应的独立工作区。"}</p>
      <ol>
        <li class="active"><span>01</span>${boardOnly ? "桌游项目" : "选择创作类型"}</li>
        <li class="active"><span>02</span>给项目命名</li>
        <li><span>→</span>进入对应工作区</li>
      </ol>
    </aside>
    <form class="world-create-main" data-world-create-form>
      <div>
        <h2>${boardOnly ? "创建新桌游" : "创建新项目"}</h2>
        <p class="wizard-intro">${boardOnly ? "创建后直接进入桌游创作中心。" : "不同产品进入不同创作中心，工具与术语不会混用。"}</p>
      </div>
      ${boardOnly ? "" : `<fieldset class="world-type-fieldset">
        <legend>你准备创作什么？</legend>
        <div class="world-type-grid">${PRIMARY_CREATION_TYPES.map((type) => creationChoice(type, type === draft.creationType)).join("")}</div>
      </fieldset>`}
      <label class="world-name-field" for="world-create-name"><span>${boardOnly ? "桌游名称" : "项目名称"}</span><input class="field" id="world-create-name" data-world-create-name maxlength="120" autocomplete="off" placeholder="输入一个名称即可" value="${escapeHtml(draft.worldName)}" autofocus></label>
      <div class="world-create-result"><span>${selectedCopy.icon}</span><p>${boardOnly ? "创建后直接进入桌游创作中心；席位、组件、规则和 Demo 都保持空白。" : `创建后直接进入<strong>${selectedCopy.title}</strong>工作区；项目内容保持空白。`}</p></div>
      <footer class="world-create-actions">
        <button type="button" class="secondary-btn" data-world-create-cancel>取消</button>
        <button type="submit" class="primary-btn" data-world-create-submit ${creating ? "disabled" : ""}>${creating ? "正在创建…" : `创建空白${selectedCopy.title}`}</button>
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
    wizardStore.set({ wizardDraft: { worldName: "", creationType: draft.creationType } });
    go(CREATE_COPY[draft.creationType].destination);
    showToast(`已创建空白${CREATE_COPY[draft.creationType].title}「${draft.worldName}」`);
  } catch (error) {
    creating = false;
    setHtml(modal, worldCreationHtml());
    bindWorldCreation();
    showToast(normalizeError(error, "项目创建失败，请稍后重试"));
  }
}

registerRuntime({ openWizard, finishWizard });
