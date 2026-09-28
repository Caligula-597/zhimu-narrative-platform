import { renderStepper } from "../components/stepper.js";
import { escapeHtml } from "../../../shared/security.js";
import { state } from "../state.js";
import { roomContentBindingPresentation } from "../../../shared/room-content-binding.js";
import { PLAYER_PRODUCT_MODES, productModeForRoom, productModeMeta } from "../product-mode.js";

export function renderJoin() {
  const preview = state.joinPreview;
  if (!preview) {
    return `
      <section class="panel card">
        ${renderStepper(1)}
        <h2>输入房间邀请码</h2>
        <p class="muted">输入主持人分享的邀请码，系统会读取该房间可选的角色席位。</p>
        <div class="join-row">
          <input class="field" type="text" placeholder="房间邀请码" value="${escapeHtml(state.inviteCode)}" data-bind="inviteCode" />
          <button class="btn primary" type="button" data-action="lookup-invite" ${state.busy ? "disabled" : ""}>读取角色列表</button>
        </div>
        <button class="text-btn" type="button" data-action="back-landing">← 返回首页</button>
      </section>`;
  }

  const roles = preview.roles || [];
  const boundRoleId = preview.current_role_slot_id || "";
  const availableCount = boundRoleId
    ? 1
    : roles.filter((r) => !r.occupied || r.occupied_by_current).length;
  const selected = roles.find((r) => r.id === state.selectedRoleId);
  const binding = roomContentBindingPresentation(preview.room.contentBinding);
  const roomMode = productModeForRoom(preview.room);
  const selectedMode = productModeMeta(state.productMode);
  const roomModeMeta = productModeMeta(roomMode || state.productMode);
  const modeMatches = !roomMode || roomMode === state.productMode;

  return `
    <section class="join-shell">
      ${renderStepper(state.joinStep)}
      <div class="join-summary card">
        <div>
          <p class="eyebrow">即将进入</p>
          <h2>${escapeHtml(preview.room.name)}</h2>
          <p class="muted">世界 · ${escapeHtml(preview.world.name)} · 房间状态 ${escapeHtml(preview.room.status || "运行中")}</p>
          <p class="join-mode-line"><span>你选择的玩家模式</span><strong>${escapeHtml(selectedMode.label)}</strong><span>· 房间类型</span><strong>${escapeHtml(roomModeMeta.label)}</strong></p>
          <p class="hint ${binding.tone === "testing" ? "warn" : ""}"><strong>${escapeHtml(binding.label)}</strong> · ${escapeHtml(binding.detail)}</p>
        </div>
        <dl class="join-stats">
          <div><dt>可选角色</dt><dd>${availableCount} / ${roles.length}</dd></div>
          <div><dt>邀请码</dt><dd><code>${escapeHtml(state.inviteCode)}</code></dd></div>
        </dl>
      </div>

      ${!modeMatches
        ? `<div class="join-mode-mismatch banner error" role="alert">
            <strong>玩家模式不匹配</strong>
            <p>当前选择的是“${escapeHtml(selectedMode.label)}”，这个邀请码对应“${escapeHtml(roomModeMeta.label)}”房间。请先切换玩家模式，再继续进入。</p>
            <div class="player-mode-switcher" role="list" aria-label="切换玩家模式">
              ${PLAYER_PRODUCT_MODES.map((mode) => `
                <button class="btn ${state.productMode === mode.id ? "primary" : "outline"}" type="button" data-action="select-product-mode" data-product-mode="${mode.id}" aria-pressed="${state.productMode === mode.id}">${escapeHtml(mode.label)}</button>`).join("")}
            </div>
          </div>`
        : `<div class="join-mode-match hint"><strong>${escapeHtml(selectedMode.label)}</strong> 玩家工作区已匹配，可以继续选择角色。</div>`}

      <div class="panel card">
        <h3>选择你的角色席位</h3>
        ${boundRoleId
          ? `<p class="hint warn">你已在该房间绑定角色，不可更换席位。继续进入将恢复你原来的角色与进度。</p>`
          : `<p class="muted">每个席位对应剧本中的一个角色。已被其他玩家占用的席位无法选择。</p>`}
        <div class="role-grid">
          ${roles
            .map((role) => {
              const disabled = boundRoleId
                ? role.id !== boundRoleId
                : role.occupied && !role.occupied_by_current;
              const isSelected = state.selectedRoleId === role.id;
              const status = boundRoleId && role.id === boundRoleId
                ? "你已绑定"
                : boundRoleId
                  ? "不可更换"
                  : disabled
                    ? "已被占用"
                    : role.occupied_by_current
                      ? "你的当前角色"
                      : "可选";
              return `
              <button type="button" class="role-card ${isSelected ? "is-selected" : ""}" data-action="pick-role" data-role-id="${role.id}" ${disabled ? "disabled" : ""}>
                <span class="role-avatar">${escapeHtml(String(role.name?.[0] || "?"))}</span>
                <div>
                  <strong>${escapeHtml(role.name)}</strong>
                  <span class="role-status">${status}</span>
                  ${role.public_profile ? `<p>${escapeHtml(role.public_profile)}</p>` : ""}
                </div>
              </button>`;
            })
            .join("")}
        </div>

        ${selected
          ? `
          <div class="join-confirm card-soft">
            <p>你将以 <strong>${escapeHtml(selected.name)}</strong> 的身份进入 <strong>${escapeHtml(preview.room.name)}</strong></p>
            <p class="hint">进入后可阅读该角色的私人分幕、探索场景、查看线索与背包。</p>
          </div>`
          : ""}

        <div class="row-actions">
          <button class="btn primary large" type="button" data-action="confirm-join" ${state.busy || !state.selectedRoleId || !modeMatches ? "disabled" : ""}>进入房间，开始游戏</button>
          <button class="btn quiet" type="button" data-action="join-back-code">修改邀请码</button>
          <button class="btn quiet" type="button" data-action="back-landing">返回首页</button>
        </div>
      </div>
    </section>`;
}
