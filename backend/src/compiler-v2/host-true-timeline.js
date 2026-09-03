/**
 * Stage 3A — Host TRUE Timeline (LLM).
 * Only story-world / host-asserted truth events. No character tracks.
 */

import { deepseekConfig } from "../deepseek-config.js";
import { ACT_STATUS, TRUTH_STATUS, newCompilerId } from "./state.js";

export const TIMELINE_TRACK = Object.freeze({
  TRUE: "TRUE"
});

const SYSTEM_PROMPT = [
  "你是剧本杀「主持人手册」主时间线整理助手（Stage 3A）。",
  "任务：整理一条主持人复盘用的 TRUE 主时间线（剧情真相顺序）。",
  "",
  "硬性规则：",
  "1. 只输出主持手册明确写出的事件；禁止脑补。",
  "2. 粒度=主持人复盘级。禁止微动作（走过去/抬手/说一句/坐下来）。",
  "3. 数量硬约束：本批次最多输出 6 条事件。宁缺毋滥；能合并就合并。",
  "4. 不要拆解：发线索/搜证轮次/播放音频/翻页/BGM/时长建议——除非并入一个更大的剧情节点标题中一笔带过。",
  "5. 历史远景/回忆杀：只保留改变主线理解的关键节点（例如长生水由来、关键死亡、身份真相），不要把朝代编年史逐条拆开。",
  "6. 多重结局：合并为 1 条「按生门死门/生死组合进入分支结局」，不要把每对角色的每种生死结局各写成一条。",
  "7. 优先顺序骨架：背景设定 → 开场案发 → 第一幕关键推进 → 第二幕关键推进 → 第三幕揭示 → 阵法抉择 → 结局框架。",
  "8. 每个事件必须引用提供的 sourceSectionId；不得引用未给出的 id。",
  "9. truthStatus 只能 CONFIRMED 或 UNCERTAIN。禁止 FABRICATED / CHARACTER_BELIEF。",
  "10. locationHint 仅地点短语或 null。不要 invent locationId。",
  "11. participantNames 只用原文角色名。",
  "12. actTitle 能对应第N幕则填，否则 null。",
  "",
  "只输出 JSON：",
  '{"events":[{',
  '"title":"短标题",',
  '"summary":"1-2句复盘摘要",',
  '"time":"原文时间短语或null",',
  '"actTitle":"第一幕|第二幕|第三幕|null",',
  '"locationHint":"地点或null",',
  '"participantNames":["角色名"],',
  '"truthStatus":"CONFIRMED|UNCERTAIN",',
  '"sourceSectionIds":["src_..."],',
  '"evidenceQuote":"直接支撑该事件的短引文"',
  "}]}"
].join("\n");

function cleanStr(value, max = 400) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * Pack host SourceSections into LLM windows (~5.5k chars).
 */
export function buildHostTimelineChunks(state, { maxChars = 9000 } = {}) {
  const host = (state.documents || []).find((d) => d.kind === "HOST_BOOK");
  if (!host) return [];

  const sections = (state.sourceSections || []).filter((s) => s.documentId === host.id);
  if (!sections.length && host.text) {
    // Fallback single synthetic window (should be rare after Stage 2)
    return [
      {
        index: 0,
        sections: [
          {
            id: null,
            actId: null,
            headingPath: ["host"],
            originalText: String(host.text).slice(0, maxChars)
          }
        ]
      }
    ];
  }

  const chunks = [];
  let buf = [];
  let chars = 0;
  for (const sec of sections) {
    const len = String(sec.originalText || "").length;
    if (buf.length && chars + len > maxChars) {
      chunks.push({ index: chunks.length, sections: buf });
      buf = [];
      chars = 0;
    }
    buf.push(sec);
    chars += len;
  }
  if (buf.length) chunks.push({ index: chunks.length, sections: buf });
  return chunks;
}

function buildUserPayload(chunk, acts) {
  return {
    instruction: "本批次最多 6 条事件。合并结局分支与过细史实。",
    maxEvents: 6,
    acts: (acts || []).map((a) => ({ id: a.id, title: a.title })),
    sourceSections: chunk.sections.map((s) => ({
      id: s.id,
      actId: s.actId || null,
      headingPath: s.headingPath || [],
      text: String(s.originalText || "").slice(0, 4000)
    }))
  };
}

function resolveActId(actTitle, acts) {
  const t = cleanStr(actTitle, 40);
  if (!t) return null;
  const hit = (acts || []).find((a) => a.title === t || t.includes(a.title) || a.title.includes(t));
  return hit?.id || null;
}

function normalizeRawEvents(rawEvents, { acts, validSectionIds, orderStart }) {
  const events = [];
  let order = orderStart;
  for (const raw of rawEvents || []) {
    if (!raw || typeof raw !== "object") continue;
    const title = cleanStr(raw.title, 80);
    const summary = cleanStr(raw.summary, 500);
    if (!title || !summary) continue;

    let truthStatus = String(raw.truthStatus || "").trim();
    if (truthStatus !== TRUTH_STATUS.CONFIRMED && truthStatus !== TRUTH_STATUS.UNCERTAIN) {
      truthStatus = TRUTH_STATUS.UNCERTAIN;
    }

    const sourceSectionIds = [
      ...new Set(
        (Array.isArray(raw.sourceSectionIds) ? raw.sourceSectionIds : [])
          .map((id) => String(id || "").trim())
          .filter((id) => id && validSectionIds.has(id))
      )
    ];

    const actTitle = cleanStr(raw.actTitle, 40) || null;
    const actId = resolveActId(actTitle, acts);

    events.push({
      id: newCompilerId("tev"),
      track: TIMELINE_TRACK.TRUE,
      order: order++,
      title,
      summary,
      time: cleanStr(raw.time, 80) || null,
      actId,
      actStatus: actId ? ACT_STATUS.ASSIGNED : ACT_STATUS.UNASSIGNED,
      locationHint: cleanStr(raw.locationHint, 40) || null,
      locationId: null,
      participantNames: Array.isArray(raw.participantNames)
        ? raw.participantNames.map((n) => cleanStr(n, 40)).filter(Boolean).slice(0, 12)
        : [],
      truthStatus,
      sourceSectionIds,
      sourceRefs: sourceSectionIds.map((sid) => ({ sourceSectionId: sid })),
      evidenceQuote: cleanStr(raw.evidenceQuote, 200) || null
    });
  }
  return { events, nextOrder: order };
}

