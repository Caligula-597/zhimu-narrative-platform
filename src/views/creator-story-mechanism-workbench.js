/**
 * 通用剧情机制工作台（Story Mechanism Workbench）
 * 按 TemplateDefinition / editableSlots 自动渲染，不为每个 STORY 子型写独立页。
 */

import "./creator-story-mechanism-workbench.css";
import {
  listStoryFamilies,
  listStoryTemplates,
  getStoryTemplate,
  contentMaturityTable,
} from "../../shared/story-mechanism-registry.js";
import {
  acceptStoryBlock,
  createDemoProjectState,
  editStorySlot,
  generateStoryMechanism,
  swapStorySlot,
  swapStoryVariant,
} from "../../shared/story-mechanism-engine.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MATURITY_LABEL = {
  FOUNDATION: "基础骨架",
  PARTIAL: "部分充实",
  COMPLETE: "设计完整",
};

function ensureState(root) {
  if (!root.__storyMechState) {
    root.__storyMechState = createDemoProjectState();
  }
  if (!root.__storyMechUi) {
    root.__storyMechUi = {
      familyId: "M01",
      templateId: "M01-FRAMING",
      activeBlockId: null,
      message: "",
    };
  }
  return { state: root.__storyMechState, ui: root.__storyMechUi };
}

function activeBlock(state, ui) {
  return state.mechanismBlocks.find((b) => b.id === ui.activeBlockId) || state.mechanismBlocks[0] || null;
}

