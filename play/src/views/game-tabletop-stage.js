import { escapeHtml } from "../../../shared/security.js";

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

export function renderPlayerStageMap(map) {
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
  const notation = diceLabel(map.dice);
  return `<section class="player-stage" aria-label="当前跑团地图">
    <div class="player-stage-head">
      <div><p class="eyebrow">当前场景地图</p><h3>${escapeHtml(map.title || "跑团地图")}</h3></div>
      <span class="player-stage-dice">${escapeHtml(notation)} · 默认难度 ${Number(map.dice?.defaultTarget) || 10}</span>
    </div>
    ${endingHtml}
    ${encounterHtml}
    ${checkHtml}
    <div class="player-stage-layout">
      <div class="player-stage-map" role="img" aria-label="已公开 ${locations.length} 个地点，当前位于${escapeHtml(active?.name || "未指定地点")}">
        <svg viewBox="0 0 100 100" aria-hidden="true">${(map.routes || []).map(([from, to]) => {
          const start = byId.get(from);
          const end = byId.get(to);
          return start && end ? `<line x1="${Number(start.x) * 100}" y1="${Number(start.y) * 100}" x2="${Number(end.x) * 100}" y2="${Number(end.y) * 100}"></line>` : "";
        }).join("")}</svg>
        ${locations.map((location, index) => `<div class="player-stage-node${location.id === active?.id ? " is-active" : ""}" style="--map-x:${Number(location.x) * 100}%;--map-y:${Number(location.y) * 100}%"><span>${index + 1}</span><b>${escapeHtml(location.name)}</b></div>`).join("")}
      </div>
      <div class="player-stage-current">
        <span>${escapeHtml(active?.type || "当前地点")}</span>
        <h4>${escapeHtml(active?.name || "等待主持人指定地点")}</h4>
        <p>${escapeHtml(active?.description || "主持人推进后，这里会显示当前地点说明。")}</p>
        ${map.party?.length ? `<div class="player-party-strip">${map.party.map((member) => {
          const hp = Math.max(0, Number(member.hp) || 0);
          const maxHp = Math.max(1, Number(member.maxHp) || 1);
          return `<div class="player-party-member"><div><strong>${escapeHtml(member.name)}</strong><span>HP ${hp}/${maxHp}</span></div><i style="--hp:${Math.round(hp / maxHp * 100)}%"><b></b></i></div>`;
        }).join("")}</div>` : ""}
      </div>
    </div>
  </section>`;
}
