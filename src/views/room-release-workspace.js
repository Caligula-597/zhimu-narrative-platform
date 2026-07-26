import * as zhimuApi from "../api/index.js";
import { normalizeError } from "../components/status-ui.js";
import { showToast } from "../components/toast.js";
import { escapeHtml } from "../utils/format.js";

const RELEASE_DOMAIN_LABELS = Object.freeze({
  roles: "角色",
  chapters: "章节",
  sections: "私人分幕",
  scenes: "场景",
  clues: "线索",
  investigationPoints: "调查点",
  items: "物品",
  rules: "自动化规则",
  segments: "主持流程段",
  segmentRefs: "流程引用",
  playerTasks: "玩家任务",
  edges: "剧情关系",
  truthClaims: "真相事实",
  roleRelationships: "角色关系",
  roleArchives: "角色档案",
  foreshadowBeats: "伏笔",
  timelineEvents: "时间线",
  assetManifest: "素材",
  tags: "标签"
});

export function emptyRoomReleaseChange() {
  return {
    roomId: "",
    targetReleaseId: "",
    status: "idle",
    impact: null,
    error: ""
  };
}

export function roomReleaseId(room) {
  return room?.contentBinding?.release?.id || "";
}

export function availableRoomReleaseTargets(room, releases = []) {
  const currentReleaseId = roomReleaseId(room);
  return releases.filter((release) => release.id !== currentReleaseId);
}

export function reconcileRoomReleaseChange(state) {
  if (
    state.releaseChange.roomId
    && !state.rooms.some((room) => room.id === state.releaseChange.roomId)
  ) {
    state.releaseChange = emptyRoomReleaseChange();
  } else if (
    state.releaseChange.targetReleaseId
    && !state.releases.some((release) => release.id === state.releaseChange.targetReleaseId)
  ) {
    state.releaseChange = {
      ...state.releaseChange,
      targetReleaseId: "",
      status: "idle",
      impact: null,
      error: ""
    };
  }
}

function releaseIssueList(title, issues, tone) {
  if (!issues.length) return "";
  return `<div class="room-release-issues ${tone}"><strong>${title}</strong>${issues
    .map((issue) => `<p>${escapeHtml(issue.message)}</p>`)
    .join("")}</div>`;
}

function releaseDomainDiff(impact) {
  const changedDomains = Object.entries(impact?.comparison?.domains || {})
    .filter(([, value]) => Object.values(value.counts || {}).some((count) => Number(count) > 0))
    .slice(0, 12);
  if (!changedDomains.length) {
    return `<p class="muted-note">两个版本没有对象级内容差异。</p>`;
  }
  return `<div class="room-release-domain-list">${changedDomains.map(([key, value]) =>
    `<span>${escapeHtml(RELEASE_DOMAIN_LABELS[key] || key)}：+${Number(value.counts?.added) || 0} / −${Number(value.counts?.removed) || 0} / 改${Number(value.counts?.changed) || 0}</span>`
  ).join("")}</div>`;
}

function releaseImpactBody(impact) {
  if (!impact) {
    return `<p class="muted-note">先生成影响预览；系统会核对对象差异、已分配角色和所有运行记录。</p>`;
  }
  const summary = impact.comparison?.summary;
  const blockers = impact.runtimeImpact?.blockers || [];
  const warnings = impact.runtimeImpact?.warnings || [];
  return `
    <div class="room-release-impact-summary ${impact.allowed ? "ready" : "blocked"}">
      <strong>${impact.allowed ? "可以安全切换" : "当前不能原地切换"}</strong>
      <p>对象差异：新增 ${Number(summary?.added) || 0} · 移除 ${Number(summary?.removed) || 0} · 修改 ${Number(summary?.changed) || 0}；运行记录 ${Number(impact.runtimeImpact?.runtimeActivityCount) || 0} 条。</p>
    </div>
    ${releaseIssueList("阻塞原因", blockers, "blocked")}
    ${releaseIssueList("需要确认", warnings, "warning")}
    ${releaseDomainDiff(impact)}
  `;
}

