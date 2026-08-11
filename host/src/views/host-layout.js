import { state } from "../state.js";
import { escapeHtml, formatRelativeTime } from "../utils/format.js";
import { resolveChapterSegmentKey, segmentRunbookFromOperations } from "../../../shared/segment-contract.js";
import { hostVoiceRoster, hostVoiceStatusLabel } from "../runtime/host-voice-controller.js";

function paceClock(pace = {}) {
  let elapsed = pace.elapsedMs || 0;
  if (pace.running && pace.startedAt) elapsed += Date.now() - pace.startedAt;
  const ms = pace.mode === "count-up" ? elapsed : Math.max(0, (pace.targetMs || 0) - elapsed);
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function legacyRunbooks() {
  const settings = state.studio?.world?.settings || {};
  return settings.matrixSync?.hostRunbooks || settings.hostRunbooks || [];
}

function segmentRunbooks() {
  return (state.cloudWorldSegments || [])
    .map((segment) => segmentRunbookFromOperations(segment))
    .filter(Boolean);
}

export function hostRunbooks() {
  const byKey = new Map();
  for (const book of segmentRunbooks()) {
    byKey.set(book.actKey || book.segmentKey, book);
  }
  for (const book of legacyRunbooks()) {
    const key = book.actKey || book.segmentKey || book.key || "";
    if (key && !byKey.has(key)) byKey.set(key, book);
  }
  return [...byKey.values()];
}

export function hostChapterActKey(chapter) {
  return resolveChapterSegmentKey(chapter);
}

function hostActs() {
  const chapters = (state.studio?.chapters || []).slice().sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  const byKey = new Map();
  for (const chapter of chapters) {
    const key = hostChapterActKey(chapter);
    byKey.set(key, {
      key,
      title: chapter.title || key,
      chapter,
      sequence: chapter.sequence || byKey.size + 1,
      runbook: null
    });
  }
  for (const book of hostRunbooks()) {
    const key = book.actKey || book.segmentKey || book.key || "";
    if (!key) continue;
    const existing = byKey.get(key) || { key, title: book.title || key, chapter: null, sequence: byKey.size + 1 };
    existing.title = book.title || existing.title;
    existing.sequence = book.sequence || existing.sequence;
    existing.runbook = book;
    byKey.set(key, existing);
  }
  for (const remedy of state.cloudHostSegmentRemedies || []) {
    const key = remedy.segment_key;
    if (!key || byKey.has(key)) continue;
    byKey.set(key, { key, title: remedy.title || key, chapter: null, sequence: byKey.size + 1, runbook: null });
  }
  return [...byKey.values()].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
}

function activeAct(preferredActKey = "") {
  const acts = hostActs();
  if (!acts.length) return null;
  const selected = state.hostSelectedActKey || preferredActKey;
  return acts.find((act) => act.key === selected) || acts[0];
}

function clueName(clueId) {
  const clue = (state.studio?.clues || []).find((item) => String(item.id) === String(clueId));
  return clue?.name || clueId || "未指定线索";
}

function clueById(clueId) {
  return (
    (state.cloudHostClueMatrix?.clues || []).find((item) => String(item.id) === String(clueId)) ||
    (state.studio?.clues || []).find((item) => String(item.id) === String(clueId)) ||
    null
  );
}

function grantModeLabel(mode) {
  return { auto: "自动发放", host_confirm: "主持确认", explore: "探索获得" }[mode] || mode || "未标注";
}

function roleLabel(roleKey) {
  if (!roleKey) return "全场";
  const players = state.cloudHostClueMatrix?.players || state.cloudHostPlayers || [];
  const match = players.find((player) =>
    [player.role_key, player.roleKey, player.role_slot_id, player.role_name, player.name]
      .filter(Boolean)
      .some((value) => String(value) === String(roleKey))
  );
  return match?.role_name || match?.name || roleKey;
}

function grantStatus(grant) {
  const clueId = grant.clueId || grant.clue_id;
  const roleKey = grant.roleKey || grant.role_key;
  const matrix = state.cloudHostClueMatrix;
  if (!matrix?.cells || !clueId) return { label: "待核对", tone: "draft" };
  const players = matrix.players || [];
  const targetPlayers = roleKey
    ? players.filter((player) =>
        [player.role_key, player.roleKey, player.role_slot_id, player.role_name, player.name]
          .filter(Boolean)
          .some((value) => String(value) === String(roleKey))
      )
    : players.filter((player) => player.joined);
  const roleSlotIds = targetPlayers.map((player) => player.role_slot_id).filter(Boolean);
  if (!roleSlotIds.length) return { label: "待匹配角色", tone: "testing" };
  const ownedCount = roleSlotIds.filter((roleSlotId) => matrix.cells?.[clueId]?.[roleSlotId]?.owned).length;
  if (ownedCount === roleSlotIds.length) return { label: "已发放", tone: "published" };
  if (ownedCount > 0) return { label: `${ownedCount}/${roleSlotIds.length} 已发`, tone: "testing" };
  return { label: "待发放", tone: "draft" };
}

function actSelector(acts, current) {
  if (!acts.length) return "";
  return `<div class="host-act-tabs" role="tablist" aria-label="选择当前幕">
    ${acts
      .map(
        (act) => `<button type="button" role="tab" aria-selected="${act.key === current?.key ? "true" : "false"}" class="host-act-tab ${act.key === current?.key ? "is-active" : ""}" data-action="host-select-act" data-act-key="${escapeHtml(act.key)}">${escapeHtml(act.title)}</button>`
      )
      .join("")}
  </div>`;
}

function renderRunbook(act) {
  const book = act?.runbook;
  if (!book) {
    return `<div class="host-current-empty">当前幕没有主持手册。可先按章节控场，后续由 Matrix/Segment 生成 runbook。</div>`;
  }
  const flow = String(book.flow || "").trim();
  const hostTruth = String(book.hostTruth || "").trim();
  return `<div class="host-current-runbook">
    ${flow ? `<section><p class="section-kicker">流程</p><p>${escapeHtml(flow)}</p></section>` : ""}
    ${hostTruth ? `<section><p class="section-kicker">上帝视角</p><p>${escapeHtml(hostTruth)}</p></section>` : ""}
  </div>`;
}

function renderClueGrants(act) {
  const grants = Array.isArray(act?.runbook?.clueGrants) ? act.runbook.clueGrants : [];
  if (!grants.length) {
    return `<div class="host-current-empty">当前幕没有配置应发线索。需要临场处理时可使用手动发线索。</div>`;
  }
  return `<div class="host-current-list">
    ${grants
      .map((grant) => {
        const clueId = grant.clueId || grant.clue_id;
        const clue = clueById(clueId);
        const status = grantStatus(grant);
        const grantMode = clue?.metadata?.grantMode || clue?.grantMode || "auto";
        return `<article class="host-current-item host-clue-grant-item">
          <div class="host-current-item-head">
            <strong>${escapeHtml(clue?.name || clueName(clueId))}</strong>
            <span class="status-chip ${escapeHtml(status.tone)}">${escapeHtml(status.label)}</span>
          </div>
          <p>${escapeHtml(grant.when || grant.timing || "未标注发放时机")}</p>
          <div class="host-grant-meta">
            <span>${escapeHtml(roleLabel(grant.roleKey || grant.role_key))}</span>
            <span>${escapeHtml(grantModeLabel(grantMode))}</span>
          </div>
          <button class="secondary-btn host-grant-now-btn" type="button" data-action="host-manual-grant-clue" data-act-key="${escapeHtml(act?.key || "")}" data-clue-id="${escapeHtml(clueId || "")}" data-role-key="${escapeHtml(grant.roleKey || grant.role_key || "")}">发放这条</button>
        </article>`
      })
      .join("")}
  </div>`;
}

function renderPlayerTasks(act) {
  const tasks = Array.isArray(act?.runbook?.playerTasks) ? act.runbook.playerTasks.filter(Boolean) : [];
  if (!tasks.length) return "";
  return `<section class="host-current-tasks">
    <div class="section-head compact"><div><h3>玩家任务</h3><p>${tasks.length} 项来自当前 Segment</p></div></div>
    <div class="host-current-list">
      ${tasks
        .map(
          (task, index) => `<article class="host-current-item host-task-item">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <p>${escapeHtml(task)}</p>
          </article>`
        )
        .join("")}
    </div>
  </section>`;
}

function renderRemedies(act) {
  const fallbacks = Array.isArray(act?.runbook?.fallbacks) ? act.runbook.fallbacks : [];
  const items = (state.cloudHostSegmentRemedies || []).filter((row) => !act?.key || row.segment_key === act.key);
  if (!fallbacks.length && !items.length) {
    return `<div class="host-current-empty">当前幕没有补救话术。卡关时可先用主持日志或手动发线索。</div>`;
  }
  return `<div class="host-current-list">
    ${fallbacks
      .map(
        (text, index) => `<article class="host-current-item">
          <strong>主持手册兜底 ${index + 1}</strong>
          <p>${escapeHtml(text)}</p>
        </article>`
      )
      .join("")}
    ${items
      .map(
        (row) => `<article class="host-current-item">
          <strong>${escapeHtml(row.title)}</strong>
          <p>${escapeHtml(row.trigger_hint || "无触发提示")}</p>
          <button class="secondary-btn" type="button" data-action="host-apply-remedy" data-remedy="${escapeHtml(row.id)}">执行补救</button>
        </article>`
      )
      .join("")}
  </div>`;
}

function renderHostTabletopStage(presentation) {
  const map = presentation?.map;
  if (!map?.host?.locations?.length) return "";
  const locations = map.host.locations;
  const locationIds = new Set(locations.map((location) => location.id));
  const revealed = new Set(map.revealedLocationIds || []);
  const routes = (map.routes || []).filter(([from, to]) => locationIds.has(from) && locationIds.has(to));
  const byId = new Map(locations.map((location) => [location.id, location]));
  const active = byId.get(map.activeLocationId) || locations[0];
  const dice = map.dice || {};
  const diceLabel = `${Number(dice.count) || 1}d${Number(dice.sides) || 20}${Number(dice.modifier) ? Number(dice.modifier) > 0 ? `+${Number(dice.modifier)}` : Number(dice.modifier) : ""}`;
  return `<section class="host-stage-panel">
    <div class="section-head">
      <div><p class="section-kicker">PLAYER STAGE</p><h3>跑团地图同步</h3><p>${escapeHtml(map.title)} · ${locations.length} 个地点 · ${escapeHtml(diceLabel)}</p></div>
      <button class="secondary-btn" type="button" data-action="host-tabletop-toggle-map">${map.visible ? "对玩家隐藏地图" : "向玩家公开地图"}</button>
    </div>
    <div class="host-stage-grid">
      <div class="host-stage-map" role="group" aria-label="选择玩家当前地点">
        <svg viewBox="0 0 100 100" aria-hidden="true">${routes.map(([from, to]) => {
          const start = byId.get(from);
          const end = byId.get(to);
          return `<line x1="${Number(start?.x || 0.5) * 100}" y1="${Number(start?.y || 0.5) * 100}" x2="${Number(end?.x || 0.5) * 100}" y2="${Number(end?.y || 0.5) * 100}"></line>`;
        }).join("")}</svg>
        ${locations.map((location, index) => `<button type="button" class="host-stage-node${location.id === active?.id ? " is-active" : ""}${revealed.has(location.id) ? " is-revealed" : ""}" style="--map-x:${Number(location.x) * 100}%;--map-y:${Number(location.y) * 100}%" data-action="host-tabletop-select-location" data-location-id="${escapeHtml(location.id)}" aria-label="设为当前地点：${escapeHtml(location.name)}"><span>${index + 1}</span><b>${escapeHtml(location.name)}</b></button>`).join("")}
      </div>
      <div class="host-stage-location-list">
        ${locations.map((location) => {
          const isActive = location.id === active?.id;
          const isRevealed = revealed.has(location.id);
          return `<article class="host-stage-location${isActive ? " is-active" : ""}">
            <button type="button" class="host-stage-location-main" data-action="host-tabletop-select-location" data-location-id="${escapeHtml(location.id)}">
              <span>${isActive ? "当前地点" : location.segmentKey ? `绑定 ${escapeHtml(location.segmentKey)}` : escapeHtml(location.type)}</span>
              <strong>${escapeHtml(location.name)}</strong>
              <small>${escapeHtml(location.hostNotes || location.description || "尚未填写主持备注")}</small>
            </button>
            <button type="button" class="secondary-btn compact" data-action="host-tabletop-toggle-location" data-location-id="${escapeHtml(location.id)}" ${isActive ? "disabled" : ""}>${isRevealed ? "对玩家隐藏" : "向玩家公开"}</button>
          </article>`;
        }).join("")}
      </div>
    </div>
    ${renderHostTabletopEncounter(map, active)}
    ${renderHostTabletopCheck(map, active, diceLabel)}
    ${renderHostTabletopOutcome(map)}
    <div class="host-stage-footer">
      <span class="status-chip ${map.visible ? "published" : "draft"}">${map.visible ? "玩家可见" : "仅主持可见"}</span>
      <span>已公开 ${revealed.size}/${locations.length} 个地点</span>
      <span>队伍 ${map.party?.length || 0} 人</span>
      <span>结局条件 ${map.host.endingCount || 0} 组</span>
    </div>
  </section>`;
}

function renderHostTabletopEncounter(map, activeLocation) {
  const activeEncounter = map.activeEncounter;
  const npcById = new Map((map.host?.npcs || []).map((npc) => [npc.id, npc]));
  const configuredNpcs = (activeLocation?.encounterNpcIds || []).map((id) => npcById.get(id)).filter(Boolean);
  if (activeEncounter?.status === "active") {
    return `<section class="host-stage-encounter is-active" data-host-tabletop-encounter aria-live="polite">
      <div><p class="section-kicker">ENCOUNTER LIVE</p><h4>${escapeHtml(activeEncounter.locationName)}遭遇进行中</h4><p>玩家端已收到遭遇状态；结束后会保留当前地点与已揭示地图。</p></div>
      <div class="host-stage-encounter-roster">${activeEncounter.npcs.map((npc) => `<span><strong>${escapeHtml(npc.name)}</strong><small>${escapeHtml(npc.role || "NPC")} · HP ${npc.hp}/${npc.maxHp}</small></span>`).join("")}</div>
      <button type="button" class="secondary-btn" data-action="host-tabletop-end-encounter">结束遭遇</button>
    </section>`;
  }
  if (!configuredNpcs.length) return "";
  return `<section class="host-stage-encounter" data-host-tabletop-encounter-builder>
    <div><p class="section-kicker">ENCOUNTER READY</p><h4>触发${escapeHtml(activeLocation.name)}遭遇</h4><p>${configuredNpcs.map((npc) => `${escapeHtml(npc.name)} · HP ${npc.hp}/${npc.maxHp}`).join("；")}</p></div>
    <button type="button" class="primary-btn" data-action="host-tabletop-start-encounter">触发遭遇并同步</button>
  </section>`;
}

function renderHostTabletopCheck(map, activeLocation, diceLabel) {
  const check = map.activeCheck;
  if (check) {
    const result = check.result;
    const pending = check.status === "pending" || !result;
    const mode = { normal: "普通", advantage: "优势", disadvantage: "劣势" }[check.rollMode] || "普通";
    return `<section class="host-stage-check${pending ? " is-pending" : result.success ? " is-success" : " is-failure"}" data-host-tabletop-check>
      <div class="host-stage-check-head">
        <div><p class="section-kicker">${pending ? "AWAITING CHECK" : "CHECK RESULT"}</p><h4>${escapeHtml(check.label)}</h4><p>${escapeHtml(check.instruction)}</p></div>
        <span class="status-chip ${pending ? "testing" : result.success ? "published" : "blocked"}">${pending ? "等待公开掷骰" : escapeHtml(result.degreeLabel)}</span>
      </div>
      <div class="host-stage-check-meta"><span>${escapeHtml(diceLabel)}</span><span>难度 ${check.target}</span><span>加值 ${Number(check.bonus) >= 0 ? "+" : ""}${Number(check.bonus) || 0}</span><span>${mode}</span></div>
      ${pending ? `<div class="host-stage-check-actions"><button type="button" class="primary-btn" data-action="host-tabletop-roll-check">公开掷骰并同步结果</button><button type="button" class="secondary-btn" data-action="host-tabletop-clear-check">取消判定</button></div>` : `<div class="host-stage-check-result"><strong>${result.rolls.join(" + ")}${Number(result.total) !== Number(result.rawTotal) ? ` → ${result.total}` : ` = ${result.total}`}</strong><span>目标 ${result.target} · 差值 ${result.margin >= 0 ? "+" : ""}${result.margin}</span><p>${escapeHtml(check.outcomeText)}</p></div>${renderHostCheckChanges(map, check)}<div class="host-stage-check-actions">${check.appliedAt ? "" : `<button type="button" class="primary-btn" data-action="host-tabletop-apply-check-outcome">应用数值并计算结局</button>`}<button type="button" class="secondary-btn" data-action="host-tabletop-clear-check">完成并继续流程</button></div>`}
    </section>`;
  }
  const templates = activeLocation?.checks || [];
  return `<section class="host-stage-check-builder" data-host-tabletop-check-builder>
    <div class="host-stage-check-builder-head"><div><p class="section-kicker">NEXT ACTION</p><h4>发起场景判定</h4><p>玩家会先看到行动目标，公开掷骰后再同步成功或失败导向。</p></div><span>${escapeHtml(diceLabel)}</span></div>
    ${templates.length ? `<div class="host-stage-check-presets">${templates.map((template) => `<button type="button" data-action="host-tabletop-start-check" data-check-id="${escapeHtml(template.id)}"><span>预设判定</span><strong>${escapeHtml(template.label)}</strong><small>难度 ${template.target} · ${escapeHtml(template.instruction)}</small></button>`).join("")}</div>` : `<p class="host-stage-check-empty">创作端尚未给这个地点配置预设判定，可以先使用下面的临场判定。</p>`}
    <div class="host-stage-check-custom">
      <label><span>临场判定</span><input class="field" maxlength="80" value="调查${escapeHtml(activeLocation?.name || "当前场景")}" data-host-check-label></label>
      <label><span>难度</span><input class="field" type="number" min="-9999" max="9999" step="1" value="${Number(map.dice?.defaultTarget) || 12}" data-host-check-target></label>
      <label><span>加值</span><input class="field" type="number" min="-999" max="999" step="1" value="0" data-host-check-bonus></label>
      <label><span>模式</span><select class="field" data-host-check-mode><option value="normal">普通</option><option value="advantage">优势</option><option value="disadvantage">劣势</option></select></label>
      <button type="button" class="secondary-btn" data-action="host-tabletop-start-custom-check">发起临场判定</button>
    </div>
  </section>`;
}

function renderHostCheckChanges(map, check) {
  const applied = Array.isArray(check.appliedChanges) ? check.appliedChanges : [];
  if (check.appliedAt) {
    return `<div class="host-stage-check-changes is-applied" data-host-tabletop-check-changes><strong>已写入房间变量</strong>${applied.length
      ? `<div>${applied.map((change) => `<span>${escapeHtml(change.label)} <b>${Number(change.delta) > 0 ? "+" : ""}${Number(change.delta)}</b> → ${Number(change.value)}</span>`).join("")}</div>`
      : `<small>此分支没有配置数值变化，结局条件仍已重新计算。</small>`}</div>`;
  }
  const effects = check.result?.success ? check.successEffects : check.failureEffects;
  const variableLookup = new Map((map.host?.variables || []).map((variable) => [variable.id, variable]));
  const preview = Object.entries(effects || {}).filter(([, delta]) => Number(delta)).map(([id, delta]) => ({
    label: variableLookup.get(id)?.label || id,
    delta: Number(delta)
  }));
  return `<div class="host-stage-check-changes" data-host-tabletop-check-changes><strong>等待主持人确认数值</strong>${preview.length
    ? `<div>${preview.map((change) => `<span>${escapeHtml(change.label)} <b>${change.delta > 0 ? "+" : ""}${change.delta}</b></span>`).join("")}</div>`
    : `<small>创作端未配置此分支的数值变化，可直接确认以刷新结局条件。</small>`}</div>`;
}

function renderHostTabletopOutcome(map) {
  const host = map.host;
  if (!host?.variables?.length && !host?.endingCount) return "";
  const published = map.publishedEnding;
  const candidates = host.endingCandidates || [];
  const closest = host.closestEnding;
  return `<section class="host-stage-outcome" data-host-tabletop-outcome>
    <div class="host-stage-outcome-head"><div><p class="section-kicker">CONDITION ROUTER</p><h4>变量与结局导向</h4><p>判定只更新变量；满足条件的结局仍由主持人确认后公开。</p></div><span>${candidates.length} 个可用候选</span></div>
    <div class="host-stage-variable-strip">${(host.variables || []).map((variable) => {
      const percent = Math.round((Number(variable.value) - Number(variable.min)) / Math.max(1, Number(variable.max) - Number(variable.min)) * 100);
      return `<div><span><b>${escapeHtml(variable.label)}</b><strong>${Number(variable.value)}</strong></span><i style="--runtime-value:${Math.max(0, Math.min(100, percent))}%"><b></b></i><small>${Number(variable.min)}—${Number(variable.max)}</small></div>`;
    }).join("")}</div>
    ${published ? `<article class="host-stage-published-ending is-${escapeHtml(published.tone)}" data-host-tabletop-published-ending><div><span>玩家端已公开</span><h5>${escapeHtml(published.name)}</h5><p>${escapeHtml(published.summary)}</p></div><button type="button" class="secondary-btn" data-action="host-tabletop-unpublish-ending">收回公开</button></article>` : ""}
    ${candidates.length ? `<div class="host-stage-ending-list">${candidates.map((ending) => `<article class="is-${escapeHtml(ending.tone)}"><div><span>条件已满足 · ${ending.readiness}%</span><h5>${escapeHtml(ending.name)}</h5><p>${escapeHtml(ending.summary)}</p><small>${ending.conditions.map((condition) => `${escapeHtml(condition.variableLabel)} ${condition.operator} ${condition.threshold}`).join(" · ")}</small></div><button type="button" class="primary-btn" data-action="host-tabletop-publish-ending" data-ending-id="${escapeHtml(ending.id)}"${published?.id === ending.id ? " disabled" : ""}>${published?.id === ending.id ? "已公开" : "公开此导向"}</button></article>`).join("")}</div>` : closest ? `<div class="host-stage-ending-empty"><strong>尚无结局满足全部条件</strong><span>最接近「${escapeHtml(closest.name)}」· ${closest.readiness}%</span></div>` : `<div class="host-stage-ending-empty"><strong>创作端尚未添加结局规则</strong><span>可以继续推进判定，稍后再补充条件判断器。</span></div>`}
  </section>`;
}

function queueItems() {
  const items = [];
  for (const event of (state.cloudHostEvents || []).filter((row) => row.status !== "delayed")) {
    items.push({
      type: "event",
      priority: 10,
      time: event.created_at,
      title: event.title || "待确认事件",
      detail: event.description || event.rule_name || "",
      actions: `<button class="primary-btn" data-action="execute-host-event" data-event="${escapeHtml(event.id)}">确认</button><button class="secondary-btn" data-action="delay-host-event" data-event="${escapeHtml(event.id)}">延后</button>`
    });
  }
  for (const player of (state.cloudHostPlayers || []).filter((row) => row.maybe_stuck)) {
    items.push({
      type: "stuck",
      priority: 15,
      time: player.last_activity_at || player.joined_at,
      title: `${player.player_display_name || player.role_name || "玩家"} · ${player.stuck_label || "疑似卡关"}`,
      detail: player.stuck_detail || "长时间没有有效推进",
      actions: `<button class="primary-btn" data-action="host-stuck-intervene" data-role="${escapeHtml(player.role_slot_id)}">精准提醒</button><button class="secondary-btn" data-action="host-player-detail" data-role="${escapeHtml(player.role_slot_id)}">查看详情</button>`
    });
  }
  for (const vote of state.cloudHostVotes || []) {
    if (!["open", "closed"].includes(vote.status)) continue;
    const ballots = vote.ballots?.length || 0;
    items.push({
      type: "vote",
      priority: vote.status === "open" ? 20 : 25,
      time: vote.updated_at || vote.created_at,
      title: vote.title || "投票 / 指认",
      detail: `${vote.status === "open" ? "投票中" : "待公布"} · ${ballots} 票`,
      actions:
        vote.status === "open"
          ? `<button class="secondary-btn" data-action="host-vote-status" data-vote-id="${escapeHtml(vote.id)}" data-status="closed">关闭</button>`
          : `<button class="primary-btn" data-action="host-vote-status" data-vote-id="${escapeHtml(vote.id)}" data-status="published">公布</button>`
    });
  }
  for (const action of state.cloudHostPrivateActions || []) {
    if (["accepted", "rejected"].includes(action.status)) continue;
    items.push({
      type: "private",
      priority: 30,
      time: action.created_at,
      title: action.title || "私密行动",
      detail: `${action.actor_role_name || "玩家"} · ${action.action_type || ""}`,
      actions: `<button class="secondary-btn" data-action="host-review-private-action" data-action-id="${escapeHtml(action.id)}" data-status="seen">已阅</button><button class="primary-btn" data-action="host-review-private-action" data-action-id="${escapeHtml(action.id)}" data-status="accepted">接受</button><button class="secondary-btn" data-action="host-review-private-action" data-action-id="${escapeHtml(action.id)}" data-status="rejected">拒绝</button>`
    });
  }
  for (const testimony of state.cloudHostTestimonies || []) {
    if (testimony.host_flag) continue;
    items.push({
      type: "testimony",
      priority: 40,
      time: testimony.submitted_at,
      title: "玩家口供",
      detail: `${testimony.role_name || "角色"} · ${String(testimony.body || "").slice(0, 60)}`,
      actions: `<button class="secondary-btn" data-action="host-review-testimony" data-testimony="${escapeHtml(testimony.id)}" data-flag="noted">已阅</button><button class="secondary-btn" data-action="host-review-testimony" data-testimony="${escapeHtml(testimony.id)}" data-flag="contradiction">标矛盾</button>`
    });
  }
  return items.sort((a, b) => a.priority - b.priority || String(a.time || "").localeCompare(String(b.time || "")));
}

function renderQueuePanel() {
  const items = queueItems();
  if (!items.length) {
    return `<section class="host-command-card host-queue-panel">
      <div class="section-head"><div><p class="section-kicker">QUEUE</p><h3>待处理队列</h3></div></div>
      <div class="empty-state">当前没有需要立即处理的卡点、投票、事件、私密行动或口供。</div>
    </section>`;
  }
  return `<section class="host-command-card host-queue-panel">
    <div class="section-head"><div><p class="section-kicker">QUEUE</p><h3>待处理队列</h3><p>${items.length} 项按现场优先级排序</p></div></div>
    <div class="host-queue-list">
      ${items
        .map(
          (item) => `<article class="host-queue-item host-queue-${escapeHtml(item.type)}">
            <span class="host-queue-type">${escapeHtml(item.type)}</span>
            <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p><small>${item.time ? formatRelativeTime(item.time) : ""}</small></div>
            <div class="host-queue-actions">${item.actions}</div>
          </article>`
        )
        .join("")}
    </div>
  </section>`;
}

function renderPlayersColumn({ playersTableRows }) {
  const players = state.cloudHostPlayers || [];
  return `<section class="host-command-card host-players-column">
    <div class="section-head">
      <div><p class="section-kicker">PLAYERS</p><h3>玩家状态</h3><p>${players.filter((p) => p.joined).length}/${players.length} 已入房</p></div>
      <div class="row host-manual-actions">
        <button class="secondary-btn" data-action="host-manual-grant-clue">发线索</button>
        <button class="secondary-btn" data-action="host-manual-grant-item">发物品</button>
        <button class="secondary-btn" data-action="host-manual-unlock-section">解锁分幕</button>
      </div>
    </div>
    <div class="host-runtime-table-wrap host-command-player-table">
      <table class="host-runtime-table"><thead><tr><th>玩家 / 角色</th><th>入房</th><th>阅读</th><th>线索</th><th>最近操作</th><th>状态</th><th></th></tr></thead><tbody>${playersTableRows(players)}</tbody></table>
    </div>
  </section>`;
}

function renderCurrentActColumn(preferredActKey = "", presentation = null) {
  const acts = hostActs();
  const act = activeAct(preferredActKey);
  return `<section class="host-command-card host-current-act-panel">
    <div class="section-head">
      <div><p class="section-kicker">CURRENT ACT</p><h3>${escapeHtml(act?.title || "当前幕控场")}</h3><p>${escapeHtml(act?.key || "尚未建立 Segment / Runbook")}</p></div>
      <button class="secondary-btn" data-action="host-manual-log">主持日志</button>
    </div>
    ${actSelector(acts, act)}
    ${renderRunbook(act)}
    ${renderPlayerTasks(act)}
    ${renderHostTabletopStage(presentation)}
    <div class="host-current-grid">
      <section><div class="section-head compact"><div><h3>应发线索</h3></div><button class="secondary-btn" data-action="host-manual-grant-clue" data-act-key="${escapeHtml(act?.key || "")}">手动发线索</button></div>${renderClueGrants(act)}</section>
      <section><div class="section-head compact"><div><h3>补救话术</h3></div></div>${renderRemedies(act)}</section>
    </div>
    <div class="host-current-actions">
      <button class="secondary-btn" data-action="host-manual-unlock-section" data-act-key="${escapeHtml(act?.key || "")}">解锁本幕分幕</button>
    </div>
  </section>`;
}

function renderTopbar({ room, world }) {
  const pace = state.paceTimer || { mode: "count-up", running: false, elapsedMs: 0 };
  return `<section class="host-command-topbar">
    <div class="host-topbar-room">
      <span class="live-label"><i></i>LIVE</span>
      <div><p class="eyebrow">${escapeHtml(world?.name || "当前世界")}</p><h1>${escapeHtml(room?.name || "主持工作区")}</h1></div>
    </div>
    <div class="host-topbar-meta">
      ${room?.invite_code ? `<span>邀请码 <code class="invite-code-inline">${escapeHtml(room.invite_code)}</code></span>` : ""}
      <span>${state.roomEventsConnected ? "实时同步已连接" : "轮询同步中"}</span>
    </div>
    <div class="host-topbar-timer">
      <strong data-host-pace-clock>${escapeHtml(paceClock(pace))}</strong>
      <button class="secondary-btn" data-action="host-pace-toggle">${pace.running ? "暂停" : "开始"}</button>
      <button class="secondary-btn" data-action="host-pace-reset">重置</button>
    </div>
  </section>`;
}

function renderHostVoicePanel() {
  const session = state.voiceSession;
  const policy = session?.voicePolicy || {};
  const mainRoom = (session?.voiceRooms || []).find((room) => room.id === policy.mainRoomId)
    || (session?.voiceRooms || []).find((room) => room.room_type === "public");
  const roster = hostVoiceRoster();
  const connected = state.hostVoiceLiveStatus === "connected";
  const connecting = state.hostVoiceLiveStatus === "connecting";
  const started = Boolean(policy.privateRoomsEnabled);
  return `<section class="host-voice-panel" aria-label="全员主语音房">
    <div class="host-voice-summary">
      <span class="host-voice-mark" aria-hidden="true">${connected ? "🎙" : "♬"}</span>
      <div>
        <p class="section-kicker">MAIN VOICE</p>
        <h2>${escapeHtml(mainRoom?.name || "全员主语音房")}</h2>
        <p>主持人与全部玩家共用固定主房 · ${escapeHtml(hostVoiceStatusLabel())}</p>
      </div>
    </div>
    <div class="host-voice-roster">
      ${roster.length ? roster.map((member) => `<span class="host-voice-person ${member.connected ? "is-connected" : ""}"><b>${escapeHtml(member.roleLabel)}</b>${escapeHtml(member.name)}<i>${member.connected ? "语音在线" : "已入房"}</i></span>`).join("") : `<span class="host-voice-empty">等待房间成员加入</span>`}
    </div>
    <div class="host-voice-policy">
      <span class="status-chip ${started ? "published" : "testing"}">${started ? "场次已开始" : "候场中"}</span>
      <small>${started ? "玩家现可创建仅受邀者可见的临时密谈" : "当前仅开放全员主房；正式开场后才开放玩家密谈"}</small>
    </div>
    <div class="host-voice-actions">
      ${started ? "" : `<button class="primary-btn" type="button" data-action="host-session-start" ${state.hostVoiceBusy ? "disabled" : ""}>正式开始场次</button>`}
      ${connected
        ? `<button class="secondary-btn" type="button" data-action="host-voice-mic">${state.hostVoiceMicEnabled ? "关闭麦克风" : "开启麦克风"}</button>
           ${state.hostVoicePlaybackBlocked ? `<button class="primary-btn" type="button" data-action="host-voice-playback">开启扬声器</button>` : ""}
           <button class="secondary-btn" type="button" data-action="host-voice-disconnect">退出音频</button>`
        : `<button class="secondary-btn" type="button" data-action="host-voice-connect" ${!mainRoom || connecting || state.hostVoiceBusy ? "disabled" : ""}>${connecting ? "正在连接…" : "进入主语音房"}</button>`}
    </div>
  </section>`;
}

export function renderHostCommandCenter({ room, world, playersTableRows, currentBeatKey = "", presentation = null }) {
  return `<section class="host-command-center">
    ${renderTopbar({ room, world })}
    ${renderHostVoicePanel()}
    <div class="host-command-grid">
      ${renderPlayersColumn({ playersTableRows })}
      ${renderCurrentActColumn(currentBeatKey, presentation)}
      ${renderQueuePanel()}
    </div>
  </section>`;
}
