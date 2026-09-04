/**
 * P6.0 详细生产母稿 Workbench — Deterministic expand of MasterOutlineDraft
 */

import "./creator-production-master-draft-workbench.css";
import {
  getProjectStoryState as apiGetProjectStoryState,
  saveProjectStoryState as apiSaveProjectStoryState,
} from "../api/project-story-state.js";
import {
  expandAndWriteProductionMasterDraft,
  applyContentEdit,
  proposeStructureEdit,
  writeProductionMasterDraft,
  markProductionDraftStaleIfNeeded,
} from "../../shared/production-master-draft-expander.js";
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
  return root.__pmdWorldId || root.closest("[data-world-id]")?.getAttribute("data-world-id") || "";
}

async function persist(root, { reason } = {}) {
  const worldId = worldIdOf(root);
  const ui = root.__pmdUi;
  if (!worldId) {
    ui.saveStatus = SAVE.IDLE;
    ui.message = reason || "本地预览（无世界 id，未落库）";
    return;
  }
  ui.saveStatus = SAVE.SAVING;
  render(root);
  try {
    const saved = await apiSaveProjectStoryState(worldId, root.__pmdState);
    root.__pmdState = saved?.state || root.__pmdState;
    ui.saveStatus = SAVE.SAVED;
    ui.message = reason || "已保存详细母稿";
  } catch (err) {
    ui.saveStatus = SAVE.ERROR;
    ui.message = err?.message || "保存失败";
  }
  render(root);
}

function saveHtml(ui) {
  if (ui.saveStatus === SAVE.SAVING) return `<span class="pmd-save is-saving">保存中…</span>`;
  if (ui.saveStatus === SAVE.ERROR)
    return `<span class="pmd-save is-error">保存失败 · <button type="button" data-pmd-retry>重试</button></span>`;
  if (ui.saveStatus === SAVE.SAVED) return `<span class="pmd-save is-saved">已保存</span>`;
  return `<span class="pmd-save">未保存</span>`;
}

function qualityLabel(q) {
  if (q === "INTERWOVEN") return "真正交织";
  if (q === "COLOCATED") return "同场并列";
  if (q === "PARALLEL") return "保持平行";
  return "";
}