export function renderRoomReleaseChangePanel(room, state) {
  const change = state.releaseChange;
  if (change.roomId !== room.id) return "";
  const targetOptions = availableRoomReleaseTargets(room, state.releases).map((release) =>
    `<option value="${escapeHtml(release.id)}" ${change.targetReleaseId === release.id ? "selected" : ""}>R${Number(release.releaseNumber) || "?"} · ${escapeHtml(release.label)}</option>`
  ).join("");
  const impact = change.impact;
  return `<section class="room-release-change-panel" aria-live="polite">
    <div class="section-head"><div><strong>切换运行版本</strong><p>只允许未开始且没有运行数据的房间原地换版。</p></div><button type="button" class="text-btn" data-action="room-release-close" data-room-id="${escapeHtml(room.id)}">收起</button></div>
    <div class="room-release-change-controls">
      <label>目标 Release
        <select class="field" data-room-release-target data-room-id="${escapeHtml(room.id)}" ${change.status === "loading" || change.status === "applying" ? "disabled" : ""}>${targetOptions}</select>
      </label>
      <button type="button" class="secondary-btn" data-action="room-release-preview" data-room-id="${escapeHtml(room.id)}" ${!change.targetReleaseId || change.status === "loading" || change.status === "applying" ? "disabled" : ""}>${change.status === "loading" ? "正在评估…" : "生成影响预览"}</button>
    </div>
    ${change.error ? `<div class="workspace-inline-error" role="alert"><p>${escapeHtml(change.error)}</p></div>` : ""}
    ${releaseImpactBody(impact)}
    ${impact ? `<div class="room-release-change-actions"><button type="button" class="primary-btn" data-action="room-release-apply" data-room-id="${escapeHtml(room.id)}" ${!impact.allowed || change.status === "applying" ? "disabled" : ""}>${change.status === "applying" ? "正在切换…" : `确认切换到 R${Number(impact.targetRelease?.releaseNumber) || "?"}`}</button></div>` : ""}
  </section>`;
}

export function bindRoomReleaseTargetFields(root, state, render) {
  root.querySelectorAll("[data-room-release-target]").forEach((field) => {
    field.addEventListener("change", () => {
      if (state.releaseChange.roomId !== field.dataset.roomId) return;
      state.releaseChange = {
        ...state.releaseChange,
        targetReleaseId: field.value,
        status: "idle",
        impact: null,
        error: ""
      };
      render();
    });
  });
}

export function createRoomReleaseChangeController({ getState, isCurrent, render }) {
  function open(roomId) {
    const state = getState();
    const room = state.rooms.find((item) => item.id === roomId);
    if (!room) return;
    const target = availableRoomReleaseTargets(room, state.releases)[0];
    if (!target) {
      state.error = "当前没有其他可切换的 Release";
      render();
      return;
    }
    state.releaseChange = {
      roomId,
      targetReleaseId: target.id,
      status: "idle",
      impact: null,
      error: ""
    };
    render();
  }

  function close(roomId) {
    const state = getState();
    if (state.releaseChange.roomId !== roomId) return;
    state.releaseChange = emptyRoomReleaseChange();
    render();
  }

  async function preview(roomId) {
    const state = getState();
    const targetReleaseId = state.releaseChange.roomId === roomId
      ? state.releaseChange.targetReleaseId
      : "";
    if (!targetReleaseId || state.releaseChange.status === "loading") return;
    state.releaseChange = {
      ...state.releaseChange,
      status: "loading",
      impact: null,
      error: ""
    };
    render();
    try {
      const impact = await zhimuApi.getRoomReleaseImpact(
        state.worldId,
        roomId,
        targetReleaseId
      );
      if (
        !isCurrent(state)
        || state.releaseChange.roomId !== roomId
        || state.releaseChange.targetReleaseId !== targetReleaseId
      ) return;
      state.releaseChange = {
        ...state.releaseChange,
        status: "ready",
        impact,
        error: ""
      };
    } catch (error) {
      if (!isCurrent(state) || state.releaseChange.roomId !== roomId) return;
      state.releaseChange = {
        ...state.releaseChange,
        status: "error",
        impact: null,
        error: normalizeError(error, "版本影响评估失败")
      };
    }
    render();
  }

  async function confirm(roomId) {
    const state = getState();
    const change = state.releaseChange;
    const impact = change.roomId === roomId ? change.impact : null;
    if (!impact?.allowed || change.status === "applying") return;
    state.releaseChange = { ...change, status: "applying", error: "" };
    render();
    try {
      const updated = await zhimuApi.applyRoomRelease(state.worldId, roomId, {
        releaseId: impact.targetRelease.id,
        expectedCurrentReleaseId: impact.currentBinding?.release?.id || null,
        targetContentSha256: impact.targetRelease.contentSha256,
        impactFingerprint: impact.fingerprint
      });
      if (!isCurrent(state)) return;
      state.rooms = state.rooms.map((room) => room.id === roomId
        ? { ...room, ...updated }
        : room);
      state.releaseChange = emptyRoomReleaseChange();
      render();
      showToast(`已切换到 R${Number(impact.targetRelease.releaseNumber) || "?"}；三端将同步刷新`);
    } catch (error) {
      if (!isCurrent(state) || state.releaseChange.roomId !== roomId) return;
      state.releaseChange = {
        ...state.releaseChange,
        status: "error",
        error: normalizeError(error, "运行版本切换失败；请重新生成影响预览")
      };
      render();
    }
  }

  return { open, close, preview, confirm };
}