function render(root) {
  const { state, ui } = ensureState(root);
  const families = listStoryFamilies();
  const templates = listStoryTemplates({ familyId: ui.familyId });
  const tpl = getStoryTemplate(ui.templateId);
  const block = activeBlock(state, ui);
  if (block) ui.activeBlockId = block.id;

  const familyHtml = families
    .map(
      (f) =>
        `<button type="button" class="story-mech-chip ${ui.familyId === f ? "active" : ""}" data-story-family="${escapeHtml(f)}">${escapeHtml(f)}</button>`,
    )
    .join("");

  const templateHtml = templates
    .map((t) => {
      const active = t.id === ui.templateId;
      return `<button type="button" class="story-mech-template ${active ? "active" : ""}" data-story-template="${escapeHtml(t.id)}">
        <strong>${escapeHtml(t.title)}</strong>
        <span>${escapeHtml(t.id)} · ${escapeHtml(MATURITY_LABEL[t.contentMaturity] || t.contentMaturity)}</span>
        <small>${escapeHtml(t.purpose)}</small>
      </button>`;
    })
    .join("");

  const variantHtml = (tpl?.variants || [])
    .map(
      (v) =>
        `<button type="button" class="story-mech-chip ${block?.variantId === v.id ? "active" : ""}" data-story-variant="${escapeHtml(v.id)}" ${block ? "" : "disabled"}>${escapeHtml(v.title || v.id)}</button>`,
    )
    .join("");

  const slotsHtml = block
    ? block.editableSlots
        .map((slot) => {
          const key = slot.key;
          const isRole = slot.kind === "role" || slot.type === "CHARACTER";
          const value = isRole
            ? block.roleBindings[key]?.name || "（空）"
            : String(block.plotBindings[key] ?? "");
          const locked = slot.locked ? "is-locked" : "";
          return `<div class="story-mech-slot ${locked}" data-slot-key="${escapeHtml(key)}">
            <div><strong>${escapeHtml(slot.label || key)}</strong><span>${escapeHtml(isRole ? "角色" : "剧情")}</span></div>
            <p>${escapeHtml(value)}</p>
            <div class="story-mech-slot-actions">
              <button type="button" data-story-swap-slot="${escapeHtml(key)}" ${slot.locked ? "disabled" : ""}>换一个</button>
              <button type="button" data-story-edit-slot="${escapeHtml(key)}" ${slot.locked ? "disabled" : ""}>手动改</button>
            </div>
          </div>`;
        })
        .join("")
    : `<p class="story-mech-empty">尚未生成剧情骨架。选择模板后点「生成候选」。${tpl?.contentMaturity === "FOUNDATION" ? "（当前为 FOUNDATION 最小模板，可运行但设计尚未充实。）" : ""}</p>`;

  const beatsHtml = block
    ? ["setup", "progression", "climax", "resolution"]
        .map((section) => {
          const beats = block[section] || [];
          if (!beats.length) return "";
          return `<article><h4>${escapeHtml(section)}</h4><ul>${beats
            .map((b) => `<li><strong>${escapeHtml(b.stageKey)}</strong> ${escapeHtml(b.summary)}</li>`)
            .join("")}</ul></article>`;
        })
        .join("")
    : "";

  const maturitySummary = contentMaturityTable()
    .reduce((acc, row) => {
      acc[row.contentMaturity] = (acc[row.contentMaturity] || 0) + 1;
      return acc;
    }, {});

  root.innerHTML = `<section class="creator-story-mechanism-workbench" data-workspace-editor aria-label="剧情机制工作台">
    <header class="story-mech-head">
      <div>
        <p>STORY MECHANISM WORKBENCH</p>
        <h2>剧情机制工作台</h2>
        <span>选 STORY 模板 → 生成骨架 → 用这个 / 换结构 / 换槽 / 手改。GAME 玩法不在此页。</span>
      </div>
      <div class="story-mech-maturity">
        <strong>${maturitySummary.COMPLETE || 0}</strong><small>COMPLETE</small>
        <strong>${maturitySummary.FOUNDATION || 0}</strong><small>FOUNDATION</small>
      </div>
    </header>

    <section class="story-mech-section">
      <h3>1. 选择家族</h3>
      <div class="story-mech-chip-row">${familyHtml}</div>
    </section>

    <section class="story-mech-section">
      <h3>2. 选择剧情模板</h3>
      <div class="story-mech-template-grid">${templateHtml}</div>
    </section>

    <section class="story-mech-section story-mech-actions-bar">
      <button type="button" class="primary-btn" data-story-generate>生成候选</button>
      <button type="button" class="secondary-btn" data-story-accept ${block ? "" : "disabled"}>用这个</button>
      <button type="button" class="secondary-btn" data-story-close>返回驾驶舱</button>
      ${ui.message ? `<p class="story-mech-msg" role="status">${escapeHtml(ui.message)}</p>` : ""}
    </section>

    <section class="story-mech-section">
      <h3>3. 结构变体</h3>
      <div class="story-mech-chip-row">${variantHtml || "<span class='story-mech-empty'>生成后可换结构</span>"}</div>
    </section>

    <section class="story-mech-section">
      <h3>4. 可编辑槽位</h3>
      <div class="story-mech-slot-grid">${slotsHtml}</div>
    </section>

    <section class="story-mech-section">
      <h3>5. 大纲 Beats</h3>
      <div class="story-mech-beats">${beatsHtml || "<p class='story-mech-empty'>尚无 beats</p>"}</div>
      ${
        block
          ? `<p class="story-mech-meta">状态 ${escapeHtml(block.status)} · 修订 r${escapeHtml(block.revision)} · 真凶占位 ${escapeHtml((state.assignments.killerCharacterIds || []).join(",") || "—")}</p>`
          : ""
      }
    </section>
  </section>`;
}

