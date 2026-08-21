/**
 * Deterministic story-structure diagnostics.
 *
 * This module deliberately evaluates authored links and declared metadata only.
 * It does not pretend to understand prose causality. The report therefore keeps
 * every finding traceable to a structured object and states its coverage limits.
 */
import {
  creativeConstitutionCoverage,
  isCreativeConstitutionEmpty,
  normalizeCreativeConstitution
} from "../../shared/creative-constitution.js";

export const STORY_DIAGNOSTIC_STANDARDS = Object.freeze({
  classic: {
    id: "classic",
    label: "本格公平",
    description: "强调证据冗余、可排除性与真相揭晓前的完整证据链。",
    minEvidence: 2,
    weights: { causal: 0.34, information: 0.3, fairness: 0.36 },
    singlePointSeverity: "danger",
    earlyLeakSeverity: "danger"
  },
  emotional: {
    id: "emotional",
    label: "情感还原",
    description: "允许较轻的机制证明，但仍检查信息可达、角色掉线和关键转折。",
    minEvidence: 1,
    weights: { causal: 0.36, information: 0.34, fairness: 0.3 },
    singlePointSeverity: "warning",
    earlyLeakSeverity: "warning"
  },
  mechanism: {
    id: "mechanism",
    label: "机制推理",
    description: "强调规则触发、获得路径和关键证据的备用通路。",
    minEvidence: 2,
    weights: { causal: 0.32, information: 0.38, fairness: 0.3 },
    singlePointSeverity: "danger",
    earlyLeakSeverity: "warning"
  },
  narrative: {
    id: "narrative",
    label: "叙事诡计",
    description: "强调揭晓时机、伏笔支撑与单条线索提前击穿真相的风险。",
    minEvidence: 2,
    weights: { causal: 0.34, information: 0.28, fairness: 0.38 },
    singlePointSeverity: "warning",
    earlyLeakSeverity: "danger"
  },
  open: {
    id: "open",
    label: "开放调查",
    description: "允许多路径探索，重点检查信息是否可获得以及调查失败后的补偿路径。",
    minEvidence: 1,
    weights: { causal: 0.3, information: 0.4, fairness: 0.3 },
    singlePointSeverity: "danger",
    earlyLeakSeverity: "warning"
  }
});

const SEVERITY_ORDER = Object.freeze({ danger: 0, warning: 1, info: 2 });
const KEY_IMPORTANCE = new Set(["key", "prerequisite", "truth_piece", "finale_key"]);
const RED_HERRING_IMPORTANCE = new Set(["red_herring"]);
const EVENT_TYPES = new Set(["segment", "scene", "chapter"]);

function rows(value) {
  return Array.isArray(value) ? value : [];
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value) {
  return String(value ?? "").trim();
}

function normalizeType(value) {
  const type = text(value).toLowerCase();
  return ({
    investigationpoint: "investigation_point",
    investigation_points: "investigation_point",
    point: "investigation_point",
    scriptsection: "script_section",
    section: "script_section",
    truthclaim: "truth_claim",
    truth: "truth_claim",
    automation_rule: "rule",
    world_segment: "segment"
  })[type] || type;
}

function viewForType(type) {
  return ({
    clue: "clues",
    truth_claim: "truth",
    segment: "structure",
    role: "writer",
    script_section: "writer",
    rule: "rules",
    scene: "studio",
    investigation_point: "studio",
    chapter: "studio",
    item: "studio"
  })[type] || "diagnostics";
}

function nodeKey(type, id) {
  return `${normalizeType(type)}:${id}`;
}

function entityCollections(snapshot) {
  return [
    ["chapter", rows(snapshot.chapters)],
    ["role", rows(snapshot.roles)],
    ["script_section", rows(snapshot.sections)],
    ["scene", rows(snapshot.scenes)],
    ["clue", rows(snapshot.clues)],
    ["investigation_point", rows(snapshot.investigationPoints)],
    ["item", rows(snapshot.items)],
    ["rule", rows(snapshot.rules)],
    ["segment", rows(snapshot.segments)],
    ["truth_claim", rows(snapshot.truthClaims)]
  ];
}

function entityLabel(type, entity) {
  if (!entity) return "已删除对象";
  if (type === "segment") return text(entity.title) || text(entity.segment_key) || "未命名运行段落";
  if (type === "truth_claim") return text(entity.title) || text(entity.claim_key) || "未命名真相";
  if (type === "chapter") return text(entity.title) || "未命名章节";
  if (type === "script_section") return text(entity.title) || "未命名私人分幕";
  return text(entity.name) || text(entity.title) || "未命名对象";
}

function buildEntityIndex(snapshot) {
  const index = new Map();
  for (const [type, collection] of entityCollections(snapshot)) {
    for (const entity of collection) {
      if (!entity?.id) continue;
      index.set(nodeKey(type, entity.id), {
        type,
        id: entity.id,
        label: entityLabel(type, entity),
        view: viewForType(type),
        entity
      });
    }
  }
  return index;
}

function refFor(index, type, id, fallbackLabel = "") {
  const normalized = normalizeType(type);
  const found = index.get(nodeKey(normalized, id));
  return found
    ? { type: found.type, id: found.id, label: found.label, view: found.view }
    : { type: normalized, id, label: fallbackLabel || "未解析对象", view: viewForType(normalized) };
}

