/**
 * 整母稿 · Master Outline Integrator Workbench V1
 * 左阶段 / 中剧情块 / 右负载与冲突；支持局部调整后保存。
 */

import "./creator-master-outline-workbench.css";
import {
  getProjectStoryState as apiGetProjectStoryState,
  saveProjectStoryState as apiSaveProjectStoryState,
} from "../api/project-story-state.js";
import {
  integrateMasterOutline,
  listAcceptedStoryBlocks,
  moveOutlineBeat,
  mergeOutlineBeats,
  setConflictDecision,
  splitWeaveLink,
  proposeWeaveBetweenBeats,
  writeMasterOutlineDraft,
} from "../../shared/master-outline-integrator.js";
import { createInitialProjectStoryState } from "../../shared/story-mechanism-engine.js";

const SAVE = { IDLE: "idle", SAVING: "saving", SAVED: "saved", ERROR: "error" };

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function worldIdOf(root) {
  return root.__outlineWorldId || root.closest("[data-world-id]")?.getAttribute("data-world-id") || "";
}

async function persist(root, { reason } = {}) {
  const worldId = worldIdOf(root);
  const ui = root.__outlineUi;
  if (!worldId) {
    ui.saveStatus = SAVE.IDLE;
    ui.message = reason || "本地预览（无世界 id，未落库）";
    return;
  }
  ui.saveStatus = SAVE.SAVING;
  render(root);
  try {
    const saved = await apiSaveProjectStoryState(worldId, root.__outlineState);
    root.__outlineState = saved?.state || root.__outlineState;
    ui.saveStatus = SAVE.SAVED;
    ui.message = reason || "已保存交织结果";
  } catch (err) {
    ui.saveStatus = SAVE.ERROR;
    ui.message = err?.message || "保存失败";
  }
  render(root);
}

function saveHtml(ui) {
  if (ui.saveStatus === SAVE.SAVING) return `<span class="outline-save is-saving">保存中…</span>`;
  if (ui.saveStatus === SAVE.ERROR) return `<span class="outline-save is-error">保存失败 · <button type="button" data-outline-retry>重试</button></span>`;
  if (ui.saveStatus === SAVE.SAVED) return `<span class="outline-save is-saved">已保存</span>`;
  return `<span class="outline-save">未保存</span>`;
}

function weaveLabel(kind) {
  const map = {
    WEAVE_STRONG: "真正交织·目标对撞",
    WEAVE_SHARED_ACTION: "真正交织·共享行动",
    WEAVE_SHARED_SCENE: "同场并列（不算真正交织）",
    WEAVE_SHARED_CHARACTER: "角色重合（不算真正交织）",
    WEAVE_CAUSAL: "真正交织·因果",
    WEAVE_WEAK: "同场提示",
    KEEP_PARALLEL: "保持平行",
  };
  return map[kind] || kind;
}

function relationLabel(q) {
  const map = {
    INTERWOVEN: "真正交织",
    COLOCATED: "同场并列",
    PARALLEL: "保持平行",
  };
  return map[q] || q || "";
}

