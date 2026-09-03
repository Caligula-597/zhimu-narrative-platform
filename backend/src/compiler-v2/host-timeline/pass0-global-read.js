/**
 * Pass 0 — Global Read → GlobalStoryMap (not full TimelineEvents).
 */

import { deepseekConfig } from "../../deepseek-config.js";

const SYSTEM = [
  "你是剧本杀主持手册的「全局阅读地图」助手（Stage 3A Pass 0）。",
  "任务：通读主持册摘要，建立短阅读地图 GlobalStoryMap。",
  "不要输出完整 TimelineEvent 列表；不要编造原文没有的人物/地点/事件。",
  "只输出 JSON：",
  JSON.stringify({
    characters: [{ name: "", aliases: [], roleHint: null }],
    locations: [""],
    historicalPhases: [{ id: "hist_1", label: "", summary: "" }],
    plotPhases: [{ id: "plot_1", stageId: null, label: "", summary: "" }],
    majorIncidents: [{ label: "", hint: "" }],
    truthSections: [""],
    unresolvedTopics: [""]
  })
].join("\n");

function clean(s, max = 200) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function emptyGlobalStoryMap() {
  return {
    characters: [],
    locations: [],
    historicalPhases: [],
    plotPhases: [],
    majorIncidents: [],
    truthSections: [],
    unresolvedTopics: []
  };
}

export function normalizeGlobalStoryMap(raw, { stageSchema = null } = {}) {
  const base = emptyGlobalStoryMap();
  if (!raw || typeof raw !== "object") return base;

  base.characters = (Array.isArray(raw.characters) ? raw.characters : [])
    .map((c) => ({
      name: clean(c?.name, 40),
      aliases: Array.isArray(c?.aliases) ? c.aliases.map((a) => clean(a, 40)).filter(Boolean) : [],
      roleHint: clean(c?.roleHint, 40) || null
    }))
    .filter((c) => c.name)
    .slice(0, 24);

  base.locations = (Array.isArray(raw.locations) ? raw.locations : [])
    .map((l) => clean(typeof l === "string" ? l : l?.name, 40))
    .filter(Boolean)
    .slice(0, 40);

  base.historicalPhases = (Array.isArray(raw.historicalPhases) ? raw.historicalPhases : [])
    .map((p, i) => ({
      id: clean(p?.id, 40) || `hist_${i + 1}`,
      label: clean(p?.label, 80),
      summary: clean(p?.summary, 240)
    }))
    .filter((p) => p.label)
    .slice(0, 12);

  const stageNames = new Set((stageSchema?.items || []).map((i) => i.name));
  base.plotPhases = (Array.isArray(raw.plotPhases) ? raw.plotPhases : [])
    .map((p, i) => ({
      id: clean(p?.id, 40) || `plot_${i + 1}`,
      stageId: p?.stageId || null,
      label: clean(p?.label, 80),
      summary: clean(p?.summary, 240)
    }))
    .filter((p) => p.label)
    .slice(0, 16);

  // If user confirmed StageSchema and model omitted plotPhases, seed from schema
  if (!base.plotPhases.length && stageSchema?.items?.length) {
    base.plotPhases = stageSchema.items.map((item) => ({
      id: `plot_stage_${item.order}`,
      stageId: item.id,
      label: item.name,
      summary: `确认阶段：${item.name}`
    }));
  }
  void stageNames;

  base.majorIncidents = (Array.isArray(raw.majorIncidents) ? raw.majorIncidents : [])
    .map((m) => ({
      label: clean(m?.label, 80),
      hint: clean(m?.hint, 160)
    }))
    .filter((m) => m.label)
    .slice(0, 24);

  base.truthSections = (Array.isArray(raw.truthSections) ? raw.truthSections : [])
    .map((t) => clean(t, 80))
    .filter(Boolean)
    .slice(0, 20);

  base.unresolvedTopics = (Array.isArray(raw.unresolvedTopics) ? raw.unresolvedTopics : [])
    .map((t) => clean(t, 120))
    .filter(Boolean)
    .slice(0, 20);

  return base;
}

function buildHostDigest(sections, maxChars = 14000) {
  const parts = [];
  let used = 0;
  for (const sec of sections || []) {
    const head = (sec.headingPath || []).join(" / ");
    const body = String(sec.originalText || "").slice(0, 1200);
    const block = `[${sec.id}] ${head}\n${body}`;
    if (used + block.length > maxChars) break;
    parts.push(block);
    used += block.length;
  }
  return parts.join("\n\n---\n\n");
}

export async function runPass0GlobalRead(input, { requestJson } = {}) {
  const sections = input.hostSourceSections || [];
  if (!sections.length) {
    return { map: emptyGlobalStoryMap(), usage: null, skipped: true };
  }

  if (!requestJson) {
    if (!deepseekConfig().configured) {
      throw new Error("DEEPSEEK_NOT_CONFIGURED");
    }
    const { requestDeepseekJson } = await import("../../deepseek-client.js");
    requestJson = requestDeepseekJson;
  }

  const user = {
    project: input.projectMeta || {},
    confirmedStageSchema: input.confirmedStageSchema
      ? {
          items: input.confirmedStageSchema.items?.map((i) => ({
            order: i.order,
            name: i.name,
            id: i.id
          }))
        }
      : null,
    hostDigest: buildHostDigest(sections),
    instruction:
      "建立阅读地图即可。historicalPhases=远史；plotPhases=局内流程；majorIncidents=关键节点提示，不要展开成完整事件列表。"
  };

  const result = await requestJson(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: JSON.stringify(user) }
    ],
    {
      temperature: 0.1,
      maxTokens: 4000,
      timeoutMs: Math.min(deepseekConfig().timeoutMs, 180000),
      phase: "compiler-v2-stage3a-v2-pass0-global-read"
    }
  );

  return {
    map: normalizeGlobalStoryMap(result.value, {
      stageSchema: input.confirmedStageSchema
    }),
    usage: result.usage || null,
    skipped: false
  };
}
