/**
 * P10.4 — Grounded Production Projection (thin contract).
 * Does not create STORY, mutate Context rules, or change Writer prompts.
 * Answers: who / what / terms / actions for an abstract semantic instance.
 */

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value, maximum = 400) {
  return String(value ?? "").trim().slice(0, maximum);
}

/** Template fallback labels that must never reach Writer as "concrete". */
export const ABSTRACT_FALLBACK_LABELS = Object.freeze(
  new Set([
    "可交换标的",
    "可私下谈判的场所",
    "换手凭证",
    "关键证物",
    "关键场所",
    "某个关键东西",
  ]),
);

/** M12 required fields → grounding level (data contract, not NLP). */
export const M12_FIELD_REQUIREMENTS = Object.freeze([
  Object.freeze({ field: "contestedStake", required: true, groundingLevel: "CONCRETE_ENTITY" }),
  Object.freeze({ field: "seekerNeed", required: true, groundingLevel: "CONCRETE_MOTIVE" }),
  Object.freeze({ field: "holderPrice", required: true, groundingLevel: "CONCRETE_TERM" }),
  Object.freeze({ field: "exchangeTerms", required: true, groundingLevel: "CONCRETE_TERM" }),
  Object.freeze({ field: "afterOwner", required: true, groundingLevel: "CONCRETE_ACTOR_OR_STATE" }),
  Object.freeze({ field: "aftermathChoice", required: true, groundingLevel: "CONCRETE_CHOICE" }),
]);

/** Projection aliases: consume Context without changing Context schema. */
export const CONTEXT_SLOT_ALIASES = Object.freeze({
  contestedStake: Object.freeze(["contestedStake", "core_object", "contestedResource", "centralDocument"]),
  bargainVenue: Object.freeze(["bargainVenue", "venue", "factionMeetingPlace"]),
  accessProof: Object.freeze(["accessProof", "credential", "accessCredential", "access_record"]),
});

export const PROJECTION_ISSUE_CODES = Object.freeze([
  "SYMBOLIC_SLOT_LEAK",
  "ABSTRACT_REQUIRED_FIELD",
  "ROLE_SCOPE_LEAK",
  "ACTION_UNDERSPECIFIED",
  "GROUNDING_LOST_IN_PMD",
  "GROUNDING_LOST_IN_PACKET",
  "PROJECTION_GROUNDING_BLOCKED",
  "GROUNDING_REVIEW_REQUIRED",
]);

export function isAbstractFallbackLabel(label) {
  const text = cleanText(label, 200);
  if (!text) return true;
  return ABSTRACT_FALLBACK_LABELS.has(text);
}

export function roleFillContext(roleBindings = {}) {
  const out = {};
  for (const [slotId, binding] of Object.entries(record(roleBindings))) {
    const name = cleanText(binding?.name || binding?.displayName || binding?.id, 80);
    if (name) out[slotId] = name;
  }
  return out;
}

export function collectSymbolicSlotIds({ roleSlots = null, plotSlots = null, roleBindings = null } = {}) {
  const ids = new Set();
  for (const key of Object.keys(record(roleSlots))) ids.add(key);
  for (const key of Object.keys(record(plotSlots))) ids.add(key);
  for (const key of Object.keys(record(roleBindings))) ids.add(key);
  // Always include M12 core roles even if template omitted
  for (const key of ["bargainA", "bargainB", "stakeholder", "witness", "bearer", "knower"]) {
    if (roleBindings?.[key] || roleSlots?.[key]) ids.add(key);
  }
  return [...ids].filter(Boolean).sort((a, b) => b.length - a.length);
}

/**
 * Replace {ctx.x}, {slot}, and bare camelCase slot identifiers with grounded names.
 * Missing binding → leave token and let audit raise PROJECTION_GROUNDING_BLOCKED
 * (never silently use slotId as display name).
 */
export function groundSurfaceText(text, { roleBindings = {}, labelMap = {}, slotIds = null } = {}) {
  if (text == null || text === "") return text;
  let out = String(text);
  const labels = record(labelMap);
  const roles = roleFillContext(roleBindings);
  out = out.replace(/\{ctx\.([a-zA-Z0-9_]+)\}/g, (full, key) =>
    Object.prototype.hasOwnProperty.call(labels, key) ? String(labels[key]) : full,
  );
  out = out.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (full, key) => {
    if (Object.prototype.hasOwnProperty.call(roles, key) && roles[key]) return roles[key];
    if (Object.prototype.hasOwnProperty.call(labels, key) && labels[key]) return String(labels[key]);
    return full;
  });
  const ids = asArray(slotIds).length
    ? asArray(slotIds)
    : collectSymbolicSlotIds({ roleBindings });
  for (const slotId of ids) {
    const name = roles[slotId];
    if (!name || name === slotId) continue;
    const re = new RegExp(`\\b${slotId}\\b`, "g");
    out = out.replace(re, name);
  }
  return out;
}

