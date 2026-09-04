/**
 * 剧情积木篮（Story Mechanism Workbench）
 * 默认展示「你的剧情骨架」列表；添加/修改时再进入通用槽位编辑。
 * 不为每个 STORY 子型写独立页；不暴露内部术语为主标题。
 */

import "./creator-story-mechanism-workbench.css";
import {
  listStoryFamilies,
  listStoryTemplates,
  getStoryTemplate,
  contentMaturityTable,
} from "../../shared/story-mechanism-registry.js";
import { characterLoadScore } from "../../shared/story-mechanism-contracts.js";
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

/** 用户可见家族名（内部仍用 M01…） */
const FAMILY_INTENT = Object.freeze({
  M01: { label: "追凶调查", blurb: "谁做了什么、留下什么、如何误判与揭开" },
  M07: { label: "身份与记忆", blurb: "隐藏身份、记忆分层、阶段显现" },
  M08: { label: "阵营冲突", blurb: "公开或隐秘阵营与对抗（内容仍在充实）" },
  M10: { label: "多结局", blurb: "分支结局条件（内容仍在充实）" },
  M11: { label: "世界变化", blurb: "现场与世界状态改写（内容仍在充实）" },
});

function ensureState(root) {
  if (!root.__storyMechState) {
    root.__storyMechState = createDemoProjectState();
  }
  if (!root.__storyMechUi) {
    root.__storyMechUi = {
      mode: "basket",
      familyId: "M01",
      templateId: "M01-FRAMING",
      activeBlockId: null,
      message: "",
    };
  }
  return { state: root.__storyMechState, ui: root.__storyMechUi };
}

function activeBlock(state, ui) {
  return state.mechanismBlocks.find((b) => b.id === ui.activeBlockId) || null;
}

function blockHeadline(block) {
  const tpl = getStoryTemplate(block.templateId);
  const title = tpl?.title || block.templateId;
  const roles = Object.entries(block.roleBindings || {})
    .filter(([, ref]) => ref?.name)
    .slice(0, 3)
    .map(([key, ref]) => `${ref.name}`)
    .join(" / ");
  return { title, roles, familyLabel: FAMILY_INTENT[block.familyId]?.label || block.familyId };
}

function renderLoadBars(state) {
  const chars = state.characters || [];
  if (!chars.length) return "";
  const scores = chars.map((c) => ({
    id: c.id,
    name: c.name,
    score: characterLoadScore(state, c.id),
  }));
  const max = Math.max(1, ...scores.map((s) => s.score));
  return `<div class="story-basket-loads" aria-label="角色负载">
    <h3>角色负载</h3>
    ${scores
      .map((s) => {
        const pct = Math.round((s.score / max) * 100);
        const bars = "█".repeat(Math.max(1, Math.ceil((s.score / max) * 8))) + "░".repeat(Math.max(0, 8 - Math.ceil((s.score / max) * 8)));
        return `<div class="story-basket-load-row"><span>${escapeHtml(s.name)}</span><span class="story-basket-bar" title="${pct}%">${escapeHtml(bars)}</span><small>${s.score}</small></div>`;
      })
      .join("")}
  </div>`;
}

function renderBasket(root, state, ui) {
  const blocks = state.mechanismBlocks || [];
  const list = blocks.length
    ? blocks
        .map((block, index) => {
          const { title, roles, familyLabel } = blockHeadline(block);
          const active = block.id === ui.activeBlockId ? " is-active" : "";
          return `<article class="story-basket-card${active}" data-story-select-block="${escapeHtml(block.id)}">
            <div class="story-basket-card-head">
              <strong>${index + 1}. ${escapeHtml(title)}</strong>
              <span>${escapeHtml(familyLabel)} · ${escapeHtml(block.status || "DRAFT")}</span>
            </div>
            <p>${escapeHtml(roles || "尚未分配角色")}</p>
            <div class="story-basket-card-actions">
              <button type="button" data-story-edit-block="${escapeHtml(block.id)}">修改</button>
            </div>
          </article>`;
        })
        .join("")
    : `<p class="story-mech-empty">还没有剧情积木。点「添加剧情结构」，选择你希望本里有什么。</p>`;

  const maturitySummary = contentMaturityTable().reduce((acc, row) => {
    acc[row.contentMaturity] = (acc[row.contentMaturity] || 0) + 1;
    return acc;
  }, {});

  root.innerHTML = `<section class="creator-story-mechanism-workbench" data-workspace-editor aria-label="剧情积木篮">
    <header class="story-mech-head">
      <div>
        <p>你的剧情骨架</p>
        <h2>剧情积木篮</h2>
        <span>像搭积木一样选结构：生成一条、换一种结构、只换一个槽、自己改、锁定。幕内玩法请在「加玩法」阶段添加。</span>
      </div>
      <div class="story-mech-maturity">
        <strong>${blocks.length}</strong><small>已放入</small>
        <strong>${maturitySummary.COMPLETE || 0}</strong><small>完整模板</small>
      </div>
    </header>
    <section class="story-mech-section">
      <div class="story-basket-layout">
        <div class="story-basket-list">${list}</div>
        ${renderLoadBars(state)}
      </div>
    </section>
    <section class="story-mech-section story-mech-actions-bar">
      <button type="button" class="primary-btn" data-story-open-compose>+ 添加剧情结构</button>
      <button type="button" class="secondary-btn" data-story-close>返回创作</button>
      ${ui.message ? `<p class="story-mech-msg" role="status">${escapeHtml(ui.message)}</p>` : ""}
    </section>
  </section>`;
}