function referenceFromValue(value, defaultType = "clue") {
  if (typeof value === "string") {
    const id = text(value);
    return id ? { type: defaultType, id } : null;
  }
  if (!value || typeof value !== "object") return null;
  const type = normalizeType(
    value.refType ?? value.ref_type ?? value.type ?? value.entityType ?? value.entity_type ?? defaultType
  );
  const id = text(
    value.refId ?? value.ref_id ?? value.clueId ?? value.clue_id ?? value.entityId ?? value.entity_id ?? value.id
  );
  return id ? { type, id } : null;
}

function declaredEvidenceRefs(claim, index) {
  const resolved = [];
  const seen = new Set();
  for (const value of rows(claim?.evidence)) {
    const candidate = referenceFromValue(value, "clue");
    if (!candidate) continue;
    const key = nodeKey(candidate.type, candidate.id);
    if (!index.has(key) || seen.has(key)) continue;
    seen.add(key);
    resolved.push(refFor(index, candidate.type, candidate.id));
  }
  return resolved;
}

function contradictionRefs(claim, index) {
  const resolved = [];
  const seen = new Set();
  for (const value of rows(claim?.contradictions)) {
    const candidate = referenceFromValue(value, "clue");
    if (!candidate) continue;
    const key = nodeKey(candidate.type, candidate.id);
    if (!index.has(key) || seen.has(key)) continue;
    seen.add(key);
    resolved.push(refFor(index, candidate.type, candidate.id));
  }
  return resolved;
}

function conditionRefs(node, refs = []) {
  if (!node || typeof node !== "object") return refs;
  if (Array.isArray(node.all)) node.all.forEach((child) => conditionRefs(child, refs));
  if (Array.isArray(node.any)) node.any.forEach((child) => conditionRefs(child, refs));
  if (node.not) conditionRefs(node.not, refs);
  if (node.type === "reading_completed" && node.scriptSectionId) {
    refs.push({ type: "script_section", id: node.scriptSectionId });
  }
  if (node.type === "clue_owned" && node.clueId) refs.push({ type: "clue", id: node.clueId });
  if (node.type === "investigation_completed" && node.investigationPointId) {
    refs.push({ type: "investigation_point", id: node.investigationPointId });
  }
  if (node.type === "item_owned" && node.itemId) refs.push({ type: "item", id: node.itemId });
  return refs;
}

function actionRef(action) {
  if (action?.type === "unlock_script_section" && action.scriptSectionId) {
    return { type: "script_section", id: action.scriptSectionId };
  }
  if (action?.type === "unlock_scene" && action.sceneId) return { type: "scene", id: action.sceneId };
  if (action?.type === "grant_clue" && action.clueId) return { type: "clue", id: action.clueId };
  if (action?.type === "grant_item" && action.itemId) return { type: "item", id: action.itemId };
  return null;
}

