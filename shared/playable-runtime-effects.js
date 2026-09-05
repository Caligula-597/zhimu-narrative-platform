/**
 * P7.2 / P7.2.5 Playable Runtime Effect Executor
 *
 * UNIQUE write entry for permissionGrants + keyStates.
 * Bridge must only: settlement → outcome → applyRuntimeEffects → here.
 * Never mutate permission/state outside this module.
 */

import { normalizeRuntimeEffect } from "./playable-project-contracts.js";

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function nowIso(now) {
  return typeof now === "function" ? now() : now || new Date().toISOString();
}

export function effectApplicationKey({
  placementId,
  outcomeIndex,
  effectIndex,
  targetRoleId,
  effect,
}) {
  const e = normalizeRuntimeEffect(effect);
  const subject =
    e.type === "PERMISSION_GRANT" || e.type === "PERMISSION_REVOKE"
      ? `perm:${e.permissionId}`
      : `state:${e.key}`;
  return [
    String(placementId || ""),
    String(outcomeIndex),
    String(effectIndex),
    String(targetRoleId || ""),
    e.type,
    subject,
  ].join("|");
}

export function normalizePermissionGrant(value = {}) {
  const src = record(value);
  return {
    permissionId: String(src.permissionId || ""),
    targetRoleId: String(src.targetRoleId || ""),
    sourcePlacementId: src.sourcePlacementId != null ? String(src.sourcePlacementId) : undefined,
    sourceOutcomeId: src.sourceOutcomeId != null ? String(src.sourceOutcomeId) : undefined,
    grantedAt: src.grantedAt != null ? String(src.grantedAt) : null,
    applicationKey: src.applicationKey != null ? String(src.applicationKey) : undefined,
  };
}

export function roleHasPermission(runtime, roleId, permissionId) {
  return asArray(runtime?.permissionGrants).some(
    (g) => g.permissionId === permissionId && g.targetRoleId === roleId,
  );
}

export function permissionAllowsContent(runtime, roleId, contentUnitId) {
  const snapshot = runtime?.playableSnapshot;
  if (!snapshot) return false;
  const grants = asArray(runtime.permissionGrants).filter((g) => g.targetRoleId === roleId);
  for (const g of grants) {
    const def = (snapshot.permissions || []).find((p) => p.id === g.permissionId);
    if (def?.contentUnitIds?.includes(contentUnitId)) return true;
  }
  return false;
}

export function permissionAllowsClue(runtime, roleId, clueId) {
  const snapshot = runtime?.playableSnapshot;
  if (!snapshot) return false;
  const grants = asArray(runtime.permissionGrants).filter((g) => g.targetRoleId === roleId);
  for (const g of grants) {
    const def = (snapshot.permissions || []).find((p) => p.id === g.permissionId);
    if (def?.clueIds?.includes(clueId)) return true;
  }
  return false;
}

export function staticAudienceAllows(snapshot, roleId, contentUnit) {
  if (!contentUnit?.audience) return false;
  const vis = contentUnit.audience.visibility;
  const role = (snapshot.roles || []).find((r) => r.id === roleId);
  if (!role) return false;
  if (vis === "PUBLIC") return role.type === "PLAYER" || role.type === "HOST";
  if (vis === "HOST_ONLY") return role.type === "HOST";
  if (vis === "PRIVATE" || vis === "SHARED") {
    return (contentUnit.audience.roleIds || []).includes(roleId);
  }
  return false;
}

export function resolveEffectTargetRole(effect, { winnerRoleId } = {}) {
  const target = String(normalizeRuntimeEffect(effect).target || "WINNER");
  if (target === "WINNER") return winnerRoleId || null;
  if (target === "ALL_PLAYERS") return null;
  return target;
}

/**
 * Single-effect write entry. Idempotent via appliedEffectKeys.
 * @returns {{ runtime, applied: boolean, applicationKey: string|null }}
 */
