import { escapeHtml } from "../../../shared/security.js";
import { getRoomId } from "../session.js";
import { state } from "../state.js";

export function activeRuntimeRoom() {
  const roomId = getRoomId();
  if (!roomId) return null;
  return state.rooms.find((r) => r.id === roomId) || state.room || null;
}

export function stat(icon, num, label, sub) {
  return `<article class="stat-card"><div class="stat-icon">${icon}</div><strong>${num}</strong><span>${label} · ${sub}</span></article>`;
}

export function activity(text, time, type) {
  return `<div class="activity ${type}"><i class="dot"></i><div><p>${text}</p><small>${time}</small></div></div>`;
}

export function cloudStatus() {
  const panelMsg = state.apiError || (state.loading ? "正在读取云端…" : "● 云端已连接");
  const rooms = state.rooms || [];
  return `<section class="demo-strip cloud-status-strip"><div><span class="cloud-pill">${state.apiError ? "提示" : "● 主持端"}</span><strong style="margin-top:7px">${escapeHtml(panelMsg)}</strong><p>${rooms.length ? `当前世界 ${rooms.length} 个平行房。` : "请选择剧本与平行房。"}</p></div><button class="secondary-btn" type="button" data-action="refresh-host-data">刷新</button></section>`;
}

export function runtimeEmpty(title, description) {
  const world = state.studio?.world;
  return `${cloudStatus()}<article class="card runtime-empty"><p class="eyebrow">RUNTIME REQUIRED</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p><div class="tutorial-tip"><b>${escapeHtml(world?.name || "当前世界")}</b><span>在下方选择平行运行房后，监控台会载入玩家进度与待确认事件。</span></div><button class="primary-btn" type="button" data-action="go-pick-room">选择平行房</button></article>`;
}
