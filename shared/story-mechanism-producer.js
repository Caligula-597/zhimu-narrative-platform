/**
 * STORY 机制最小生成闭环（第一刀只接 M01-FRAMING）
 *
 * 流程：READ state → 选 variant → 占位角色 → 填槽 → Beat → WRITE BACK
 * 操作：生成 / 用这个 / 换结构 / 换单槽 / 手动改
 */

import {
  createProjectStoryState,
  findBlock,
  listAvailableCharacters,
  normalizeStoryMechanismBlock,
  replaceBlock,
  characterLoadScore,
} from "./story-mechanism-contracts.js";
import {
  M01_FRAMING,
  M01_FRAMING_FAMILY_ID,
  M01_FRAMING_MECHANISM_ID,
  M01_FRAMING_TEMPLATE_ID,
  M01_FRAMING_VARIANTS,
  M01_PLOT_CANDIDATES,
  getM01FramingVariant,
} from "./story-mechanism-m01-framing.js";

export class StoryMechanismProducerError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "StoryMechanismProducerError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function fail(code, message, details) {
  throw new StoryMechanismProducerError(code, message, details);
}

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function stageLabel(key) {
  const map = {
    SETUP: "铺垫",
    CRIME_DISCOVERY: "案发发现",
    FALSE_DIRECTION: "错误方向",
    CONTRADICTION: "反证出现",
    TRUTH_REVEAL: "真相揭示",
  };
  return map[key] || key;
}

function nameOf(bindings, key) {
  return bindings[key]?.name || `「${key}」`;
}

function bindRoles(state, intentionalOverlap = false) {
  const used = new Set();
  const roleBindings = {};
  const playerPool = listAvailableCharacters(state, {
    allowNpc: false,
    maxLoad: intentionalOverlap ? 99 : 2,
  }).sort((a, b) => characterLoadScore(state, a.id) - characterLoadScore(state, b.id));
  const anyPool = listAvailableCharacters(state, {
    allowNpc: true,
    maxLoad: intentionalOverlap ? 99 : 3,
  }).sort((a, b) => characterLoadScore(state, a.id) - characterLoadScore(state, b.id));

  for (const [key, slot] of Object.entries(M01_FRAMING.roleSlots)) {
    const pool = slot.allowNpc ? anyPool : playerPool;
    if (!slot.required && pool.filter((c) => !used.has(c.id)).length === 0) {
      roleBindings[key] = null;
      continue;
    }
    const forbidden = new Set(
      (slot.mustDifferFrom || [])
        .map((other) => roleBindings[other]?.id)
        .filter(Boolean),
    );
    const filtered = pool.filter((c) => !used.has(c.id) && !forbidden.has(c.id));
    if (!filtered.length) {
      if (!slot.required) {
        roleBindings[key] = null;
        continue;
      }
      fail("STORY_ROLE_CONFLICT", `Cannot bind role ${key}`, { key, used: [...used] });
    }
    const chosen = filtered[0];
    used.add(chosen.id);
    roleBindings[key] = { id: chosen.id, name: chosen.name };
  }
  return roleBindings;
}

function buildPlotBindings(variant, overrides = {}) {
  const base = {
    trueMotive: M01_PLOT_CANDIDATES.trueMotive[0],
    trueMethod: variant.defaults.trueMethod,
    plantedEvidence: variant.defaults.plantedEvidence,
    apparentConclusion: "被嫁祸者进入过现场并与死者起过冲突",
    contradiction: variant.defaults.contradiction,
    decisiveEvidence: variant.defaults.decisiveEvidence,
    concealmentMethod: variant.defaults.concealmentMethod,
    ...variant.defaults,
    ...overrides,
  };
  return base;
}

