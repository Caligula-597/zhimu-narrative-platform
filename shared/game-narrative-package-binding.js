/**
 * P9.2 — project GameNarrativePlan onto CompleteScriptPackage fields.
 * Thin projection only: mechanismAnnotations / permissions / clue unlocks.
 */

import { normalizeCompleteScriptPackage } from "./complete-script-package-contracts.js";
import { normalizeGameNarrativePlan, normalizeGameNarrativeBinding } from "./game-narrative-plan.js";
import { resolveNarrativeStakeLabel } from "./game-narrative-metadata.js";
import { normalizeProjectContextProfile } from "./project-context-profile.js";

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, maximum = 400) {
  return String(value ?? "").trim().slice(0, maximum);
}

/**
 * Fill stake labels from context when binding still has generic/empty stake.
 */
export function instantiatePlanStakes(planInput, contextProfile = null) {
  const plan = normalizeGameNarrativePlan(planInput);
  const profile = contextProfile ? normalizeProjectContextProfile(contextProfile) : null;
  const bindings = plan.bindings.map((b) => {
    const resolved = resolveNarrativeStakeLabel({ binding: b, contextProfile: profile });
    if (resolved.source === "UNRESOLVED") return b;
    return normalizeGameNarrativeBinding({
      ...b,
      narrative: {
        ...b.narrative,
        stake: {
          ...b.narrative.stake,
          label: resolved.label,
          contextBindingKey:
            b.narrative.stake.contextBindingKey ||
            (resolved.source.startsWith("CONTEXT") ? b.narrative.stake.contextBindingKey : null),
        },
      },
    });
  });
  return normalizeGameNarrativePlan({ ...plan, bindings });
}

function annotationFromBinding(binding) {
  const intro = [];
  if (binding.narrative.publicPrompt) intro.push(binding.narrative.publicPrompt);
  else if (binding.narrative.causeSummary && binding.narrative.stake.label) {
    intro.push(
      `${binding.narrative.causeSummary} 本次争夺：${binding.narrative.stake.label}。${binding.narrative.participantReason || ""}`.trim(),
    );
  }
  return {
    id: binding.id.replace(/^gnb-/, "place_"),
    mechanismTemplateId: binding.mechanismTemplateId,
    familyId: binding.familyId,
    stageId: binding.stageId,
    title:
      binding.familyId === "M09"
        ? `最终表决｜${binding.narrative.stake.label || "结算"}`
        : `竞价｜${binding.narrative.stake.label || binding.id}`,
    trigger: binding.trigger || "HOST_START",
    participantRule: binding.participantRule,
    introParagraphs: intro,
    runtimeConfig: binding.runtimeConfig || {},
    outcomeBindings: binding.outcomes.map((o) => ({
      outcomeMatcher: o.outcomeMatcher,
      effects: o.effects,
      // narrativeMeaning stays authoring-side; runtime ignores it
      narrativeMeaning: o.narrativeMeaning,
    })),
    fallback: binding.fallback,
    requiredForStageCompletion: binding.requiredForStageCompletion,
    sourceBeatIds: binding.sourceBeatIds,
    narrativeBindingId: binding.id,
  };
}

function permissionsFromBindings(bindings) {
  const byId = new Map();
  for (const b of bindings) {
    for (const o of b.outcomes) {
      for (const cb of o.contentBindings || []) {
        if (!cb.permissionId) continue;
        const prev = byId.get(cb.permissionId) || {
          id: cb.permissionId,
          grants: ["VIEW_CONTENT", "RECEIVE_CLUE"],
          summary: `由 ${b.id} 结算授予`,
          clueIds: [],
          contentUnitIds: [],
        };
        for (const cid of cb.clueIds || []) {
          if (!prev.clueIds.includes(cid)) prev.clueIds.push(cid);
        }
        for (const uid of cb.contentUnitIds || []) {
          if (!prev.contentUnitIds.includes(uid)) prev.contentUnitIds.push(uid);
        }
        byId.set(cb.permissionId, prev);
      }
      for (const ef of o.effects || []) {
        if (ef.type !== "PERMISSION_GRANT" || !ef.permissionId) continue;
        if (!byId.has(ef.permissionId)) {
          byId.set(ef.permissionId, {
            id: ef.permissionId,
            grants: ["VIEW_CONTENT", "RECEIVE_CLUE"],
            summary: `由 ${b.id} 结算授予`,
            clueIds: [],
            contentUnitIds: [],
          });
        }
      }
    }
  }
  return [...byId.values()];
}

