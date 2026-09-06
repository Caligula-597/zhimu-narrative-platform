/**
 * P10.4 — Projection Trace + Packet Probe audit (read-only localization + hard gate).
 */

import {
  ABSTRACT_FALLBACK_LABELS,
  M12_FIELD_REQUIREMENTS,
  assertNoUnresolvedSemanticSlots,
  buildGroundedExperienceProjection,
  collectSymbolicSlotIds,
  findUnresolvedSymbolicSlots,
  isAbstractFallbackLabel,
} from "./production-projection-grounding.js";
import { semanticsBridgeForTemplate } from "./complete-beat-semantics-data.js";
import { listAcceptedStoryBlocks } from "./master-outline-integrator.js";

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, maximum = 800) {
  return String(value ?? "").trim().slice(0, maximum);
}

function walkStrings(node, acc = []) {
  if (node == null) return acc;
  if (typeof node === "string") {
    acc.push(node);
    return acc;
  }
  if (Array.isArray(node)) {
    for (const item of node) walkStrings(item, acc);
    return acc;
  }
  if (typeof node === "object") {
    for (const value of Object.values(node)) walkStrings(value, acc);
  }
  return acc;
}

function issue(code, message, extra = {}) {
  return { code, message, ...extra };
}

function listAcceptedBlocks(storyState) {
  if (!storyState) return [];
  try {
    return listAcceptedStoryBlocks(storyState);
  } catch {
    return asArray(storyState?.mechanismBlocks || storyState?.storyBlocks || storyState?.blocks).filter(
      (b) => !b?.status || b.status === "ACCEPTED" || b.accepted !== false,
    );
  }
}

/**
 * Localize first-loss layer for one block (P10.4.0).
 */
