import { escapeHtml } from "../security.js";

export function normalizeMiniGame(raw) {
  if (!raw) return null;
  const config = raw.config || raw.game_config || {};
  const type = raw.gameType || raw.game_type || config.gameType || config.game_type || "";
  if (!type) return null;
  return {
    ...raw,
    config,
    gameType: type,
    instanceId: raw.instanceId || raw.instance_id || "",
    status: raw.status || "playing",
    attemptsLeft: raw.attemptsLeft ?? raw.attempts_left ?? config.max_attempts ?? null
  };
}

function renderLock(game) {
  const config = game.config || {};
  const length = Math.max(1, Math.min(12, Number(config.length || config.answer_length || 4)));
  const attempts = game.attemptsLeft == null ? "" : `<span class="mini-game-attempts">剩余 ${escapeHtml(game.attemptsLeft)} 次</span>`;
  return `
    <section class="mini-game-card" data-mini-game="${escapeHtml(game.instanceId)}">
      <div class="mini-game-head">
        <div>
          <p class="eyebrow">解密机关</p>
          <h3>${escapeHtml(config.title || "数字密码锁")}</h3>
        </div>
        ${attempts}
      </div>
      <p class="muted">${escapeHtml(config.prompt || "输入线索中得到的密码。")}</p>
      <div class="mini-game-lock-row">
        <input class="field mini-game-answer" data-mini-game-answer inputmode="numeric" maxlength="${length}" placeholder="${"0".repeat(length)}" autocomplete="off" />
        <button class="btn primary" type="button" data-action="mini-game-submit" ${game.instanceId ? "" : "disabled"}>尝试解锁</button>
      </div>
      ${config.hint ? `<p class="hint">${escapeHtml(config.hint)}</p>` : ""}
    </section>`;
}

export function renderMiniGamePanel(rawGame) {
  const game = normalizeMiniGame(rawGame);
  if (!game || game.status === "idle") return "";
  if (game.status === "success") {
    return `<section class="mini-game-card success"><p class="eyebrow">解密机关</p><h3>机关已解开</h3><p class="muted">主持端已同步结果，请继续查看新的剧情推进。</p></section>`;
  }
  if (game.status === "fail") {
    return `<section class="mini-game-card fail"><p class="eyebrow">解密机关</p><h3>机关暂时锁死</h3><p class="muted">请等待主持人处理或查看其他线索。</p></section>`;
  }
  if (game.gameType === "zhimu_lock") return renderLock(game);
  return `<section class="mini-game-card"><p class="eyebrow">互动机关</p><h3>${escapeHtml(game.config?.title || "暂不支持的小游戏")}</h3><p class="muted">当前玩家端暂不支持 ${escapeHtml(game.gameType)}，请联系主持人处理。</p></section>`;
}
