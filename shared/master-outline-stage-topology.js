/**
 * P8.0.1 Target-Stage-Aware Remap
 *
 * Maps STORY phaseBand → concrete project stages without collapsing
 * locked stage counts. 4-stage stays band→index compatible.
 */

/**
 * @typedef {{ id: string, label: string, order: number, topologySlot: string, stageRole: string }} StageSlot
 */

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/** Topology roles for locked stage counts (stageRole uses existing enum). */
export function topologyRolesForCount(stageCount) {
  const n = Math.max(1, Math.trunc(Number(stageCount) || 1));
  if (n === 1) return [{ topologySlot: "SETUP", stageRole: "SETUP", label: "铺垫" }];
  if (n === 2) {
    return [
      { topologySlot: "SETUP", stageRole: "SETUP", label: "铺垫" },
      { topologySlot: "FINAL", stageRole: "PAYOFF", label: "收束" },
    ];
  }
  if (n === 3) {
    return [
      { topologySlot: "SETUP", stageRole: "SETUP", label: "铺垫" },
      { topologySlot: "MIDDLE", stageRole: "PRESSURE", label: "加压" },
      { topologySlot: "FINAL", stageRole: "PAYOFF", label: "收束" },
    ];
  }
  if (n === 4) {
    return [
      { topologySlot: "SETUP", stageRole: "SETUP", label: "铺垫" },
      { topologySlot: "MIDDLE", stageRole: "PRESSURE", label: "加压" },
      { topologySlot: "ESCALATION", stageRole: "ESCALATION", label: "升级" },
      { topologySlot: "FINAL", stageRole: "PAYOFF", label: "收束" },
    ];
  }
  if (n === 5) {
    return [
      { topologySlot: "SETUP", stageRole: "SETUP", label: "铺垫" },
      { topologySlot: "DEVELOPMENT", stageRole: "PRESSURE", label: "发展" },
      { topologySlot: "PRESSURE", stageRole: "PRESSURE", label: "加压" },
      { topologySlot: "ESCALATION", stageRole: "ESCALATION", label: "升级" },
      { topologySlot: "FINAL", stageRole: "PAYOFF", label: "收束" },
    ];
  }
  // Generic: first SETUP, last PAYOFF, middles PRESSURE/ESCALATION
  return Array.from({ length: n }, (_, i) => {
    if (i === 0) return { topologySlot: "SETUP", stageRole: "SETUP", label: "铺垫" };
    if (i === n - 1) return { topologySlot: "FINAL", stageRole: "PAYOFF", label: "收束" };
    if (i === n - 2) return { topologySlot: "ESCALATION", stageRole: "ESCALATION", label: "升级" };
    return { topologySlot: "MIDDLE", stageRole: "PRESSURE", label: `第${i + 1}阶段` };
  });
}

/**
 * Eligibility windows by phaseBand (0 setup … 3 resolution).
 * 4-stage: single index === phaseBand (regression-compatible).
 */
export function eligibleStageIndices(phaseBand, stageCount) {
  const n = Math.max(1, Math.trunc(Number(stageCount) || 1));
  const band = Math.max(0, Math.min(3, Math.trunc(Number(phaseBand) || 0)));
  if (n <= 1) return [0];
  if (n === 2) return band <= 1 ? [0] : [1];
  if (n === 3) {
    if (band <= 0) return [0];
    if (band === 1) return [1];
    return [2]; // climax + resolution → final
  }
  if (n === 4) return [band];
  if (n === 5) {
    if (band <= 0) return [0];
    if (band === 1) return [1, 2];
    if (band === 2) return [2, 3];
    return [4];
  }
  // scale 4-band into n
  const t = band / 3;
  const idx = Math.min(n - 1, Math.round(t * (n - 1)));
  return [idx];
}

/**
 * Legacy 4-band direct map (kept for tests / unlocked fallback).
 */
export function legacyAssignBeatToStageIndex(phaseBand, stageCount) {
  if (stageCount <= 1) return 0;
  if (stageCount === 2) return phaseBand <= 1 ? 0 : 1;
  if (stageCount === 3) {
    if (phaseBand <= 0) return 0;
    if (phaseBand <= 2) return 1;
    return 2;
  }
  return Math.min(stageCount - 1, Math.max(0, phaseBand));
}

export function planStageTopology({ projectStages, beats = [] } = {}) {
  const sorted = [...asArray(projectStages)].sort(
    (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0),
  );
  const locked = sorted.length >= 2;
  let slots;
  if (locked) {
    const roles = topologyRolesForCount(sorted.length);
    slots = sorted.map((s, i) => ({
      id: String(s.id),
      label: roles[i]?.label || s.label || `第${i + 1}阶段`,
      order: Number.isFinite(Number(s.order)) ? Number(s.order) : i,
      topologySlot: roles[i]?.topologySlot || "MIDDLE",
      stageRole: roles[i]?.stageRole || "PRESSURE",
      projectLabel: s.label || null,
    }));
  } else {
    const beatCount = asArray(beats).length;
    const n = beatCount <= 6 ? 3 : Math.min(4, Math.max(3, Math.ceil(beatCount / 4)));
    const roles = topologyRolesForCount(n);
    slots = roles.map((r, i) => ({
      id: `outline-stage-${i + 1}`,
      label: r.label,
      order: i,
      topologySlot: r.topologySlot,
      stageRole: r.stageRole,
      projectLabel: null,
    }));
  }
  return {
    stageCountLocked: locked,
    targetStageCount: slots.length,
    slots,
  };
}

