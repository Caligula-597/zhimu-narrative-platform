/**
 * P7.0 Playable Compile Inspection — fixture → PlayableProject (no session runtime)
 */

import "./creator-playable-compile-workbench.css";
import {
  getPlayableProject as apiGetPlayableProject,
  compilePlayableFixture as apiCompilePlayableFixture,
} from "../api/playable-project.js";
import {
  compileWarehouseSixFixture,
  buildWarehouseSixFixture,
} from "../../shared/playable-project-compiler.js";
import { listContentUnitsForRole } from "../../shared/playable-project-contracts.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function worldIdOf(root) {
  return root.__ppWorldId || root.closest("[data-world-id]")?.getAttribute("data-world-id") || "";
}

function render(root) {
  const ui = root.__ppUi;
  const project = root.__ppProject;
  if (!project) {
    root.innerHTML = `<section class="creator-pp-workbench" aria-label="Playable 编译">
      <header class="pp-head">
        <div>
          <p>P7.0 · Playable Compiler</p>
          <h2>编译完整剧本</h2>
          <span>当前使用受控 fixture「商会库房案」· 不启动房间</span>
        </div>
      </header>
      <p class="pp-empty">尚未编译。可本地编译预览，或写入当前世界。</p>
      <div class="pp-actions">
        <button type="button" class="primary-btn" data-pp-compile-local>本地编译预览</button>
        <button type="button" class="secondary-btn" data-pp-compile-save ${worldIdOf(root) ? "" : "disabled"}>编译并保存到世界</button>
        <button type="button" class="secondary-btn" data-pp-close>返回</button>
      </div>
      ${ui.message ? `<p class="pp-msg">${escapeHtml(ui.message)}</p>` : ""}
    </section>`;
    return;
  }

  const errors = (project.diagnostics || []).filter((d) => d.severity === "ERROR");
  const warns = (project.diagnostics || []).filter((d) => d.severity === "WARN");
  const players = (project.roles || []).filter((r) => r.type === "PLAYER");
  const host = (project.roles || []).filter((r) => r.type === "HOST");
  const m03 = (project.mechanismPlacements || []).filter((m) => m.familyId === "M03");
  const m09 = (project.mechanismPlacements || []).filter((m) => m.familyId === "M09");

  const tab = ui.tab || "summary";
  const tabs = [
    ["summary", "总览"],
    ["roles", "角色"],
    ["stages", "阶段"],
    ["content", "内容"],
    ["clues", "线索"],
    ["mechs", "玩法"],
    ["sim", "模拟角色"],
    ["diag", "诊断"],
  ]
    .map(
      ([id, label]) =>
        `<button type="button" class="pp-tab ${tab === id ? "active" : ""}" data-pp-tab="${id}">${label}</button>`,
    )
    .join("");

  let body = "";
  if (tab === "summary") {
    body = `<table class="pp-table">
      <tr><th>状态</th><td><strong>${escapeHtml(project.status)}</strong>${project.isStale ? " · STALE" : ""}</td></tr>
      <tr><th>角色</th><td>${players.length} 玩家 + ${host.length} 主持</td></tr>
      <tr><th>阶段</th><td>${project.stages.length}</td></tr>
      <tr><th>内容单元</th><td>${project.contentUnits.length}</td></tr>
      <tr><th>线索</th><td>${project.clues.length}</td></tr>
      <tr><th>玩法</th><td>M03 ×${m03.length} · M09 ×${m09.length}</td></tr>
      <tr><th>诊断</th><td>${errors.length} error · ${warns.length} warning</td></tr>
      <tr><th>指纹</th><td><code>${escapeHtml(project.source?.fingerprint || "")}</code></td></tr>
    </table>`;
  } else if (tab === "roles") {
    body = `<ul class="pp-list">${(project.roles || [])
      .map((r) => `<li><strong>${escapeHtml(r.id)}</strong> ${escapeHtml(r.name)} · ${escapeHtml(r.type)}</li>`)
      .join("")}</ul>`;
  } else if (tab === "stages") {
    body = `<ul class="pp-list">${(project.stages || [])
      .map(
        (s) =>
          `<li><strong>${escapeHtml(s.title)}</strong> · content ${s.contentUnitIds.length} · clues ${s.clueIds.length} · mechs ${s.mechanismPlacementIds.length}</li>`,
      )
      .join("")}</ul>`;
  } else if (tab === "content") {
    body = `<ul class="pp-list">${(project.contentUnits || [])
      .slice(0, 40)
      .map(
        (c) =>
          `<li><strong>${escapeHtml(c.id)}</strong> [${escapeHtml(c.audience.visibility)}] ${escapeHtml(c.title || "")}<br/><small>${escapeHtml(c.content.slice(0, 80))}</small></li>`,
      )
      .join("")}</ul>`;
  } else if (tab === "clues") {
    body = `<ul class="pp-list">${(project.clues || [])
      .map(
        (c) =>
          `<li><strong>${escapeHtml(c.title)}</strong> → ${escapeHtml(c.contentUnitId)} · ${escapeHtml(c.stageId)} · ${escapeHtml(c.delivery)}</li>`,
      )
      .join("")}</ul>`;
  } else if (tab === "mechs") {
    body = `<ul class="pp-list">${(project.mechanismPlacements || [])
      .map(
        (m) =>
          `<li><strong>${escapeHtml(m.title)}</strong> ${escapeHtml(m.mechanismTemplateId)} @ ${escapeHtml(m.stageId)} · bindings ${m.outcomeBindings.length}</li>`,
      )
      .join("")}</ul>`;
  } else if (tab === "sim") {
    const roleId = ui.simRoleId || players[0]?.id || "";
    const options = players
      .map((r) => `<option value="${escapeHtml(r.id)}" ${r.id === roleId ? "selected" : ""}>${escapeHtml(r.name)}</option>`)
      .join("");
    const units = listContentUnitsForRole(project, roleId);
    body = `<label>模拟角色 <select data-pp-sim-role>${options}</select></label>
      <p class="pp-note">仅编译检查：列出该角色作为 audience 的 ContentUnit（非分幕 runtime gating）。</p>
      <ul class="pp-list">${units
        .map(
          (c) =>
            `<li><strong>${escapeHtml(c.stageId)}</strong> · ${escapeHtml(c.audience.visibility)} · ${escapeHtml(c.title || c.id)}<br/>${escapeHtml(c.content.slice(0, 120))}</li>`,
        )
        .join("")}</ul>`;
  } else {
    body = `<ul class="pp-list">${(project.diagnostics || [])
      .map((d) => `<li class="pp-${escapeHtml(d.severity)}"><strong>${escapeHtml(d.severity)}</strong> ${escapeHtml(d.code)} — ${escapeHtml(d.message)}</li>`)
      .join("") || "<li>无</li>"}</ul>`;
  }

  root.innerHTML = `<section class="creator-pp-workbench" aria-label="Playable 编译结果">
    <header class="pp-head">
      <div>
        <p>P7.0 · 编译检查</p>
        <h2>${escapeHtml(project.title)}</h2>
        <span>${escapeHtml(project.status)} · rev ${project.revision} · ${escapeHtml(project.source?.compiledAt || "")}</span>
      </div>
      <div class="pp-head-meta">
        <button type="button" class="secondary-btn" data-pp-compile-local>重新本地编译</button>
        <button type="button" class="secondary-btn" data-pp-compile-save ${worldIdOf(root) ? "" : "disabled"}>保存到世界</button>
        <button type="button" class="secondary-btn" data-pp-close>返回</button>
      </div>
    </header>
    <div class="pp-tabs">${tabs}</div>
    <div class="pp-body">${body}</div>
    ${ui.message ? `<p class="pp-msg" role="status">${escapeHtml(ui.message)}</p>` : ""}
  </section>`;
}

