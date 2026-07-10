/**
 * Resolve host stuck-intervention routing from player rows (snake_case API fields).
 * Shared by main app director view and standalone host console.
 */

const DEFAULT_NUDGE =
  "当前剧情似乎停住了，可以查看「现在」页的建议下一步，或联系主持人获取提示。";

/**
 * @typedef {object} HostStuckPlayer
 * @property {boolean} [joined]
 * @property {boolean} [maybe_stuck]
 * @property {string} [role_slot_id]
 * @property {string} [recommended_action]
 * @property {string} [suggested_nudge]
 * @property {string} [stuck_label]
 */

/**
 * @param {HostStuckPlayer[]} players
 * @param {string} [roleSlotId]
 * @returns {{ ok: boolean, reason?: string, action?: string, target?: HostStuckPlayer, defaultMessage?: string }}
 */
export function resolveHostStuckIntervention(players, roleSlotId = "") {
  const joined = (players || []).filter((player) => player.joined);
  const stuck = joined.filter(
    (player) => player.maybe_stuck && (!roleSlotId || String(player.role_slot_id) === String(roleSlotId))
  );
  if (!stuck.length) {
    return { ok: false, reason: "当前没有需要干预的卡关玩家" };
  }
  const target = stuck[0];
  const action = target.recommended_action || "nudge";
  return {
    ok: true,
    action,
    target,
    defaultMessage: target.suggested_nudge || DEFAULT_NUDGE
  };
}
