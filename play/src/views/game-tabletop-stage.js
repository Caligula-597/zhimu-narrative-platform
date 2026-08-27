import { escapeHtml } from "../../../shared/security.js";
import {
  formatLocationDiscoveryCount,
  normalizeLocationDiscoveryCopy,
} from "../../../shared/location-discovery.js";
import { clueIsRead } from "../utils/clues.js";
import {
  authorizedCluesForLocation,
  clueArchiveCode,
} from "./location-clue-deck.js";

const LOCATION_SCAN_MS = 3200;
const discoverySessions = new Map();

function diceLabel(dice = {}) {
  const modifier = Number(dice.modifier) || 0;
  return `${Number(dice.count) || 1}d${Number(dice.sides) || 20}${modifier ? modifier > 0 ? `+${modifier}` : modifier : ""}`;
}

function renderPlayerTabletopCheck(check) {
  if (!check) return "";
  const pending = check.status === "pending" || !check.result;
  const mode = { normal: "普通判定", advantage: "优势判定", disadvantage: "劣势判定" }[check.rollMode] || "普通判定";
  if (pending) {
    return `<section class="player-stage-check is-pending" data-player-tabletop-check aria-live="polite">
      <div><p class="eyebrow">主持人发起判定</p><h4>${escapeHtml(check.label)}</h4><p>${escapeHtml(check.instruction)}</p></div>
      <div class="player-stage-check-target"><strong>${escapeHtml(diceLabel(check.dice))}</strong><span>目标 ${check.target}</span><small>${mode}${Number(check.bonus) ? ` · 加值 ${Number(check.bonus) > 0 ? "+" : ""}${Number(check.bonus)}` : ""}</small></div>
      <p class="player-stage-check-wait">先说明你的行动方式，等待主持人公开掷骰。</p>
    </section>`;
  }
  const result = check.result;
  const appliedChanges = Array.isArray(check.appliedChanges) ? check.appliedChanges : [];
  return `<section class="player-stage-check ${result.success ? "is-success" : "is-failure"}" data-player-tabletop-check aria-live="polite">
    <div><p class="eyebrow">公开判定结果</p><h4>${escapeHtml(check.label)}</h4><p>${escapeHtml(check.outcomeText)}</p></div>
    <div class="player-stage-check-result"><span>${escapeHtml(result.degreeLabel)}</span><strong>${result.rolls.join(" + ")}${Number(result.total) !== Number(result.rawTotal) ? ` → ${result.total}` : ` = ${result.total}`}</strong><small>目标 ${result.target} · 差值 ${result.margin >= 0 ? "+" : ""}${result.margin}</small></div>
    ${check.appliedAt ? `<div class="player-stage-check-changes" data-player-tabletop-check-changes><strong>故事状态已更新</strong>${appliedChanges.length ? appliedChanges.map((change) => `<span>${escapeHtml(change.label)} <b>${Number(change.delta) > 0 ? "+" : ""}${Number(change.delta)}</b></span>`).join("") : `<span>主持人已确认本次结果</span>`}</div>` : `<p class="player-stage-check-wait">结果已公开，等待主持人确认对故事状态的影响。</p>`}
  </section>`;
}

function renderPlayerTabletopEncounter(encounter) {
  if (!encounter || encounter.status !== "active" || !encounter.npcs?.length) return "";
  return `<section class="player-stage-encounter" data-player-tabletop-encounter aria-live="polite">
    <div><p class="eyebrow">遭遇已触发</p><h4>${escapeHtml(encounter.locationName)}</h4><p>保持在当前场景，等待主持人推进遭遇。</p></div>
    <div class="player-stage-encounter-roster">${encounter.npcs.map((npc) => `<span><strong>${escapeHtml(npc.name)}</strong><small>${escapeHtml(npc.role || "NPC")} · HP ${npc.hp}/${npc.maxHp}</small></span>`).join("")}</div>
  </section>`;
}