export function traceProductionProjection({
  storyState = null,
  masterOutline = null,
  productionMasterDraft = null,
  packetSet = null,
  package: pkg = null,
  blockId = null,
  contextProfile = null,
} = {}) {
  const blocks = listAcceptedBlocks(storyState);
  const block =
    (blockId && blocks.find((b) => b.id === blockId)) ||
    blocks.find((b) => b.templateId === "M12-1" || b.familyId === "M12") ||
    blocks[0] ||
    null;
  if (!block) {
    return {
      blockId: null,
      templateId: null,
      issues: [issue("GROUNDING_REVIEW_REQUIRED", "no accepted block for trace")],
    };
  }

  const slotIds = collectSymbolicSlotIds({ roleBindings: block.roleBindings });
  const semanticSource = {
    roleSlots: Object.keys(record(block.roleBindings)),
    plotSlots: Object.keys(record(block.plotBindings)),
    actionKind: null,
  };
  const resolvedStoryInstance = {
    roleBindings: record(block.roleBindings),
    plotValues: record(block.plotBindings),
  };

  const outlineBeats = asArray(masterOutline?.stages || storyState?.masterOutlineDraft?.stages)
    .flatMap((st) => asArray(st.beats))
    .filter((b) => b.sourceBlockId === block.id);
  const pmdBeats = asArray(productionMasterDraft?.stages)
    .flatMap((st) => asArray(st.beats))
    .filter((b) => b.sourceBlockId === block.id || b.templateId === block.templateId);

  const outlineText = walkStrings(outlineBeats).join("\n");
  const pmdText = walkStrings(pmdBeats).join("\n");
  const packetText = walkStrings(packetSet).join("\n");
  const finalText = walkStrings(pkg).join("\n");

  const issues = [];
  const outlineSlots = findUnresolvedSymbolicSlots(outlineText, slotIds);
  const pmdSlots = findUnresolvedSymbolicSlots(pmdText, slotIds);
  const packetSlots = findUnresolvedSymbolicSlots(packetText, slotIds);

  const storyStake = cleanText(block.plotBindings?.contestedStake);
  const outlineHasAbstract = [...ABSTRACT_FALLBACK_LABELS].some((l) => outlineText.includes(l));
  const pmdHasAbstract = [...ABSTRACT_FALLBACK_LABELS].some((l) => pmdText.includes(l));

  if (outlineSlots.length && !storyStake.includes("bargain")) {
    issues.push(
      issue("SYMBOLIC_SLOT_LEAK", `first seen in MasterOutline: ${outlineSlots.join(",")}`, {
        layer: "MasterOutline",
        slots: outlineSlots,
      }),
    );
  } else if (pmdSlots.length && !outlineSlots.length) {
    issues.push(
      issue("SYMBOLIC_SLOT_LEAK", `first seen in PMD: ${pmdSlots.join(",")}`, {
        layer: "PMD",
        slots: pmdSlots,
      }),
    );
  } else if (packetSlots.length && !pmdSlots.length) {
    issues.push(
      issue("SYMBOLIC_SLOT_LEAK", `first seen in Packet: ${packetSlots.join(",")}`, {
        layer: "Packet",
        slots: packetSlots,
      }),
    );
  } else if (outlineSlots.length) {
    issues.push(
      issue("SYMBOLIC_SLOT_LEAK", `present from MasterOutline: ${outlineSlots.join(",")}`, {
        layer: "MasterOutline",
        slots: outlineSlots,
      }),
    );
  }

  if (storyStake && !isAbstractFallbackLabel(storyStake) && outlineHasAbstract) {
    issues.push(
      issue("ABSTRACT_REQUIRED_FIELD", "contestedStake concrete on StoryState but abstract in outline/semantics", {
        layer: "enrichBeat/resolveBeatSemantics",
        field: "contestedStake",
        storyValue: storyStake,
      }),
    );
  } else if (isAbstractFallbackLabel(storyStake)) {
    issues.push(
      issue("ABSTRACT_REQUIRED_FIELD", "contestedStake abstract already on StoryState", {
        layer: "StoryState",
        field: "contestedStake",
      }),
    );
  } else if (pmdHasAbstract && !outlineHasAbstract) {
    issues.push(
      issue("GROUNDING_LOST_IN_PMD", "abstract fallback appears in PMD", {
        layer: "PMD",
        field: "contestedStake",
      }),
    );
  }

  // M07 role-scope: PARTICIPANT action copying OWNER agency summary
  const charViews = asArray(productionMasterDraft?.characterViews?.characters);
  for (const ch of charViews) {
    for (const st of asArray(ch.stages)) {
      for (const c of asArray(st.contributions)) {
        if (c.templateId !== "M07-1" && c.familyId !== "M07") continue;
        if (c.roleInBeat !== "PARTICIPANT" && c.roleInBeat !== "OBSERVER") continue;
        const action = cleanText(c.action);
        if (/为了/.test(action) && /隐藏|身份|领取|核对|公开/.test(action)) {
          issues.push(
            issue("ROLE_SCOPE_LEAK", `${ch.name || ch.characterId} inherits OWNER M07 agency via PARTICIPANT action`, {
              layer: "PMD.characterViews",
              characterId: ch.characterId,
              sourceOutlineBeatId: c.sourceOutlineBeatId,
            }),
          );
        }
      }
    }
  }

  const grounded = buildGroundedExperienceProjection({
    block,
    contextProfile,
    bridge: semanticsBridgeForTemplate(block.templateId),
  });

  return {
    blockId: block.id,
    templateId: block.templateId,
    beatIds: outlineBeats.map((b) => b.id),
    semanticSource,
    resolvedStoryInstance,
    pmdProjection: {
      beatCount: pmdBeats.length,
      sampleGoals: pmdBeats.slice(0, 3).map((b) => b.goal),
    },
    packetProjection: grounded?.packetCapture || null,
    finalSections: pkg ? ["package_present"] : [],
    issues,
    groundedExperience: grounded,
  };
}