function uniqueRefs(refs) {
  const seen = new Set();
  return refs.filter((ref) => {
    if (!ref?.id) return false;
    const key = nodeKey(ref.type, ref.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function addGraphEdge(graph, edge) {
  if (!edge?.from?.id || !edge?.to?.id) return;
  const id = edge.id || `${nodeKey(edge.from.type, edge.from.id)}>${nodeKey(edge.to.type, edge.to.id)}:${edge.kind}`;
  if (graph.edgeIds.has(id)) return;
  graph.edgeIds.add(id);
  graph.edges.push({ ...edge, id });
  const fromKey = nodeKey(edge.from.type, edge.from.id);
  const toKey = nodeKey(edge.to.type, edge.to.id);
  if (!graph.outbound.has(fromKey)) graph.outbound.set(fromKey, []);
  if (!graph.inbound.has(toKey)) graph.inbound.set(toKey, []);
  graph.outbound.get(fromKey).push(edge);
  graph.inbound.get(toKey).push(edge);
}

function buildGraph(snapshot, index) {
  const graph = { edges: [], edgeIds: new Set(), outbound: new Map(), inbound: new Map() };

  for (const edge of rows(snapshot.edges)) {
    const fromType = normalizeType(edge.from_type ?? edge.fromType);
    const toType = normalizeType(edge.to_type ?? edge.toType);
    if (!index.has(nodeKey(fromType, edge.from_id ?? edge.fromId))) continue;
    if (!index.has(nodeKey(toType, edge.to_id ?? edge.toId))) continue;
    addGraphEdge(graph, {
      id: edge.id,
      from: refFor(index, fromType, edge.from_id ?? edge.fromId),
      to: refFor(index, toType, edge.to_id ?? edge.toId),
      kind: "authored",
      relation: text(edge.label) || text(edge.relation_type ?? edge.relationType) || "剧情关联",
      explicit: true
    });
  }

  for (const point of rows(snapshot.investigationPoints)) {
    if (point.scene_id && index.has(nodeKey("scene", point.scene_id))) {
      addGraphEdge(graph, {
        from: refFor(index, "scene", point.scene_id),
        to: refFor(index, "investigation_point", point.id),
        kind: "acquisition",
        relation: "包含调查点",
        explicit: true
      });
    }
    if (point.clue_id && index.has(nodeKey("clue", point.clue_id))) {
      addGraphEdge(graph, {
        from: refFor(index, "investigation_point", point.id),
        to: refFor(index, "clue", point.clue_id),
        kind: "acquisition",
        relation: "调查获得",
        explicit: true
      });
    }
  }

  for (const segmentRef of rows(snapshot.segmentRefs)) {
    const type = normalizeType(segmentRef.ref_type ?? segmentRef.refType);
    const id = segmentRef.ref_id ?? segmentRef.refId;
    if (!index.has(nodeKey(type, id)) || !index.has(nodeKey("segment", segmentRef.segment_id ?? segmentRef.segmentId))) {
      continue;
    }
    addGraphEdge(graph, {
      from: refFor(index, type, id),
      to: refFor(index, "segment", segmentRef.segment_id ?? segmentRef.segmentId),
      kind: "segment_ref",
      relation: "编排进运行段落",
      explicit: true
    });
  }

  for (const claim of rows(snapshot.truthClaims)) {
    for (const evidence of declaredEvidenceRefs(claim, index)) {
      addGraphEdge(graph, {
        from: evidence,
        to: refFor(index, "truth_claim", claim.id),
        kind: "evidence",
        relation: "支撑真相",
        explicit: true
      });
    }
  }

  for (const rule of rows(snapshot.rules)) {
    if (rule.enabled === false) continue;
    const ruleRef = refFor(index, "rule", rule.id);
    for (const source of uniqueRefs(conditionRefs(rule.conditions))) {
      if (!index.has(nodeKey(source.type, source.id))) continue;
      addGraphEdge(graph, {
        from: refFor(index, source.type, source.id),
        to: ruleRef,
        kind: "rule",
        relation: "满足规则条件",
        explicit: true
      });
    }
    for (const action of rows(rule.actions)) {
      const target = actionRef(action);
      if (!target || !index.has(nodeKey(target.type, target.id))) continue;
      addGraphEdge(graph, {
        from: ruleRef,
        to: refFor(index, target.type, target.id),
        kind: "rule",
        relation: "规则触发",
        explicit: true
      });
    }
  }
  return graph;
}

function acquisitionPaths(snapshot, index) {
  const paths = new Map(rows(snapshot.clues).map((clue) => [clue.id, []]));
  for (const clue of rows(snapshot.clues)) {
    if (clue.visibility === "public") {
      paths.get(clue.id).push({ type: "public", label: "房间公开可见", ref: refFor(index, "clue", clue.id) });
    }
  }
  for (const point of rows(snapshot.investigationPoints)) {
    if (!point.clue_id || !paths.has(point.clue_id)) continue;
    paths.get(point.clue_id).push({
      type: "investigation",
      label: `调查「${entityLabel("investigation_point", point)}」`,
      ref: refFor(index, "investigation_point", point.id)
    });
  }
  for (const rule of rows(snapshot.rules)) {
    if (rule.enabled === false) continue;
    for (const action of rows(rule.actions)) {
      if (action?.type !== "grant_clue" || !paths.has(action.clueId)) continue;
      paths.get(action.clueId).push({
        type: "rule",
        label: `规则「${entityLabel("rule", rule)}」发放`,
        ref: refFor(index, "rule", rule.id)
      });
    }
  }
  for (const segmentRef of rows(snapshot.segmentRefs)) {
    const type = normalizeType(segmentRef.ref_type ?? segmentRef.refType);
    const id = segmentRef.ref_id ?? segmentRef.refId;
    if (type !== "clue" || !paths.has(id)) continue;
    const segmentId = segmentRef.segment_id ?? segmentRef.segmentId;
    paths.get(id).push({
      type: "segment",
      label: "运行段落显式引用",
      ref: refFor(index, "segment", segmentId)
    });
  }
  for (const [clueId, cluePaths] of paths) {
    const seen = new Set();
    paths.set(clueId, cluePaths.filter((path) => {
      const key = `${path.type}:${path.ref?.id || path.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }));
  }
  return paths;
}

function roleVisibilityIds(roleVisibility, roleIds) {
  const result = [];
  if (Array.isArray(roleVisibility)) {
    for (const id of roleVisibility) if (roleIds.has(id)) result.push(id);
    return result;
  }
  for (const [id, value] of Object.entries(object(roleVisibility))) {
    if (!roleIds.has(id)) continue;
    if (value === false || value === null || value === "hidden" || value === "none") continue;
    result.push(id);
  }
  return result;
}

function roleKnowledge(snapshot, index) {
  const roles = rows(snapshot.roles);
  const roleIds = new Set(roles.map((role) => role.id));
  const byRole = new Map(roles.map((role) => [role.id, []]));
  const clueOwners = new Map(rows(snapshot.clues).map((clue) => [clue.id, new Set()]));
  const segments = new Map(rows(snapshot.segments).map((segment) => [segment.id, segment]));

  function add(roleId, entry) {
    if (!byRole.has(roleId)) return;
    const existing = byRole.get(roleId);
    const duplicate = existing.some(
      (item) => item.type === entry.type && item.id === entry.id && item.segmentId === entry.segmentId
    );
    if (!duplicate) existing.push(entry);
    if (entry.type === "clue" && clueOwners.has(entry.id)) clueOwners.get(entry.id).add(roleId);
  }

  for (const claim of rows(snapshot.truthClaims)) {
    for (const roleId of roleVisibilityIds(claim.role_visibility ?? claim.roleVisibility, roleIds)) {
      add(roleId, {
        type: "truth_claim",
        id: claim.id,
        label: entityLabel("truth_claim", claim),
        sequence: 0,
        segmentId: null,
        segmentTitle: "角色可见设定",
        source: "truth_visibility"
      });
    }
  }

  for (const section of rows(snapshot.sections)) {
    if (!section.role_slot_id) continue;
    const chapter = rows(snapshot.chapters).find((item) => item.id === section.chapter_id);
    add(section.role_slot_id, {
      type: "script_section",
      id: section.id,
      label: entityLabel("script_section", section),
      sequence: Number(chapter?.sequence ?? section.sequence ?? 0),
      segmentId: null,
      segmentTitle: chapter ? entityLabel("chapter", chapter) : "角色私人分幕",
      source: "private_section"
    });
  }

  for (const segmentRef of rows(snapshot.segmentRefs)) {
    const roleId = segmentRef.role_slot_id ?? segmentRef.roleSlotId;
    const type = normalizeType(segmentRef.ref_type ?? segmentRef.refType);
    const id = segmentRef.ref_id ?? segmentRef.refId;
    if (!roleId || !["clue", "truth_claim", "script_section"].includes(type) || !index.has(nodeKey(type, id))) continue;
    const segmentId = segmentRef.segment_id ?? segmentRef.segmentId;
    const segment = segments.get(segmentId);
    add(roleId, {
      type,
      id,
      label: refFor(index, type, id).label,
      sequence: Number(segment?.sequence ?? 0),
      segmentId,
      segmentTitle: entityLabel("segment", segment),
      source: "segment_ref"
    });
  }

  for (const segment of rows(snapshot.segments)) {
    for (const grant of rows(object(segment.operations).clueGrants)) {
      const roleId = grant.roleSlotId ?? grant.role_slot_id;
      const clueId = grant.clueId ?? grant.clue_id;
      if (!roleId || !clueOwners.has(clueId)) continue;
      add(roleId, {
        type: "clue",
        id: clueId,
        label: refFor(index, "clue", clueId).label,
        sequence: Number(segment.sequence ?? 0),
        segmentId: segment.id,
        segmentTitle: entityLabel("segment", segment),
        source: "clue_grant"
      });
    }
  }

  const timelines = roles.map((role) => {
    const entries = byRole.get(role.id).slice().sort((a, b) => a.sequence - b.sequence || a.label.localeCompare(b.label));
    const grouped = new Map();
    for (const entry of entries) {
      const key = `${entry.sequence}:${entry.segmentId || entry.segmentTitle}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          sequence: entry.sequence,
          segmentId: entry.segmentId,
          segmentTitle: entry.segmentTitle,
          items: []
        });
      }
      grouped.get(key).items.push({
        type: entry.type,
        id: entry.id,
        label: entry.label,
        source: entry.source
      });
    }
    return {
      role: refFor(index, "role", role.id),
      itemCount: entries.length,
      stages: [...grouped.values()].slice(0, 20)
    };
  });
  return { timelines, clueOwners };
}

function evidenceOwners(evidence, clueOwners) {
  if (evidence.type !== "clue") return new Set();
  return clueOwners.get(evidence.id) || new Set();
}

function communicationNeeds(snapshot, index, clueOwners) {
  const needs = [];
  for (const claim of rows(snapshot.truthClaims)) {
    if (claim.confidence === "misdirection") continue;
    const evidence = declaredEvidenceRefs(claim, index).filter((ref) => ref.type === "clue");
    if (evidence.length < 2) continue;
    const ownerSets = evidence.map((ref) => evidenceOwners(ref, clueOwners)).filter((set) => set.size);
    if (ownerSets.length < 2) continue;
    const allOwners = new Set(ownerSets.flatMap((set) => [...set]));
    const oneRoleHasAll = [...allOwners].some((roleId) => ownerSets.every((set) => set.has(roleId)));
    if (oneRoleHasAll) continue;
    needs.push({
      truth: refFor(index, "truth_claim", claim.id),
      roles: [...allOwners].map((roleId) => refFor(index, "role", roleId)),
      evidence,
      reason: "证据分散在不同角色的显式信息分配中，没有单一角色同时持有全部证据。"
    });
  }
  return needs.slice(0, 30);
}

function eventRows(snapshot) {
  const segments = rows(snapshot.segments)
    .slice()
    .sort((a, b) => Number(a.sequence ?? 0) - Number(b.sequence ?? 0));
  if (segments.length) return { type: "segment", rows: segments };
  const scenes = rows(snapshot.scenes);
  return { type: "scene", rows: scenes };
}

function downstreamCount(graph, start) {
  const startKey = nodeKey(start.type, start.id);
  const visited = new Set([startKey]);
  const queue = [startKey];
  while (queue.length) {
    const current = queue.shift();
    for (const edge of graph.outbound.get(current) || []) {
      if (!["authored", "rule", "evidence"].includes(edge.kind)) continue;
      const next = nodeKey(edge.to.type, edge.to.id);
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  return visited.size - 1;
}

function score(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function weightedOverall(scores, weights) {
  return score(
    scores.causal * weights.causal
    + scores.information * weights.information
    + scores.fairness * weights.fairness
  );
}

function issueFactory() {
  const issues = [];
  function add(issue) {
    issues.push({
      id: issue.id,
      category: issue.category,
      severity: issue.severity || "warning",
      title: issue.title,
      detail: issue.detail,
      rationale: issue.rationale || "",
      recommendation: issue.recommendation || "",
      refs: uniqueRefs(issue.refs || []),
      path: issue.path || []
    });
  }
  return { issues, add };
}

function pathFromEdge(edge) {
  return [
    { ...edge.from, relation: edge.relation },
    { ...edge.to }
  ];
}

function isLateStage(value) {
  return /复盘|结算|终局|finale|recap|ending|postgame/i.test(text(value));
}

/**
 * Evaluate an archive-grade snapshot. All findings are bounded and traceable.
 */
export function evaluateStoryDiagnostics(snapshot = {}, { standard = "classic" } = {}) {
  const profile = STORY_DIAGNOSTIC_STANDARDS[standard] || STORY_DIAGNOSTIC_STANDARDS.classic;
  const rawConstitution = object(snapshot.world?.settings).creativeConstitution;
  const constitution = normalizeCreativeConstitution(rawConstitution);
  const constitutionConfigured = !isCreativeConstitutionEmpty(rawConstitution);
  const constitutionCoverage = creativeConstitutionCoverage(rawConstitution, rows(snapshot.roles));
  const minimumEvidence = constitutionConfigured
    ? constitution.fairness.minimumEvidence
    : profile.minEvidence;
  const index = buildEntityIndex(snapshot);
  const graph = buildGraph(snapshot, index);
  const cluePaths = acquisitionPaths(snapshot, index);
  const knowledge = roleKnowledge(snapshot, index);
  const communication = communicationNeeds(snapshot, index, knowledge.clueOwners);
  const { issues, add } = issueFactory();
  const events = eventRows(snapshot);
  const eventRefs = events.rows.map((event) => refFor(index, events.type, event.id));
  const authoredEdges = graph.edges.filter((edge) => edge.kind === "authored");
  const constitutionRef = {
    type: "constitution",
    id: "creative-constitution",
    label: "创作宪法",
    view: "constitution"
  };

  if (!constitutionConfigured) {
    add({
      id: "intent.no_constitution",
      category: "intent",
      severity: "warning",
      title: "尚未建立创作宪法",
      detail: "当前诊断只能套用通用类型标准，无法判断结构是否偏离作者的体验承诺。",
      recommendation: "写明核心主题、最终感受、不可破坏原则和禁用套路，再重新诊断。",
      refs: [constitutionRef]
    });
  } else {
    if (constitutionCoverage.missing.length) {
      const labels = constitutionCoverage.missing.slice(0, 5).map((item) => item.label);
      add({
        id: "intent.constitution_incomplete",
        category: "intent",
        severity: "warning",
        title: "创作宪法仍有关键约束未写明",
        detail: `当前完成度 ${constitutionCoverage.score}%；待补：${labels.join("、")}${constitutionCoverage.missing.length > labels.length ? "等" : ""}。`,
        recommendation: "优先补齐会影响结构判断的体验承诺、公平谜题和不可破坏原则。",
        refs: [constitutionRef]
      });
    }
    if (constitutionCoverage.roles.missing.length) {
      const missingRoleRefs = constitutionCoverage.roles.missing.map((role) => refFor(index, "role", role.id, role.label));
      add({
        id: "intent.role_highlight_gaps",
        category: "intent",
        severity: "warning",
        title: `${missingRoleRefs.length} 个角色尚未声明体验高光`,
        detail: `缺少高光承诺：${missingRoleRefs.slice(0, 6).map((role) => role.label).join("、")}${missingRoleRefs.length > 6 ? "等" : ""}。`,
        rationale: "角色高光是后续角色体验检查和 AI 玩家试跑的重要评判依据。",
        recommendation: "为每个角色写明只有他能完成的行动、决定或情绪高潮。",
        refs: [constitutionRef, ...missingRoleRefs]
      });
    }
  }

  if (!eventRefs.length) {
    add({
      id: "causal.no_events",
      category: "causal",
      severity: "danger",
      title: "尚未建立可诊断的剧情事件",
      detail: "当前没有运行段落或场景，系统无法形成因果链。",
      recommendation: "先建立场景或运行段落，再用剧情边标出“为什么发生”和“导致什么”。"
    });
  }

  const orphanEvents = [];
  const removableCandidates = [];
  eventRefs.forEach((eventRef, indexInSequence) => {
    const incoming = (graph.inbound.get(nodeKey(eventRef.type, eventRef.id)) || [])
      .filter((edge) => edge.kind === "authored" || edge.kind === "rule");
    const outgoing = (graph.outbound.get(nodeKey(eventRef.type, eventRef.id)) || [])
      .filter((edge) => edge.kind === "authored" || edge.kind === "rule");
    if (indexInSequence > 0 && !incoming.length) {
      orphanEvents.push(eventRef);
      add({
        id: `causal.unmotivated.${eventRef.type}.${eventRef.id}`,
        category: "causal",
        severity: "danger",
        title: `「${eventRef.label}」缺少显式前因`,
        detail: "该事件不是序列首项，但没有剧情边或规则触发指向它。",
        rationale: "仅有排列顺序不能说明角色动机或事件原因。",
        recommendation: "连接前置事件、证据或角色行动，并在边标签中写明因果关系。",
        refs: [eventRef]
      });
    }
    const impact = downstreamCount(graph, eventRef);
    if (indexInSequence < eventRefs.length - 1 && !outgoing.length && impact === 0) {
      removableCandidates.push({ ref: eventRef, downstreamCount: impact });
      add({
        id: `causal.removable.${eventRef.type}.${eventRef.id}`,
        category: "causal",
        severity: "warning",
        title: `删除「${eventRef.label}」后，结构图中的后续仍可能成立`,
        detail: "当前没有显式剧情边或规则从该事件流向后续对象。",
        rationale: "这不证明正文没有影响，只表示结构化依赖尚未建模。",
        recommendation: "若它确实推动后续，请补一条带因果标签的出边；否则考虑压缩或合并。",
        refs: [eventRef]
      });
    }
  });

  const unreachableClues = [];
  const singlePointClues = [];
  for (const clue of rows(snapshot.clues)) {
    const ref = refFor(index, "clue", clue.id);
    const paths = cluePaths.get(clue.id) || [];
    const importance = text(object(clue.metadata).importance);
    if (!paths.length) {
      unreachableClues.push(ref);
      add({
        id: `information.unreachable_clue.${clue.id}`,
        category: "information",
        severity: KEY_IMPORTANCE.has(importance) ? "danger" : "warning",
        title: `线索「${ref.label}」没有可达的获得路径`,
        detail: "未发现调查点、启用规则、公开可见状态或运行段落引用。",
        recommendation: "至少绑定一个调查点、规则发放或运行段落，并确认玩家权限。",
        refs: [ref]
      });
    }
    if (KEY_IMPORTANCE.has(importance) && paths.length === 1) {
      singlePointClues.push({ clue: ref, path: paths[0] });
      add({
        id: `information.single_point_clue.${clue.id}`,
        category: "information",
        severity: profile.singlePointSeverity,
        title: `关键线索「${ref.label}」只有一条获得路径`,
        detail: `当前唯一通路：${paths[0].label}。该通路失败时，推理可能卡死。`,
        recommendation: "增加独立备用通路，或设计主持可审查的分级补救提示。",
        refs: [ref, paths[0].ref].filter(Boolean),
        path: paths[0].ref ? [paths[0].ref, ref] : [ref]
      });
    }
    const isRedHerring = RED_HERRING_IMPORTANCE.has(importance)
      || ["misdirect", "red_herring"].includes(text(clue.clue_kind ?? clue.clueKind));
    if (isRedHerring) {
      const outgoing = graph.outbound.get(nodeKey("clue", clue.id)) || [];
      const usedAsContradiction = rows(snapshot.truthClaims)
        .some((claim) => contradictionRefs(claim, index).some((candidate) => candidate.id === clue.id));
      if (!outgoing.length && !usedAsContradiction) {
        add({
          id: `information.unused_red_herring.${clue.id}`,
          category: "information",
          severity: "warning",
          title: `烟雾弹「${ref.label}」没有参与任何误导路径`,
          detail: "它没有指向假设、事件或真相矛盾，也没有被声明为反证。",
          recommendation: "把它接入一个可被验证和排除的错误假设，或移除无效噪声。",
          refs: [ref]
        });
      }
    }
  }

  const privateInfoExists = rows(snapshot.sections).length
    || rows(snapshot.truthClaims).some((claim) => roleVisibilityIds(
      claim.role_visibility ?? claim.roleVisibility,
      new Set(rows(snapshot.roles).map((role) => role.id))
    ).length)
    || rows(snapshot.segmentRefs).some((ref) => ref.role_slot_id ?? ref.roleSlotId);
  const informationIslands = knowledge.timelines.filter((timeline) => timeline.itemCount === 0);
  if (privateInfoExists) {
    for (const island of informationIslands) {
      add({
        id: `information.role_island.${island.role.id}`,
        category: "information",
        severity: "warning",
        title: `角色「${island.role.label}」没有已建模的信息时间线`,
        detail: "未发现私人分幕、角色可见真相或带角色归属的线索分发。",
        rationale: "公开讨论内容不在本项中重复计入。",
        recommendation: "确认该角色在每一阶段能获得什么、通过谁或什么渠道获得。",
        refs: [island.role]
      });
    }
  }

  const fairnessClaims = [];
  const weakClaims = [];
  const earlyLeaks = [];
  for (const claim of rows(snapshot.truthClaims)) {
    if (claim.confidence === "misdirection") continue;
    const claimRef = refFor(index, "truth_claim", claim.id);
    const evidence = declaredEvidenceRefs(claim, index);
    const contradictions = contradictionRefs(claim, index);
    const minimum = minimumEvidence;
    const status = evidence.length >= minimum ? "supported" : evidence.length ? "weak" : "unsupported";
    const claimRow = {
      truth: claimRef,
      confidence: claim.confidence || "canon",
      revealStage: claim.reveal_stage ?? claim.revealStage ?? "",
      evidence,
      contradictions,
      minimum,
      status
    };
    fairnessClaims.push(claimRow);
    if (evidence.length < minimum) {
      weakClaims.push(claimRow);
      add({
        id: `fairness.weak_truth.${claim.id}`,
        category: "fairness",
        severity: evidence.length ? "warning" : "danger",
        title: `真相「${claimRef.label}」证据不足`,
        detail: evidence.length
          ? `已声明 ${evidence.length} 条证据；${constitutionConfigured ? "创作宪法" : `「${profile.label}」标准`}要求至少 ${minimum} 条。`
          : "没有声明可回溯到创作对象的证据。",
        recommendation: "在真相断言的 evidence 中引用可验证线索，并确保它们在揭晓前可获得。",
        refs: [claimRef, ...evidence],
        path: [...evidence, claimRef]
      });
    }
    if (isLateStage(claim.reveal_stage ?? claim.revealStage) && evidence.length) {
      const evidenceOnlyLate = rows(claim.evidence).every((value) => {
        if (!value || typeof value !== "object") return false;
        return isLateStage(value.stage ?? value.revealStage ?? value.sourceStage ?? value.source_stage);
      });
      if (evidenceOnlyLate) {
        add({
          id: `fairness.recap_only.${claim.id}`,
          category: "fairness",
          severity: "danger",
          title: `真相「${claimRef.label}」的证据只在揭晓阶段出现`,
          detail: "所有带阶段信息的证据都被标记为复盘、终局或结算阶段。",
          recommendation: "至少把必要证据提前到玩家可调查或可交流的阶段。",
          refs: [claimRef, ...evidence]
        });
      }
    }
    if (evidence.length === 1 && evidence[0].type === "clue") {
      const clue = index.get(nodeKey("clue", evidence[0].id))?.entity;
      const paths = cluePaths.get(evidence[0].id) || [];
      const publiclyExposed = clue?.visibility === "public" || paths.some((path) => path.type === "public");
      if (publiclyExposed && text(claim.reveal_stage ?? claim.revealStage)) {
        const leak = { truth: claimRef, clue: evidence[0], revealStage: claim.reveal_stage ?? claim.revealStage };
        earlyLeaks.push(leak);
        add({
          id: `information.early_leak.${claim.id}`,
          category: "information",
          severity: profile.earlyLeakSeverity,
          title: `公开线索「${evidence[0].label}」可能单独击穿真相`,
          detail: `它是「${claimRef.label}」唯一声明证据，而真相计划在「${leak.revealStage}」揭晓。`,
          recommendation: "拆分信息、增加歧义或把结论建立在多条独立证据的组合上。",
          refs: [evidence[0], claimRef],
          path: [evidence[0], claimRef]
        });
      }
    }
  }

  if (!rows(snapshot.truthClaims).length) {
    add({
      id: "fairness.no_truth_claims",
      category: "fairness",
      severity: "danger",
      title: "尚未声明可验证的核心真相",
      detail: "系统无法判断答案是否由游戏内证据推出。",
      recommendation: "先在“谜底与关系”中录入核心真相，并为每条真相声明 evidence 引用。"
    });
  }

  const keyClues = rows(snapshot.clues).filter((clue) => KEY_IMPORTANCE.has(text(object(clue.metadata).importance)));
  const usedEvidenceIds = new Set(
    rows(snapshot.truthClaims).flatMap((claim) => declaredEvidenceRefs(claim, index))
      .filter((ref) => ref.type === "clue")
      .map((ref) => ref.id)
  );
  for (const clue of keyClues) {
    if (usedEvidenceIds.has(clue.id)) continue;
    const ref = refFor(index, "clue", clue.id);
    add({
      id: `fairness.unused_key_clue.${clue.id}`,
      category: "fairness",
      severity: "warning",
      title: `关键线索「${ref.label}」没有支撑任何真相`,
      detail: "它被标记为关键/真相碎片/终局关键，但未出现在真相 evidence 中。",
      recommendation: "把它绑定到具体结论，或下调重要性，避免作者与玩家对“关键”的理解不一致。",
      refs: [ref]
    });
  }

  const causalDenominator = Math.max(1, eventRefs.length - 1);
  const causalScore = eventRefs.length
    ? score(100 - (orphanEvents.length / causalDenominator) * 55
      - (removableCandidates.length / Math.max(1, eventRefs.length)) * 25)
    : 0;
  const pathCoverage = rows(snapshot.clues).length
    ? [...cluePaths.values()].filter((pathList) => pathList.length).length / rows(snapshot.clues).length
    : 0;
  const redundancyCoverage = keyClues.length
    ? keyClues.filter((clue) => (cluePaths.get(clue.id) || []).length >= 2).length / keyClues.length
    : pathCoverage;
  const mappedRoleCoverage = knowledge.timelines.length
    ? knowledge.timelines.filter((timeline) => timeline.itemCount).length / knowledge.timelines.length
    : 0;
  const informationScore = rows(snapshot.clues).length
    ? score(pathCoverage * 55 + redundancyCoverage * 25 + mappedRoleCoverage * 20)
    : 0;
  const fairnessScore = fairnessClaims.length
    ? score(
      fairnessClaims.reduce(
        (sum, claim) => sum + Math.min(1, claim.evidence.length / Math.max(1, claim.minimum)),
        0
      ) / fairnessClaims.length * 100
      - earlyLeaks.length * 8
    )
    : 0;
  const scores = {
    causal: causalScore,
    information: informationScore,
    fairness: fairnessScore,
    intent: constitutionCoverage.score
  };
  const structuralOverall = weightedOverall(scores, profile.weights);
  scores.overall = score(structuralOverall * 0.85 + scores.intent * 0.15);

  const sortedIssues = issues
    .sort((a, b) => {
      const severity = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
      if (severity) return severity;
      return a.category.localeCompare(b.category) || a.title.localeCompare(b.title);
    })
    .slice(0, 120);
  const issueSummary = {
    danger: sortedIssues.filter((issue) => issue.severity === "danger").length,
    warning: sortedIssues.filter((issue) => issue.severity === "warning").length,
    info: sortedIssues.filter((issue) => issue.severity === "info").length
  };

  const chains = graph.edges
    .filter((edge) => ["authored", "acquisition", "evidence", "rule"].includes(edge.kind))
    .slice(0, 80)
    .map((edge) => ({
      id: edge.id,
      kind: edge.kind,
      relation: edge.relation,
      path: pathFromEdge(edge)
    }));

  return {
    version: 2,
    standard: {
      id: profile.id,
      label: profile.label,
      description: profile.description,
      minEvidence: minimumEvidence,
      defaultMinEvidence: profile.minEvidence,
      constitutionOverride: constitutionConfigured && minimumEvidence !== profile.minEvidence
    },
    scope: {
      events: eventRefs.length,
      eventType: events.type,
      roles: rows(snapshot.roles).length,
      clues: rows(snapshot.clues).length,
      truthClaims: rows(snapshot.truthClaims).length,
      authoredEdges: authoredEdges.length,
      rules: rows(snapshot.rules).filter((rule) => rule.enabled !== false).length
    },
    scores,
    status: issueSummary.danger ? "blocked" : issueSummary.warning ? "review" : "ready",
    summary: {
      ...issueSummary,
      issueCount: sortedIssues.length,
      headline: issueSummary.danger
        ? `发现 ${issueSummary.danger} 个高风险结构问题`
        : issueSummary.warning
          ? `结构可运行，但有 ${issueSummary.warning} 项需要作者确认`
          : "已建模结构未发现明显阻塞项"
    },
    issues: sortedIssues,
    constitution: {
      configured: constitutionConfigured,
      score: constitutionCoverage.score,
      filled: constitutionCoverage.filled,
      total: constitutionCoverage.total,
      missing: constitutionCoverage.missing,
      roleHighlights: constitutionCoverage.roles,
      theme: constitution.theme,
      experiencePromise: constitution.experiencePromise,
      inviolableCount: constitution.inviolablePrinciples.length,
      forbiddenTropesCount: constitution.forbiddenTropes.length,
      minimumEvidence,
      requireIndependentPaths: constitution.fairness.requireIndependentPaths
    },
    causal: {
      eventType: events.type,
      events: eventRefs.map((ref) => ({
        ref,
        inboundCount: (graph.inbound.get(nodeKey(ref.type, ref.id)) || [])
          .filter((edge) => edge.kind === "authored" || edge.kind === "rule").length,
        outboundCount: (graph.outbound.get(nodeKey(ref.type, ref.id)) || [])
          .filter((edge) => edge.kind === "authored" || edge.kind === "rule").length,
        downstreamCount: downstreamCount(graph, ref)
      })),
      chains,
      orphanEvents,
      removableCandidates
    },
    information: {
      knowledgeTimelines: knowledge.timelines,
      informationIslands: privateInfoExists ? informationIslands.map((item) => item.role) : [],
      communicationNeeds: communication,
      singlePointClues,
      unreachableClues,
      earlyLeaks
    },
    fairness: {
      claims: fairnessClaims,
      minimumEvidence,
      supportedClaims: fairnessClaims.filter((claim) => claim.status === "supported").length,
      weakClaims: weakClaims.length,
      keyClues: keyClues.length,
      keyCluesUsedAsEvidence: keyClues.filter((clue) => usedEvidenceIds.has(clue.id)).length
    },
    limitations: [
      "本报告只判断已结构化的剧情边、规则、调查点、分发和真相证据引用，不会把正文中的自然语言因果冒充为已验证关系。",
      "“缺少显式前因”表示依赖尚未建模；它是需要作者确认的定位结果，不等同于断言正文一定不合理。",
      "多解性、角色动机强度和对白歧义需要语义审读或 AI 玩家试跑；本阶段不输出未经证据支持的结论。"
    ]
  };
}