export function applyRuntimeEffect(runtime, {
  effect,
  placementId,
  outcomeId,
  outcomeIndex = 0,
  effectIndex = 0,
  targetRoleId,
  now,
} = {}) {
  const state = {
    ...runtime,
    permissionGrants: [...asArray(runtime.permissionGrants)].map(normalizePermissionGrant),
    keyStates: { ...record(runtime.keyStates) },
    appliedEffectKeys: [...asArray(runtime.appliedEffectKeys)],
  };
  const normalized = normalizeRuntimeEffect(effect);
  if (!normalized.valid || normalized.type === "INVALID" || !targetRoleId) {
    return { runtime: state, applied: false, applicationKey: null };
  }

  const key = effectApplicationKey({
    placementId,
    outcomeIndex,
    effectIndex,
    targetRoleId,
    effect: normalized,
  });
  if (state.appliedEffectKeys.includes(key)) {
    return { runtime: state, applied: false, applicationKey: key };
  }

  const ts = nowIso(now);
  state.appliedEffectKeys.push(key);

  if (normalized.type === "PERMISSION_GRANT") {
    const exists = state.permissionGrants.some(
      (g) => g.permissionId === normalized.permissionId && g.targetRoleId === targetRoleId,
    );
    if (!exists) {
      state.permissionGrants.push(
        normalizePermissionGrant({
          permissionId: normalized.permissionId,
          targetRoleId,
          sourcePlacementId: placementId,
          sourceOutcomeId: outcomeId,
          grantedAt: ts,
          applicationKey: key,
        }),
      );
    }
  } else if (normalized.type === "PERMISSION_REVOKE") {
    state.permissionGrants = state.permissionGrants.filter(
      (g) => !(g.permissionId === normalized.permissionId && g.targetRoleId === targetRoleId),
    );
  } else if (normalized.type === "STATE_APPLY") {
    state.keyStates[normalized.key] = normalized.value;
  } else if (normalized.type === "STATE_CLEAR") {
    delete state.keyStates[normalized.key];
  }

  return { runtime: state, applied: true, applicationKey: key };
}

/**
 * Apply OutcomeBinding effects. Only public batch entry for Bridge.
 */
export function applyRuntimeEffects(runtime, {
  effects,
  placementId,
  outcomeId,
  outcomeIndex = 0,
  winnerRoleId,
  now,
} = {}) {
  let state = {
    ...runtime,
    permissionGrants: [...asArray(runtime.permissionGrants)].map(normalizePermissionGrant),
    keyStates: { ...record(runtime.keyStates) },
    appliedEffectKeys: [...asArray(runtime.appliedEffectKeys)],
  };
  const list = asArray(effects);

  for (let effectIndex = 0; effectIndex < list.length; effectIndex++) {
    const effect = normalizeRuntimeEffect(list[effectIndex]);
    if (!effect.valid || effect.type === "INVALID") continue;

    let targets = [];
    if (String(effect.target) === "ALL_PLAYERS") {
      targets = (state.playableSnapshot?.roles || [])
        .filter((r) => r.type === "PLAYER")
        .map((r) => r.id);
    } else {
      const one = resolveEffectTargetRole(effect, { winnerRoleId });
      if (one) targets = [one];
    }

    for (const targetRoleId of targets) {
      const result = applyRuntimeEffect(state, {
        effect,
        placementId,
        outcomeId,
        outcomeIndex,
        effectIndex,
        targetRoleId,
        now,
      });
      state = result.runtime;
    }
  }

  return state;
}

export function selectOutcomeBinding(placement, settlementResult) {
  const bindings = asArray(placement?.outcomeBindings);
  if (!bindings.length) return { binding: null, outcomeIndex: -1 };
  if (settlementResult?.status === "SOLD" && settlementResult?.winner) {
    const idx = bindings.findIndex((b) => record(b.outcomeMatcher).type === "WINNER");
    if (idx >= 0) return { binding: bindings[idx], outcomeIndex: idx };
  }
  return { binding: null, outcomeIndex: -1 };
}