function render(root) {
  const state = markProductionDraftStaleIfNeeded(root.__pmdState || {});
  root.__pmdState = state;
  const ui = root.__pmdUi;
  const draft = state.productionMasterDraft;
  const hasOutline = Boolean(state.masterOutlineDraft);

  if (!draft) {
    root.innerHTML = `<section class="creator-pmd-workbench" aria-label="详细母稿">
      <header class="pmd-head">
        <div>
          <p>整母稿 · 详细展开</p>
          <h2>生产母稿</h2>
          <span>把交织骨架忠实展开成可审阅正文（不调用 AI）</span>
        </div>
        ${saveHtml(ui)}
      </header>
      <p class="pmd-empty">${hasOutline ? "尚未展开。可立即从当前交织骨架生成。" : "请先完成交织骨架。"}</p>
      <div class="pmd-actions">
        <button type="button" class="primary-btn" data-pmd-expand ${hasOutline ? "" : "disabled"}>展开详细母稿</button>
        <button type="button" class="secondary-btn" data-pmd-close>返回</button>
      </div>
      ${ui.message ? `<p class="pmd-msg">${escapeHtml(ui.message)}</p>` : ""}
    </section>`;
    return;
  }

  const stages = draft.stages || [];
  const active = stages.find((s) => s.stageId === ui.activeStageId) || stages[0];
  if (active) ui.activeStageId = active.stageId;

  const stageNav = stages
    .map(
      (s) =>
        `<button type="button" class="pmd-stage-tab ${s.stageId === ui.activeStageId ? "active" : ""}" data-pmd-stage="${escapeHtml(s.stageId)}">${escapeHtml(s.title)}<small>${s.beats.length}</small></button>`,
    )
    .join("");

  const beatsHtml =
    (active?.beats || [])
      .map((b) => {
        const q = qualityLabel(b.relationQuality);
        const notes = (b.relationNotes || []).map((n) => `<li>${escapeHtml(n)}</li>`).join("");
        return `<article class="pmd-beat ${b.needsDetail ? "is-needs" : ""}" data-pmd-beat="${escapeHtml(b.id)}">
          <header>
            <strong>${escapeHtml(b.actors?.[0]?.name || "角色")}</strong>
            ${q ? `<span class="pmd-q pmd-q--${escapeHtml(b.relationQuality)}">${escapeHtml(q)}</span>` : ""}
            ${b.contentConfirmed ? "<span class='pmd-ok'>已确认</span>" : ""}
          </header>
          <p class="pmd-prose">${escapeHtml(b.eventSummary)}</p>
          <p class="pmd-meta">目标：${escapeHtml(b.goal || "—")} · 行动：${escapeHtml(b.action || "—")}</p>
          <p class="pmd-meta">后果：${escapeHtml(b.immediateConsequence || "UNKNOWN")}</p>
          ${notes ? `<ul class="pmd-notes">${notes}</ul>` : ""}
          <div class="pmd-beat-actions">
            <button type="button" data-pmd-confirm="${escapeHtml(b.id)}">标记已确认</button>
            <button type="button" data-pmd-edit="${escapeHtml(b.id)}">编辑段落</button>
            <button type="button" data-pmd-structure="${escapeHtml(b.sourceOutlineBeatId)}" data-stage="${escapeHtml(active.stageId)}">提出结构调整</button>
          </div>
        </article>`;
      })
      .join("") || `<p class="pmd-empty">本阶段暂无正文</p>`;

  const warnings = (draft.warnings || [])
    .slice(0, 12)
    .map((w) => `<li><strong>${escapeHtml(w.type)}</strong> ${escapeHtml(w.message)}</li>`)
    .join("");

  const chars = (draft.characterViews?.characters || [])
    .slice(0, 8)
    .map((c) => `<li><strong>${escapeHtml(c.name)}</strong> · ${c.stages.length} 阶段有行动</li>`)
    .join("");

  const clues = (draft.clueView?.clues || [])
    .slice(0, 10)
    .map(
      (c) =>
        `<li>${escapeHtml(c.label || c.clueId)}${c.missingDetail ? " · <em>缺具体内容</em>" : ""}</li>`,
    )
    .join("");

  const reqs = (draft.structureChangeRequests || [])
    .filter((r) => r.status === "PROPOSED")
    .slice(0, 8)
    .map(
      (r) =>
        `<li><strong>${escapeHtml(r.type)}</strong> ${escapeHtml(r.proposal || r.reason)} <small>（仅提议，未改结构）</small></li>`,
    )
    .join("");

  const staleBanner =
    draft.status === "STALE"
      ? `<p class="pmd-stale" role="status">剧情结构已修改，需要重新展开受影响内容。</p>`
      : "";

  const viewTabs = ["正文", "真相", "角色", "线索", "主持"]
    .map((label, i) => {
      const id = ["prose", "truth", "chars", "clues", "exec"][i];
      return `<button type="button" class="pmd-view-tab ${ui.view === id ? "active" : ""}" data-pmd-view="${id}">${label}</button>`;
    })
    .join("");

  let mainBody = "";
  if (ui.view === "truth") {
    mainBody = `<ul class="pmd-list">${(draft.truthView?.events || [])
      .filter((e) => e.stageId === active?.stageId)
      .map(
        (e) =>
          `<li><strong>${escapeHtml(e.whatHappened)}</strong><br/>为何：${escapeHtml(e.why)} · 后果：${escapeHtml(e.consequence)}${e.isMisleading ? " · 误导" : ""}</li>`,
      )
      .join("")}</ul>`;
  } else if (ui.view === "chars") {
    mainBody = `<ul class="pmd-list">${(draft.characterViews?.characters || [])
      .map((c) => {
        const st = c.stages.find((s) => s.stageId === active?.stageId);
        if (!st) return "";
        return `<li><strong>${escapeHtml(c.name)}</strong><br/>目标：${escapeHtml(st.goal)} · 行动：${escapeHtml(st.action)} · 知道：${escapeHtml(st.knows)}</li>`;
      })
      .filter(Boolean)
      .join("")}</ul>`;
  } else if (ui.view === "clues") {
    mainBody = `<ul class="pmd-list">${(draft.clueView?.clues || [])
      .filter((c) => c.stageId === active?.stageId)
      .map(
        (c) =>
          `<li>${escapeHtml(c.label)} · 支持：${escapeHtml(c.supportsFact)}${c.detailNote ? `<br/><em>${escapeHtml(c.detailNote)}</em>` : ""}</li>`,
      )
      .join("")}</ul>`;
  } else if (ui.view === "exec") {
    const ex = (draft.executionView?.stages || []).find((s) => s.stageId === active?.stageId);
    mainBody = ex
      ? `<div class="pmd-exec">
          <p><strong>开场状态</strong> ${escapeHtml(ex.openingState)}</p>
          <p><strong>本幕目标</strong> ${escapeHtml(ex.stageGoal)}</p>
          <p><strong>推进节点</strong> ${escapeHtml((ex.beatsToAdvance || []).join("、"))}</p>
          <p><strong>下场前应变</strong> ${escapeHtml(ex.requiredStateBeforeNext)}</p>
          <p class="pmd-meta">GAME 插槽预留 ${(ex.gameMechanismSlots || []).length} 处（本轮不接 runtime）</p>
        </div>`
      : `<p class="pmd-empty">—</p>`;
  } else {
    mainBody = `<div class="pmd-beats">${beatsHtml}</div>
      <p class="pmd-stage-summary"><strong>玩家侧</strong> ${escapeHtml(active?.playerVisibleSummary || "—")}</p>
      <p class="pmd-stage-summary"><strong>主持侧</strong> ${escapeHtml(active?.hostTruthSummary || "—")}</p>`;
  }

  root.innerHTML = `<section class="creator-pmd-workbench" aria-label="详细生产母稿">
    <header class="pmd-head">
      <div>
        <p>整母稿 · 详细展开（确定性）</p>
        <h2>${escapeHtml(draft.title || "生产母稿")}</h2>
        <span>story rev ${draft.sourceStoryStateRevision} · 状态 ${escapeHtml(draft.status)} · draft rev ${draft.revision}</span>
      </div>
      <div class="pmd-head-meta">${saveHtml(ui)}
        <button type="button" class="secondary-btn" data-pmd-expand>重新展开</button>
        <button type="button" class="secondary-btn" data-pmd-close>返回</button>
      </div>
    </header>
    ${staleBanner}
    <div class="pmd-view-tabs">${viewTabs}</div>
    <div class="pmd-grid">
      <aside class="pmd-col pmd-stages">${stageNav}</aside>
      <main class="pmd-col pmd-main">${mainBody}</main>
      <aside class="pmd-col pmd-side">
        <h3>警告</h3>
        <ul class="pmd-list">${warnings || "<li class='pmd-empty'>无</li>"}</ul>
        <h3>角色</h3>
        <ul class="pmd-list">${chars || "<li class='pmd-empty'>—</li>"}</ul>
        <h3>线索</h3>
        <ul class="pmd-list">${clues || "<li class='pmd-empty'>—</li>"}</ul>
        <h3>结构调整提议</h3>
        <ul class="pmd-list">${reqs || "<li class='pmd-empty'>无（P6 不会自动改结构）</li>"}</ul>
      </aside>
    </div>
    ${ui.message ? `<p class="pmd-msg" role="status">${escapeHtml(ui.message)}</p>` : ""}
  </section>`;
}

