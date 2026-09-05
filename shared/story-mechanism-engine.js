/**
 * Story Mechanism Production Engine V1 — 数据驱动通用引擎
 *
 * 所有 STORY 机制共用；禁止子型专用 generateM01Xxx / generateM07Xxx。
 */

import {
  createProjectStoryState,
  findBlock,
  listAvailableCharacters,
  normalizeStoryMechanismBlock,
  rebuildLegacyAssignments,
  removeBlockFromState,
  replaceBlock,
  characterLoadScore,
} from "./story-mechanism-contracts.js";
import { getStoryTemplate, getStoryVariant } from "./story-mechanism-registry.js";
import {
  formatAgencySummary,
  isInternalCompletionSummary,
  resolveBeatSemantics,
} from "./story-beat-semantics.js";
import { semanticsBridgeForTemplate } from "./complete-beat-semantics-data.js";

export class StoryMechanismEngineError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "StoryMechanismEngineError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function fail(code, message, details) {
  throw new StoryMechanismEngineError(code, message, details);
}

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function nameOf(bindings, key) {
  return bindings[key]?.name || `「${key}」`;
}

function stageLabel(stage) {
  if (!stage) return "";
  if (typeof stage === "string") return stage;
  return stage.label || stage.id || stage.stageRole || "";
}

function bindRoles(state, template, { intentionalOverlap = false, preserve = null } = {}) {
  const used = new Set();
  const roleBindings = {};
  if (preserve) {
    for (const [k, ref] of Object.entries(preserve)) {
      if (ref?.id) {
        roleBindings[k] = ref;
        used.add(ref.id);
      } else {
        roleBindings[k] = null;
      }
    }
  }
  const playerPool = listAvailableCharacters(state, {
    allowNpc: false,
    maxLoad: intentionalOverlap ? 99 : 2,
  }).sort((a, b) => characterLoadScore(state, a.id) - characterLoadScore(state, b.id));
  const anyPool = listAvailableCharacters(state, {
    allowNpc: true,
    maxLoad: intentionalOverlap ? 99 : 3,
  }).sort((a, b) => characterLoadScore(state, a.id) - characterLoadScore(state, b.id));

  for (const [key, slot] of Object.entries(template.roleSlots || {})) {
    if (roleBindings[key] !== undefined && (preserve?.[key] !== undefined || roleBindings[key])) {
      continue;
    }
    const pool = slot.allowNpc ? anyPool : playerPool;
    const free = pool.filter((c) => !used.has(c.id));
    if (!slot.required && !free.length) {
      roleBindings[key] = null;
      continue;
    }
    const forbidden = new Set(
      (slot.mustDifferFrom || [])
        .map((other) => roleBindings[other]?.id)
        .filter(Boolean),
    );
    const filtered = free.filter((c) => !forbidden.has(c.id));
    if (!filtered.length) {
      if (!slot.required) {
        roleBindings[key] = null;
        continue;
      }
      fail("STORY_ROLE_CONFLICT", `Cannot bind role ${key}`, { key, templateId: template.id });
    }
    const chosen = filtered[0];
    used.add(chosen.id);
    roleBindings[key] = { id: chosen.id, name: chosen.name };
  }
  return roleBindings;
}

function buildPlotBindings(template, variant, overrides = {}, lockedSlots = [], slotSources = {}) {
  const out = { ...(variant.defaults || {}) };
  for (const [key, slot] of Object.entries(template.plotSlots || {})) {
    if (out[key] != null) continue;
    if (slot.presets?.length) out[key] = slot.presets[0];
    else out[key] = slot.label || key;
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (lockedSlots.includes(key) || slotSources[key] === "USER") {
      out[key] = value;
    } else if (overrides[key] !== undefined) {
      out[key] = value;
    }
  }
  // locked / USER always win
  for (const key of lockedSlots) {
    if (overrides[key] !== undefined) out[key] = overrides[key];
  }
  for (const [key, src] of Object.entries(slotSources)) {
    if (src === "USER" && overrides[key] !== undefined) out[key] = overrides[key];
  }
  return out;
}

