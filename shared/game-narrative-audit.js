/**
 * P9.2 Game Narrative Binding Audit
 */

import {
  normalizeGameNarrativePlan,
  GAME_NARRATIVE_SUPPORTED_FAMILIES,
} from "./game-narrative-plan.js";
import {
  gameNarrativeFamilyMeta,
  isGenericStakeLabel,
  isGameNarrativeFamilySupported,
} from "./game-narrative-metadata.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function check(code, ok, detail = null) {
  return { code, ok: Boolean(ok), detail };
}

function beatIdsFromCatalog(beatCatalog = null) {
  if (!beatCatalog) return null;
  if (Array.isArray(beatCatalog)) return new Set(beatCatalog.map(String));
  if (beatCatalog instanceof Set) return beatCatalog;
  if (typeof beatCatalog === "object") {
    const ids = new Set();
    for (const [k, v] of Object.entries(beatCatalog)) {
      if (typeof v === "string") ids.add(v);
      else if (v?.id) ids.add(String(v.id));
      else ids.add(k);
    }
    return ids;
  }
  return null;
}

function grantedPermissionIds(outcome) {
  return asArray(outcome?.effects)
    .filter((e) => e?.type === "PERMISSION_GRANT" && e.permissionId)
    .map((e) => e.permissionId);
}

function contentBoundPermissionIds(outcome) {
  return asArray(outcome?.contentBindings)
    .map((c) => c.permissionId)
    .filter(Boolean);
}

function looksLikeTruthRewrite(outcome) {
  const blob = [
    outcome?.narrativeMeaning,
    ...asArray(outcome?.effects).map((e) => `${e.key || ""}=${e.value || ""}`),
  ]
    .join("\n")
    .toLowerCase();
  // Affirmative rewrite only — "不改写真相" is explicitly allowed.
  if (/不改写.*真相|不等于.*改写|不自动改写/.test(blob)) return false;
  return /改写.*真相|真相变为|设为真凶|canonical.?truth\s*=|rewrite.?truth|pmd.?truth/.test(blob);
}

/**
 * @param {{
 *   plan: object,
 *   beatCatalog?: object|string[]|Set,
 *   contextProfile?: object|null,
 * }} args
 */