async function onClick(root, event) {
  const el = event.target.closest(
    "[data-pmd-close],[data-pmd-expand],[data-pmd-retry],[data-pmd-stage],[data-pmd-view],[data-pmd-confirm],[data-pmd-edit],[data-pmd-structure]",
  );
  if (!el) return;
  const ui = root.__pmdUi;

  if (el.matches("[data-pmd-close]")) {
    root.hidden = true;
    root.innerHTML = "";
    return;
  }
  if (el.matches("[data-pmd-retry]")) {
    await persist(root);
    return;
  }
  if (el.matches("[data-pmd-expand]")) {
    try {
      root.__pmdState = expandAndWriteProductionMasterDraft(root.__pmdState);
      ui.activeStageId = root.__pmdState.productionMasterDraft?.stages?.[0]?.stageId || "";
      ui.message = "已忠实展开（未调用 AI，未改交织结构）";
      render(root);
      await persist(root, { reason: "详细母稿已保存" });
    } catch (err) {
      ui.message = err?.message || "展开失败";
      render(root);
    }
    return;
  }
  if (el.matches("[data-pmd-stage]")) {
    ui.activeStageId = el.getAttribute("data-pmd-stage");
    render(root);
    return;
  }
  if (el.matches("[data-pmd-view]")) {
    ui.view = el.getAttribute("data-pmd-view");
    render(root);
    return;
  }
  if (el.matches("[data-pmd-confirm]")) {
    const id = el.getAttribute("data-pmd-confirm");
    const draft = applyContentEdit(root.__pmdState.productionMasterDraft, id, {
      contentConfirmed: true,
    });
    root.__pmdState = writeProductionMasterDraft(root.__pmdState, draft);
    ui.message = "已标记确认（CONTENT_EDIT）";
    render(root);
    await persist(root);
    return;
  }
  if (el.matches("[data-pmd-edit]")) {
    const id = el.getAttribute("data-pmd-edit");
    const beat = root.__pmdState.productionMasterDraft.stages
      .flatMap((s) => s.beats)
      .find((b) => b.id === id);
    const next = window.prompt("编辑段落（CONTENT_EDIT，不改结构）", beat?.eventSummary || "");
    if (next == null) return;
    const draft = applyContentEdit(root.__pmdState.productionMasterDraft, id, {
      eventSummary: next,
    });
    root.__pmdState = writeProductionMasterDraft(root.__pmdState, draft);
    ui.message = "段落已更新（未改交织骨架）";
    render(root);
    await persist(root);
    return;
  }
  if (el.matches("[data-pmd-structure]")) {
    const beatId = el.getAttribute("data-pmd-structure");
    const stageId = el.getAttribute("data-stage");
    const draft = proposeStructureEdit(root.__pmdState.productionMasterDraft, {
      type: "MOVE_BEAT",
      sourceBeatIds: [beatId],
      sourceStageIds: [stageId],
      reason: "用户在详细母稿中提出结构调整",
      proposal: "请回到交织骨架移动该剧情块；P6 仅记录提议，不自动应用。",
      severity: "info",
    });
    root.__pmdState = writeProductionMasterDraft(root.__pmdState, draft);
    ui.message = "已生成结构调整提议（需回交织骨架处理）";
    render(root);
    await persist(root);
  }
}