function renderPlayerTabletopEnding(ending) {
  if (!ending) return "";
  return `<section class="player-stage-ending is-${escapeHtml(ending.tone)}" data-player-tabletop-ending aria-live="polite">
    <p class="eyebrow">主持人公开结局导向</p>
    <h4>${escapeHtml(ending.name)}</h4>
    <p>${escapeHtml(ending.summary)}</p>
    <small>这是当前故事走向，主持人仍可结合现场演绎完成最终收束。</small>
  </section>`;
}

function discoveryKey(location, context = {}) {
  return [
    String(context.roomId || "room"),
    String(context.roleSlotId || "role"),
    String(location?.id || "location"),
    String(location?.segmentKey || location?.segment_key || ""),
  ].join(":");
}

function scanDelay() {
  if (typeof window === "undefined") return null;
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? 0 : LOCATION_SCAN_MS;
  } catch {
    return LOCATION_SCAN_MS;
  }
}

function notifyDiscoveryReady() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("zhimu:tabletop-discovery-ready"));
}

function emitDiscoveryAction(session, action) {
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    window.dispatchEvent(new CustomEvent("zhimu:tabletop-discovery-action", {
      detail: {
        action,
        locationId: session.locationId,
        expectedRevision: Number(session.remote?.revision) || 0,
        resolve,
        reject,
      },
    }));
  });
}

function scheduleDiscovery(session) {
  const delay = scanDelay();
  if (delay === null || session.remote?.phase !== "scanning" || session.timer || session.readyRequested) return;
  session.timer = window.setTimeout(() => {
    session.timer = null;
    session.readyRequested = true;
    void emitDiscoveryAction(session, "scan_ready")
      .then(() => notifyDiscoveryReady())
      .catch(() => {
        session.readyRequested = false;
      });
  }, delay);
}

export function discoveryNeedsReconciliation(remote, clues = []) {
  if (!remote || remote.phase !== "complete" || Number(remote.remainingCount) > 0) return false;
  const drawnClueIds = new Set((remote.drawnClueIds || []).map((id) => String(id)));
  return clues.some((clue) => clue?.id != null && !drawnClueIds.has(String(clue.id)));
}

function ensureDiscoverySession(location, context = {}, clues = []) {
  const key = discoveryKey(location, context);
  let session = discoverySessions.get(key);
  if (!session) {
    session = {
      key,
      locationId: String(location?.id || ""),
      remote: null,
      timer: null,
      startRequested: false,
      readyRequested: false,
      reconcileSignature: "",
    };
    discoverySessions.set(key, session);
  }
  const remote = (context.discoverySessions || []).find(
    (candidate) => String(candidate.locationId) === session.locationId
  ) || null;
  if (remote && Number(remote.revision) !== Number(session.remote?.revision)) {
    session.readyRequested = false;
  }
  session.remote = remote;
  if (!remote && !session.startRequested && typeof window !== "undefined") {
    session.startRequested = true;
    queueMicrotask(() => {
      void emitDiscoveryAction(session, "scan_started").catch(() => {
        session.startRequested = false;
      });
    });
  }
  if (remote && discoveryNeedsReconciliation(remote, clues) && typeof window !== "undefined") {
    const authorizedSignature = clues.map((clue) => String(clue.id)).sort().join(",");
    const reconcileSignature = `${Number(remote.revision) || 0}:${authorizedSignature}`;
    if (session.reconcileSignature !== reconcileSignature) {
      session.reconcileSignature = reconcileSignature;
      queueMicrotask(() => {
        if (!discoveryNeedsReconciliation(session.remote, clues)) return;
        void emitDiscoveryAction(session, "scan_started").catch(() => {
          if (session.reconcileSignature === reconcileSignature) session.reconcileSignature = "";
        });
      });
    }
  } else {
    session.reconcileSignature = "";
  }
  scheduleDiscovery(session);
  return session;
}

function renderParty(party = []) {
  if (!party.length) return "";
  return `<div class="player-party-strip">${party.map((member) => {
    const hp = Math.max(0, Number(member.hp) || 0);
    const maxHp = Math.max(1, Number(member.maxHp) || 1);
    return `<div class="player-party-member"><div><strong>${escapeHtml(member.name)}</strong><span>HP ${hp}/${maxHp}</span></div><i style="--hp:${Math.round(hp / maxHp * 100)}%"><b></b></i></div>`;
  }).join("")}</div>`;
}

