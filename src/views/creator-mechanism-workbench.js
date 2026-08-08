import "./creator-mechanism-workbench.css";
import { escapeHtml } from "../utils/format.js";
import { setHtml } from "../../shared/safe-dom.js";
import {
  MECHANISM_DESIGN_QUESTIONS,
  mechanismDesignCoverage,
  normalizeMechanismDesign,
  validateMechanismDesignConfirmation,
} from "../../shared/mechanism-design.js";
import {
  MECHANISM_INTERACTION_CARDS,
  mechanismInteractionCard,
} from "../../shared/mechanism-interactions.js";

function fieldHtml(question, value, invalidKeys) {
  const invalid = invalidKeys.has(question.key);
  return `<label class="mechanism-design-field ${invalid ? "is-invalid" : ""}">
    <span>${escapeHtml(question.label)}</span>
    <small>${escapeHtml(question.prompt)}</small>
    <textarea rows="3" maxlength="2400" data-mechanism-design-field="${escapeHtml(question.key)}" aria-invalid="${invalid ? "true" : "false"}">${escapeHtml(value)}</textarea>
  </label>`;
}

function renderFrame(
  root,
  design,
  saving = false,
  discardArmed = false,
  validationIssues = [],
  saveError = "",
) {
  const coverage = mechanismDesignCoverage(design);
  const activeCard = mechanismInteractionCard(design.interactionKind);
  const invalidKeys = new Set(validationIssues.map((issue) => issue.key));
  const validationMessage = validationIssues.length
    ? `<section class="mechanism-validation-message" role="alert" aria-label="机制设计确认校验失败"><strong>还不能确认并用于生成</strong><p>请补齐以下内容，草稿仍可随时保存。</p><ul>${validationIssues.map((issue) => `<li>${escapeHtml(issue.message)}</li>`).join("")}</ul></section>`
    : saveError
      ? `<section class="mechanism-validation-message is-save-error" role="alert"><strong>机制设计保存失败</strong><p>${escapeHtml(saveError)}</p></section>`
      : "";
  const interactionConfiguration =
    design.interactionKind === "numeric_allocation"
      ? `<div class="mechanism-interaction-configuration" aria-label="数值分配配置">
        <label><span>每位玩家可分配总额</span><input type="number" min="1" max="10000" step="1" data-mechanism-design-field="allocationTotal" value="${escapeHtml(design.allocationTotal)}"></label>
        <label><span>额度单位</span><input maxlength="40" data-mechanism-design-field="allocationUnitLabel" value="${escapeHtml(design.allocationUnitLabel)}" placeholder="例如：点、票、单位"></label>
        <p>玩家必须把全部额度分配完毕；玩家之间互不可见，主持端只汇总各项总额。</p>
      </div>`
      : "";
  setHtml(
    root,
    `<section class="creator-mechanism-workbench" data-workspace-editor aria-label="机制设计工作台" aria-busy="${saving ? "true" : "false"}">
  <div class="mechanism-workbench-head">
    <div><p>MECHANISM WORKBENCH</p><h2>机制设计工作台</h2><span>先把玩家反复做什么说清楚，再交给AI扩写章节。</span></div>
    <div class="mechanism-coverage"><strong>${coverage.filled}/${coverage.total}</strong><small>机制七问</small></div>
  </div>
  <section class="mechanism-design-section">
    <div class="mechanism-design-section-head"><div><span>01</span><h3>选择线上表现形式</h3></div><p>它决定玩家端如何操作、主持端如何结算，不决定故事题材。</p></div>
    <div class="mechanism-design-card-grid">${MECHANISM_INTERACTION_CARDS.map(
      (card) => `
      <button type="button" class="mechanism-design-card ${card.key === design.interactionKind ? "active" : ""}" data-mechanism-kind="${escapeHtml(card.key)}" aria-pressed="${card.key === design.interactionKind ? "true" : "false"}">
        <span>${escapeHtml(card.shortLabel)}</span><strong>${escapeHtml(card.label)}</strong><p>${escapeHtml(card.authorPrompt)}</p>
      </button>`,
    ).join("")}</div>
    <div class="mechanism-cross-surface-preview">
      <article><span>玩家端</span><p>${escapeHtml(activeCard.playerInstruction)}</p></article>
      <article><span>主持端</span><p>${escapeHtml(activeCard.hostInstruction)}</p></article>
    </div>
    ${interactionConfiguration}
  </section>
  <section class="mechanism-design-section">
    <div class="mechanism-design-section-head"><div><span>02</span><h3>回答机制七问</h3></div><p>写世界内行为，不写状态Key、变量名或抽象“决策点”。</p></div>
    <div class="mechanism-design-basics">
      <label class="${invalidKeys.has("title") ? "is-invalid" : ""}"><span>机制名称</span><input data-mechanism-design-field="title" maxlength="160" value="${escapeHtml(design.title)}" aria-invalid="${invalidKeys.has("title") ? "true" : "false"}" placeholder="例如：潮窗分洪许可"></label>
      <label class="${invalidKeys.has("summary") ? "is-invalid" : ""}"><span>一句话概述</span><textarea data-mechanism-design-field="summary" rows="2" maxlength="1200" aria-invalid="${invalidKeys.has("summary") ? "true" : "false"}" placeholder="玩家每轮通过什么动作，在什么限制下改变局面">${escapeHtml(design.summary)}</textarea></label>
    </div>
    <div class="mechanism-design-question-grid">${MECHANISM_DESIGN_QUESTIONS.map((question) => fieldHtml(question, design[question.key], invalidKeys)).join("")}</div>
    <label class="mechanism-design-field wide"><span>补充给AI与主持人的作者备注</span><textarea rows="3" maxlength="4000" data-mechanism-design-field="authorNotes">${escapeHtml(design.authorNotes)}</textarea></label>
  </section>
  ${validationMessage}
  <div class="mechanism-workbench-actions">
    <button type="button" class="secondary-btn" data-mechanism-close>${discardArmed ? "再次点击放弃修改" : "返回驾驶舱"}</button>
    <div><span>${discardArmed ? "当前有未保存修改；再次返回才会放弃。" : validationIssues.length ? "当前修改未通过确认校验，不会进入生成" : design.status === "confirmed" ? "当前版本已确认为作者设定" : "草稿会进入AI上下文，但会明确标记为未确认"}</span>
      <button type="button" class="secondary-btn" data-mechanism-save="draft" ${saving ? "disabled" : ""}>保存草稿</button>
      <button type="button" class="primary-btn" data-mechanism-save="confirmed" ${saving ? "disabled" : ""}>确认并用于生成</button>
    </div>
  </div>
</section>`,
  );
}