export async function openCurrentCreatorProductionMasterDraftWorkbench({
  worldId,
  projectStoryState,
  expandNow = false,
} = {}) {
  const host =
    document.querySelector(".creator-production-master-draft-host") ||
    (() => {
      const cockpit = document.querySelector(".creator-cockpit .cockpit-core-canvas") || document.body;
      const el = document.createElement("div");
      el.className = "creator-production-master-draft-host";
      cockpit.appendChild(el);
      return el;
    })();

  let state = projectStoryState;
  if (!state && worldId) {
    try {
      const loaded = await apiGetProjectStoryState(worldId);
      state = loaded?.state;
    } catch {
      state = null;
    }
  }
  state = state || createInitialProjectStoryState({ projectId: "local-preview" });

  host.hidden = false;
  host.__pmdWorldId = worldId || "";
  host.__pmdState = state;
  host.__pmdUi = {
    saveStatus: SAVE.IDLE,
    message: "",
    activeStageId: state.productionMasterDraft?.stages?.[0]?.stageId || "",
    view: "prose",
  };

  if (!host.__pmdBound) {
    host.__pmdBound = true;
    host.addEventListener("click", (ev) => onClick(host, ev));
  }

  if (expandNow || !state.productionMasterDraft) {
    if (state.masterOutlineDraft) {
      try {
        host.__pmdState = expandAndWriteProductionMasterDraft(host.__pmdState);
        host.__pmdUi.activeStageId =
          host.__pmdState.productionMasterDraft?.stages?.[0]?.stageId || "";
        host.__pmdUi.message = "已忠实展开详细母稿";
        render(host);
        await persist(host, { reason: "详细母稿已保存" });
        return;
      } catch (err) {
        host.__pmdUi.message = err?.message || "展开失败";
      }
    }
  }

  render(host);
}