function renderClueBacks(location, count, copy) {
  return Array.from({ length: Math.min(3, count) }, (_, index) => `
    <div class="player-clue-back" style="--clue-index:${index}" aria-hidden="true">
      <span>${escapeHtml(clueArchiveCode(location, index))}</span><b>${escapeHtml(copy.archiveLabel)}</b>
    </div>`).join("");
}

function renderRevealedClue(clue, drawnCount, totalCount, key, copy) {
  if (!clue) return "";
  const read = clueIsRead(clue, { owned: clue.is_owner !== false });
  return `<article class="player-clue-revealed" data-player-location-clue aria-live="polite">
    <div class="player-clue-revealed-head"><span>${escapeHtml(copy.collectionLabel)}</span><small>已抽取 ${drawnCount} / ${totalCount}</small></div>
    <h5>${escapeHtml(clue.name)}</h5>
    <p>${escapeHtml(clue.public_text || "这条线索暂无公开说明。")}</p>
    <div class="player-clue-actions">
      ${read ? `<span class="player-clue-read">✓ 已标记阅读</span>` : `<button type="button" class="player-stage-button is-outline" data-action="read-clue" data-clue-id="${escapeHtml(clue.id)}">标记已读</button>`}
      ${drawnCount < totalCount ? `<button type="button" class="player-stage-button is-primary" data-action="tabletop-draw-clue" data-discovery-key="${escapeHtml(key)}">再抽一条</button>` : `<span class="player-clue-complete">本地点线索已全部抽取</span>`}
    </div>
  </article>`;
}

export function renderLocationDiscovery(location, clues, context) {
  const session = ensureDiscoverySession(location, context, clues);
  const remote = session.remote;
  const copy = normalizeLocationDiscoveryCopy(location?.discovery);
  const byId = new Map(clues.map((clue) => [String(clue.id), clue]));
  const drawnIds = remote?.drawnClueIds || [];
  const activeClue = byId.get(remote?.lastDrawnClueId || drawnIds.at(-1));
  const drawn = drawnIds.length;
  const remaining = remote ? Number(remote.remainingCount) || 0 : clues.length;
  const total = drawn + remaining;
  const unlocked = ["ready", "drawing", "complete"].includes(remote?.phase);
  const statusText = unlocked ? copy.unlockLabel : copy.scanLabel;
  const countLabel = formatLocationDiscoveryCount(copy, total);

  return `<section class="player-location-discovery ${unlocked ? "is-unlocked" : "is-scanning"}" data-player-location-discovery data-discovery-key="${escapeHtml(session.key)}" aria-busy="${unlocked ? "false" : "true"}">
    <div class="player-location-radar-shell">
      <div class="player-location-radar" aria-hidden="true"><i></i><b></b><span>12</span><span>3</span><span>6</span><span>9</span></div>
      <div class="player-location-radar-copy" role="status" aria-live="polite">
        <strong>${escapeHtml(statusText)}</strong>
        <span>${unlocked ? (total ? escapeHtml(countLabel) : "现场暂无线索") : escapeHtml(copy.scanHint)}</span>
        ${remote?.phase === "scanning" ? `<button type="button" class="player-scan-skip" data-action="tabletop-discovery-skip" data-discovery-key="${escapeHtml(session.key)}">立即揭示</button>` : ""}
      </div>
    </div>
    <div class="player-location-clue-summary">
      <div><strong>${total ? escapeHtml(countLabel) : "尚无可抽取线索"}</strong><span>${total ? "按顺序逐条抽取" : "等待主持人开放此场景"}</span></div>
      ${unlocked && remaining && !activeClue ? `<button type="button" class="player-stage-button is-primary" data-action="tabletop-draw-clue" data-discovery-key="${escapeHtml(session.key)}">抽取一条线索</button>` : ""}
      <small>已授权内容 · 不会提前揭示</small>
    </div>
    <div class="player-location-clue-deck ${activeClue ? "has-revealed-clue" : ""}">
      <div class="player-clue-deck-head"><strong>${activeClue ? escapeHtml(copy.collectionLabel) : `${escapeHtml(copy.collectionLabel)}（未抽取）`}</strong></div>
      ${activeClue ? renderRevealedClue(activeClue, drawn, total, session.key, copy) : `<div class="player-clue-backs">${renderClueBacks(location, total, copy)}</div>`}
    </div>
  </section>`;
}

