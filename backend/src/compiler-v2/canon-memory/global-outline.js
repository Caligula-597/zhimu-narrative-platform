import { deepseekConfig } from "../../deepseek-config.js";
import { newCompilerId } from "../state.js";
import { outlineCacheKey } from "./source-hash.js";
import { readCanonCache, writeCanonCache } from "./file-cache.js";

const SYSTEM = [
  "你是剧本杀主持手册 GlobalOutline 编译器（Canon Stage 2.5 通道 A）。",
  "通读主持册建立全局索引，不是写摘要。列出主要人物、阶段、地点、历史阶段、主要案件/事件提示、真相区段、机制区段。",
  "不要编造原文没有的内容。只输出 JSON：",
  JSON.stringify({
    characters: [{ name: "", aliases: [], roleHint: null }],
    stages: [{ id: null, name: "", order: 1 }],
    locations: [""],
    historicalPhases: [{ label: "", summary: "" }],
    majorIncidents: [{ label: "", hint: "", sourceSectionIds: [] }],
    truthSections: [{ label: "", sourceSectionIds: [] }],
    mechanismSections: [{ label: "", sourceSectionIds: [] }],
    unresolvedTopics: [""]
  })
].join("\n");

function clean(s, max = 200) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function emptyGlobalOutline() {
  return {
    id: null,
    characters: [],
    stages: [],
    locations: [],
    historicalPhases: [],
    majorIncidents: [],
    truthSections: [],
    mechanismSections: [],
    unresolvedTopics: []
  };
}

export function normalizeGlobalOutline(raw) {
  const base = emptyGlobalOutline();
  if (!raw || typeof raw !== "object") return base;
  base.id = newCompilerId("outline");
  base.characters = (raw.characters || [])
    .map((c) => ({
      name: clean(c?.name, 40),
      aliases: (c?.aliases || []).map((a) => clean(a, 40)).filter(Boolean),
      roleHint: clean(c?.roleHint, 60) || null
    }))
    .filter((c) => c.name)
    .slice(0, 32);
  base.stages = (raw.stages || [])
    .map((s, i) => ({
      id: s?.id || null,
      name: clean(s?.name, 40),
      order: Number(s?.order) || i + 1
    }))
    .filter((s) => s.name)
    .slice(0, 16);
  base.locations = (raw.locations || [])
    .map((l) => clean(typeof l === "string" ? l : l?.name, 40))
    .filter(Boolean)
    .slice(0, 40);
  base.historicalPhases = (raw.historicalPhases || [])
    .map((p) => ({
      label: clean(p?.label, 80),
      summary: clean(p?.summary, 240)
    }))
    .filter((p) => p.label)
    .slice(0, 12);
  base.majorIncidents = (raw.majorIncidents || [])
    .map((m) => ({
      label: clean(m?.label, 80),
      hint: clean(m?.hint, 160),
      sourceSectionIds: (m?.sourceSectionIds || []).map(String).filter(Boolean)
    }))
    .filter((m) => m.label)
    .slice(0, 32);
  base.truthSections = (raw.truthSections || [])
    .map((t) => ({
      label: clean(t?.label, 80),
      sourceSectionIds: (t?.sourceSectionIds || []).map(String).filter(Boolean)
    }))
    .filter((t) => t.label)
    .slice(0, 20);
  base.mechanismSections = (raw.mechanismSections || [])
    .map((t) => ({
      label: clean(t?.label, 80),
      sourceSectionIds: (t?.sourceSectionIds || []).map(String).filter(Boolean)
    }))
    .filter((t) => t.label)
    .slice(0, 20);
  base.unresolvedTopics = (raw.unresolvedTopics || [])
    .map((t) => clean(t, 120))
    .filter(Boolean)
    .slice(0, 20);
  return base;
}

function buildHostDigest(sections, maxChars = 28000) {
  const parts = [];
  let used = 0;
  for (const sec of sections || []) {
    const head = (sec.headingPath || []).join(" / ");
    const body = String(sec.originalText || "").slice(0, 800);
    const block = `[${sec.id}] ${head}\n${body}`;
    if (used + block.length > maxChars) break;
    parts.push(block);
    used += block.length;
  }
  return parts.join("\n\n---\n\n");
}

export async function compileGlobalOutline(sections, {
  projectMeta,
  stageSchema,
  requestJson,
  useCache = true,
  modelTag = "default"
} = {}) {
  if (!sections?.length) {
    return { outline: emptyGlobalOutline(), usage: null, cached: false, skipped: true };
  }

  const cacheKey = outlineCacheKey(sections, { model: modelTag });
  if (useCache) {
    const hit = await readCanonCache(cacheKey);
    if (hit?.outline) {
      return { outline: hit.outline, usage: null, cached: true, cacheKey, skipped: false };
    }
  }

  if (!requestJson) {
    if (!deepseekConfig().configured) throw new Error("DEEPSEEK_NOT_CONFIGURED");
    const { requestDeepseekJson } = await import("../../deepseek-client.js");
    requestJson = requestDeepseekJson;
  }

  const user = {
    project: projectMeta || {},
    confirmedStageSchema: stageSchema?.items?.length ? { items: stageSchema.items } : null,
    hostDigest: buildHostDigest(sections),
    instruction: "建立 GlobalOutline 索引，不是摘要。majorIncidents 尽量挂 sourceSectionIds。"
  };

  const result = await requestJson(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: JSON.stringify(user) }
    ],
    {
      temperature: 0.1,
      maxTokens: 5000,
      timeoutMs: Math.min(deepseekConfig().timeoutMs, 180000),
      phase: "compiler-v2-canon-global-outline"
    }
  );

  const outline = normalizeGlobalOutline(result.value);
  if (useCache) {
    await writeCanonCache(cacheKey, { outline, compiledAt: new Date().toISOString() });
  }

  return {
    outline,
    usage: result.usage || null,
    cached: false,
    cacheKey,
    skipped: false
  };
}