const CONSOLIDATE_PROMPT = [
  "你是剧本杀时间线编辑。输入是从主持手册抽出的草稿事件列表（可能重复、过碎、顺序乱）。",
  "请合并为一条主持人复盘用的 TRUE 主时间线。",
  "",
  "规则：",
  "1. 输出 12～22 条，按剧情真相时间顺序排列（不是手册章节顺序）。",
  "2. 多重结局合并为 1 条。",
  "3. 远古/回忆史实最多保留 3 条关键节点。",
  "4. 保留 sourceSectionIds（可并集），不得发明新 id。",
  "5. 不得新增原文没有的情节。",
  "6. truthStatus 只能 CONFIRMED 或 UNCERTAIN。",
  "",
  "只输出 JSON：",
  '{"events":[{"title":"","summary":"","time":null,"actTitle":null,"locationHint":null,"participantNames":[],"truthStatus":"CONFIRMED","sourceSectionIds":[],"evidenceQuote":""}]}'
].join("\n");

async function consolidateHostTrueEvents(draftEvents, acts) {
  if (!draftEvents.length || draftEvents.length <= 22) {
    return draftEvents;
  }
  const { requestDeepseekJson } = await import("../deepseek-client.js");
  const compact = draftEvents.map((e) => ({
    title: e.title,
    summary: e.summary,
    time: e.time,
    actTitle: (acts || []).find((a) => a.id === e.actId)?.title || null,
    locationHint: e.locationHint,
    participantNames: e.participantNames,
    truthStatus: e.truthStatus,
    sourceSectionIds: e.sourceSectionIds,
    evidenceQuote: e.evidenceQuote
  }));
  const result = await requestDeepseekJson(
    [
      { role: "system", content: CONSOLIDATE_PROMPT },
      { role: "user", content: JSON.stringify({ draftEvents: compact }) }
    ],
    {
      temperature: 0.1,
      maxTokens: 7000,
      timeoutMs: Math.min(deepseekConfig().timeoutMs, 180000),
      phase: "compiler-v2-stage3a-consolidate"
    }
  );
  const validSectionIds = new Set(draftEvents.flatMap((e) => e.sourceSectionIds || []));
  const raw = Array.isArray(result.value?.events) ? result.value.events.slice(0, 22) : [];
  const { events } = normalizeRawEvents(raw, {
    acts,
    validSectionIds,
    orderStart: 1
  });
  return events.length ? events : draftEvents;
}

/**
 * Extract TRUE host timeline. Requires DeepSeek configured.
 */
export async function extractHostTrueTimeline(state, { onChunk } = {}) {
  if (!deepseekConfig().configured) {
    throw new Error("DEEPSEEK_NOT_CONFIGURED");
  }

  const { requestDeepseekJson } = await import("../deepseek-client.js");

  const chunks = buildHostTimelineChunks(state);
  if (!chunks.length) {
    return { events: [], track: null, meta: { chunks: 0 } };
  }

  const allEvents = [];
  let order = 1;
  const meta = { chunks: chunks.length, calls: 0, usage: [], consolidated: false };

  for (const chunk of chunks) {
    const validSectionIds = new Set(chunk.sections.map((s) => s.id).filter(Boolean));
    const payload = buildUserPayload(chunk, state.acts);
    const result = await requestDeepseekJson(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(payload) }
      ],
      {
        temperature: 0.15,
        maxTokens: 6000,
        timeoutMs: Math.min(deepseekConfig().timeoutMs, 180000),
        phase: "compiler-v2-stage3a-host-true-timeline",
        context: { chunk: chunk.index, sections: chunk.sections.length }
      }
    );
    meta.calls += 1;
    if (result.usage) meta.usage.push(result.usage);
    if (typeof onChunk === "function") {
      onChunk({ chunk: chunk.index, total: chunks.length, usage: result.usage });
    }

    const rawEvents = Array.isArray(result.value?.events) ? result.value.events : [];
    const { events, nextOrder } = normalizeRawEvents(rawEvents.slice(0, 6), {
      acts: state.acts,
      validSectionIds,
      orderStart: order
    });
    allEvents.push(...events);
    order = nextOrder;
  }

  let finalEvents = allEvents;
  if (allEvents.length > 22) {
    finalEvents = await consolidateHostTrueEvents(allEvents, state.acts);
    meta.consolidated = true;
    meta.calls += 1;
  }

  finalEvents.forEach((ev, i) => {
    ev.order = i + 1;
  });

  const track = {
    id: newCompilerId("track"),
    type: TIMELINE_TRACK.TRUE,
    label: "Host TRUE Timeline",
    characterId: null,
    eventIds: finalEvents.map((e) => e.id)
  };

  return { events: finalEvents, track, meta };
}