export async function handlePlayerStageAction({ action, button, render, syncDiscovery }) {
  const key = String(button?.dataset?.discoveryKey || "");
  const session = discoverySessions.get(key);
  if (!session || !session.remote || typeof syncDiscovery !== "function") return false;
  let discoveryAction = "";
  if (action === "tabletop-discovery-skip") {
    if (session.timer) globalThis.clearTimeout(session.timer);
    session.timer = null;
    discoveryAction = "scan_ready";
  } else if (action === "tabletop-draw-clue") {
    if (!["ready", "drawing"].includes(session.remote.phase) || !session.remote.remainingCount) return true;
    discoveryAction = "clue_drawn";
  } else if (action === "tabletop-reshuffle-clues") {
    discoveryAction = "reshuffle";
  } else {
    return false;
  }
  await syncDiscovery({
    action: discoveryAction,
    locationId: session.locationId,
    expectedRevision: Number(session.remote.revision) || 0,
  });
  render?.();
  return true;
}

export function renderPlayerStageMap(map, context = {}) {
  if (!map) return "";
  const checkHtml = renderPlayerTabletopCheck(map.activeCheck);
  const encounterHtml = renderPlayerTabletopEncounter(map.activeEncounter);
  const endingHtml = renderPlayerTabletopEnding(map.publishedEnding);
  if (!map.visible || !map.locations?.length) {
    return checkHtml || encounterHtml || endingHtml ? `<section class="player-stage player-stage-check-only" aria-label="当前跑团状态">${endingHtml}${encounterHtml}${checkHtml}</section>` : "";
  }
  const locations = map.locations;
  const byId = new Map(locations.map((location) => [location.id, location]));
  const active = byId.get(map.activeLocationId) || map.activeLocation || locations[0];
  const clues = authorizedCluesForLocation(active, context.clues, context.sharedClues);
  const notation = diceLabel(map.dice);
  return `<section class="player-stage" aria-label="当前跑团地图">
    <div class="player-stage-head">
      <div><p class="eyebrow">当前场景地图</p><h3>${escapeHtml(map.title || "跑团地图")}</h3></div>
      <span class="player-stage-dice">${escapeHtml(notation)} · 默认难度 ${Number(map.dice?.defaultTarget) || 10}</span>
    </div>
    ${endingHtml}
    <div class="player-stage-events">${encounterHtml}${checkHtml}</div>
    <div class="player-stage-layout">
      <div class="player-stage-map" role="img" aria-label="已公开 ${locations.length} 个地点，当前位于${escapeHtml(active?.name || "未指定地点")}">
        <svg viewBox="0 0 100 100" aria-hidden="true">${(map.routes || []).map(([from, to]) => {
          const start = byId.get(from);
          const end = byId.get(to);
          return start && end ? `<line x1="${Number(start.x) * 100}" y1="${Number(start.y) * 100}" x2="${Number(end.x) * 100}" y2="${Number(end.y) * 100}"></line>` : "";
        }).join("")}</svg>
        ${locations.map((location, index) => `<div class="player-stage-node${location.id === active?.id ? " is-active" : ""}" style="--map-x:${Number(location.x) * 100}%;--map-y:${Number(location.y) * 100}%"><span>${index + 1}</span><b>${escapeHtml(location.name)}</b></div>`).join("")}
        <div class="player-stage-map-legend" aria-hidden="true"><span><i></i>已探索路径</span><span><i></i>可通往地点</span></div>
      </div>
      <div class="player-stage-current">
        <div class="player-stage-current-head"><div><span>${escapeHtml(active?.type || "当前地点")}</span><h4>${escapeHtml(active?.name || "等待主持人指定地点")}</h4></div>${renderParty(map.party)}</div>
        <p>${escapeHtml(active?.description || "主持人推进后，这里会显示当前地点说明。")}</p>
        ${renderLocationDiscovery(active, clues, context)}
      </div>
    </div>
  </section>`;
}
