/**
 * StageSchema — author/user confirmation layer (not LLM).
 * AI/heuristics may propose; only USER_CONFIRMED becomes authoritative.
 */

import { newCompilerId, DETECTION_STATUS, pushUnresolved, pushWarning } from "./state.js";

export const STAGE_SCHEMA_SOURCE = Object.freeze({
  PROPOSED: "PROPOSED",
  USER_CONFIRMED: "USER_CONFIRMED",
  REJECTED_AS_HEADINGS: "REJECTED_AS_HEADINGS",
  MANUAL: "MANUAL"
});

function compact(s = "") {
  return String(s).replace(/\s+/g, "");
}

const CHAPTER_STAGE_RE = /^第[一二三四五六七八九十\d]+章\s*[：:]?\s*(.+)$/;

/**
 * Extract ordered stage labels from one role manuscript text.
 */
export function extractStageSequenceFromText(text = "") {
  const stages = [];
  const seen = new Set();
  for (const line of String(text).split(/\n+/)) {
    const t = line.trim();
    const m = t.match(CHAPTER_STAGE_RE);
    if (!m) continue;
    const label = compact(m[1]).replace(/夜阑.*/, "夜阑");
    if (!label || seen.has(label)) continue;
    seen.add(label);
    stages.push(label);
  }
  return stages;
}

/**
 * Propose shared StageSchema when all role scripts share the same sequence.
 * @param {Array<{ characterName?: string, originalContent?: string, text?: string }>} roleScripts
 */
export function proposeStageSchemaFromRoleScripts(roleScripts = []) {
  const scripts = (roleScripts || []).filter((r) => (r.originalContent || r.text || "").trim());
  if (scripts.length < 2) return null;

  const sequences = scripts.map((r) =>
    extractStageSequenceFromText(r.originalContent || r.text || "")
  );
  const first = sequences[0];
  if (!first || first.length < 2) return null;

  const same = sequences.every(
    (seq) => seq.length === first.length && seq.every((s, i) => s === first[i])
  );
  if (!same) return null;

  const items = first.map((name, order) => ({
    order: order + 1,
    name,
    id: null
  }));

  return {
    id: null,
    items,
    source: STAGE_SCHEMA_SOURCE.PROPOSED,
    characterCount: scripts.length,
    label: first.join(" / "),
    prompt: `检测到 ${scripts.length} 个角色均包含以下重复阶段：\n${first
      .map((n, i) => `${i + 1}. ${n}`)
      .join("\n")}\n\n这些是否代表本剧本的统一游戏阶段？`
  };
}

/**
 * After Stage 2 ingest: rebuild per-character text with headings so chapter lines
 * survive section-body splitting, then propose.
 */
export function proposeStageSchemaFromCompilerState(state = {}) {
  const byChar = new Map();
  for (const sec of state.sourceSections || []) {
    if (!sec.characterId) continue;
    if (!byChar.has(sec.characterId)) byChar.set(sec.characterId, []);
    byChar.get(sec.characterId).push(sec);
  }

  if (byChar.size >= 2) {
    const roleScripts = [...byChar.values()].map((secs) => {
      const chunks = secs.map((s) => {
        const heading = (s.headingPath || []).slice(-1)[0] || "";
        return `${heading}\n${s.originalText || ""}`;
      });
      return { originalContent: chunks.join("\n") };
    });
    const fromSections = proposeStageSchemaFromRoleScripts(roleScripts);
    if (fromSections) return fromSections;
  }

  return proposeStageSchemaFromRoleScripts(state.characterScripts || []);
}

export function materializeStageSchema(proposal, { source = STAGE_SCHEMA_SOURCE.USER_CONFIRMED } = {}) {
  const schemaId = newCompilerId("stage_schema");
  const items = (proposal.items || []).map((item, i) => ({
    id: newCompilerId("stage"),
    order: Number(item.order) || i + 1,
    name: String(item.name || "").trim()
  }));
  return {
    id: schemaId,
    items,
    source,
    label: items.map((i) => i.name).join(" / "),
    confirmedAt: new Date().toISOString()
  };
}