function buildClueBindings(template, plot, roleBindings, blockId) {
  return (template.clueSlots || []).map((slot, index) => {
    const id = typeof slot === "string" ? slot : slot.id;
    const purpose = typeof slot === "string" ? id : slot.purpose || id;
    let summary = plot[id] || plot.plantedEvidence || plot.coreReveal || plot.judgmentQuestion || purpose;
    if (id === "FALSE_LEAD") summary = plot.plantedEvidence || plot.falseLead || summary;
    if (id === "CONTRADICTION") summary = plot.contradiction || summary;
    if (id === "TRUE_EVIDENCE") summary = `${plot.trueMethod || plot.trueAnswer || "真实痕迹"}`;
    if (id === "DECISIVE_EVIDENCE") summary = plot.decisiveEvidence || summary;
    if (id === "HOOK") summary = plot.dramaticQuestion || plot.judgmentQuestion || summary;
    if (id === "PAYOFF") summary = plot.coreReveal || plot.trueAnswer || summary;
    return {
      slotKey: id,
      clueId: `${blockId}-${id.toLowerCase()}-${index}`,
      label: purpose,
      summary: String(summary),
      pointsToRoleKey: null,
    };
  });
}

function enrichBeat(beat, { template, variant, roleBindings, plot, phaseBand, sourceBlockId }) {
  const bridge = template.semanticsBridge || semanticsBridgeForTemplate(template.id);
  const semantics = resolveBeatSemantics({
    bridge,
    phaseBand,
    roleBindings,
    plot,
    involvedRoleKeys: beat.involvedRoleKeys,
    variant,
    sourceBlockId,
    sourceBeatId: beat.id,
  });
  let summary = beat.summary;
  if (isInternalCompletionSummary(summary)) {
    summary = semantics
      ? formatAgencySummary(semantics, "NEEDS_DETAIL：缺具体行动")
      : "NEEDS_DETAIL：缺具体行动";
  } else if (semantics?.goal && semantics?.action) {
    // Prefer agency sentence for COMPLETE bridges; keep original as fallback detail
    summary = formatAgencySummary(semantics, summary);
  }
  return { ...beat, summary, semantics };
}