function blockBeatGroups(beats) {
  const groups = new Map();
  const order = [];
  for (const beat of asArray(beats)) {
    const key = beat.sourceBlockId || "_";
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key).push(beat);
  }
  return order.map((k) => groups.get(k));
}

function chooseIndex(eligible, loads, preferFillEmpty) {
  if (!eligible.length) return 0;
  let best = eligible[0];
  let bestScore = Infinity;
  for (const idx of eligible) {
    const load = loads[idx] || 0;
    // Prefer empty stages when filling, then lowest density, then earliest index
    const emptyBoost = preferFillEmpty && load === 0 ? -1000 : 0;
    const score = load * 10 + idx + emptyBoost;
    if (score < bestScore) {
      bestScore = score;
      best = idx;
    }
  }
  return best;
}

/**
 * Deterministic assignment: chronology → eligibility → load balance.
 * @returns {Map<string, number>} beat.id → stage index
 */
export function assignBeatsToStageIndices(beats, stageCount, { preferAdvance = true } = {}) {
  const n = Math.max(1, Math.trunc(Number(stageCount) || 1));
  const loads = Array.from({ length: n }, () => 0);
  const assignment = new Map();
  const emptyCount = () => loads.filter((c) => c === 0).length;

  for (const group of blockBeatGroups(beats)) {
    let prevIdx = 0;
    let first = true;
    for (const beat of group) {
      const band = Number(beat.phaseBand) || 0;
      let eligible = eligibleStageIndices(band, n);
      if (!first) {
        const chrono = eligible.filter((i) => i >= prevIdx);
        eligible = chrono.length ? chrono : [Math.max(prevIdx, eligible[eligible.length - 1])];
      }
      if (preferAdvance && !first && eligible.length > 1) {
        const advanced = eligible.filter((i) => i > prevIdx);
        // Advance when empty stages remain ahead or current stage already denser than next
        if (advanced.length && (emptyCount() > 0 || (loads[prevIdx] || 0) >= (loads[advanced[0]] || 0))) {
          // keep both; chooseIndex prefers empty / lower load
        }
      }
      const preferFillEmpty = emptyCount() > 0 && asArray(beats).length >= n;
      const idx = chooseIndex(eligible, loads, preferFillEmpty);
      assignment.set(beat.id, idx);
      loads[idx] += 1;
      prevIdx = idx;
      first = false;
    }
  }

  // Repair: if locked density allows and some stages empty, pull eligible beats forward
  if (asArray(beats).length >= n) {
    for (let emptyIdx = 0; emptyIdx < n; emptyIdx += 1) {
      if (loads[emptyIdx] > 0) continue;
      const donor = findDonorBeat(beats, assignment, loads, emptyIdx, n);
      if (!donor) continue;
      const from = assignment.get(donor.id);
      assignment.set(donor.id, emptyIdx);
      loads[from] -= 1;
      loads[emptyIdx] += 1;
    }
  }

  return assignment;
}

function findDonorBeat(beats, assignment, loads, emptyIdx, n) {
  // Prefer donors from adjacent denser stages whose eligibility includes emptyIdx
  // and whose block chronology still holds after move.
  const byBlock = blockBeatGroups(beats);
  let best = null;
  let bestScore = -Infinity;
  for (const group of byBlock) {
    for (let i = 0; i < group.length; i += 1) {
      const beat = group[i];
      const from = assignment.get(beat.id);
      if (from == null || from === emptyIdx) continue;
      if ((loads[from] || 0) <= 1) continue; // don't empty donor
      const eligible = eligibleStageIndices(Number(beat.phaseBand) || 0, n);
      if (!eligible.includes(emptyIdx)) continue;
      const prev = i > 0 ? assignment.get(group[i - 1].id) : null;
      const next = i < group.length - 1 ? assignment.get(group[i + 1].id) : null;
      if (prev != null && emptyIdx < prev) continue;
      if (next != null && emptyIdx > next) continue;
      const score = (loads[from] || 0) * 10 - Math.abs(from - emptyIdx);
      if (score > bestScore) {
        bestScore = score;
        best = beat;
      }
    }
  }
  return best;
}

/**
 * Build outline stage shells from topology (empty beats arrays).
 */
export function materializeTopologyStages(topology) {
  return topology.slots.map((s) => ({
    id: s.id,
    label: s.label,
    order: s.order,
    beats: [],
    topologySlot: s.topologySlot,
    stageRole: s.stageRole,
  }));
}

/**
 * Assign beats into stage shells. Mutates stages[*].beats.
 */
export function distributeBeatsIntoStages(stages, beats) {
  const n = stages.length;
  const map = assignBeatsToStageIndices(beats, n);
  for (const beat of asArray(beats)) {
    const idx = map.get(beat.id);
    const safe = Number.isFinite(idx) ? Math.min(n - 1, Math.max(0, idx)) : 0;
    stages[safe].beats.push(beat);
  }
  return stages;
}

export function assertStageChronology(stages) {
  const byBlock = new Map();
  for (const st of stages) {
    for (const beat of st.beats || []) {
      const key = beat.sourceBlockId || "_";
      if (!byBlock.has(key)) byBlock.set(key, []);
      byBlock.get(key).push({ order: st.order, beat });
    }
  }
  for (const [, rows] of byBlock) {
    // flatten order within block follows original push order across stages — check stage order monotonic by appearance
    let prev = -Infinity;
    for (const row of rows) {
      if (row.order < prev) {
        return { ok: false, sourceBlockId: rows[0]?.beat?.sourceBlockId, order: row.order, prev };
      }
      prev = row.order;
    }
  }
  return { ok: true };
}
