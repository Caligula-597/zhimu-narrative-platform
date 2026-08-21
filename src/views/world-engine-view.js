import { formatAction } from "../../shared/world-engine/index.js";
import { escapeHtml } from "../utils/format.js";
import { renderWorkspaceEditor } from "../components/workspace-editor.js";
import {
  writerToolContextPanelHtml,
  writerToolGridPageHtml,
  writerToolGuidanceHtml
} from "./writer-tool-layout.js";

function venuesHtml(venues = [], selected) {
  return venues.map((venue) => `<label class="world-engine-venue">
    <input type="radio" name="world-engine-venue" value="${escapeHtml(venue.key)}" ${venue.key === selected ? "checked" : ""}>
    <span><strong>${escapeHtml(venue.label)}</strong><small>${escapeHtml(venue.summary || "")}</small></span>
  </label>`).join("");
}

function candidateHtml(candidate, ledger) {
  const actions = (candidate.actions || []).map((action) => escapeHtml(formatAction(action, ledger))).join("；");
  return `<article class="world-engine-card">
    <p>${actions || "无动作"}</p>
    <div class="writer-story-inline-actions">
      <button type="button" class="primary-btn" data-action="world-engine-commit" data-candidate-id="${escapeHtml(candidate.candidateId)}">留下</button>
      <button type="button" class="text-btn" data-action="world-engine-lower" data-action-type="${escapeHtml(candidate.actions?.[0]?.type || "")}">降低这类</button>
    </div>
  </article>`;
}

function eventHtml(event, ledger) {
  const actions = (event.actions || []).map((action) => escapeHtml(formatAction(action, ledger))).join("；");
  return `<li><strong>${escapeHtml(event.eventId)}</strong> ${actions}</li>`;
}

function scriptHtml(session) {
  const scripts = session.view?.scripts || {};
  const entries = Object.entries(scripts);
  if (!entries.length) return `<div class="empty-state">还没有角色正文。世界可玩后再写。</div>`;
  return entries.map(([key, script]) => {
    const audits = (script.audits || []).map((hit) => `<li>${escapeHtml(hit.code)}：${escapeHtml(hit.excerpt)}</li>`).join("");
    return `<article class="world-engine-script"><header>${escapeHtml(key)}</header>
      <pre>${escapeHtml(script.text || "")}</pre>
      ${audits ? `<ul class="world-engine-audits">${audits}</ul>` : ""}
    </article>`;
  }).join("");
}

export function worldEngineWorkspaceHtml(data, session) {
  const view = session.view || { venues: [] };
  const seed = view.seed || session.draft || {};
  const playable = view.playability?.playable;
  const context = writerToolContextPanelHtml({
    kicker: "WORLD ENGINE V6",
    title: "世界引擎",
    intro: "先选定场所底盘，再挑选可能发生过的事。程序负责让留下的事继续为真。正文模型不能补剧情。",
    facts: [
      { label: "场所", value: seed.venueKey || "未选定" },
      { label: "事件", value: view.eventLog?.length || 0 },
      { label: "可玩", value: playable ? "动作循环已编译" : "先建立底盘" }
    ],
    bodyHtml: writerToolGuidanceHtml({
      title: "权限",
      text: "AI 只提出候选事件、可选误导和正文。钱、权限、痕迹和可操作动作全部由程序编译。"
    }),
    className: "world-engine-context"
  });
  const body = `<div class="world-engine-source">
    <fieldset class="world-engine-seed">
      <legend>创作方向</legend>
      ${venuesHtml(view.venues || [], seed.venueKey || "photo_studio")}
      <label>人数 <input type="number" min="4" max="8" data-engine-field="playerCount" value="${escapeHtml(String(seed.playerCount || 6))}"></label>
      <label>狗血 1-6 <input type="number" min="1" max="6" data-engine-field="dramaLevel" value="${escapeHtml(String(seed.dramaLevel || 3))}"></label>
      <label>最先想到的 <input type="text" data-engine-field="inspiration" maxlength="800" value="${escapeHtml(seed.inspiration || "")}" placeholder="婚纱影楼 / 一个特别爱钱的人"></label>
      <label>不要出现 <input type="text" data-engine-field="banned" maxlength="800" value="${escapeHtml(seed.banned || "")}"></label>
      <button type="button" class="secondary-btn" data-action="world-engine-seed">${session.savingAction === "seed" ? "正在建立底盘…" : "建立世界底盘"}</button>
    </fieldset>
    ${view.characters?.length ? `<section><h3>底盘人物</h3><p>${view.characters.map((row) => escapeHtml(`${row.name}·${row.roleKey}`)).join("、")}</p>
      <p>可操作动作 ${view.playability?.operationalCount || 0} 种${playable ? "。已经能玩，不必先写正文。" : ""}</p></section>` : ""}
    <section>
      <div class="writer-story-inline-actions">
        <button type="button" class="primary-btn" data-action="world-engine-search" ${view.characters?.length ? "" : "disabled"}>${session.savingAction === "search" ? "正在搜索事件…" : "提出可能发生过的事"}</button>
        <button type="button" class="secondary-btn" data-action="world-engine-epistemic" ${view.eventLog?.length ? "" : "disabled"}>${session.savingAction === "epistemic" ? "正在搜索误导…" : "提出误导（可选）"}</button>
      </div>
      <div class="world-engine-cards">${(view.candidates?.items || []).map((item) => candidateHtml(item, view)).join("") || "<p class=\"muted-note\">留下的事件会进入账本，后面不能被模型改写。</p>"}</div>
    </section>
    <section>
      <h3>已确认历史</h3>
      <ul>${(view.eventLog || []).map((event) => eventHtml(event, view)).join("") || "<li>还没有 Canonical Event</li>"}</ul>
    </section>
    <section>
      <h3>第一幕正文</h3>
      <div class="world-engine-render-row">${(view.characters || []).map((row) => `<button type="button" class="secondary-btn" data-action="world-engine-render" data-character-id="${escapeHtml(row.id)}">${escapeHtml(row.name)}</button>`).join("")}</div>
      ${scriptHtml(session)}
    </section>
  </div>`;
  return writerToolGridPageHtml({
    type: "world-engine",
    className: "world-engine-workspace",
    wide: true,
    contextHtml: context,
    contentHtml: renderWorkspaceEditor({
      title: "从方向生成世界",
      kicker: "SEED · SELECT · COMPILE · RENDER",
      intro: "不要从凶手和线索开始。先让这个地方能营业，再决定哪些事成为历史。",
      body,
      submitAction: "",
      cancelAction: "writer-tool-close",
      cancelLabel: session.discardArmed ? "再次点击放弃方向" : "返回创作中心",
      className: "world-engine-editor",
      status: session.error ? `<strong>未完成</strong><p>${escapeHtml(session.error)}</p>` : ""
    })
  });
}