export function auditGameNarrativePlan({ plan, beatCatalog = null, contextProfile = null } = {}) {
  const normalized = normalizeGameNarrativePlan(plan || {});
  const knownBeats = beatIdsFromCatalog(beatCatalog);
  const checks = [];
  const bindingReports = [];

  for (const b of normalized.bindings) {
    const local = [];
    const meta = gameNarrativeFamilyMeta(b.familyId);

    if (!isGameNarrativeFamilySupported(b.familyId)) {
      local.push(
        check("NARRATIVE_RUNTIME_UNSUPPORTED", false, {
          familyId: b.familyId,
          message: "P9.2 V1 only supports M03/M09 narrative binding",
        }),
      );
    } else {
      local.push(check("FAMILY_SUPPORTED", true, { familyId: b.familyId }));
    }

    local.push(
      check(
        "EXPLICIT_SELECTION",
        b.selectionSource === "EXPLICIT" || b.acceptedFromCandidate === true,
        { selectionSource: b.selectionSource },
      ),
    );

    local.push(
      check("HAS_SOURCE_BEATS", b.sourceBeatIds.length > 0, { sourceBeatIds: b.sourceBeatIds }),
    );

    if (knownBeats) {
      const missing = b.sourceBeatIds.filter((id) => !knownBeats.has(id));
      local.push(
        check("CAUSE_BEATS_IN_PMD", missing.length === 0, {
          missing,
          code: missing.length ? "GAME_NARRATIVE_CAUSE_UNSUPPORTED" : null,
        }),
      );
    }

    local.push(
      check("HAS_CAUSE_SUMMARY", Boolean(b.narrative.causeSummary), {
        causeSummary: b.narrative.causeSummary || null,
      }),
    );
    local.push(
      check("HAS_PARTICIPANT_REASON", Boolean(b.narrative.participantReason), {
        participantReason: b.narrative.participantReason || null,
      }),
    );
    local.push(
      check("HAS_PUBLIC_PROMPT", Boolean(b.narrative.publicPrompt), {
        publicPrompt: b.narrative.publicPrompt || null,
      }),
    );

    const stakeLabel = b.narrative.stake.label;
    const stakeOk = Boolean(stakeLabel) && !isGenericStakeLabel(stakeLabel);
    local.push(
      check("STAKE_INSTANTIATED", stakeOk, {
        label: stakeLabel || null,
        code: stakeOk ? null : "NARRATIVE_STAKE_NOT_INSTANTIATED",
      }),
    );

    local.push(check("HAS_OUTCOMES", b.outcomes.length > 0, { count: b.outcomes.length }));

    for (const [i, outcome] of b.outcomes.entries()) {
      local.push(
        check(`OUTCOME_${i}_MEANING`, Boolean(outcome.narrativeMeaning), {
          matcher: outcome.outcomeMatcher,
        }),
      );
      local.push(
        check(`OUTCOME_${i}_NO_TRUTH_REWRITE`, !looksLikeTruthRewrite(outcome), {
          narrativeMeaning: outcome.narrativeMeaning,
        }),
      );

      if (b.kind === "MID_STORY_GAME" || meta?.requiresDownstreamContent) {
        const grants = grantedPermissionIds(outcome);
        const bound = contentBoundPermissionIds(outcome);
        const hasContent =
          bound.some((pid) => {
            const cb = outcome.contentBindings.find((c) => c.permissionId === pid);
            return (cb?.clueIds?.length || 0) + (cb?.contentUnitIds?.length || 0) > 0;
          }) || grants.length === 0;

        if (outcome.outcomeMatcher?.type === "WINNER" || grants.length) {
          local.push(
            check(`OUTCOME_${i}_PERMISSION_CONTENT_CLOSED`, grants.every((g) => bound.includes(g)), {
              grants,
              bound,
            }),
          );
          local.push(
            check(`OUTCOME_${i}_CONTENT_HAS_GRANT`, bound.every((pid) => grants.includes(pid)), {
              grants,
              bound,
            }),
          );
          const dead =
            grants.length === 0 ||
            !bound.some((pid) => {
              const cb = outcome.contentBindings.find((c) => c.permissionId === pid);
              return (cb?.clueIds?.length || 0) > 0 || (cb?.contentUnitIds?.length || 0) > 0;
            });
          local.push(
            check(`OUTCOME_${i}_NOT_NARRATIVELY_DEAD`, !dead, {
              code: dead ? "GAME_OUTCOME_NARRATIVELY_DEAD" : null,
            }),
          );
        }
      }

      if (b.kind === "FINAL_SETTLEMENT_GAME" || meta?.requiresEndingSettlement) {
        const grants = grantedPermissionIds(outcome);
        local.push(
          check(`OUTCOME_${i}_ENDING_SETTLEMENT`, grants.length > 0 || Boolean(outcome.narrativeMeaning), {
            grants,
          }),
        );
      }
    }

    bindingReports.push({
      bindingId: b.id,
      familyId: b.familyId,
      stageId: b.stageId,
      checks: local,
      status: local.every((c) => c.ok) ? "PASS" : "FAIL",
    });
    checks.push(...local.map((c) => ({ ...c, bindingId: b.id })));
  }

  // Isolation among multiple M03 mid-story bindings
  const midM03 = normalized.bindings.filter((b) => b.familyId === "M03");
  if (midM03.length >= 2) {
    const permSets = midM03.map((b) => {
      const perms = new Set();
      for (const o of b.outcomes) {
        for (const e of o.effects || []) {
          if (e.type === "PERMISSION_GRANT" && e.permissionId) perms.add(e.permissionId);
        }
      }
      return { id: b.id, perms: [...perms] };
    });
    const overlap = [];
    for (let i = 0; i < permSets.length; i++) {
      for (let j = i + 1; j < permSets.length; j++) {
        const shared = permSets[i].perms.filter((p) => permSets[j].perms.includes(p));
        if (shared.length) overlap.push({ a: permSets[i].id, b: permSets[j].id, shared });
      }
    }
    checks.push(
      check("M03_PLACEMENT_ISOLATION", overlap.length === 0, { overlap }),
    );
  }

  const hardFailCodes = new Set([
    "NARRATIVE_RUNTIME_UNSUPPORTED",
    "GAME_NARRATIVE_CAUSE_UNSUPPORTED",
    "NARRATIVE_STAKE_NOT_INSTANTIATED",
    "GAME_OUTCOME_NARRATIVELY_DEAD",
  ]);
  const failed = checks.filter((c) => !c.ok);
  const hard = failed.some(
    (c) => hardFailCodes.has(c.code) || hardFailCodes.has(c.detail?.code) || !c.ok,
  );

  return {
    status: failed.length === 0 ? "PASS" : hard ? "FAIL" : "FAIL",
    plan: normalized,
    contextProfileRevision: contextProfile?.revision ?? null,
    bindingReports,
    checks,
    failed,
  };
}

export function auditGameNarrativeRevisionImpact({
  plan = null,
  contextProfile = null,
  pmdRevision = null,
} = {}) {
  const normalized = normalizeGameNarrativePlan(plan || {});
  const ctxRev = contextProfile?.revision ?? null;
  const review = [];
  const staleContext =
    ctxRev != null &&
    normalized.sourceContextRevision != null &&
    Number(ctxRev) !== Number(normalized.sourceContextRevision);
  const stalePmd =
    pmdRevision != null &&
    normalized.sourcePmdRevision != null &&
    Number(pmdRevision) !== Number(normalized.sourcePmdRevision);

  for (const b of normalized.bindings) {
    if (["USER_MODIFIED", "USER_ACCEPTED", "LOCKED"].includes(b.status)) {
      if (staleContext || stalePmd || b.status === "LOCKED") {
        review.push({
          bindingId: b.id,
          status: b.status,
          code: "GAME_NARRATIVE_REVIEW_REQUIRED",
          sourceContextRevision: normalized.sourceContextRevision,
          profileRevision: ctxRev,
          sourcePmdRevision: normalized.sourcePmdRevision,
          pmdRevision,
        });
      }
    }
  }
  return {
    status: review.length ? "REVIEW_REQUIRED" : "COMPATIBLE",
    reviewRequired: review,
  };
}