function roleScopeLeaksInPacketSet(packetSet, pmd) {
  const leaks = [];
  const ownerGoalsByBeat = new Map();
  for (const ch of asArray(pmd?.characterViews?.characters)) {
    for (const st of asArray(ch.stages)) {
      for (const c of asArray(st.contributions)) {
        if (c.roleInBeat === "OWNER" && c.goal) {
          ownerGoalsByBeat.set(c.sourceOutlineBeatId, {
            ownerId: ch.characterId,
            goal: c.goal,
            templateId: c.templateId,
          });
        }
      }
    }
  }

  for (const role of asArray(packetSet?.roles)) {
    for (const st of asArray(role.stages)) {
      for (const c of asArray(st.contributions)) {
        if (c.roleInBeat === "OWNER") continue;
        const owner = ownerGoalsByBeat.get(c.sourceOutlineBeatId);
        if (!owner) continue;
        if (owner.ownerId === role.characterId) continue;
        const action = cleanText(c.action);
        if (owner.goal && action.includes(owner.goal)) {
          leaks.push({
            characterId: role.characterId,
            characterName: role.characterName,
            sourceOutlineBeatId: c.sourceOutlineBeatId,
            templateId: c.templateId || owner.templateId,
          });
        }
        if (
          (c.templateId === "M07-1" || owner.templateId === "M07-1") &&
          /为了/.test(action) &&
          /隐藏|身份|领取|核对/.test(action)
        ) {
          leaks.push({
            characterId: role.characterId,
            characterName: role.characterName,
            sourceOutlineBeatId: c.sourceOutlineBeatId,
            templateId: "M07-1",
          });
        }
      }
    }
  }
  return leaks;
}

function underspecifiedActions(groundedList) {
  const out = [];
  for (const g of asArray(groundedList)) {
    const negotiate = asArray(g.actions).find((a) => a.kind === "NEGOTIATE");
    const exchange = asArray(g.actions).find((a) => a.kind === "EXCHANGE");
    if (!negotiate?.actor || !negotiate?.counterpart) out.push("NEGOTIATE.actor/counterpart");
    if (!negotiate?.wants || !negotiate?.controls) out.push("NEGOTIATE.wants/controls");
    if (!negotiate?.openingOffer) out.push("NEGOTIATE.openingOffer");
    if (asArray(negotiate?.acceptableTerms).length < 1) out.push("NEGOTIATE.acceptableTerms");
    if (asArray(negotiate?.counterOptions).length < 2) out.push("NEGOTIATE.counterOptions");
    if (!exchange?.beforeOwner || !exchange?.afterOwner) out.push("EXCHANGE.before/afterOwner");
    if (!asArray(g.aftermath).some((a) => a.delta)) out.push("AFTERMATH.delta");
  }
  return [...new Set(out)];
}

/**
 * Hard Packet Probe gate — no real model required.
 */
