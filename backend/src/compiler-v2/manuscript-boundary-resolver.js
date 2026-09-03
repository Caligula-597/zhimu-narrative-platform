/**
 * ManuscriptBoundaryResolver — mechanical split of a bound manuscript.
 * NO LLM. Upload-slot multi-file path stays authoritative; this only handles
 * "one combined DOCX → Opening Package segments".
 */

import { randomUUID } from "node:crypto";
import { extractDocxParagraphStream, joinParagraphs } from "./docx-paragraph-stream.js";
import { proposeStageSchemaFromRoleScripts } from "./stage-schema.js";

export const SEGMENT_TYPE = Object.freeze({
  HOST: "HOST",
  CHARACTER: "CHARACTER",
  CLUE_APPENDIX: "CLUE_APPENDIX",
  OTHER: "OTHER"
});

export const DETECTION = Object.freeze({
  EXACT_HEADING: "EXACT_HEADING",
  PAGE_BOUNDARY: "PAGE_BOUNDARY",
  STRUCTURAL_PATTERN: "STRUCTURAL_PATTERN",
  USER_CONFIRMED: "USER_CONFIRMED"
});

function newId(prefix = "seg") {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function compact(s = "") {
  return String(s).replace(/\s+/g, "");
}

/** Shared stage headings that repeat once per character book (青楼-style). */
const REPEATING_STAGE_RES = [
  /^第[一二三四五六七八九十\d]+章\s*[：:]\s*玉满楼$/,
  /^第一章\s*[：:]\s*玉满楼$/
];

const TASK_ONE_RE = /①\s*你的任务一/;

/**
 * Find paragraph indices that look like role-book starts via repeating stage pattern.
 */
export function findRepeatingStageStarts(paragraphs, { expectedCount = null } = {}) {
  const hits = [];
  for (const p of paragraphs) {
    const t = compact(p.text);
    if (REPEATING_STAGE_RES.some((re) => re.test(t) || re.test(p.text.trim()))) {
      hits.push(p.index);
    }
  }
  if (expectedCount != null && hits.length === expectedCount) return hits;
  if (hits.length >= 2) return hits;
  return [];
}

/**
 * 青楼-style: each role booklet opens with ①你的任务一 (then 第一章：玉满楼).
 * May share a paragraph with imprint「黑羽…《青楼》①你的任务一」.
 */
export function findTaskOneStarts(paragraphs, { expectedCount = null } = {}) {
  const hits = [];
  for (const p of paragraphs) {
    const t = p.text.trim();
    const c = compact(t);
    if (!TASK_ONE_RE.test(t) && !TASK_ONE_RE.test(c)) continue;
    // Avoid long prose that merely quotes the task phrase
    if (t.length > 100 && !c.includes("黑羽") && !c.includes("青楼")) continue;
    hits.push(p.index);
  }
  if (expectedCount != null && hits.length === expectedCount) return hits;
  if (hits.length >= 2) return hits;
  return [];
}

/**
 * Exact standalone role-name headings (not inline prose).
 */
export function findExactRoleHeadings(paragraphs, characterNames = []) {
  const names = characterNames.map((n) => String(n).trim()).filter(Boolean);
  const starts = [];
  for (const p of paragraphs) {
    const t = p.text.trim();
    const c = compact(t);
    for (const name of names) {
      const nc = compact(name);
      const exact =
        c === nc ||
        c === `${nc}：` ||
        c === `${nc}:` ||
        (p.isHeading && c.startsWith(nc) && c.length <= nc.length + 6);
      // Reject prose: too long or has sentence punctuation mid-line
      if (!exact) continue;
      if (t.length > 24) continue;
      if (/[。！？；]/.test(t)) continue;
      starts.push({ index: p.index, characterName: name, detection: DETECTION.EXACT_HEADING });
      break;
    }
  }
  return starts;
}

/**
 * Assign character names to role intervals using intro window cues.
 * Prefer the narrative body after「第一章」over the shared task/skill boilerplate.
 */
export function assignCharacterNames(paragraphs, starts, characterNames) {
  const remaining = new Set(characterNames.map((n) => String(n).trim()));
  const assigned = [];

  const cues = [
    { name: "白斋子", re: /江南第一才子|人称你为.{0,6}才子|所有人都称你为/ },
    { name: "齐剑心", re: /名剑山庄|江南第一剑|五岁时你便在名剑/ },
    { name: "莫怀", re: /长安第一公子|莫府的大少爷|大名[「"']?莫怀/ },
    { name: "杜霄元", re: /杜家乃是你长大|银纹衣.{0,20}银冠/ },
    { name: "姜红儿", re: /美名远扬的姜红儿|不是玉满楼里那美名远扬的姜/ },
    { name: "舒悦", re: /自你记事以来你就在这书斋|书斋先生也是如同你/ },
    { name: "陈一兔", re: /月伎|梳妆台前看着自己的脸庞|小女伎正在为你梳妆|红姨也是你的亲娘|亲娘.*红姨|红姨.*亲娘/ }
  ];

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : paragraphs.length;
    let bodyStart = start;
    for (let j = start; j < Math.min(end, start + 40); j++) {
      const t = compact(paragraphs[j]?.text || "");
      if (t.includes("第一章") && t.includes("玉满楼")) {
        bodyStart = j;
        break;
      }
    }
    const windowText = joinParagraphs(paragraphs, bodyStart, Math.min(bodyStart + 35, end));
    const windowCompact = compact(windowText);

    let best = null;
    let bestScore = 0;

    // 1) Strong identity cues first
    for (const cue of cues) {
      if (!remaining.has(cue.name)) continue;
      if (cue.re.test(windowText) || cue.re.test(windowCompact)) {
        best = cue.name;
        bestScore = 80;
        break;
      }
    }

    // 2) Explicit self-name patterns
    if (!best || bestScore < 60) {
      for (const name of remaining) {
        const nc = compact(name);
        let score = 0;
        if (windowCompact.includes(`大名${nc}`)) score += 100;
        if (/人称你为|叫你为|外号/.test(windowCompact) && windowCompact.includes(nc)) score += 70;
        if (score > bestScore) {
          bestScore = score;
          best = name;
        }
      }
    }

    if (best && bestScore >= 50) {
      remaining.delete(best);
      assigned.push({
        start,
        end,
        characterName: best,
        confidence: Math.min(0.99, 0.55 + bestScore / 200),
        needsConfirmation: bestScore < 60
      });
    } else {
      assigned.push({
        start,
        end,
        characterName: null,
        confidence: 0.35,
        needsConfirmation: true
      });
    }
  }

  const leftover = [...remaining];
  for (const slot of assigned) {
    if (!slot.characterName && leftover.length) {
      slot.characterName = leftover.shift();
      slot.needsConfirmation = true;
      slot.confidence = 0.4;
    }
  }
  return assigned;
}

function buildSegmentsFromStarts(paragraphs, roleSlots, { detection }) {
  const segments = [];
  const firstRole = roleSlots[0]?.start ?? paragraphs.length;

  if (firstRole > 0) {
    segments.push({
      id: newId("seg"),
      type: SEGMENT_TYPE.HOST,
      characterName: null,
      startParagraph: 0,
      endParagraph: firstRole,
      originalContent: joinParagraphs(paragraphs, 0, firstRole),
      detection,
      confidence: 0.9
    });
  }

  for (const slot of roleSlots) {
    segments.push({
      id: newId("seg"),
      type: SEGMENT_TYPE.CHARACTER,
      characterName: slot.characterName,
      startParagraph: slot.start,
      endParagraph: slot.end,
      originalContent: joinParagraphs(paragraphs, slot.start, slot.end),
      detection,
      confidence: slot.confidence,
      needsConfirmation: Boolean(slot.needsConfirmation)
    });
  }
  return segments;
}

/**
 * Detect shared stage schema repeated across all character segments.
 * Suggestion only — StageSchema Confirmation UI must confirm (never auto-act).
 */
export function detectSharedStageSchema(characterSegments) {
  const proposal = proposeStageSchemaFromRoleScripts(characterSegments || []);
  if (!proposal) return null;
  return {
    stages: proposal.items.map((i) => i.name),
    label: proposal.label,
    characterCount: proposal.characterCount,
    suggestion: "SHARED_GAME_STAGES",
    prompt: proposal.prompt,
    proposal
  };
}

export function validateSegments(segments, { characterNames = [], minRoleChars = 400 } = {}) {
  const issues = [];
  const chars = segments.filter((s) => s.type === SEGMENT_TYPE.CHARACTER);

  // coverage / overlap on paragraph ranges
  const ranges = segments
    .map((s) => [s.startParagraph, s.endParagraph])
    .sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < ranges.length; i++) {
    const [a0, a1] = ranges[i];
    if (a0 >= a1) issues.push({ code: "EMPTY_RANGE", message: `空区间 ${a0}-${a1}` });
    if (i > 0 && a0 < ranges[i - 1][1]) {
      issues.push({ code: "OVERLAP", message: `段落区间重叠于 ${a0}` });
    }
    if (i > 0 && a0 > ranges[i - 1][1]) {
      issues.push({ code: "GAP", message: `段落缺口 ${ranges[i - 1][1]}…${a0}` });
    }
  }

  for (const name of characterNames) {
    const hit = chars.filter((c) => c.characterName === name);
    if (hit.length === 0) issues.push({ code: "MISSING_ROLE", message: `缺少角色「${name}」` });
    if (hit.length > 1) issues.push({ code: "DUPLICATE_ROLE", message: `角色「${name}」重复` });
  }

  for (const c of chars) {
    if ((c.originalContent || "").length < minRoleChars) {
      issues.push({
        code: "ROLE_TOO_SHORT",
        message: `角色「${c.characterName || "?"}」过短 (${c.originalContent.length}字)`
      });
    }
  }

  const needsConfirmation = segments.some((s) => s.needsConfirmation);
  return {
    ok: issues.length === 0 && !needsConfirmation,
    issues,
    needsConfirmation
  };
}

/**
 * Main entry: resolve boundaries from DOCX buffer + known cast.
 */
export function resolveManuscriptBoundaries({
  buffer,
  paragraphs: givenParagraphs = null,
  characterNames = [],
  minRoleChars = 400
} = {}) {
  const paragraphs = givenParagraphs || extractDocxParagraphStream(buffer);
  const names = characterNames.map((n) => String(n).trim()).filter(Boolean);

  // Prefer exact headings when each name appears exactly once as heading
  const exact = findExactRoleHeadings(paragraphs, names);
  const exactUnique =
    exact.length === names.length &&
    new Set(exact.map((e) => e.characterName)).size === names.length;

  let roleSlots;
  let detection;

  if (exactUnique) {
    detection = DETECTION.EXACT_HEADING;
    const starts = exact.map((e) => e.index).sort((a, b) => a - b);
    roleSlots = starts.map((start, i) => ({
      start,
      end: i + 1 < starts.length ? starts[i + 1] : paragraphs.length,
      characterName: exact.find((e) => e.index === start)?.characterName || null,
      confidence: 0.95,
      needsConfirmation: false
    }));
  } else {
    // Structural: ①你的任务一 × N, else repeating 第一章：玉满楼 × N
    let starts = findTaskOneStarts(paragraphs, { expectedCount: names.length || null });
    detection = DETECTION.STRUCTURAL_PATTERN;
    if (!starts.length) {
      starts = findRepeatingStageStarts(paragraphs, { expectedCount: names.length || null });
    }
    if (!starts.length) {
      return {
        paragraphs,
        segments: [],
        sharedStages: null,
        validation: {
          ok: false,
          issues: [{ code: "NO_BOUNDARY", message: "未找到可机械切分的角色边界" }],
          needsConfirmation: true
        },
        preview: []
      };
    }
    roleSlots = assignCharacterNames(paragraphs, starts, names);
  }

  const segments = buildSegmentsFromStarts(paragraphs, roleSlots, { detection });
  const sharedStages = detectSharedStageSchema(
    segments.filter((s) => s.type === SEGMENT_TYPE.CHARACTER)
  );
  const validation = validateSegments(segments, { characterNames: names, minRoleChars });

  const preview = segments.map((s) => ({
    id: s.id,
    type: s.type,
    characterName: s.characterName,
    startParagraph: s.startParagraph,
    endParagraph: s.endParagraph,
    chars: (s.originalContent || "").length,
    confidence: s.confidence,
    needsConfirmation: Boolean(s.needsConfirmation),
    detection: s.detection,
    head: String(s.originalContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80)
  }));

  return { paragraphs, segments, sharedStages, validation, preview };
}

/**
 * Convert resolved segments → Compiler V2 Opening Package inputFiles shape.
 */
export function segmentsToOpeningPackageInput(segments, { creationType = "murder_mystery" } = {}) {
  const host = segments.find((s) => s.type === SEGMENT_TYPE.HOST);
  const roles = segments.filter((s) => s.type === SEGMENT_TYPE.CHARACTER && s.characterName);
  return {
    rightsConfirmed: true,
    creationType,
    hostHandbook: host
      ? { filename: "host-from-bound-manuscript.txt", text: host.originalContent }
      : null,
    roleScripts: roles.map((r) => ({
      filename: `${r.characterName}.txt`,
      characterName: r.characterName,
      text: r.originalContent
    })),
    clueTextFiles: [],
    clueImages: [],
    notes: "从合订本 ManuscriptBoundaryResolver 机械切分生成"
  };
}