function readDesign(root, current) {
  const next = { ...current };
  root.querySelectorAll("[data-mechanism-design-field]").forEach((field) => {
    next[field.dataset.mechanismDesignField] = field.value;
  });
  return normalizeMechanismDesign(next);
}

export function openCreatorMechanismWorkbench({
  root,
  value,
  onSave,
  onClose,
}) {
  if (!root) return false;
  let design = normalizeMechanismDesign(value);
  let saving = false;
  let dirty = false;
  let discardArmed = false;
  let validationIssues = [];
  let saveError = "";

  function bind() {
    root
      .querySelector("[data-mechanism-close]")
      ?.addEventListener("click", () => {
        if (saving) return;
        if (dirty && !discardArmed) {
          discardArmed = true;
          render();
          return;
        }
        onClose?.();
      });
    root.querySelectorAll("[data-mechanism-kind]").forEach((button) => {
      button.addEventListener("click", () => {
        design = normalizeMechanismDesign({
          ...readDesign(root, design),
          interactionKind: button.dataset.mechanismKind,
        });
        dirty = true;
        discardArmed = false;
        render();
      });
    });
    root
      .querySelector("[data-workspace-editor]")
      ?.addEventListener("input", () => {
        dirty = true;
        discardArmed = false;
        validationIssues = [];
        saveError = "";
      });
    root.querySelectorAll("[data-mechanism-save]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (saving) return;
        const requestedStatus = button.dataset.mechanismSave;
        design = normalizeMechanismDesign({
          ...readDesign(root, design),
          status: requestedStatus,
          updatedAt: new Date().toISOString(),
        });
        if (requestedStatus === "confirmed") {
          const validation = validateMechanismDesignConfirmation(design);
          if (!validation.valid) {
            validationIssues = validation.issues;
            saveError = "";
            render();
            root
              .querySelector(
                `[data-mechanism-design-field="${validationIssues[0].key}"]`,
              )
              ?.focus();
            return;
          }
        }
        validationIssues = [];
        saveError = "";
        saving = true;
        render();
        try {
          await onSave(design);
          dirty = false;
          discardArmed = false;
        } catch (error) {
          dirty = true;
          saveError = error?.message || "请检查网络连接后重试。";
        } finally {
          saving = false;
          if (root.isConnected) render();
        }
      });
    });
  }

  function render() {
    renderFrame(
      root,
      design,
      saving,
      discardArmed,
      validationIssues,
      saveError,
    );
    bind();
  }

  render();
  return true;
}

export async function openCurrentCreatorMechanismWorkbench() {
  const [
    zhimuApi,
    { worldStore },
    { showToast },
    { callView },
    { callRuntime },
  ] = await Promise.all([
    import("../api/index.js"),
    import("../state/index.js"),
    import("../components/toast.js"),
    import("../runtime/view-registry.js"),
    import("../runtime/runtime-facade.js"),
  ]);
  const worldId = zhimuApi.context.worldId;
  const root = document.querySelector(".creator-cockpit .cockpit-core-canvas");
  if (!root) return showToast("机制工作台暂时无法打开，请刷新驾驶舱后重试");
  const cockpitRoot = root.closest(".creator-cockpit");
  const backgroundControls = cockpitRoot?.querySelectorAll(
    ".cockpit-hero-actions, .cockpit-stage-strip, .cockpit-nav-band, .cockpit-copilot",
  );
  cockpitRoot?.classList.add("mechanism-workbench-open");
  backgroundControls?.forEach((element) => {
    element.inert = true;
  });
  return openCreatorMechanismWorkbench({
    root,
    value:
      worldStore.get().cloudWorkspacePreview?.world?.settings?.mechanismDesign,
    onClose: () => {
      cockpitRoot?.classList.remove("mechanism-workbench-open");
      backgroundControls?.forEach((element) => {
        element.inert = false;
      });
      callView("creatorCockpit", "rerenderCockpit");
    },
    onSave: async (mechanismDesign) => {
      try {
        await zhimuApi.patchWorld({ settings: { mechanismDesign } }, worldId);
        callRuntime("invalidateStudioSnapshot", { clear: true });
        callView("creatorCockpit", "invalidateCockpitData");
        await callView("creatorCockpit", "refreshCockpitData", { force: true });
        showToast(
          mechanismDesign.status === "confirmed"
            ? "机制设计已确认并进入生成上下文"
            : "机制设计草稿已保存",
        );
      } catch (error) {
        showToast(error?.message || "机制设计保存失败");
        throw error;
      }
    },
  });
}