function render(root) {
  const state = root.__outlineState;
  const ui = root.__outlineUi;
  const draft = state?.masterOutlineDraft;
  const accepted = listAcceptedStoryBlocks(state || {});

  if (!draft) {
    root.innerHTML = `<section class="creator-master-outline-workbench" aria-label="整母稿">
      <header class="outline-head">
        <div>
          <p>整母稿</p>
          <h2>交织骨架</h2>
          <span>先从积木篮接受结构，再点「尝试交织成整本骨架」。</span>
        </div>
        ${saveHtml(ui)}
      </header>
      <p class="outline-empty">已接受 ${accepted.length} 条积木。${accepted.length ? "可立即交织。" : "请先回到剧情积木篮生成并接受。"}</p>
      <div class="outline-actions">
        <button type="button" class="primary-btn" data-outline-integrate ${accepted.length ? "" : "disabled"}>尝试交织成整本骨架</button>
        <button type="button" class="secondary-btn" data-outline-close>返回</button>
      </div>
      ${ui.message ? `<p class="outline-msg">${escapeHtml(ui.message)}</p>` : ""}
    </section>`;
    return;
  }

  const stages = draft.stages || [];
  const activeStage = stages.find((s) => s.id === ui.activeStageId) || stages[0];
  if (activeStage) ui.activeStageId = activeStage.id;

  const stageNav = stages
    .map(
      (s) =>
        `<button type="button" class="outline-stage-tab ${s.id === ui.activeStageId ? "active" : ""}" data-outline-stage="${escapeHtml(s.id)}">${escapeHtml(s.label)}<small>${s.beats.length}</small></button>`,
    )
    .join("");

  const beatsHtml = (activeStage?.beats || [])
    .map((b) => {
      const selected = ui.selectedBeatIds.includes(b.id);
      const agency =
        b.semantics?.goal && b.semantics?.action
          ? `${b.semantics.actorLabel || "角色"} → ${b.semantics.goal}`
          : b.needsDetail
            ? "NEEDS_DETAIL"
            : "";
      return `<article class="outline-beat ${selected ? "is-selected" : ""} ${b.weaveGroupId ? "is-woven" : ""}" data-outline-beat="${escapeHtml(b.id)}">
        <header>
          <strong>${escapeHtml(b.blockTitle || b.templateId)}</strong>
          <span>${escapeHtml(b.familyId)}</span>
        </header>
        <p>${escapeHtml(b.summary)}</p>
        ${agency ? `<p class="outline-agency">${escapeHtml(agency)}</p>` : ""}
        <footer>${(b.characterIds || []).map((id) => `<code>${escapeHtml(id)}</code>`).join(" ")}${b.weaveGroupId ? " · 交织组" : ""}</footer>
      </article>`;
    })
    .join("") || `<p class="outline-empty">本阶段暂无剧情块</p>`;

  const weaves = (draft.weaveLinks || [])
    .filter((l) => l.status !== "SPLIT")
    .slice(0, 12)
    .map(
      (l) => `<li class="outline-weave outline-weave--${escapeHtml(l.relationQuality || "PARALLEL")}">
        <strong>${escapeHtml(relationLabel(l.relationQuality))} · ${escapeHtml(weaveLabel(l.kind))}</strong>
        <span class="outline-weave-why">WHY：${escapeHtml(l.reason)}</span>
        <button type="button" data-outline-split="${escapeHtml(l.id)}">拆开</button>
      </li>`,
    )
    .join("");

  const loads = (draft.characterLoadReport || [])
    .slice(0, 8)
    .map((r) => {
      const roles = (r.roles || []).map((x) => `${x.narrativeRole || x.slotId}`).join("、");
      return `<li><strong>${escapeHtml(r.name)}</strong> · 负载 ${r.totalLoad}<br/><small>${escapeHtml(roles)}</small></li>`;
    })
    .join("");

  const conflicts = (draft.conflictReport || [])
    .map((c) => {
      const decided = c.decision ? ` · 已${c.decision === "ACCEPT" ? "接受" : c.decision === "IGNORE" ? "忽略" : "待调整"}` : "";
      return `<article class="outline-conflict">
        <p>⚠ ${escapeHtml(c.summary)}${escapeHtml(decided)}</p>
        <div class="outline-conflict-actions">
          <button type="button" data-outline-conflict="${escapeHtml(c.id)}" data-decision="ACCEPT">接受</button>
          <button type="button" data-outline-conflict="${escapeHtml(c.id)}" data-decision="ADJUST">调整</button>
          <button type="button" data-outline-conflict="${escapeHtml(c.id)}" data-decision="IGNORE">暂时忽略</button>
        </div>
      </article>`;
    })
    .join("") || `<p class="outline-empty">暂无冲突</p>`;

  const moveOptions = stages
    .filter((s) => s.id !== ui.activeStageId)
    .map((s) => `<button type="button" data-outline-move-to="${escapeHtml(s.id)}">移到${escapeHtml(s.label)}</button>`)
    .join("");

  root.innerHTML = `<section class="creator-master-outline-workbench" aria-label="整母稿交织预览">
    <header class="outline-head">
      <div>
        <p>整母稿 · 先编排后写作</p>
        <h2>剧情骨架预览</h2>
        <span>来源 revision ${draft.sourceStoryStateRevision} · ${draft.sourceBlockIds?.length || 0} 条积木 · ${draft.status}</span>
      </div>
      <div class="outline-head-meta">${saveHtml(ui)}
        <button type="button" class="secondary-btn" data-outline-integrate>重新交织</button>
        <button type="button" class="secondary-btn" data-outline-close>返回</button>
      </div>
    </header>
    <div class="outline-grid">
      <aside class="outline-col outline-stages">${stageNav}</aside>
      <main class="outline-col outline-main">
        <div class="outline-toolbar">
          <button type="button" data-outline-merge ${ui.selectedBeatIds.length === 2 ? "" : "disabled"}>尝试合并场景</button>
          <button type="button" data-outline-propose-weave ${ui.selectedBeatIds.length === 2 ? "" : "disabled"}>尝试交织</button>
          ${moveOptions}
          <small>点选 1～2 个剧情块后操作</small>
        </div>
        <div class="outline-beats">${beatsHtml}</div>
      </main>
      <aside class="outline-col outline-side">
        <h3>交织关系</h3>
        <ul class="outline-weave-list">${weaves || "<li class='outline-empty'>暂无交织边</li>"}</ul>
        <h3>角色负载</h3>
        <ul class="outline-load-list">${loads || "<li class='outline-empty'>—</li>"}</ul>
        <h3>待确认</h3>
        <div class="outline-conflicts">${conflicts}</div>
      </aside>
    </div>
    ${ui.message ? `<p class="outline-msg" role="status">${escapeHtml(ui.message)}</p>` : ""}
  </section>`;
}

function patchDraft(root, mutator) {
  const draft = root.__outlineState.masterOutlineDraft;
  const nextDraft = mutator(draft);
  root.__outlineState = writeMasterOutlineDraft(root.__outlineState, nextDraft);
}