async function onClick(root, event) {
  const el = event.target.closest(
    "[data-pp-close],[data-pp-compile-local],[data-pp-compile-save],[data-pp-tab]",
  );
  if (!el) return;
  const ui = root.__ppUi;

  if (el.matches("[data-pp-close]")) {
    root.hidden = true;
    root.innerHTML = "";
    return;
  }
  if (el.matches("[data-pp-tab]")) {
    ui.tab = el.getAttribute("data-pp-tab");
    render(root);
    return;
  }
  if (el.matches("[data-pp-compile-local]")) {
    root.__ppProject = compileWarehouseSixFixture({
      worldId: worldIdOf(root) || undefined,
      now: () => new Date().toISOString(),
    });
    ui.message = `本地编译完成 · ${root.__ppProject.status} · ${root.__ppProject.diagnostics.filter((d) => d.severity === "ERROR").length} error`;
    ui.tab = "summary";
    render(root);
    return;
  }
  if (el.matches("[data-pp-compile-save]")) {
    const worldId = worldIdOf(root);
    if (!worldId) {
      ui.message = "无世界 id，仅可本地预览";
      render(root);
      return;
    }
    try {
      ui.message = "编译保存中…";
      render(root);
      const saved = await apiCompilePlayableFixture(worldId, {
        fixtureId: buildWarehouseSixFixture().metadata.fixtureId,
      });
      root.__ppProject = saved?.project || null;
      ui.message = "已编译并保存到世界";
      render(root);
    } catch (err) {
      ui.message = err?.message || "保存失败";
      render(root);
    }
  }
}

function onChange(root, event) {
  const el = event.target.closest("[data-pp-sim-role]");
  if (!el) return;
  root.__ppUi.simRoleId = el.value;
  render(root);
}

export async function openCurrentCreatorPlayableCompileWorkbench({ worldId } = {}) {
  const host =
    document.querySelector(".creator-playable-compile-host") ||
    (() => {
      const cockpit = document.querySelector(".creator-cockpit .cockpit-core-canvas") || document.body;
      const el = document.createElement("div");
      el.className = "creator-playable-compile-host";
      cockpit.appendChild(el);
      return el;
    })();

  const wid = worldId || host.closest("[data-world-id]")?.getAttribute("data-world-id") || "";
  host.hidden = false;
  host.__ppWorldId = wid;
  host.__ppUi = { message: "", tab: "summary", simRoleId: "" };
  host.__ppProject = null;

  if (!host.__ppBound) {
    host.__ppBound = true;
    host.addEventListener("click", (ev) => onClick(host, ev));
    host.addEventListener("change", (ev) => onChange(host, ev));
  }

  if (wid) {
    try {
      const loaded = await apiGetPlayableProject(wid);
      if (loaded?.project) host.__ppProject = loaded.project;
    } catch {
      /* local ok */
    }
  }

  if (!host.__ppProject) {
    host.__ppProject = compileWarehouseSixFixture({
      worldId: wid || undefined,
      now: () => "2026-09-05T00:00:00.000Z",
    });
    host.__ppUi.message = "已加载本地 fixture 编译预览";
  }

  render(host);
}
