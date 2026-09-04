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
  createInitialProjectStoryState,
  editStorySlot,
  generateStoryMechanism,
  lockStorySlot,
  swapStorySlot,
  swapStoryVariant,
} from "../../shared/story-mechanism-engine.js";
import { demoContext } from "../api/client.js";
import {
  getProjectStoryState as apiGetProjectStoryState,
  saveProjectStoryState as apiSaveProjectStoryState,
} from "../api/project-story-state.js";

const SAVE_STATUS = Object.freeze({
  IDLE: "IDLE",
  SAVED: "SAVED",
  SAVING: "SAVING",
  ERROR: "ERROR",
});

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
  M08: { label: "阵营冲突", blurb: "多人共享目标、归属变化与阵营信息差" },
  M10: { label: "多结局", blurb: "分支结局条件（内容仍在充实）" },
  M11: { label: "世界变化", blurb: "现场与世界状态改写（内容仍在充实）" },
});

function currentWorldId() {
  return demoContext.worldId || null;
}

function ensureUi(root) {
  if (!root.__storyMechUi) {
    root.__storyMechUi = {
      mode: "basket",
      familyId: "M01",
      templateId: "M01-FRAMING",
      activeBlockId: null,
      message: "",
      saveStatus: SAVE_STATUS.IDLE,
      saveError: "",
      loaded: false,
      worldId: null,
    };
  }
  return root.__storyMechUi;
}

function ensureState(root) {
  ensureUi(root);
  if (!root.__storyMechState) {
    const worldId = currentWorldId();
    root.__storyMechState = worldId
      ? createInitialProjectStoryState(worldId)
      : createDemoProjectState();
  }
  return { state: root.__storyMechState, ui: root.__storyMechUi };
}

async function loadPersistedState(root) {
  const ui = ensureUi(root);
  const worldId = currentWorldId();
  ui.worldId = worldId;
  if (!worldId) {
    root.__storyMechState = createDemoProjectState();
    ui.loaded = true;
    ui.saveStatus = SAVE_STATUS.IDLE;
    ui.message = "未选择项目：使用本地演示状态（不会云端保存）";
    return;
  }
  try {
    const payload = await apiGetProjectStoryState(worldId);
    root.__storyMechState = payload?.state
      ? { ...payload.state, projectId: worldId }
      : createInitialProjectStoryState(worldId);
    ui.loaded = true;
    ui.saveStatus = payload?.exists ? SAVE_STATUS.SAVED : SAVE_STATUS.IDLE;
    ui.saveError = "";
  } catch (error) {
    root.__storyMechState = createInitialProjectStoryState(worldId);
    ui.loaded = true;
    ui.saveStatus = SAVE_STATUS.ERROR;
    ui.saveError = error?.message || String(error);
    ui.message = "加载项目剧情状态失败，先使用本地草稿；保存时会重试";
  }
}

async function persistState(root, { reason = "" } = {}) {
  const ui = ensureUi(root);
  const worldId = currentWorldId();
  if (!worldId) {
    ui.saveStatus = SAVE_STATUS.IDLE;
    return false;
  }
  ui.saveStatus = SAVE_STATUS.SAVING;
  ui.saveError = "";
  render(root);
  try {
    const result = await apiSaveProjectStoryState(worldId, root.__storyMechState);
    if (result?.state) {
      root.__storyMechState = { ...result.state, projectId: worldId };
    }
    ui.saveStatus = SAVE_STATUS.SAVED;
    ui.saveError = "";
    if (reason) ui.message = reason;
    render(root);
    return true;
  } catch (error) {
    ui.saveStatus = SAVE_STATUS.ERROR;
    ui.saveError = error?.message || String(error);
    ui.message = `保存失败：${ui.saveError}（本地修改已保留）`;
    render(root);
    return false;
  }
}