function buildBeats(template, variant, roleBindings, plot, clues, sourceBlockId = null) {
  const pattern = variant.beatPattern || {};
  const keys = Object.keys(pattern);
  const stages = template.stagePattern || [];
  const make = (id, stageKey, summary, roleKeys, clueIds, phaseBand) =>
    enrichBeat(
      {
        id,
        stageKey,
        summary,
        involvedRoleKeys: roleKeys.filter((k) => roleBindings[k]),
        clueIds,
      },
      { template, variant, roleBindings, plot, phaseBand, sourceBlockId },
    );
  // M01-FRAMING shaped beats
  if (pattern.setup && pattern.crime) {
    return {
      setup: [
        make(
          "beat-setup",
          "SETUP",
          `${pattern.setup}。${roleBindings.culprit ? `真凶 ${nameOf(roleBindings, "culprit")}` : ""} ${plot.trueMotive ? `动机：${plot.trueMotive}` : ""}`.trim(),
          ["culprit", "framedCharacter", "focusCharacter", "bearer", "actor"],
          [],
          0,
        ),
      ],
      progression: [
        make(
          "beat-crime",
          stages[1]?.id || "CRIME_DISCOVERY",
          `${pattern.crime}${plot.trueMethod ? `（${plot.trueMethod}）` : ""}`,
          ["victim", "discoverer", "culprit", "subject", "investigator"],
          clues[0] ? [clues[0].clueId] : [],
          1,
        ),
        make(
          "beat-false",
          stages[2]?.id || "FALSE_DIRECTION",
          `${pattern.falseDirection || pattern.develop || ""} ${plot.apparentConclusion || plot.falseLead || ""}`.trim(),
          ["framedCharacter", "subject", "discoverer"],
          clues[0] ? [clues[0].clueId] : [],
          2,
        ),
        make(
          "beat-contra",
          stages[3]?.id || "CONTRADICTION",
          `${pattern.contradiction || ""} ${plot.contradiction || ""}`.trim(),
          ["discoverer", "investigator", "witness"],
          clues[1] ? [clues[1].clueId] : [],
          3,
        ),
      ],
      climax: [
        make(
          "beat-climax",
          stages[4]?.id || stages[stages.length - 1]?.id || "RESOLVE",
          `${pattern.reveal || pattern.resolve || ""} ${plot.decisiveEvidence || plot.coreReveal || ""}`.trim(),
          ["culprit", "framedCharacter", "focusCharacter", "decisionMaker"],
          clues.slice(2).map((c) => c.clueId),
          4,
        ),
      ],
      resolution: [
        make(
          "beat-res",
          stages[stages.length - 1]?.id || "RESOLVE",
          `${template.title}收束。${plot.concealmentMethod || plot.endingA || plot.openCondition || ""}`.trim(),
          Object.keys(roleBindings),
          clues.slice(-1).map((c) => c.clueId),
          4,
        ),
      ],
    };
  }

  // Generic 3-beat
  const setupKey = stages[0]?.id || "SETUP";
  const developKey = stages[1]?.id || keys[1] || "DEVELOP";
  const resolveKey = stages[stages.length - 1]?.id || "RESOLVE";
  return {
    setup: [
      make(
        "beat-setup",
        setupKey,
        `${pattern.setup || pattern[keys[0]] || "建立关注点"}；焦点：${nameOf(roleBindings, Object.keys(roleBindings)[0])}。`,
        Object.keys(roleBindings).slice(0, 2),
        clues[0] ? [clues[0].clueId] : [],
        0,
      ),
    ],
    progression: [
      make(
        "beat-develop",
        developKey,
        `${pattern.develop || pattern[keys[1]] || "推进冲突"} ${plot.dramaticQuestion || plot.judgmentQuestion || plot.publicGoal || ""}`.trim(),
        Object.keys(roleBindings),
        clues[0] ? [clues[0].clueId] : [],
        1,
      ),
    ],
    climax: [
      make(
        "beat-climax",
        resolveKey,
        `${pattern.resolve || pattern.reveal || pattern[keys[keys.length - 1]] || "收束"} ${plot.coreReveal || plot.trueAnswer || plot.endingA || plot.stateChange || ""}`.trim(),
        Object.keys(roleBindings),
        clues.slice(1).map((c) => c.clueId),
        2,
      ),
    ],
    resolution: [
      make(
        "beat-res",
        resolveKey,
        `${template.title}阶段完成。`,
        Object.keys(roleBindings),
        [],
        3,
      ),
    ],
  };
}