function buildClueBindings(plot, roleBindings) {
  return [
    {
      slotKey: "FALSE_LEAD",
      clueId: "clue-false",
      label: "误导线索",
      summary: plot.plantedEvidence,
      pointsToRoleKey: "framedCharacter",
    },
    {
      slotKey: "CONTRADICTION",
      clueId: "clue-contra",
      label: "反证",
      summary: plot.contradiction,
      pointsToRoleKey: null,
    },
    {
      slotKey: "TRUE_EVIDENCE",
      clueId: "clue-true",
      label: "真实手法痕迹",
      summary: `${plot.trueMethod}相关痕迹`,
      pointsToRoleKey: "culprit",
    },
    {
      slotKey: "DECISIVE_EVIDENCE",
      clueId: "clue-decisive",
      label: "关键突破",
      summary: plot.decisiveEvidence,
      pointsToRoleKey: "culprit",
    },
  ].map((c) => ({
    ...c,
    summary:
      c.pointsToRoleKey && roleBindings[c.pointsToRoleKey]
        ? `${c.summary}（指向 ${roleBindings[c.pointsToRoleKey].name}）`
        : c.summary,
  }));
}

function buildBeats(variant, roleBindings, plot, clues) {
  const o = variant.beatOutline;
  const culprit = nameOf(roleBindings, "culprit");
  const framed = nameOf(roleBindings, "framedCharacter");
  const victim = nameOf(roleBindings, "victim");
  const discoverer = roleBindings.discoverer
    ? nameOf(roleBindings, "discoverer")
    : "某人";
  return {
    setup: [
      {
        id: "beat-setup",
        stageKey: "SETUP",
        summary: `${o.setup}。真凶 ${culprit} 针对 ${framed} 布局；动机：${plot.trueMotive}。`,
        involvedRoleKeys: ["culprit", "framedCharacter"],
        clueIds: [],
      },
    ],
    progression: [
      {
        id: "beat-crime",
        stageKey: "CRIME_DISCOVERY",
        summary: `${victim} 遇害（${plot.trueMethod}）。${discoverer} 发现现场；${o.crime}。`,
        involvedRoleKeys: ["victim", "discoverer", "culprit"].filter(
          (k) => roleBindings[k],
        ),
        clueIds: [clues[0].clueId],
      },
      {
        id: "beat-false",
        stageKey: "FALSE_DIRECTION",
        summary: `${o.falseDirection}。表面判断：${plot.apparentConclusion}；误导物：${plot.plantedEvidence}。`,
        involvedRoleKeys: ["framedCharacter"],
        clueIds: [clues[0].clueId],
      },
      {
        id: "beat-contra",
        stageKey: "CONTRADICTION",
        summary: `${o.contradiction}：${plot.contradiction}。`,
        involvedRoleKeys: ["discoverer"].filter((k) => roleBindings[k]),
        clueIds: [clues[1].clueId],
      },
    ],
    climax: [
      {
        id: "beat-climax",
        stageKey: "TRUTH_REVEAL",
        summary: `${o.reveal}。关键：${plot.decisiveEvidence}。`,
        involvedRoleKeys: ["culprit", "framedCharacter"],
        clueIds: [clues[2].clueId, clues[3].clueId],
      },
    ],
    resolution: [
      {
        id: "beat-res",
        stageKey: "TRUTH_REVEAL",
        summary: `推翻对 ${framed} 的指控；确认 ${culprit} 为真凶。掩饰方式：${plot.concealmentMethod}。`,
        involvedRoleKeys: ["culprit", "framedCharacter"],
        clueIds: [clues[3].clueId],
      },
    ],
  };
}

function editableSlotsFor() {
  return [
    ...Object.entries(M01_FRAMING.roleSlots).map(([key, slot]) => ({
      key,
      kind: "role",
      label: slot.label,
      locked: false,
    })),
    ...Object.entries(M01_FRAMING.plotSlots).map(([key, slot]) => ({
      key,
      kind: "plot",
      label: slot.label,
      locked: false,
    })),
  ];
}