export function findUnresolvedSymbolicSlots(text, slotIds = []) {
  const hay = String(text ?? "");
  const hits = [];
  for (const slotId of asArray(slotIds)) {
    if (!slotId || slotId.length < 2) continue;
    if (new RegExp(`\\b${slotId}\\b`).test(hay)) hits.push(slotId);
  }
  return [...new Set(hits)];
}

function pickContextBinding(profile, aliasKeys) {
  const bindings = record(profile?.bindings);
  let best = null;
  for (const key of asArray(aliasKeys)) {
    const b = bindings[key];
    if (!b?.label) continue;
    const source = String(b.source || "");
    if (source === "PROJECT_EXPLICIT" || source === "AUTHOR_EXPLICIT") return { key, binding: b };
    if (!best) best = { key, binding: b };
  }
  return best;
}

/**
 * Build label map for a bridge: Context aliases + plot overlay.
 * Prefer PROJECT_EXPLICIT context entities over template fallbacks.
 */
export function buildContextLabelMapForBridge({
  bridge = null,
  contextProfile = null,
  plot = null,
} = {}) {
  const slots = record(bridge?.contextSlots);
  const plotRec = record(plot);
  const out = {};
  const provenance = {};

  for (const [slotKey, def] of Object.entries(slots)) {
    const aliases = CONTEXT_SLOT_ALIASES[slotKey] || [slotKey];
    const picked = pickContextBinding(contextProfile, aliases);
    const plotVal = cleanText(plotRec[slotKey], 200);
    const fallback = cleanText(def?.fallbackLabel, 120);

    if (picked?.binding?.label) {
      const src = String(picked.binding.source || "");
      const preferContext =
        src === "PROJECT_EXPLICIT" ||
        src === "AUTHOR_EXPLICIT" ||
        !plotVal ||
        isAbstractFallbackLabel(plotVal);
      if (preferContext) {
        out[slotKey] = picked.binding.label;
        provenance[slotKey] = {
          origin: src === "PROJECT_EXPLICIT" || src === "AUTHOR_EXPLICIT" ? "PROJECT_CONTEXT" : "STRUCTURAL_SOURCE",
          sourceRef: picked.key,
        };
        continue;
      }
    }
    if (plotVal && !isAbstractFallbackLabel(plotVal)) {
      out[slotKey] = groundSurfaceText(plotVal, { roleBindings: {}, labelMap: out });
      provenance[slotKey] = { origin: "STORY_SLOT", sourceRef: `plot.${slotKey}` };
      continue;
    }
    if (picked?.binding?.label) {
      out[slotKey] = picked.binding.label;
      provenance[slotKey] = { origin: "PROJECT_CONTEXT", sourceRef: picked.key };
      continue;
    }
    if (fallback) {
      out[slotKey] = fallback;
      provenance[slotKey] = { origin: "STRUCTURAL_SOURCE", sourceRef: `fallback.${slotKey}` };
    }
  }

  // Overlay remaining plot keys (seekerNeed, holderPrice, …)
  for (const [key, raw] of Object.entries(plotRec)) {
    if (out[key]) continue;
    const val = cleanText(raw, 200);
    if (!val) continue;
    out[key] = val;
    provenance[key] = { origin: "STORY_SLOT", sourceRef: `plot.${key}` };
  }

  return { labelMap: out, provenance };
}

export function groundedValue(value, { kind = "OBJECT", origin = "STORY_SLOT", sourceRef = null } = {}) {
  return {
    value: cleanText(value, 240),
    kind,
    origin,
    sourceRef,
  };
}

/**
 * Thin GroundedExperienceProjection for M12 (and no-op for others).
 */