function buildBlockFromTemplate({
  template,
  variant,
  state,
  roleBindings,
  plotOverrides,
  lockedSlots,
  slotSources,
  blockId,
  status,
  revision,
}) {
  const id = blockId || newId("smb");
  const plotBindings = buildPlotBindings(
    template,
    variant,
    { ...plotOverrides },
    lockedSlots,
    slotSources,
  );
  // Ensure locked/user values applied from plotOverrides
  for (const key of lockedSlots) {
    if (plotOverrides[key] !== undefined) plotBindings[key] = plotOverrides[key];
  }
  for (const [key, src] of Object.entries(slotSources || {})) {
    if (src === "USER" && plotOverrides[key] !== undefined) plotBindings[key] = plotOverrides[key];
  }
  for (const [key, ref] of Object.entries(roleBindings)) {
    if ((lockedSlots.includes(key) || slotSources?.[key] === "USER") && plotOverrides[`__role__${key}`]) {
      // no-op; roles passed in
    }
  }

  const clueBindings = buildClueBindings(template, plotBindings, roleBindings, id);
  const beats = buildBeats(template, variant, roleBindings, plotBindings, clueBindings, id);
  const stageBindings = (template.stagePattern || []).map((stage, order) => {
    const patternKey = typeof stage === "string" ? stage : stage.id;
    const matched = state.stages[order] || null;
    return {
      patternKey,
      stageId: matched?.id || null,
      stageLabel: matched?.label || stageLabel(stage) || patternKey,
      order,
    };
  });

  return normalizeStoryMechanismBlock({
    id,
    mechanismId: template.id,
    familyId: template.familyId,
    templateId: template.id,
    title: `${template.title}｜${variant.title || variant.name || variant.id}`,
    purpose: template.purpose,
    variantId: variant.id,
    revision: revision || 1,
    roleBindings,
    plotBindings,
    slotSources: { ...(slotSources || {}) },
    clueBindings,
    stageBindings,
    ...beats,
    prerequisites: [],
    consequences: [{ type: "ASSIGNMENT", summary: "写入 roleAssignments" }],
    exposedFacts: [],
    reservedFacts: Object.entries(roleBindings)
      .filter(([, ref]) => ref?.id)
      .map(([slotId, ref]) => {
        const narrativeRole = template.roleSlots[slotId]?.narrativeRole || slotId;
        // M01 兼容：culprit 槽对外 kind 仍可用 culprit
        const kind =
          slotId === "culprit" ? "culprit" : slotId === "framedCharacter" ? "frame" : narrativeRole;
        return {
          id: `${id}-reserve-${slotId}`,
          kind,
          summary: `${ref.name} 承担 ${template.roleSlots[slotId]?.label || slotId}`,
          characterIds: [ref.id],
          secret: true,
        };
      }),
    editableSlots: (template.editableSlots || []).map((s) => ({
      ...s,
      key: s.key || s.id,
      locked: lockedSlots.includes(s.key || s.id),
    })),
    lockedSlots,
    integrationHints: template.integrationHints || {},
    status: status || "DRAFT",
  });
}

function assignmentsFromBlock(block, template, intentionalOverlap = false) {
  const rows = [];
  for (const [slotId, ref] of Object.entries(block.roleBindings || {})) {
    if (!ref?.id) continue;
    const slot = template?.roleSlots?.[slotId] || {};
    rows.push({
      mechanismBlockId: block.id,
      mechanismId: block.mechanismId,
      slotId,
      characterId: ref.id,
      intensity: Number(slot.intensity) || 1,
      intentionalOverlap: Boolean(intentionalOverlap),
      narrativeRole: slot.narrativeRole || slotId,
    });
  }
  return rows;
}

function syncStateAfterBlocks(state) {
  const next = createProjectStoryState(state);
  // Rebuild roleAssignments strictly from current blocks
  const templateCache = new Map();
  const rows = [];
  for (const block of next.mechanismBlocks) {
    let tpl = templateCache.get(block.templateId);
    if (!tpl) {
      tpl = getStoryTemplate(block.templateId);
      templateCache.set(block.templateId, tpl);
    }
    rows.push(...assignmentsFromBlock(block, tpl, false));
  }
  next.roleAssignments = rows;
  next.assignments = rebuildLegacyAssignments(rows);

  // Rebuild clues/facts from blocks (drop orphans)
  const blockIds = new Set(next.mechanismBlocks.map((b) => b.id));
  next.clues = next.mechanismBlocks.flatMap((b) =>
    (b.clueBindings || []).map((c) => ({
      id: c.clueId,
      slotKey: c.slotKey,
      label: c.label,
      summary: c.summary,
      sourceBlockId: b.id,
    })),
  );
  next.facts = next.mechanismBlocks.flatMap((b) => [...(b.exposedFacts || []), ...(b.reservedFacts || [])]);

  // character load tags
  next.characters = next.characters.map((c) => {
    const tags = new Set();
    for (const row of rows) {
      if (row.characterId === c.id && row.narrativeRole) tags.add(row.narrativeRole);
    }
    return { ...c, loadTags: [...tags] };
  });

  // drop dangling
  void blockIds;
  return next;
}

function writeBlock(state, block, { intentionalOverlap = false } = {}) {
  const withBlock = replaceBlock(createProjectStoryState(state), block);
  return syncStateAfterBlocks(withBlock);
}

/**
 * 通用生成
 */
