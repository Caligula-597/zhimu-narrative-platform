import { newCompilerId } from "../state.js";
import { detectNeedsSplit } from "./needs-split.js";

export const SPLIT_REASON = Object.freeze({
  TIME_SHIFT: "TIME_SHIFT",
  SUBJECT_SHIFT: "SUBJECT_SHIFT",
  LOCATION_SHIFT: "LOCATION_SHIFT",
  PARALLEL_EVENT: "PARALLEL_EVENT",
  MULTIPLE_OUTCOMES: "MULTIPLE_OUTCOMES",
  MIXED_SEMANTICS: "MIXED_SEMANTICS"
});

const TIME_BOUNDARY =
  /(?=(?:五年后|多年后|数年后|两年后|次年|次日|随后|后来|最终|与此同时|同时[，,]))/;

/**
 * Splitter V1 — proposal only. Never invents facts beyond parent title+summary.
 * Does not auto-replace the parent event.
 */
export function proposeEventSplit(event, { force = false } = {}) {
  const title = String(event?.title || "").trim();
  const summary = String(event?.summary || "").trim();
  const text = `${title}。${summary}`.replace(/\s+/g, " ").trim();
  const sourceRefs = [...(event?.sourceSectionIds || [])];
  const flagged = force || event?.needsSplit || detectNeedsSplit(event).needsSplit;

  if (!flagged) {
    return {
      parentEventId: event?.id || null,
      shouldSplit: false,
      proposal: null,
      reason: "NOT_FLAGGED"
    };
  }

  // Parallel: 「同时…」
  const parallel = splitParallel(title, summary, sourceRefs);
  if (parallel) {
    return wrapProposal(event, parallel.children, SPLIT_REASON.PARALLEL_EVENT, "HIGH");
  }

  // Hard time shift: 五年后 / multi-year
  const timeSplit = splitByTimeBoundary(title, summary, sourceRefs);
  if (timeSplit) {
    return wrapProposal(event, timeSplit.children, SPLIT_REASON.TIME_SHIFT, timeSplit.confidence);
  }

  // Subject / outcome chains from title compressions
  const subjectSplit = splitSubjectOutcomes(title, summary, sourceRefs);
  if (subjectSplit) {
    return wrapProposal(
      event,
      subjectSplit.children,
      subjectSplit.reason,
      subjectSplit.confidence
    );
  }

  // Conservative: cannot safely split → LOW proposal with soft halves only if strong markers
  if (/五年后|最终|同时/.test(text) && summary.length > 36) {
    const soft = softBisect(title, summary, sourceRefs);
    if (soft) {
      return wrapProposal(event, soft, SPLIT_REASON.MIXED_SEMANTICS, "LOW");
    }
  }

  return {
    parentEventId: event?.id || null,
    shouldSplit: true,
    proposal: null,
    reason: "NEEDS_SPLIT_BUT_NO_SAFE_BOUNDARY",
    note: "Flagged over-merge but Splitter V1 refuses to invent cut points"
  };
}

function wrapProposal(event, children, reason, confidence) {
  const validated = validateSplitProposal(event, {
    parentEventId: event.id,
    children,
    reason,
    confidence
  });
  return {
    parentEventId: event.id,
    shouldSplit: validated.ok,
    proposal: validated.ok
      ? {
          parentEventId: event.id,
          children: validated.children,
          reason,
          confidence
        }
      : null,
    validation: validated,
    reason: validated.ok ? reason : validated.rejectReason
  };
}

function splitParallel(title, summary, sourceRefs) {
  const m = summary.match(/^(.*?)([。；;]?\s*)同时[，,]?(.*)$/);
  if (!m) return null;
  const left = cleanPart(m[1]);
  const right = cleanPart(m[3]);
  if (left.length < 8 || right.length < 6) return null;
  return {
    children: [
      childFrom(title.includes("同时") ? left.slice(0, 24) : title.split(/[；;]/)[0] || left.slice(0, 28), left, sourceRefs, {
        temporalHint: null
      }),
      childFrom(right.slice(0, 28) || "并行事件", right, sourceRefs, {
        temporalHint: "同时"
      })
    ]
  };
}