function patchCluesWithPermissions(clues, bindings) {
  const cluePerm = new Map();
  for (const b of bindings) {
    for (const o of b.outcomes) {
      for (const cb of o.contentBindings || []) {
        for (const cid of cb.clueIds || []) {
          cluePerm.set(cid, cb.permissionId);
        }
      }
    }
  }
  return asArray(clues).map((c) => {
    const row = record(c);
    const pid = cluePerm.get(row.id) || row.permissionId;
    if (!pid) return row;
    return {
      ...row,
      permissionId: pid,
      delivery: row.delivery || "CONDITION_UNLOCK",
      visibility: row.visibility || "PRIVATE",
      roleIds: row.roleIds || [],
    };
  });
}

/**
 * Merge plan into an existing CompleteScriptPackage (or shell).
 * Does not invent STORY text beyond GAME intro / unlock wiring.
 */
export function applyGameNarrativePlanToPackage(packageInput, planInput, { contextProfile = null } = {}) {
  const plan = instantiatePlanStakes(planInput, contextProfile);
  const pkg = normalizeCompleteScriptPackage(packageInput);
  const annotations = plan.bindings.map(annotationFromBinding);
  const permissions = permissionsFromBindings(plan.bindings);
  const clues = patchCluesWithPermissions(pkg.clues, plan.bindings);

  // Ending sections unlock via ending permission when M09 grants it
  const endingPerm = permissions.find((p) => p.id.includes("ending"))?.id;
  let endingContent = pkg.endingContent;
  if (endingPerm && endingContent?.sections?.length) {
    endingContent = {
      ...endingContent,
      sections: endingContent.sections.map((s) => ({
        ...s,
        unlockPermissionId: s.unlockPermissionId || endingPerm,
        delivery: s.delivery || "CONDITION_UNLOCK",
      })),
    };
  }

  // Attach mechanism ids onto stages
  const stageAnn = new Map();
  for (const ann of annotations) {
    if (!stageAnn.has(ann.stageId)) stageAnn.set(ann.stageId, []);
    stageAnn.get(ann.stageId).push(ann.id);
  }
  const stages = pkg.stages.map((s) => ({
    ...s,
    mechanismAnnotationIds: [
      ...new Set([...(s.mechanismAnnotationIds || []), ...(stageAnn.get(s.id) || [])]),
    ],
  }));

  return {
    package: normalizeCompleteScriptPackage({
      ...pkg,
      stages,
      clues,
      mechanismAnnotations: annotations,
      permissions,
      endingContent,
      status: pkg.status === "BLOCKED" ? "DRAFT" : pkg.status,
    }),
    plan,
  };
}

/**
 * Build a filled MID_STORY M03 outcome pair helper.
 */
export function midStoryWinnerOutcome({
  permissionId,
  clueIds = [],
  stateKey,
  stakeLabel,
} = {}) {
  return {
    outcomeMatcher: { type: "WINNER" },
    narrativeMeaning: `赢家取得「${stakeLabel}」，获得差异化调查权限。`,
    effects: [
      { type: "PERMISSION_GRANT", permissionId, target: "WINNER" },
      ...(stateKey
        ? [{ type: "STATE_APPLY", key: stateKey, value: "UNLOCKED_FOR_WINNER" }]
        : []),
    ],
    contentBindings: [
      {
        permissionId,
        clueIds,
        target: "WINNER",
      },
    ],
  };
}

export function finalSettlementOutcomes({
  endingPermissionId = "ending_reveal_access",
  decisionQuestion = "最终表决",
} = {}) {
  const grant = {
    type: "PERMISSION_GRANT",
    permissionId: endingPermissionId,
    target: "ALL_PLAYERS",
  };
  return [
    {
      outcomeMatcher: { type: "MAJORITY" },
      narrativeMeaning: `多数决对「${decisionQuestion}」生效；公开结算结果，不改写 Canon 真相。`,
      effects: [
        { type: "STATE_APPLY", key: "final_vote_status", value: "MAJORITY" },
        { type: "STATE_APPLY", key: "player_decision", value: "$majority_choice" },
        grant,
      ],
      contentBindings: [{ permissionId: endingPermissionId, clueIds: [], contentUnitIds: [], target: "ALL_PLAYERS" }],
    },
    {
      outcomeMatcher: { type: "TIE" },
      narrativeMeaning: "表决平票；进入并列结算呈现，仍不改写真相。",
      effects: [
        { type: "STATE_APPLY", key: "final_vote_status", value: "TIE" },
        grant,
      ],
      contentBindings: [{ permissionId: endingPermissionId, clueIds: [], contentUnitIds: [], target: "ALL_PLAYERS" }],
    },
    {
      outcomeMatcher: { type: "NO_DECISION" },
      narrativeMeaning: "未能形成有效多数；主持按无决议结算，真相仍按 Canon 揭示。",
      effects: [
        { type: "STATE_APPLY", key: "final_vote_status", value: "NO_DECISION" },
        grant,
      ],
      contentBindings: [{ permissionId: endingPermissionId, clueIds: [], contentUnitIds: [], target: "ALL_PLAYERS" }],
    },
  ];
}
