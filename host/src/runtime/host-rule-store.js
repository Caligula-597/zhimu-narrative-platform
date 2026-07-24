import { state } from "../state.js";

function sameJson(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export function hostRuleMatchesPayload(rule, payload) {
  return Boolean(
    rule
    && String(rule.room_id || "") === String(payload.roomId || "")
    && String(rule.name || "") === String(payload.name || "")
    && String(rule.mode || "") === String(payload.mode || "")
    && Number(rule.priority) === Number(payload.priority)
    && Boolean(rule.enabled) === Boolean(payload.enabled)
    && sameJson(rule.conditions, payload.conditions)
    && sameJson(rule.actions, payload.actions)
  );
}

export function upsertHostRule(rule) {
  if (!rule?.id) return;
  state.rules = [
    rule,
    ...(state.rules || []).filter((item) => String(item.id) !== String(rule.id))
  ];
}

export async function reloadHostRules({ apiRef, worldId, getWorld, render }) {
  const rules = await apiRef.getRules(worldId);
  if (getWorld() !== worldId) return null;
  state.rules = Array.isArray(rules) ? rules : [];
  render();
  return state.rules;
}