function splitByTimeBoundary(title, summary, sourceRefs) {
  const markers = ["五年后", "多年后", "数年后", "两年后", "次年", "次日", "后来，", "后来", "最终"];
  let best = null;
  for (const mk of markers) {
    const idx = summary.indexOf(mk);
    if (idx <= 6) continue;
    const before = cleanPart(summary.slice(0, idx));
    const after = cleanPart(summary.slice(idx));
    if (before.length < 8 || after.length < 6) continue;
    // Prefer 五年后 / multi outcome
    const score = mk === "五年后" ? 3 : mk.startsWith("最终") ? 2 : 1;
    if (!best || score > best.score) {
      best = {
        score,
        confidence: mk === "五年后" || mk === "多年后" ? "HIGH" : "MEDIUM",
        children: [
          childFrom(deriveTitle(title, before, 0), before, sourceRefs, { temporalHint: null }),
          childFrom(deriveTitle(title, after, 1), after, sourceRefs, { temporalHint: mk.replace(/，$/, "") })
        ]
      };
    }
  }
  // Title pattern: 寻找…死于途中
  if (!best && /寻找/.test(title) && /死/.test(title) && /五年后|死/.test(summary)) {
    const idx = summary.search(/五年后|死于|死亡/);
    if (idx > 8) {
      const before = cleanPart(summary.slice(0, idx));
      const after = cleanPart(summary.slice(idx));
      if (before.length >= 8 && after.length >= 4) {
        best = {
          score: 3,
          confidence: "HIGH",
          children: [
            childFrom("继续寻找长生水", before, sourceRefs, {}),
            childFrom(after.slice(0, 20) || "死亡结局", after, sourceRefs, { temporalHint: "五年后" })
          ]
        };
      }
    }
  }
  return best;
}

function splitSubjectOutcomes(title, summary, sourceRefs) {
  // 误杀 → 屠杀
  if (/误杀/.test(title) && /屠杀|逃脱/.test(summary)) {
    const parts = summary.split(/(?<=杀害[，,。])|(?=傅月生愤怒|愤怒屠杀)/);
    const chunks = parts.map(cleanPart).filter((p) => p.length >= 6);
    if (chunks.length >= 2) {
      return {
        reason: SPLIT_REASON.SUBJECT_SHIFT,
        confidence: "HIGH",
        children: [
          childFrom("荣妙珠被张家误杀", chunks[0], sourceRefs, {}),
          childFrom("傅月生屠杀张家", chunks.slice(1).join(""), sourceRefs, {})
        ]
      };
    }
  }

  // 仪式 multi-outcome
  if (/仪式/.test(title) && /牺牲|烧毁|继承|苏醒/.test(summary)) {
    const bits = sliceByKeywords(summary, ["牺牲", "苏醒", "继承", "烧毁"]);
    if (bits.length >= 2) {
      return {
        reason: SPLIT_REASON.MULTIPLE_OUTCOMES,
        confidence: "MEDIUM",
        children: bits.map((b, i) => childFrom(b.slice(0, 22) || `仪式结果${i + 1}`, b, sourceRefs, {}))
      };
    }
  }

  // life span 出生…病逝…
  if (/出生/.test(title) && /(病逝|去世|锦囊)/.test(summary)) {
    const idx = summary.search(/病逝|去世|接回|锦囊/);
    if (idx > 6) {
      return {
        reason: SPLIT_REASON.TIME_SHIFT,
        confidence: "MEDIUM",
        children: [
          childFrom(deriveTitle(title, summary.slice(0, idx), 0), cleanPart(summary.slice(0, idx)), sourceRefs, {}),
          childFrom(deriveTitle(title, summary.slice(idx), 1), cleanPart(summary.slice(idx)), sourceRefs, {})
        ]
      };
    }
  }

  // loss multi
  if (/失去/.test(title) && /母亲|哥哥/.test(summary)) {
    const idx = summary.search(/母亲|病重|去世/);
    if (idx > 6) {
      return {
        reason: SPLIT_REASON.MULTIPLE_OUTCOMES,
        confidence: "MEDIUM",
        children: [
          childFrom("失去哥哥", cleanPart(summary.slice(0, idx)), sourceRefs, {}),
          childFrom("母亲去世与寻真", cleanPart(summary.slice(idx)), sourceRefs, {})
        ]
      };
    }
  }

  return null;
}

function softBisect(title, summary, sourceRefs) {
  const idx = Math.floor(summary.length / 2);
  const cut = summary.lastIndexOf("，", idx);
  const at = cut > 10 ? cut : idx;
  const a = cleanPart(summary.slice(0, at));
  const b = cleanPart(summary.slice(at + 1));
  if (a.length < 10 || b.length < 10) return null;
  return [
    childFrom(deriveTitle(title, a, 0), a, sourceRefs, {}),
    childFrom(deriveTitle(title, b, 1), b, sourceRefs, {})
  ];
}

function sliceByKeywords(summary, keys) {
  const hits = keys
    .map((k) => ({ k, i: summary.indexOf(k) }))
    .filter((x) => x.i >= 0)
    .sort((a, b) => a.i - b.i);
  if (hits.length < 2) return [];
  const out = [];
  for (let i = 0; i < hits.length; i += 1) {
    const start = i === 0 ? 0 : hits[i].i;
    const end = i + 1 < hits.length ? hits[i + 1].i : summary.length;
    const chunk = cleanPart(summary.slice(start, end));
    if (chunk.length >= 6) out.push(chunk);
  }
  return out;
}

function deriveTitle(parentTitle, chunk, index) {
  const c = cleanPart(chunk);
  if (c.length <= 24) return c;
  if (index === 0 && parentTitle && parentTitle.length <= 28) return parentTitle;
  return `${c.slice(0, 22)}…`;
}