function buildBlock({ state, variant, roleBindings, plotOverrides, blockId, status }) {
  const plotBindings = buildPlotBindings(variant, plotOverrides);
  const clueBindings = buildClueBindings(plotBindings, roleBindings);
  const beats = buildBeats(variant, roleBindings, plotBindings, clueBindings);
  const stageBindings = M01_FRAMING.stagePattern.map((patternKey, order) => {
    const stage = state.stages[order] || null;
    return {
      patternKey,
      stageId: stage?.id || null,
      stageLabel: stage?.label || stageLabel(patternKey),
      order,
    };
  });

  return normalizeStoryMechanismBlock({
    id: blockId || newId("smb"),
    mechanismId: M01_FRAMING_MECHANISM_ID,
    familyId: M01_FRAMING_FAMILY_ID,
    templateId: M01_FRAMING_TEMPLATE_ID,
    title: `${M01_FRAMING.title}｜${variant.name}`,
    purpose: M01_FRAMING.purpose,
    variantId: variant.id,
    roleBindings,
    plotBindings,
    clueBindings,
    stageBindings,
    ...beats,
    prerequisites: [],
    consequences: [
      {
        type: "ASSIGNMENT",
        summary: "写入真凶/被嫁祸/死者占位",
      },
    ],
    exposedFacts: [
      {
        id: "fact-victim",
        kind: "death",
        summary: `${nameOf(roleBindings, "victim")} 遇害`,
        characterIds: roleBindings.victim ? [roleBindings.victim.id] : [],
        secret: false,
      },
    ],
    reservedFacts: [
      {
        id: "fact-killer",
        kind: "culprit",
        summary: `${nameOf(roleBindings, "culprit")} 是真凶`,
        characterIds: roleBindings.culprit ? [roleBindings.culprit.id] : [],
        secret: true,
      },
      {
        id: "fact-frame",
        kind: "frame",
        summary: `${nameOf(roleBindings, "framedCharacter")} 被嫁祸`,
        characterIds: roleBindings.framedCharacter
          ? [roleBindings.framedCharacter.id]
          : [],
        secret: true,
      },
    ],
    editableSlots: editableSlotsFor(),
    status: status || "DRAFT",
  });
}

/** 把 block 的角色职责写回 ProjectStoryState.assignments / facts / clues */
export function writeBackBlock(state, block) {
  const next = createProjectStoryState(state);
  const a = { ...next.assignments };
  const pushUnique = (list, id) => {
    if (id && !list.includes(id)) list.push(id);
  };
  pushUnique(a.killerCharacterIds, block.roleBindings.culprit?.id);
  pushUnique(a.victimCharacterIds, block.roleBindings.victim?.id);
  pushUnique(a.framedCharacterIds, block.roleBindings.framedCharacter?.id);

  const facts = [...next.facts];
  for (const f of [...block.exposedFacts, ...block.reservedFacts]) {
    if (!facts.some((x) => x.id === f.id)) facts.push(f);
  }
  const clues = [...next.clues];
  for (const c of block.clueBindings) {
    if (!clues.some((x) => x.id === c.clueId)) {
      clues.push({
        id: c.clueId,
        slotKey: c.slotKey,
        label: c.label,
        summary: c.summary,
        sourceBlockId: block.id,
      });
    }
  }

  // 更新角色 loadTags
  const characters = next.characters.map((c) => {
    const tags = new Set(c.loadTags || []);
    if (block.roleBindings.culprit?.id === c.id) tags.add("killer");
    if (block.roleBindings.victim?.id === c.id) tags.add("victim");
    if (block.roleBindings.framedCharacter?.id === c.id) tags.add("framed");
    if (block.roleBindings.discoverer?.id === c.id) tags.add("discoverer");
    return { ...c, loadTags: [...tags] };
  });

  return replaceBlock(
    {
      ...next,
      assignments: a,
      facts,
      clues,
      characters,
    },
    block,
  );
}

/**
 * 生成 M01 嫁祸型 StoryMechanismBlock 并写回 state。
 * @param {object} state ProjectStoryState
 * @param {{ variantId?: string, intentionalOverlap?: boolean, plotOverrides?: object }} [opts]
 */