async function mountStoryMechanismWorkbench(root, { onClose } = {}) {
  ensureState(root);
  render(root);

  root.onclick = (event) => {
    const t = event.target;
    if (!(t instanceof HTMLElement)) return;
    const { state, ui } = ensureState(root);

    try {
      if (t.matches("[data-story-close]")) {
        onClose?.();
        return;
      }
      if (t.matches("[data-story-family]")) {
        ui.familyId = t.getAttribute("data-story-family");
        const first = listStoryTemplates({ familyId: ui.familyId })[0];
        ui.templateId = first?.id || ui.templateId;
        ui.message = "";
        render(root);
        return;
      }
      if (t.matches("[data-story-template]")) {
        ui.templateId = t.getAttribute("data-story-template");
        ui.message = "";
        render(root);
        return;
      }
      if (t.matches("[data-story-generate]")) {
        root.__storyMechState = generateStoryMechanism({
          templateId: ui.templateId,
          projectStoryState: state,
        });
        ui.activeBlockId = root.__storyMechState.mechanismBlocks.at(-1)?.id || null;
        ui.message = `已生成 ${ui.templateId}`;
        render(root);
        return;
      }
      if (t.matches("[data-story-accept]")) {
        const block = activeBlock(root.__storyMechState, ui);
        if (!block) return;
        root.__storyMechState = acceptStoryBlock(root.__storyMechState, block.id);
        ui.message = "已接受当前骨架";
        render(root);
        return;
      }
      if (t.matches("[data-story-variant]")) {
        const block = activeBlock(root.__storyMechState, ui);
        if (!block) return;
        root.__storyMechState = swapStoryVariant(
          root.__storyMechState,
          block.id,
          t.getAttribute("data-story-variant"),
        );
        ui.message = `已换结构 ${t.getAttribute("data-story-variant")}`;
        render(root);
        return;
      }
      if (t.matches("[data-story-swap-slot]")) {
        const block = activeBlock(root.__storyMechState, ui);
        if (!block) return;
        const key = t.getAttribute("data-story-swap-slot");
        root.__storyMechState = swapStorySlot(root.__storyMechState, block.id, key);
        ui.message = `已轮换槽位 ${key}`;
        render(root);
        return;
      }
      if (t.matches("[data-story-edit-slot]")) {
        const block = activeBlock(root.__storyMechState, ui);
        if (!block) return;
        const key = t.getAttribute("data-story-edit-slot");
        const slot = block.editableSlots.find((s) => s.key === key);
        const isRole = slot?.kind === "role" || slot?.type === "CHARACTER";
        if (isRole) {
          const options = root.__storyMechState.characters
            .map((c) => `${c.id}:${c.name}`)
            .join("\n");
          const raw = window.prompt(`手动选择角色（填角色 id）\n${options}`, block.roleBindings[key]?.id || "");
          if (raw == null) return;
          root.__storyMechState = editStorySlot(root.__storyMechState, block.id, key, raw.trim());
        } else {
          const raw = window.prompt(`手动修改「${slot?.label || key}」`, String(block.plotBindings[key] ?? ""));
          if (raw == null) return;
          root.__storyMechState = editStorySlot(root.__storyMechState, block.id, key, raw);
        }
        ui.message = `已手改 ${key}`;
        render(root);
      }
    } catch (error) {
      ui.message = error?.message || String(error);
      render(root);
    }
  };
}

export async function openCreatorStoryMechanismWorkbench(host, options = {}) {
  const root =
    host?.querySelector?.("[data-story-mechanism-workbench-root]") ||
    host ||
    document.createElement("div");
  if (host && root.getAttribute("data-story-mechanism-workbench-root") !== "1") {
    root.setAttribute("data-story-mechanism-workbench-root", "1");
  }
  if (host && !host.contains(root) && root !== host) {
    host.appendChild(root);
  }
  const mountTarget = root === host ? host : root;
  await mountStoryMechanismWorkbench(mountTarget, options);
  return mountTarget;
}

export async function openCurrentCreatorStoryMechanismWorkbench() {
  const [
    { showToast },
    { callView },
  ] = await Promise.all([
    import("../components/toast.js"),
    import("../runtime/view-registry.js"),
  ]);
  const root = document.querySelector(".creator-cockpit .cockpit-core-canvas");
  if (!root) return showToast("剧情机制工作台暂时无法打开，请刷新驾驶舱后重试");
  const cockpitRoot = root.closest(".creator-cockpit");
  const backgroundControls = cockpitRoot?.querySelectorAll(
    ".cockpit-hero-actions, .cockpit-stage-strip, .cockpit-nav-band, .cockpit-copilot",
  );
  cockpitRoot?.classList.add("mechanism-workbench-open");
  backgroundControls?.forEach((element) => {
    element.inert = true;
  });
  root.innerHTML = "";
  return openCreatorStoryMechanismWorkbench(root, {
    onClose: () => {
      cockpitRoot?.classList.remove("mechanism-workbench-open");
      backgroundControls?.forEach((element) => {
        element.inert = false;
      });
      callView("creatorCockpit", "rerenderCockpit");
    },
  });
}

export { mountStoryMechanismWorkbench };