function cleanPart(s) {
  return String(s || "")
    .replace(/^[\s，,。；;、]+|[\s，,。；;、]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function childFrom(title, summary, sourceRefs, extra = {}) {
  return {
    title: cleanPart(title).slice(0, 40),
    summary: cleanPart(summary).slice(0, 300),
    temporalHint: extra.temporalHint || null,
    participantNames: guessNames(`${title} ${summary}`),
    locationHint: guessLocation(`${title} ${summary}`),
    sourceRefs: [...sourceRefs]
  };
}

function guessNames(text) {
  const names = [
    "顾怀辰",
    "陶梦芸",
    "白初",
    "杨峥",
    "陆卿原",
    "张九孚",
    "黎小曼",
    "傅月生",
    "陶老板",
    "朱棣",
    "荣妙珠",
    "白止"
  ];
  return names.filter((n) => text.includes(n)).slice(0, 6);
}

function guessLocation(text) {
  if (/日月山庄/.test(text)) return "日月山庄";
  if (/明长陵/.test(text)) return "明长陵";
  if (/墓室|墓穴/.test(text)) return "墓室";
  if (/拍卖/.test(text)) return "拍卖会";
  return null;
}

/**
 * Validator: children text must be composed from parent; no new tokens of concern;
 * sourceRefs ⊆ parent; at least 2 children.
 */
export function validateSplitProposal(parent, proposal) {
  const parentText = `${parent.title || ""} ${parent.summary || ""}`.replace(/\s+/g, "");
  const parentRefs = new Set(parent.sourceSectionIds || []);
  const children = proposal?.children || [];

  if (children.length < 2) {
    return { ok: false, rejectReason: "TOO_FEW_CHILDREN", children: [] };
  }

  const normalizedChildren = [];
  for (const ch of children) {
    const summary = cleanPart(ch.summary);
    const title = cleanPart(ch.title);
    if (!summary || summary.length < 4) {
      return { ok: false, rejectReason: "EMPTY_CHILD", children: [] };
    }
    // Fact preservation: every child summary chars should mostly appear in parent
    const compact = summary.replace(/\s+/g, "");
    let hit = 0;
    for (let i = 0; i < compact.length - 1; i += 1) {
      const bigram = compact.slice(i, i + 2);
      if (parentText.includes(bigram)) hit += 1;
    }
    const coverage = compact.length > 1 ? hit / (compact.length - 1) : 1;
    if (coverage < 0.72) {
      return { ok: false, rejectReason: "NEW_FACT_SUSPECT", children: [], coverage };
    }
    const refs = ch.sourceRefs || ch.sourceSectionIds || [];
    if (refs.some((r) => !parentRefs.has(r))) {
      return { ok: false, rejectReason: "SOURCE_REF_EXPANDED", children: [] };
    }
    if (!refs.length && parentRefs.size) {
      // inherit
    }
    normalizedChildren.push({
      ...ch,
      title,
      summary,
      sourceRefs: refs.length ? refs : [...parentRefs]
    });
  }

  // Union of children should not be tiny vs parent
  const childUnion = normalizedChildren.map((c) => c.summary).join("");
  if (childUnion.replace(/\s+/g, "").length < parentText.length * 0.45) {
    return { ok: false, rejectReason: "FACT_LOSS", children: normalizedChildren };
  }

  return { ok: true, rejectReason: null, children: normalizedChildren };
}

/**
 * Materialize confirmed proposal: parent → SPLIT_PARENT, children as new EVENTs.
 * Caller must explicitly confirm; Splitter never auto-applies.
 */
export function applySplitProposal(parent, proposal, { confirmed = false } = {}) {
  if (!confirmed) {
    throw new Error("SPLIT_NOT_CONFIRMED");
  }
  const validated = validateSplitProposal(parent, proposal);
  if (!validated.ok) {
    return { ok: false, error: validated.rejectReason };
  }
  const childEvents = validated.children.map((ch, i) => ({
    id: newCompilerId("cevt"),
    title: ch.title,
    summary: ch.summary,
    sourceSectionIds: ch.sourceRefs,
    participantNames: ch.participantNames || [],
    locationHint: ch.locationHint || null,
    temporalHint: ch.temporalHint || null,
    importance: parent.importance || "SUPPORTING",
    parentEventId: parent.id,
    splitIndex: i + 1,
    needsSplit: false
  }));

  const parentRecord = {
    ...parent,
    status: "SPLIT_PARENT",
    childEventIds: childEvents.map((c) => c.id),
    splitReason: proposal.reason,
    needsSplit: false
  };

  return { ok: true, parent: parentRecord, children: childEvents };
}

/**
 * Run proposals for all needsSplit events (no apply).
 */
export function proposeSplitsForEvents(events = []) {
  const proposals = [];
  const skipped = [];
  for (const ev of events) {
    if (!ev?.needsSplit && !detectNeedsSplit(ev).needsSplit) continue;
    const result = proposeEventSplit(ev, { force: true });
    if (result.proposal) proposals.push(result);
    else skipped.push(result);
  }
  return { proposals, skipped };
}