export function generateM01Framing(state, opts = {}) {
  const current = createProjectStoryState(state);
  const variant =
    (opts.variantId && getM01FramingVariant(opts.variantId)) ||
    M01_FRAMING_VARIANTS[1] || // 默认 V02 栽赃物品（示例最完整）
    M01_FRAMING_VARIANTS[0];
  if (!variant) fail("STORY_NO_VARIANT", "No M01 framing variant available");

  const roleBindings = bindRoles(current, Boolean(opts.intentionalOverlap));
  const block = buildBlock({
    state: current,
    variant,
    roleBindings,
    plotOverrides: opts.plotOverrides || {},
    status: "DRAFT",
  });
  return writeBackBlock(current, block);
}

export function acceptStoryBlock(state, blockId) {
  const current = createProjectStoryState(state);
  const block = findBlock(current, blockId);
  if (!block) fail("STORY_BLOCK_MISSING", `Unknown block ${blockId}`, { blockId });
  return writeBackBlock(current, { ...block, status: "USER_ACCEPTED" });
}

/** 换结构：保留角色绑定，按新 variant 重填默认剧情槽与 Beat（锁定槽除外）。 */
export function swapStoryVariant(state, blockId, variantId) {
  const current = createProjectStoryState(state);
  const block = findBlock(current, blockId);
  if (!block) fail("STORY_BLOCK_MISSING", `Unknown block ${blockId}`, { blockId });
  const variant = getM01FramingVariant(variantId);
  if (!variant) fail("STORY_VARIANT_UNKNOWN", `Unknown variant ${variantId}`, { variantId });

  const lockedPlot = {};
  for (const slot of block.editableSlots) {
    if (slot.kind === "plot" && slot.locked && block.plotBindings[slot.key] != null) {
      lockedPlot[slot.key] = block.plotBindings[slot.key];
    }
  }
  const nextBlock = buildBlock({
    state: current,
    variant,
    roleBindings: block.roleBindings,
    plotOverrides: lockedPlot,
    blockId: block.id,
    status: "USER_MODIFIED",
  });
  // 保留原锁定标记
  nextBlock.editableSlots = nextBlock.editableSlots.map((s) => {
    const prev = block.editableSlots.find((x) => x.key === s.key);
    return prev?.locked ? { ...s, locked: true } : s;
  });
  return writeBackBlock(current, nextBlock);
}

function nextCandidate(list, current) {
  if (!list.length) return current;
  const idx = list.indexOf(current);
  return list[(idx + 1) % list.length];
}

