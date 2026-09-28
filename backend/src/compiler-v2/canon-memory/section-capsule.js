import { deepseekConfig } from "../../deepseek-config.js";
import { newCompilerId } from "../state.js";
import { SECTION_CAPSULE_TYPE } from "./constants.js";
import { capsuleCacheKey, hashSourceSection } from "./source-hash.js";
import { readCanonCache, writeCanonCache } from "./file-cache.js";
import { flagSuspiciousCapsules } from "./coverage.js";

const SYSTEM = [
  "你是剧本杀 SourceSection Capsule 编译器（Canon Stage 2.5 通道 B）。",
  "只读当前一个 sourceSection，输出永久 SectionCapsule 索引（不是摘要）。",
  "type 必须是 EVENT|BACKGROUND|RULE|META|MECHANISM|NO_RELEVANT_CONTENT 之一。",
  "events 数组列出本段明确发生的剧情节点（可 DETAIL）；无剧情则 events=[] 并选对 type。",
  "只输出 JSON：",
  JSON.stringify({
    type: "EVENT",
    stageId: null,
    characters: [""],
    locations: [""],
    events: [{ title: "", summary: "", importance: "CORE|SUPPORTING|DETAIL" }],
    importantObjects: [""],
    mechanismHints: [""],
    summary: "一句索引说明"
  })
].join("\n");

const VALID_TYPES = new Set(Object.values(SECTION_CAPSULE_TYPE));

function clean(s, max = 200) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function normalizeSectionCapsule(raw, section) {
  const sid = section?.id || null;
  let type = String(raw?.type || "").toUpperCase();
  if (!VALID_TYPES.has(type)) type = SECTION_CAPSULE_TYPE.NO_RELEVANT_CONTENT;

  const events = (Array.isArray(raw?.events) ? raw.events : [])
    .map((e, i) => ({
      id: newCompilerId("cevt"),
      title: clean(e?.title, 80),
      summary: clean(e?.summary, 300),
      importance: ["CORE", "SUPPORTING", "DETAIL"].includes(String(e?.importance).toUpperCase())
        ? String(e.importance).toUpperCase()
        : "SUPPORTING",
      sourceSectionIds: [sid].filter(Boolean),
      order: i + 1
    }))
    .filter((e) => e.title && e.summary);

  const capsule = {
    id: newCompilerId("cap"),
    sourceSectionId: sid,
    contentHash: hashSourceSection(section),
    stageId: raw?.stageId || section?.stageId || null,
    type,
    characters: (raw?.characters || []).map((c) => clean(c, 40)).filter(Boolean).slice(0, 12),
    locations: (raw?.locations || []).map((l) => clean(l, 40)).filter(Boolean).slice(0, 8),
    events,
    importantObjects: (raw?.importantObjects || [])
      .map((o) => clean(o, 60))
      .filter(Boolean)
      .slice(0, 8),
    mechanismHints: (raw?.mechanismHints || [])
      .map((m) => clean(m, 80))
      .filter(Boolean)
      .slice(0, 6),
    summary: clean(raw?.summary, 240) || null,
    suspicious: false,
    cached: false
  };
  capsule.suspicious = flagSuspiciousCapsules(section, capsule);
  return capsule;
}

export function emptyCapsuleForSection(section, { reason = "LLM_SKIPPED" } = {}) {
  return {
    id: newCompilerId("cap"),
    sourceSectionId: section.id,
    contentHash: hashSourceSection(section),
    stageId: section.stageId || null,
    type: SECTION_CAPSULE_TYPE.NO_RELEVANT_CONTENT,
    characters: [],
    locations: [],
    events: [],
    importantObjects: [],
    mechanismHints: [],
    summary: reason,
    suspicious: flagSuspiciousCapsules(section, { type: SECTION_CAPSULE_TYPE.NO_RELEVANT_CONTENT, events: [] }),
    cached: false,
    error: reason
  };
}

export async function compileSectionCapsule(section, {
  globalOutline,
  stageSchema,
  requestJson,
  useCache = true,
  modelTag = "default"
} = {}) {
  const cacheKey = capsuleCacheKey(section, { model: modelTag, tier: "capsule" });
  if (useCache) {
    const hit = await readCanonCache(cacheKey);
    if (hit?.capsule) {
      return {
        capsule: { ...hit.capsule, cached: true },
        usage: null,
        cacheKey,
        cached: true
      };
    }
  }

  if (!requestJson) {
    if (!deepseekConfig().configured) throw new Error("DEEPSEEK_NOT_CONFIGURED");
    const { requestDeepseekJson } = await import("../../deepseek-client.js");
    requestJson = requestDeepseekJson;
  }

  const text = String(section.originalText || "").trim();
  if (!text) {
    const capsule = emptyCapsuleForSection(section, { reason: "EMPTY_SECTION" });
    return { capsule, usage: null, cacheKey, cached: false };
  }

  const user = {
    globalOutlineHint: globalOutline
      ? {
          characters: (globalOutline.characters || []).slice(0, 12).map((c) => c.name),
          majorIncidents: (globalOutline.majorIncidents || []).slice(0, 8).map((m) => m.label)
        }
      : null,
    confirmedStageSchema: stageSchema?.items?.length ? { items: stageSchema.items } : null,
    sourceSection: {
      id: section.id,
      headingPath: section.headingPath || [],
      text: text.slice(0, 4500)
    },
    instruction: "只索引本段。有剧情就写入 events；流程/规则段用 RULE；前言配件用 META。"
  };

  const result = await requestJson(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: JSON.stringify(user) }
    ],
    {
      temperature: 0.12,
      maxTokens: 2000,
      timeoutMs: Math.min(deepseekConfig().timeoutMs, 120000),
      phase: "compiler-v2-canon-section-capsule",
      context: { sectionId: section.id }
    }
  );

  const capsule = normalizeSectionCapsule(result.value, section);
  if (useCache) {
    await writeCanonCache(cacheKey, {
      capsule: { ...capsule, cached: true },
      compiledAt: new Date().toISOString()
    });
  }

  return {
    capsule,
    usage: result.usage || null,
    cacheKey,
    cached: false
  };
}

/** Run capsule compile with concurrency limit. */
export async function compileSectionCapsulesBatch(sections, opts = {}) {
  const concurrency = Math.max(
    1,
    Math.min(12, Number(opts.concurrency) || 6)
  );
  const results = [];
  const usages = [];
  let idx = 0;

  async function worker() {
    while (idx < sections.length) {
      const i = idx++;
      const sec = sections[i];
      try {
        const r = await compileSectionCapsule(sec, opts);
        if (r.usage) usages.push(r.usage);
        results[i] = r.capsule;
      } catch (err) {
        results[i] = emptyCapsuleForSection(sec, {
          reason: String(err?.message || err).slice(0, 120)
        });
        results[i].suspicious = true;
        results[i].error = results[i].summary;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, sections.length) }, () => worker()));
  return { capsules: results.filter(Boolean), usages };
}