export function auditProductionProjection({
  storyState = null,
  productionMasterDraft = null,
  packetSet = null,
  contextProfile = null,
  groundedProjections = null,
} = {}) {
  const issues = [];
  const blocks = listAcceptedBlocks(storyState);
  const grounded =
    groundedProjections ||
    blocks
      .map((block) =>
        buildGroundedExperienceProjection({
          block,
          contextProfile,
          bridge: semanticsBridgeForTemplate(block.templateId),
        }),
      )
      .filter(Boolean);

  const slotIds = [
    ...new Set(
      blocks.flatMap((b) => collectSymbolicSlotIds({ roleBindings: b.roleBindings })),
    ),
  ];

  // Scan Writer-facing PMD surfaces only (not roleAssignments.slotId metadata)
  if (productionMasterDraft) {
    const surfaces = [];
    for (const st of asArray(productionMasterDraft.stages)) {
      for (const b of asArray(st.beats)) {
        surfaces.push(b.goal, b.action, b.target, b.eventSummary, b.hostTruth, b.playerKnowledge);
      }
    }
    for (const ch of asArray(productionMasterDraft.characterViews?.characters)) {
      for (const st of asArray(ch.stages)) {
        surfaces.push(st.goal, st.action, st.knows, st.stageSummary);
        for (const c of asArray(st.contributions)) {
          surfaces.push(c.goal, c.action);
        }
      }
    }
    const pmdSlots = findUnresolvedSymbolicSlots(surfaces.filter(Boolean).join("\n"), slotIds);
    if (pmdSlots.length) {
      issues.push(
        issue("GROUNDING_LOST_IN_PMD", `PMD still has symbolic slots: ${pmdSlots.join(",")}`, {
          slots: pmdSlots,
        }),
      );
    }
  }

  // Writer packet surfaces (exclude groundedExperience internal maps)
  const packetSurfaces = [];
  for (const role of asArray(packetSet?.roles)) {
    packetSurfaces.push(...walkStrings(role));
  }
  if (packetSet?.host) packetSurfaces.push(...walkStrings(packetSet.host));
  for (const clue of asArray(packetSet?.clues)) packetSurfaces.push(...walkStrings(clue));
  for (const pub of asArray(packetSet?.publicStages)) packetSurfaces.push(...walkStrings(pub));
  if (packetSet?.ending) packetSurfaces.push(...walkStrings(packetSet.ending));
  for (const cap of asArray(packetSet?.groundedExperience?.captures)) {
    packetSurfaces.push(...walkStrings(cap));
  }

  const slotCheck = assertNoUnresolvedSemanticSlots(packetSurfaces, slotIds);
  const unresolvedSymbolicSlots = slotCheck.unresolvedSymbolicSlots;

  if (unresolvedSymbolicSlots.length) {
    issues.push(
      issue("SYMBOLIC_SLOT_LEAK", `packet has symbolic slots: ${unresolvedSymbolicSlots.join(",")}`, {
        layer: "Packet",
        slots: unresolvedSymbolicSlots,
      }),
    );
    issues.push(
      issue("GROUNDING_LOST_IN_PACKET", "symbolic slots reached Writer packet", {
        slots: unresolvedSymbolicSlots,
      }),
    );
  }

  const abstractRequiredFields = [];
  for (const g of grounded) {
    for (const req of M12_FIELD_REQUIREMENTS) {
      const entity = g.entities?.[req.field];
      if (!entity?.value || isAbstractFallbackLabel(entity.value)) {
        abstractRequiredFields.push({
          blockId: g.blockId,
          field: req.field,
          groundingLevel: req.groundingLevel,
          value: entity?.value || null,
        });
        issues.push(
          issue("ABSTRACT_REQUIRED_FIELD", `${req.field} not concrete`, {
            field: req.field,
            blockId: g.blockId,
          }),
        );
      }
      if (
        entity &&
        (!entity.origin || entity.origin === "STRUCTURAL_SOURCE") &&
        isAbstractFallbackLabel(entity.value)
      ) {
        issues.push(
          issue("GROUNDING_REVIEW_REQUIRED", `${req.field} only has structural fallback`, {
            field: req.field,
          }),
        );
      }
    }
    for (const [slotId, p] of Object.entries(record(g.participants))) {
      if (p.unresolved || !p.characterId || !p.displayName) {
        issues.push(
          issue("PROJECTION_GROUNDING_BLOCKED", `role slot ${slotId} unresolved`, { slotId }),
        );
      }
    }
  }

  const roleScopeLeaks = roleScopeLeaksInPacketSet(packetSet, productionMasterDraft);
  for (const leak of roleScopeLeaks) {
    issues.push(
      issue("ROLE_SCOPE_LEAK", `${leak.characterName || leak.characterId} role scope leak`, leak),
    );
  }

  const underspecified = underspecifiedActions(grounded);
  for (const u of underspecified) {
    issues.push(issue("ACTION_UNDERSPECIFIED", u, { detail: u }));
  }

  const ok =
    unresolvedSymbolicSlots.length === 0 &&
    abstractRequiredFields.length === 0 &&
    roleScopeLeaks.length === 0 &&
    underspecified.length === 0 &&
    !issues.some(
      (i) =>
        i.code === "PROJECTION_GROUNDING_BLOCKED" ||
        i.code === "GROUNDING_LOST_IN_PMD",
    );

  return {
    ok,
    status: ok ? "PASS" : "BLOCKED",
    unresolvedSymbolicSlots,
    abstractRequiredFields,
    roleScopeLeaks,
    underspecifiedActions: underspecified,
    issues,
    groundedProjections: grounded,
    packetCaptures: grounded.map((g) => g.packetCapture),
  };
}

export function attachGroundedProjectionsToPacketSet(packetSet, groundedProjections = []) {
  const captures = asArray(groundedProjections).map((g) => g.packetCapture).filter(Boolean);
  const byTemplate = Object.fromEntries(
    asArray(groundedProjections)
      .filter((g) => g?.templateId)
      .map((g) => [g.templateId, g]),
  );
  return {
    ...packetSet,
    groundedExperience: {
      projections: groundedProjections,
      captures,
      byTemplate,
    },
  };
}