export function generateStoryMechanism({
  templateId,
  projectStoryState,
  preferredVariantId,
  lockedSlots = [],
  intentionalOverlap = false,
  plotOverrides = {},
  preserveRoleBindings = null,
  blockId = null,
  status = "DRAFT",
  revision = 1,
} = {}) {
  const template = getStoryTemplate(templateId);
  if (!template) fail("STORY_TEMPLATE_UNKNOWN", `Unknown story template ${templateId}`, { templateId });
  const state = createProjectStoryState(projectStoryState);
  const variantId =
    preferredVariantId ||
    template.defaultGeneration?.preferredVariantId ||
    template.variants[0]?.id;
  const variant = getStoryVariant(templateId, variantId) || template.variants[0];
  if (!variant) fail("STORY_NO_VARIANT", `No variant on ${templateId}`);

  const roleBindings = bindRoles(state, template, {
    intentionalOverlap,
    preserve: preserveRoleBindings,
  });
  const block = buildBlockFromTemplate({
    template,
    variant,
    state,
    roleBindings,
    plotOverrides,
    lockedSlots: [...lockedSlots],
    slotSources: {},
    blockId,
    status,
    revision,
  });
  return writeBlock(state, block, { intentionalOverlap });
}

export function acceptStoryBlock(projectStoryState, blockId) {
  const state = createProjectStoryState(projectStoryState);
  const block = findBlock(state, blockId);
  if (!block) fail("STORY_BLOCK_MISSING", `Unknown block ${blockId}`, { blockId });
  return writeBlock(state, {
    ...block,
    status: "USER_ACCEPTED",
    revision: (block.revision || 1) + 1,
  });
}

export function swapStoryVariant(projectStoryState, blockId, variantId) {
  const state = createProjectStoryState(projectStoryState);
  const block = findBlock(state, blockId);
  if (!block) fail("STORY_BLOCK_MISSING", `Unknown block ${blockId}`, { blockId });
  const template = getStoryTemplate(block.templateId);
  if (!template) fail("STORY_TEMPLATE_UNKNOWN", block.templateId);
  const variant = getStoryVariant(block.templateId, variantId);
  if (!variant) fail("STORY_VARIANT_UNKNOWN", `Unknown variant ${variantId}`, { variantId });

  const lockedSlots = [
    ...new Set([
      ...block.lockedSlots,
      ...block.editableSlots.filter((s) => s.locked).map((s) => s.key),
    ]),
  ];
  const slotSources = { ...(block.slotSources || {}) };
  const plotOverrides = { ...block.plotBindings };
  // drop unlocked plot values so variant defaults refill
  for (const key of Object.keys(plotOverrides)) {
    if (!lockedSlots.includes(key) && slotSources[key] !== "USER") {
      delete plotOverrides[key];
    }
  }

  const next = buildBlockFromTemplate({
    template,
    variant,
    state,
    roleBindings: block.roleBindings,
    plotOverrides: { ...plotOverrides, ...Object.fromEntries(
      lockedSlots
        .filter((k) => block.plotBindings[k] !== undefined)
        .map((k) => [k, block.plotBindings[k]]),
    ) },
    lockedSlots,
    slotSources,
    blockId: block.id,
    status: "USER_MODIFIED",
    revision: (block.revision || 1) + 1,
  });
  next.editableSlots = next.editableSlots.map((s) => ({
    ...s,
    locked: lockedSlots.includes(s.key),
    source: slotSources[s.key] || s.source,
  }));
  return writeBlock(state, next);
}

function nextCandidate(list, current) {
  if (!list.length) return current;
  const idx = list.indexOf(current);
  return list[(idx + 1) % list.length];
}