/** 只换一个槽位（角色或剧情参数）。 */
export function swapStorySlot(state, blockId, slotKey) {
  const current = createProjectStoryState(state);
  const block = findBlock(current, blockId);
  if (!block) fail("STORY_BLOCK_MISSING", `Unknown block ${blockId}`, { blockId });
  const slot = block.editableSlots.find((s) => s.key === slotKey);
  if (!slot) fail("STORY_SLOT_UNKNOWN", `Unknown slot ${slotKey}`, { slotKey });
  if (slot.locked) fail("STORY_SLOT_LOCKED", `Slot ${slotKey} is locked`, { slotKey });

  let roleBindings = { ...block.roleBindings };
  let plotOverrides = { ...block.plotBindings };

  if (slot.kind === "role") {
    const roleSlot = M01_FRAMING.roleSlots[slotKey];
    if (!roleSlot) fail("STORY_SLOT_UNKNOWN", `Not a role slot ${slotKey}`);
    const forbidden = new Set(
      Object.entries(roleBindings)
        .filter(([k]) => k !== slotKey)
        .map(([, ref]) => ref?.id)
        .filter(Boolean),
    );
    for (const other of roleSlot.mustDifferFrom || []) {
      if (roleBindings[other]?.id) forbidden.add(roleBindings[other].id);
    }
    const pool = listAvailableCharacters(current, {
      allowNpc: Boolean(roleSlot.allowNpc),
      maxLoad: 99,
    }).filter((c) => !forbidden.has(c.id) || c.id === roleBindings[slotKey]?.id);
    if (pool.length < 2 && !roleSlot.allowNpc) {
      fail("STORY_NO_CHARACTER", `No alternate character for ${slotKey}`);
    }
    const ids = pool.map((c) => c.id);
    const nextId = nextCandidate(ids, roleBindings[slotKey]?.id);
    const chosen = pool.find((c) => c.id === nextId);
    roleBindings[slotKey] = chosen ? { id: chosen.id, name: chosen.name } : null;
  } else if (slot.kind === "plot") {
    const catalog = M01_PLOT_CANDIDATES[slotKey];
    if (catalog) {
      plotOverrides[slotKey] = nextCandidate(catalog, String(block.plotBindings[slotKey] ?? ""));
    } else {
      // 无目录的槽：在 variant 默认与其它 variant 默认间轮换
      const values = M01_FRAMING_VARIANTS.map((v) => v.defaults[slotKey]).filter(Boolean);
      plotOverrides[slotKey] = nextCandidate(
        [...new Set(values)],
        String(block.plotBindings[slotKey] ?? ""),
      );
    }
  } else {
    fail("STORY_SLOT_KIND", `Unsupported slot kind ${slot.kind}`, { slot });
  }

  const variant = getM01FramingVariant(block.variantId) || M01_FRAMING_VARIANTS[0];
  const nextBlock = buildBlock({
    state: current,
    variant,
    roleBindings,
    plotOverrides,
    blockId: block.id,
    status: "USER_MODIFIED",
  });
  nextBlock.editableSlots = block.editableSlots;
  return writeBackBlock(current, nextBlock);
}

/** 手动修改槽位值。 */
export function editStorySlot(state, blockId, slotKey, value) {
  const current = createProjectStoryState(state);
  const block = findBlock(current, blockId);
  if (!block) fail("STORY_BLOCK_MISSING", `Unknown block ${blockId}`, { blockId });
  const slot = block.editableSlots.find((s) => s.key === slotKey);
  if (!slot) fail("STORY_SLOT_UNKNOWN", `Unknown slot ${slotKey}`, { slotKey });
  if (slot.locked) fail("STORY_SLOT_LOCKED", `Slot ${slotKey} is locked`, { slotKey });

  let roleBindings = { ...block.roleBindings };
  let plotOverrides = { ...block.plotBindings };

  if (slot.kind === "role") {
    if (value == null) {
      if (M01_FRAMING.roleSlots[slotKey]?.required) {
        fail("STORY_ROLE_REQUIRED", `Role ${slotKey} is required`);
      }
      roleBindings[slotKey] = null;
    } else {
      const id = typeof value === "string" ? value : value.id;
      const char = current.characters.find((c) => c.id === id);
      if (!char) fail("STORY_NO_CHARACTER", `Unknown character ${id}`, { id });
      roleBindings[slotKey] = { id: char.id, name: char.name };
    }
  } else {
    plotOverrides[slotKey] = value;
  }

  const variant = getM01FramingVariant(block.variantId) || M01_FRAMING_VARIANTS[0];
  const nextBlock = buildBlock({
    state: current,
    variant,
    roleBindings,
    plotOverrides,
    blockId: block.id,
    status: "USER_MODIFIED",
  });
  nextBlock.editableSlots = block.editableSlots;
  return writeBackBlock(current, nextBlock);
}

export function lockStorySlot(state, blockId, slotKey, locked = true) {
  const current = createProjectStoryState(state);
  const block = findBlock(current, blockId);
  if (!block) fail("STORY_BLOCK_MISSING", `Unknown block ${blockId}`, { blockId });
  const editableSlots = block.editableSlots.map((s) =>
    s.key === slotKey ? { ...s, locked: Boolean(locked) } : s,
  );
  return writeBackBlock(current, { ...block, editableSlots, status: "USER_MODIFIED" });
}

export function createDemoProjectState() {
  return createProjectStoryState({
    projectId: "demo-framing",
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
  });
}