/**
 * Bind characterScripts / sourceSections headings to confirmed stages.
 * Does NOT modify originalContent — only adds stageId / stageName refs.
 */
export function bindScriptsToStageSchema(state, stageSchema) {
  if (!stageSchema?.items?.length) return state;
  const byName = new Map(stageSchema.items.map((i) => [compact(i.name), i]));

  const characterScripts = (state.characterScripts || []).map((script) => {
    const seq = extractStageSequenceFromText(script.originalContent || "");
    const stageBindings = seq
      .map((name) => {
        const hit = byName.get(compact(name));
        return hit ? { stageId: hit.id, stageName: hit.name, order: hit.order } : null;
      })
      .filter(Boolean);
    return {
      ...script,
      stageSchemaId: stageSchema.id,
      stageBindings
    };
  });

  const sourceSections = (state.sourceSections || []).map((sec) => {
    const path = (sec.headingPath || []).map(compact).join("/");
    let stageId = null;
    let stageName = null;
    for (const item of stageSchema.items) {
      const n = compact(item.name);
      if (path.includes(n) || compact(sec.title || "").includes(n)) {
        stageId = item.id;
        stageName = item.name;
        break;
      }
    }
    return stageId ? { ...sec, stageId, stageName, stageSchemaId: stageSchema.id } : sec;
  });

  return {
    ...state,
    stageSchema,
    stageSchemaProposal: null,
    characterScripts,
    sourceSections
  };
}

/**
 * Apply user decision on a proposal.
 * decision: confirm | reject | manual
 * manualItems: optional [{order,name}] when decision=manual
 */
export function applyStageSchemaDecision(state, { decision, manualItems } = {}) {
  const proposal = state.stageSchemaProposal;
  if (!proposal && decision !== "manual") {
    return pushWarning(state, {
      code: "STAGE_SCHEMA_NO_PROPOSAL",
      message: "没有待确认的阶段建议"
    });
  }

  if (decision === "reject") {
    let next = {
      ...state,
      stageSchema: {
        id: null,
        items: [],
        source: STAGE_SCHEMA_SOURCE.REJECTED_AS_HEADINGS,
        label: "",
        confirmedAt: new Date().toISOString()
      },
      stageSchemaProposal: null
    };
    // Clear stage-schema unresolved
    next.unresolved = (next.unresolved || []).filter((u) => u.field !== "stageSchema");
    next = pushWarning(next, {
      code: "STAGE_SCHEMA_REJECTED",
      message: "已确认重复标题仅作章节，不作为统一游戏阶段"
    });
    return next;
  }

  const items =
    decision === "manual"
      ? (manualItems || []).map((item, i) => ({
          order: Number(item.order) || i + 1,
          name: String(item.name || "").trim()
        })).filter((i) => i.name)
      : proposal.items;

  if (!items.length) {
    return pushWarning(state, {
      code: "STAGE_SCHEMA_EMPTY",
      message: "阶段列表为空，未写入 StageSchema"
    });
  }

  const schema = materializeStageSchema(
    { items },
    {
      source:
        decision === "manual" ? STAGE_SCHEMA_SOURCE.MANUAL : STAGE_SCHEMA_SOURCE.USER_CONFIRMED
    }
  );

  let next = bindScriptsToStageSchema(state, schema);
  next.unresolved = (next.unresolved || []).filter((u) => u.field !== "stageSchema");
  return next;
}

/** Attach proposal + NEEDS_CONFIRMATION after ingest when shared stages found. */
export function attachStageSchemaProposal(state, proposal) {
  if (!proposal) return state;
  let next = {
    ...state,
    stageSchemaProposal: proposal,
    stageSchema: state.stageSchema || null
  };
  next = pushUnresolved(next, {
    kind: DETECTION_STATUS.NEEDS_CONFIRMATION,
    field: "stageSchema",
    message: proposal.prompt || "检测到重复阶段序列，请确认是否设为统一游戏阶段",
    suggestedValue: proposal.items
  });
  return next;
}