export function swapStorySlot(projectStoryState, blockId, slotId) {
  const state = createProjectStoryState(projectStoryState);
  const block = findBlock(state, blockId);
  if (!block) fail("STORY_BLOCK_MISSING", `Unknown block ${blockId}`, { blockId });
  const template = getStoryTemplate(block.templateId);
  if (!template) fail("STORY_TEMPLATE_UNKNOWN", block.templateId);
  const slotMeta =
    block.editableSlots.find((s) => s.key === slotId || s.id === slotId) ||
    template.editableSlots.find((s) => (s.key || s.id) === slotId);
  if (!slotMeta) fail("STORY_SLOT_UNKNOWN", `Unknown slot ${slotId}`, { slotId });
  if (slotMeta.locked || block.lockedSlots.includes(slotId)) {
    fail("STORY_SLOT_LOCKED", `Slot ${slotId} is locked`, { slotId });
  }

  const roleBindings = { ...block.roleBindings };
  const plotOverrides = { ...block.plotBindings };
  const kind = slotMeta.kind || (template.roleSlots[slotId] ? "role" : "plot");

  if (kind === "role") {
    const roleSlot = template.roleSlots[slotId];
    if (!roleSlot) fail("STORY_SLOT_UNKNOWN", `Not a role slot ${slotId}`);
    const forbidden = new Set(
      Object.entries(roleBindings)
        .filter(([k]) => k !== slotId)
        .map(([, ref]) => ref?.id)
        .filter(Boolean),
    );
    for (const other of roleSlot.mustDifferFrom || []) {
      if (roleBindings[other]?.id) forbidden.add(roleBindings[other].id);
    }
    const pool = listAvailableCharacters(state, {
      allowNpc: Boolean(roleSlot.allowNpc),
      maxLoad: 99,
    }).filter((c) => !forbidden.has(c.id) || c.id === roleBindings[slotId]?.id);
    if (pool.length < 1) fail("STORY_NO_CHARACTER", `No alternate for ${slotId}`);
    const nextId = nextCandidate(
      pool.map((c) => c.id),
      roleBindings[slotId]?.id,
    );
    const chosen = pool.find((c) => c.id === nextId);
    roleBindings[slotId] = chosen ? { id: chosen.id, name: chosen.name } : null;
  } else {
    const plotSlot = template.plotSlots[slotId] || {};
    const presets = [
      ...(plotSlot.presets || []),
      ...template.variants.map((v) => v.defaults?.[slotId]).filter(Boolean),
    ];
    const unique = [...new Set(presets.map(String))];
    plotOverrides[slotId] = nextCandidate(unique, String(block.plotBindings[slotId] ?? ""));
  }

  const variant = getStoryVariant(block.templateId, block.variantId) || template.variants[0];
  const lockedSlots = [
    ...new Set([
      ...block.lockedSlots,
      ...block.editableSlots.filter((s) => s.locked).map((s) => s.key),
    ]),
  ];
  const next = buildBlockFromTemplate({
    template,
    variant,
    state,
    roleBindings,
    plotOverrides,
    lockedSlots,
    slotSources: block.slotSources,
    blockId: block.id,
    status: "USER_MODIFIED",
    revision: (block.revision || 1) + 1,
  });
  next.editableSlots = block.editableSlots;
  return writeBlock(state, next);
}

export function editStorySlot(projectStoryState, blockId, slotId, value) {
  const state = createProjectStoryState(projectStoryState);
  const block = findBlock(state, blockId);
  if (!block) fail("STORY_BLOCK_MISSING", `Unknown block ${blockId}`, { blockId });
  const template = getStoryTemplate(block.templateId);
  if (!template) fail("STORY_TEMPLATE_UNKNOWN", block.templateId);
  const slotMeta = block.editableSlots.find((s) => s.key === slotId || s.id === slotId);
  if (!slotMeta) fail("STORY_SLOT_UNKNOWN", `Unknown slot ${slotId}`, { slotId });
  if (slotMeta.locked || block.lockedSlots.includes(slotId)) {
    fail("STORY_SLOT_LOCKED", `Slot ${slotId} is locked`, { slotId });
  }

  const roleBindings = { ...block.roleBindings };
  const plotOverrides = { ...block.plotBindings };
  const slotSources = { ...(block.slotSources || {}), [slotId]: "USER" };
  const kind = slotMeta.kind || (template.roleSlots[slotId] ? "role" : "plot");

  if (kind === "role") {
    if (value == null) {
      if (template.roleSlots[slotId]?.required) {
        fail("STORY_ROLE_REQUIRED", `Role ${slotId} is required`);
      }
      roleBindings[slotId] = null;
    } else {
      const id = typeof value === "string" ? value : value.id;
      const char = state.characters.find((c) => c.id === id);
      if (!char) fail("STORY_NO_CHARACTER", `Unknown character ${id}`, { id });
      roleBindings[slotId] = { id: char.id, name: char.name };
    }
  } else {
    plotOverrides[slotId] = value;
  }

  const variant = getStoryVariant(block.templateId, block.variantId) || template.variants[0];
  const lockedSlots = [
    ...new Set([
      ...block.lockedSlots,
      ...block.editableSlots.filter((s) => s.locked).map((s) => s.key),
    ]),
  ];
  const next = buildBlockFromTemplate({
    template,
    variant,
    state,
    roleBindings,
    plotOverrides,
    lockedSlots,
    slotSources,
    blockId: block.id,
    status: "USER_MODIFIED",
    revision: (block.revision || 1) + 1,
  });
  next.slotSources = slotSources;
  next.editableSlots = block.editableSlots.map((s) =>
    s.key === slotId ? { ...s, source: "USER" } : s,
  );
  return writeBlock(state, next);
}