function saveStatusHtml(ui, state) {
  if (!ui.worldId) return `<span class="story-save-status is-idle">本地演示</span>`;
  if (ui.saveStatus === SAVE_STATUS.SAVING) {
    return `<span class="story-save-status is-saving">保存中…</span>`;
  }
  if (ui.saveStatus === SAVE_STATUS.ERROR) {
    return `<span class="story-save-status is-error">保存失败 <button type="button" data-story-retry-save>重试</button></span>`;
  }
  if (ui.saveStatus === SAVE_STATUS.SAVED) {
    return `<span class="story-save-status is-saved">已保存 · r${escapeHtml(String(state?.revision ?? 0))}</span>`;
  }
  return `<span class="story-save-status is-idle">尚未保存</span>`;
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

  const accepted = blocks.filter((b) => ["USER_ACCEPTED", "USER_MODIFIED", "LOCKED"].includes(b.status));
  const acceptedList = accepted.length
    ? `<div class="story-basket-integrate">
        <p>已选择 <strong>${accepted.length}</strong> 条剧情结构</p>
        <ul>${accepted
          .map((b) => `<li>✓ ${escapeHtml(b.title || b.templateId)}</li>`)
          .join("")}</ul>
        <button type="button" class="primary-btn" data-story-integrate>尝试交织成整本骨架</button>
      </div>`
    : "";

  root.innerHTML = `<section class="creator-story-mechanism-workbench" data-workspace-editor aria-label="剧情积木篮">
    <header class="story-mech-head">
      <div>
        <p>你的剧情骨架</p>
        <h2>剧情积木篮</h2>
        <span>像搭积木一样选结构：生成一条、换一种结构、只换一个槽、自己改、锁定。幕内玩法请在「加玩法」阶段添加。</span>
      </div>
      <div class="story-mech-head-meta">
        <div class="story-mech-maturity">
          <strong>${blocks.length}</strong><small>已放入</small>
          <strong>${maturitySummary.COMPLETE || 0}</strong><small>完整模板</small>
        </div>
        ${saveStatusHtml(ui, state)}
      </div>
    </header>
    <section class="story-mech-section">
      <div class="story-basket-layout">
        <div class="story-basket-list">${list}</div>
        ${renderLoadBars(state)}
      </div>
      ${acceptedList}
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
              <button type="button" data-story-lock-slot="${escapeHtml(key)}" data-story-lock-next="${slot.locked ? "0" : "1"}">${slot.locked ? "解锁" : "锁定"}</button>
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
      ${saveStatusHtml(ui, state)}
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
  await loadPersistedState(root);
  render(root);

  root.onclick = async (event) => {
    const t = event.target;
    if (!(t instanceof HTMLElement)) return;
    const { state, ui } = ensureState(root);
    const hit = t.closest(
      "[data-story-close],[data-story-open-compose],[data-story-back-basket],[data-story-family],[data-story-template],[data-story-generate],[data-story-accept],[data-story-variant],[data-story-swap-slot],[data-story-edit-slot],[data-story-lock-slot],[data-story-edit-block],[data-story-select-block],[data-story-retry-save],[data-story-integrate]",
    );
    if (!hit) return;
    const el = hit instanceof HTMLElement ? hit : t;

    try {
      if (el.matches("[data-story-close]")) {
        onClose?.();
        return;
      }
      if (el.matches("[data-story-integrate]")) {
        const { integrateMasterOutline } = await import("../../shared/master-outline-integrator.js");
        const { openCurrentCreatorMasterOutlineWorkbench } = await import("./creator-master-outline-workbench.js");
        root.__storyMechState = integrateMasterOutline(root.__storyMechState);
        await persistState(root, { reason: "交织骨架已写入并保存" });
        await openCurrentCreatorMasterOutlineWorkbench({
          worldId: currentWorldId() || "",
          projectStoryState: root.__storyMechState,
        });
        return;
      }
      if (el.matches("[data-story-retry-save]")) {
        await persistState(root, { reason: "已重试保存" });
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
          listStoryTemplates({ familyId: ui.familyId }).find((x) => x.contentMaturity === "COMPLETE") ||
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
        render(root);
        await persistState(root, { reason: "已生成并保存" });
        return;
      }
      if (el.matches("[data-story-accept]")) {
        const block = activeBlock(root.__storyMechState, ui);
        if (!block) return;
        root.__storyMechState = acceptStoryBlock(root.__storyMechState, block.id);
        ui.mode = "basket";
        render(root);
        await persistState(root, { reason: "已放入积木篮并保存" });
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
        render(root);
        await persistState(root, { reason: "已换结构并保存" });
        return;
      }
      if (el.matches("[data-story-swap-slot]")) {
        const block = activeBlock(root.__storyMechState, ui);
        if (!block) return;
        const key = el.getAttribute("data-story-swap-slot");
        root.__storyMechState = swapStorySlot(root.__storyMechState, block.id, key);
        render(root);
        await persistState(root, { reason: `已换「${key}」并保存` });
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
        render(root);
        await persistState(root, { reason: `已手改「${slot?.label || key}」并保存` });
        return;
      }
      if (el.matches("[data-story-lock-slot]")) {
        const block = activeBlock(root.__storyMechState, ui);
        if (!block) return;
        const key = el.getAttribute("data-story-lock-slot");
        const nextLocked = el.getAttribute("data-story-lock-next") !== "0";
        root.__storyMechState = lockStorySlot(root.__storyMechState, block.id, key, nextLocked);
        render(root);
        await persistState(root, { reason: nextLocked ? `已锁定「${key}」并保存` : `已解锁「${key}」并保存` });
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