function renderCompose(root, state, ui) {
  const families = listStoryFamilies();
  const templates = listStoryTemplates({ familyId: ui.familyId });
  const tpl = getStoryTemplate(ui.templateId);
  const block = activeBlock(state, ui);
  if (block) ui.activeBlockId = block.id;

  const familyHtml = families
    .map((f) => {
      const intent = FAMILY_INTENT[f] || { label: f };
      return `<button type="button" class="story-mech-chip ${ui.familyId === f ? "active" : ""}" data-story-family="${escapeHtml(f)}">${escapeHtml(intent.label)}</button>`;
    })
    .join("");

  const sorted = [...templates].sort((a, b) => {
    const rank = (t) => (t.contentMaturity === "COMPLETE" ? 0 : 1);
    return rank(a) - rank(b);
  });

  const templateHtml = sorted
    .map((t) => {
      const active = t.id === ui.templateId;
      const ready = t.contentMaturity === "COMPLETE" ? "可用" : "骨架";
      return `<button type="button" class="story-mech-template ${active ? "active" : ""}" data-story-template="${escapeHtml(t.id)}">
        <strong>${escapeHtml(t.title)}</strong>
        <span>${escapeHtml(ready)}</span>
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
    : `<p class="story-mech-empty">选择结构后点「生成一条」。${tpl?.contentMaturity !== "COMPLETE" ? "当前模板设计尚未充实，可试跑但建议优先选「可用」项。" : ""}</p>`;

  const intent = FAMILY_INTENT[ui.familyId];

  root.innerHTML = `<section class="creator-story-mechanism-workbench" data-workspace-editor aria-label="添加剧情结构">
    <header class="story-mech-head">
      <div>
        <p>添加剧情结构</p>
        <h2>你希望这本里有什么？</h2>
        <span>${escapeHtml(intent?.blurb || "选择一类剧情体验，再生成一条放入积木篮。")}</span>
      </div>
    </header>

    <section class="story-mech-section">
      <h3>1. 剧情类型</h3>
      <div class="story-mech-chip-row">${familyHtml}</div>
    </section>

    <section class="story-mech-section">
      <h3>2. 具体结构</h3>
      <div class="story-mech-template-grid">${templateHtml}</div>
    </section>

    <section class="story-mech-section story-mech-actions-bar">
      <button type="button" class="primary-btn" data-story-generate>生成一条</button>
      <button type="button" class="secondary-btn" data-story-accept ${block ? "" : "disabled"}>用这个</button>
      <button type="button" class="secondary-btn" data-story-back-basket>回到积木篮</button>
      <button type="button" class="text-btn" data-story-close>返回创作</button>
      ${ui.message ? `<p class="story-mech-msg" role="status">${escapeHtml(ui.message)}</p>` : ""}
    </section>

    <section class="story-mech-section">
      <h3>3. 换一种结构</h3>
      <div class="story-mech-chip-row">${variantHtml || "<span class='story-mech-empty'>生成后可换结构</span>"}</div>
    </section>

    <section class="story-mech-section">
      <h3>4. 角色与剧情槽</h3>
      <div class="story-mech-slot-grid">${slotsHtml}</div>
    </section>
  </section>`;
}

function render(root) {
  const { state, ui } = ensureState(root);
  if (ui.mode === "compose") renderCompose(root, state, ui);
  else renderBasket(root, state, ui);
}

async function mountStoryMechanismWorkbench(root, { onClose } = {}) {
  ensureState(root);
  render(root);

  root.onclick = (event) => {
    const t = event.target;
    if (!(t instanceof HTMLElement)) return;
    const { state, ui } = ensureState(root);
    const hit = t.closest("[data-story-close],[data-story-open-compose],[data-story-back-basket],[data-story-family],[data-story-template],[data-story-generate],[data-story-accept],[data-story-variant],[data-story-swap-slot],[data-story-edit-slot],[data-story-edit-block],[data-story-select-block]");
    if (!hit) return;
    const el = hit instanceof HTMLElement ? hit : t;

    try {
      if (el.matches("[data-story-close]")) {
        onClose?.();
        return;
      }
      if (el.matches("[data-story-open-compose]")) {
        ui.mode = "compose";
        ui.message = "";
        render(root);
        return;
      }
      if (el.matches("[data-story-back-basket]")) {
        ui.mode = "basket";
        ui.message = "";
        render(root);
        return;
      }
      if (el.matches("[data-story-edit-block]") || el.matches("[data-story-select-block]")) {
        ui.activeBlockId = el.getAttribute("data-story-edit-block") || el.getAttribute("data-story-select-block");
        const block = activeBlock(root.__storyMechState, ui);
        if (block) {
          ui.familyId = block.familyId || ui.familyId;
          ui.templateId = block.templateId || ui.templateId;
        }
        if (el.matches("[data-story-edit-block]")) ui.mode = "compose";
        ui.message = "";
        render(root);
        return;
      }
      if (el.matches("[data-story-family]")) {
        ui.familyId = el.getAttribute("data-story-family");
        const preferred =
          listStoryTemplates({ familyId: ui.familyId }).find((t) => t.contentMaturity === "COMPLETE") ||
          listStoryTemplates({ familyId: ui.familyId })[0];
        ui.templateId = preferred?.id || ui.templateId;
        ui.message = "";
        render(root);
        return;
      }
      if (el.matches("[data-story-template]")) {
        ui.templateId = el.getAttribute("data-story-template");
        ui.message = "";
        render(root);
        return;
      }
      if (el.matches("[data-story-generate]")) {
        root.__storyMechState = generateStoryMechanism({
          templateId: ui.templateId,
          projectStoryState: state,
        });
        ui.activeBlockId = root.__storyMechState.mechanismBlocks.at(-1)?.id || null;
        ui.message = "已生成一条，可换结构或改槽位后点「用这个」";
        render(root);
        return;
      }
      if (el.matches("[data-story-accept]")) {
        const block = activeBlock(root.__storyMechState, ui);
        if (!block) return;
        root.__storyMechState = acceptStoryBlock(root.__storyMechState, block.id);
        ui.mode = "basket";
        ui.message = "已放入剧情积木篮";
        render(root);
        return;
      }
      if (el.matches("[data-story-variant]")) {
        const block = activeBlock(root.__storyMechState, ui);
        if (!block) return;
        root.__storyMechState = swapStoryVariant(
          root.__storyMechState,
          block.id,
          el.getAttribute("data-story-variant"),
        );
        ui.message = "已换一种结构";
        render(root);
        return;
      }
      if (el.matches("[data-story-swap-slot]")) {
        const block = activeBlock(root.__storyMechState, ui);
        if (!block) return;
        const key = el.getAttribute("data-story-swap-slot");
        root.__storyMechState = swapStorySlot(root.__storyMechState, block.id, key);
        ui.message = `已换「${key}」`;
        render(root);
        return;
      }
      if (el.matches("[data-story-edit-slot]")) {
        const block = activeBlock(root.__storyMechState, ui);
        if (!block) return;
        const key = el.getAttribute("data-story-edit-slot");
        const slot = block.editableSlots.find((s) => s.key === key);
        const isRole = slot?.kind === "role" || slot?.type === "CHARACTER";
        if (isRole) {
          const options = root.__storyMechState.characters.map((c) => `${c.id}:${c.name}`).join("\n");
          const raw = window.prompt(`选择角色（填 id）\n${options}`, block.roleBindings[key]?.id || "");
          if (raw == null) return;
          root.__storyMechState = editStorySlot(root.__storyMechState, block.id, key, raw.trim());
        } else {
          const raw = window.prompt(`修改「${slot?.label || key}」`, String(block.plotBindings[key] ?? ""));
          if (raw == null) return;
          root.__storyMechState = editStorySlot(root.__storyMechState, block.id, key, raw);
        }
        ui.message = `已手改 ${slot?.label || key}`;
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
  const [{ showToast }, { callView }] = await Promise.all([
    import("../components/toast.js"),
    import("../runtime/view-registry.js"),
  ]);
  const root = document.querySelector(".creator-cockpit .cockpit-core-canvas");
  if (!root) return showToast("剧情积木篮暂时无法打开，请刷新创作页后重试");
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