export function lockStorySlot(projectStoryState, blockId, slotId, locked = true) {
  const state = createProjectStoryState(projectStoryState);
  const block = findBlock(state, blockId);
  if (!block) fail("STORY_BLOCK_MISSING", `Unknown block ${blockId}`, { blockId });
  const lockedSlots = new Set(block.lockedSlots);
  if (locked) lockedSlots.add(slotId);
  else lockedSlots.delete(slotId);
  const editableSlots = block.editableSlots.map((s) =>
    s.key === slotId ? { ...s, locked: Boolean(locked) } : s,
  );
  return writeBlock(state, {
    ...block,
    lockedSlots: [...lockedSlots],
    editableSlots,
    status: "USER_MODIFIED",
    revision: (block.revision || 1) + 1,
  });
}

export function replaceStoryBlock(projectStoryState, block) {
  return writeBlock(createProjectStoryState(projectStoryState), normalizeStoryMechanismBlock(block));
}

export function removeStoryBlock(projectStoryState, blockId) {
  const cleared = removeBlockFromState(createProjectStoryState(projectStoryState), blockId);
  return syncStateAfterBlocks(cleared);
}

export function createDemoProjectState() {
  return createProjectStoryState({
    projectId: "demo-story-engine",
    premise: {
      genre: "古风推理",
      era: "架空王朝",
      tone: ["情感", "推理"],
      playerCount: 6,
      targetDuration: 180,
    },
    characters: [
      { id: "A", name: "白斋子" },
      { id: "B", name: "沈孤鸿" },
      { id: "C", name: "顾清商" },
      { id: "D", name: "杜霄元" },
      { id: "E", name: "叶晚晴" },
      { id: "F", name: "莫玄宗" },
      { id: "NPC_LU", name: "陆老爷", isNpc: true },
    ],
    stages: [
      { id: "act1", label: "第一幕", order: 0 },
      { id: "act2", label: "第二幕", order: 1 },
      { id: "act3", label: "第三幕", order: 2 },
      { id: "act4", label: "第四幕", order: 3 },
      { id: "act5", label: "终局", order: 4 },
    ],
    revision: 0,
    updatedAt: null,
  });
}

/** 新项目空积木篮：保留最小角色/幕 snapshot，不含 mechanismBlocks。 */
export function createInitialProjectStoryState(projectId) {
  const seed = createDemoProjectState();
  return createProjectStoryState({
    ...seed,
    projectId: String(projectId || "project"),
    mechanismBlocks: [],
    roleAssignments: [],
    facts: [],
    clues: [],
    constraints: [],
    unresolvedNeeds: [],
    revision: 0,
    updatedAt: null,
  });
}

// --- M01 兼容别名（不鼓励新代码使用） ---
export function generateM01Framing(state, opts = {}) {
  return generateStoryMechanism({
    templateId: "M01-FRAMING",
    projectStoryState: state,
    preferredVariantId: opts.variantId,
    intentionalOverlap: opts.intentionalOverlap,
    plotOverrides: opts.plotOverrides || {},
  });
}