export function buildGroundedExperienceProjection({
  block = null,
  contextProfile = null,
  bridge = null,
} = {}) {
  if (!block) return null;
  const templateId = block.templateId || null;
  if (templateId !== "M12-1" && block.familyId !== "M12") return null;

  const roleBindings = record(block.roleBindings);
  const plot = record(block.plotBindings);
  const { labelMap, provenance } = buildContextLabelMapForBridge({
    bridge,
    contextProfile,
    plot,
  });

  const participants = {};
  for (const [slotId, binding] of Object.entries(roleBindings)) {
    const characterId = binding?.id || binding?.characterId;
    const displayName = cleanText(binding?.name || binding?.displayName, 80);
    if (!characterId || !displayName || displayName === slotId) {
      participants[slotId] = {
        characterId: characterId || null,
        displayName: displayName || null,
        authority: slotId === "bargainA" ? "SEEKER" : slotId === "bargainB" ? "HOLDER" : "OTHER",
        unresolved: true,
      };
      continue;
    }
    participants[slotId] = {
      characterId,
      displayName,
      authority: slotId === "bargainA" ? "SEEKER" : slotId === "bargainB" ? "HOLDER" : "OTHER",
      unresolved: false,
    };
  }

  const entities = {};
  for (const req of M12_FIELD_REQUIREMENTS) {
    const field = req.field;
    let raw = labelMap[field] || plot[field] || "";
    raw = groundSurfaceText(raw, { roleBindings, labelMap });
    const prov = provenance[field] || { origin: "STORY_SLOT", sourceRef: `plot.${field}` };
    const kind =
      field === "contestedStake"
        ? "OBJECT"
        : field === "afterOwner"
          ? "RELATIONSHIP_STATE"
          : field === "aftermathChoice"
            ? "CONDITION"
            : "CONDITION";
    entities[field] = groundedValue(raw, {
      kind,
      origin: prov.origin,
      sourceRef: prov.sourceRef,
    });
  }

  const seeker = participants.bargainA;
  const holder = participants.bargainB;
  const stake = entities.contestedStake?.value;
  const openingOffer = entities.holderPrice?.value;
  const exchangeTerms = entities.exchangeTerms?.value;
  const seekerNeed = entities.seekerNeed?.value;

  const actions = [
    {
      kind: "NEGOTIATE",
      actor: seeker ? { characterId: seeker.characterId, displayName: seeker.displayName } : null,
      counterpart: holder ? { characterId: holder.characterId, displayName: holder.displayName } : null,
      wants: stake,
      controls: stake,
      openingOffer,
      hiddenConstraint: seekerNeed ? `需求方动机：${seekerNeed}` : null,
      acceptableTerms: exchangeTerms ? [exchangeTerms] : [],
      counterOptions: [
        openingOffer ? `接受：${openingOffer}` : null,
        exchangeTerms ? `改写条件：围绕「${exchangeTerms}」提出替代方案` : null,
      ].filter(Boolean),
      onAgreement: entities.afterOwner?.value || null,
      onRefusal: "掌握方继续独占；需求方失去该项信息/权限优势",
    },
    {
      kind: "EXCHANGE",
      beforeOwner: holder?.displayName || null,
      action: "完成换手并交付凭证",
      afterOwner: groundSurfaceText(entities.afterOwner?.value || "", { roleBindings, labelMap }),
      stake,
      proof: labelMap.accessProof || null,
    },
  ];

  const aftermathChoice = entities.aftermathChoice?.value;
  const audienceScopes = [
    {
      visibility: "OWNER_ONLY",
      ownerCharacterIds: [seeker?.characterId, holder?.characterId].filter(Boolean),
      note: "议价动机与底线仅进入当事人角色本",
    },
    {
      visibility: "PARTICIPANTS",
      participantCharacterIds: Object.values(participants)
        .map((p) => p.characterId)
        .filter(Boolean),
      note: "同场者可见公开换手事实，不继承 OWNER 目标",
    },
  ];

  return {
    blockId: block.id || block.blockId || null,
    templateId: templateId || "M12-1",
    familyId: "M12",
    participants,
    entities,
    actions,
    aftermath: aftermathChoice
      ? [
          {
            choiceId: "PUBLICIZE",
            choice: aftermathChoice,
            delta: {
              ownershipChanges: stake ? [`${stake} → ${actions[1].afterOwner || "新掌握方"}`] : [],
              accessChanges: labelMap.accessProof ? [`交付 ${labelMap.accessProof}`] : [],
              knowledgeChanges: ["相关在场者可获知交换曾发生"],
              relationshipChanges: ["双方关系进入换手后重谈"],
              downstreamBeatEffects: [],
            },
          },
          {
            choiceId: "CONTINUE",
            choice: "继续合作",
            delta: {
              ownershipChanges: [],
              accessChanges: [],
              knowledgeChanges: [],
              relationshipChanges: [`${seeker?.displayName || "需求方"}/${holder?.displayName || "掌握方"}保持合作`],
              downstreamBeatEffects: [],
            },
          },
          {
            choiceId: "BREAK",
            choice: "撕毁承诺",
            delta: {
              ownershipChanges: [],
              accessChanges: [],
              knowledgeChanges: [],
              relationshipChanges: ["双方关系状态 = HOSTILE"],
              downstreamBeatEffects: [],
            },
          },
        ]
      : [],
    audienceScopes,
    provenance: {
      labelMap,
      fieldProvenance: provenance,
    },
    packetCapture: {
      templateId: templateId || "M12-1",
      roles: {
        seeker: seeker?.displayName || null,
        holder: holder?.displayName || null,
      },
      stake: stake || null,
      seekerNeed: seekerNeed || null,
      holderPrice: openingOffer || null,
      openingOffer: openingOffer || null,
      counterOptions: actions[0].counterOptions,
      exchange: {
        beforeOwner: holder?.displayName || null,
        afterOwner: actions[1].afterOwner || null,
      },
      aftermath: (aftermathChoice
        ? [
            { choice: aftermathChoice, delta: "知情扩散 / 关系重谈" },
            { choice: "继续合作", delta: "合作关系维持" },
            { choice: "撕毁承诺", delta: "关系 = HOSTILE" },
          ]
        : []),
    },
  };
}

export function assertNoUnresolvedSemanticSlots(texts, slotIds) {
  const unresolved = [];
  for (const text of asArray(texts)) {
    unresolved.push(...findUnresolvedSymbolicSlots(text, slotIds));
  }
  return {
    ok: unresolved.length === 0,
    unresolvedSymbolicSlots: [...new Set(unresolved)],
  };
}