async function onClick(root, event) {
  const el = event.target.closest("[data-outline-close],[data-outline-integrate],[data-outline-retry],[data-outline-stage],[data-outline-beat],[data-outline-merge],[data-outline-propose-weave],[data-outline-move-to],[data-outline-split],[data-outline-conflict]");
  if (!el) return;
  const ui = root.__outlineUi;

  if (el.matches("[data-outline-close]")) {
    root.hidden = true;
    root.innerHTML = "";
    return;
  }
  if (el.matches("[data-outline-retry]")) {
    await persist(root, { reason: "已重试保存" });
    return;
  }
  if (el.matches("[data-outline-integrate]")) {
    try {
      root.__outlineState = integrateMasterOutline(root.__outlineState);
      ui.activeStageId = root.__outlineState.masterOutlineDraft?.stages?.[0]?.id || "";
      ui.selectedBeatIds = [];
      ui.message = "已完成结构编排（未调用长文写作）";
      render(root);
      await persist(root, { reason: "交织结果已保存" });
    } catch (err) {
      ui.message = err?.message || "交织失败";
      render(root);
    }
    return;
  }
  if (el.matches("[data-outline-stage]")) {
    ui.activeStageId = el.getAttribute("data-outline-stage");
    render(root);
    return;
  }
  if (el.matches("[data-outline-beat]")) {
    const id = el.getAttribute("data-outline-beat");
    if (ui.selectedBeatIds.includes(id)) {
      ui.selectedBeatIds = ui.selectedBeatIds.filter((x) => x !== id);
    } else if (ui.selectedBeatIds.length >= 2) {
      ui.selectedBeatIds = [ui.selectedBeatIds[1], id];
    } else {
      ui.selectedBeatIds = [...ui.selectedBeatIds, id];
    }
    render(root);
    return;
  }
  if (el.matches("[data-outline-merge]")) {
    const [a, b] = ui.selectedBeatIds;
    try {
      patchDraft(root, (d) => mergeOutlineBeats(d, a, b));
      ui.message = "已合并为同场";
      render(root);
      await persist(root);
    } catch (err) {
      ui.message = err?.message || "合并失败";
      render(root);
    }
    return;
  }
  if (el.matches("[data-outline-propose-weave]")) {
    const [a, b] = ui.selectedBeatIds;
    try {
      patchDraft(root, (d) => proposeWeaveBetweenBeats(d, a, b));
      ui.message = "已添加交织";
      render(root);
      await persist(root);
    } catch (err) {
      ui.message = err?.message || "交织失败";
      render(root);
    }
    return;
  }
  if (el.matches("[data-outline-move-to]")) {
    const beatId = ui.selectedBeatIds[0];
    if (!beatId) return;
    try {
      patchDraft(root, (d) => moveOutlineBeat(d, beatId, el.getAttribute("data-outline-move-to")));
      ui.message = "已移动剧情块";
      render(root);
      await persist(root);
    } catch (err) {
      ui.message = err?.message || "移动失败";
      render(root);
    }
    return;
  }
  if (el.matches("[data-outline-split]")) {
    try {
      patchDraft(root, (d) => splitWeaveLink(d, el.getAttribute("data-outline-split")));
      ui.message = "已拆开交织";
      render(root);
      await persist(root);
    } catch (err) {
      ui.message = err?.message || "拆开失败";
      render(root);
    }
    return;
  }
  if (el.matches("[data-outline-conflict]")) {
    try {
      patchDraft(root, (d) =>
        setConflictDecision(d, el.getAttribute("data-outline-conflict"), el.getAttribute("data-decision")),
      );
      ui.message = "已记录冲突决定";
      render(root);
      await persist(root);
    } catch (err) {
      ui.message = err?.message || "操作失败";
      render(root);
    }
  }
}

export async function openCurrentCreatorMasterOutlineWorkbench({ worldId, projectStoryState } = {}) {
  const host =
    document.querySelector(".creator-cockpit .cockpit-core-canvas") ||
    document.querySelector("[data-creator-canvas]") ||
    document.body;
  let root = host.querySelector(".creator-master-outline-workbench-host");
  if (!root) {
    root = document.createElement("div");
    root.className = "creator-master-outline-workbench-host";
    host.appendChild(root);
  }
  root.hidden = false;
  root.__outlineWorldId = worldId || host.getAttribute("data-world-id") || "";
  root.__outlineUi = {
    saveStatus: SAVE.IDLE,
    message: "",
    activeStageId: "",
    selectedBeatIds: [],
  };

  if (projectStoryState) {
    root.__outlineState = projectStoryState;
  } else if (root.__outlineWorldId) {
    try {
      const payload = await apiGetProjectStoryState(root.__outlineWorldId);
      root.__outlineState = payload?.state || createInitialProjectStoryState(root.__outlineWorldId);
    } catch {
      root.__outlineState = createInitialProjectStoryState(root.__outlineWorldId);
      root.__outlineUi.message = "未能加载积木篮，已用空白状态打开";
    }
  } else {
    root.__outlineState = createInitialProjectStoryState("local-outline");
  }

  if (!root.__outlineBound) {
    root.__outlineBound = true;
    root.addEventListener("click", (ev) => onClick(root, ev));
  }
  render(root);
  return root;
}
