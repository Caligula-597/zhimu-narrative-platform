export const STORY_ASSISTANT_MAX_TEXT_LENGTH = 500_000;
export const STORY_ASSISTANT_MAX_NODES = 80;

export const STORY_NODE_TYPE_DETAILS = {
  scene: { label: "场景", short: "SCENE" },
  investigation_point: { label: "调查点", short: "POINT" },
  clue: { label: "线索", short: "CLUE" }
};

const STORY_NODE_TYPES = new Set(Object.keys(STORY_NODE_TYPE_DETAILS));

function stringValue(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function storySourceFingerprint(text = "") {
  const source = String(text);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${source.length}:${(hash >>> 0).toString(16)}`;
}

export function validateStoryAssistantSource(text = "") {
  const source = String(text).trim();
  const errors = [];
  if (!source) errors.push("请先输入或粘贴剧情文本");
  if (source.length > STORY_ASSISTANT_MAX_TEXT_LENGTH) {
    errors.push(`剧情文本不能超过 ${STORY_ASSISTANT_MAX_TEXT_LENGTH.toLocaleString("zh-CN")} 字符`);
  }
  return { source, errors };
}

export function normalizeStoryAssistantResult(payload = {}) {
  const usedKeys = new Set();
  const nodes = (Array.isArray(payload?.nodes) ? payload.nodes : [])
    .slice(0, STORY_ASSISTANT_MAX_NODES)
    .map((node, index) => {
      const type = STORY_NODE_TYPES.has(node?.type) ? node.type : "scene";
      const baseKey = stringValue(node?.key, 96) || `preview-${index + 1}`;
      let key = baseKey;
      let suffix = 1;
      while (usedKeys.has(key)) {
        suffix += 1;
        key = `${baseKey.slice(0, 88)}-${suffix}`;
      }
      usedKeys.add(key);
      return {
        key,
        type,
        name: stringValue(node?.name, 120) || `${STORY_NODE_TYPE_DETAILS[type].label} ${index + 1}`,
        text: stringValue(node?.text, STORY_ASSISTANT_MAX_TEXT_LENGTH),
        sceneIndex: Number.isFinite(Number(node?.sceneIndex)) ? Number(node.sceneIndex) : 0
      };
    });
  const nodeKeys = new Set(nodes.map((node) => node.key));
  const edges = (Array.isArray(payload?.edges) ? payload.edges : [])
    .slice(0, Math.max(0, STORY_ASSISTANT_MAX_NODES - 1))
    .map((edge) => ({
      fromKey: stringValue(edge?.fromKey, 96),
      toKey: stringValue(edge?.toKey, 96),
      relationType: stringValue(edge?.relationType, 64) || "extension",
      label: stringValue(edge?.label, 240)
    }))
    .filter((edge) => nodeKeys.has(edge.fromKey) && nodeKeys.has(edge.toKey) && edge.fromKey !== edge.toKey);
  const suggestions = (Array.isArray(payload?.suggestions) ? payload.suggestions : [])
    .slice(0, 20)
    .map((suggestion) => stringValue(suggestion, 500))
    .filter(Boolean);
  return { nodes, edges, suggestions };
}

export function storyAssistantCounts(result = {}) {
  const nodes = Array.isArray(result.nodes) ? result.nodes : [];
  return {
    total: nodes.length,
    scenes: nodes.filter((node) => node.type === "scene").length,
    points: nodes.filter((node) => node.type === "investigation_point").length,
    clues: nodes.filter((node) => node.type === "clue").length,
    edges: Array.isArray(result.edges) ? result.edges.length : 0
  };
}

export function storyAnalysisIsCurrent(session) {
  return Boolean(
    session?.analysis
    && session.analysisFingerprint
    && session.analysisFingerprint === storySourceFingerprint(String(session.draft?.text || "").trim())
  );
}
