/**
 * Shared parse / structure helpers for Compiler V2.
 * Act ≠ heading. Title must be high-confidence or NEEDS_CONFIRMATION.
 */

import { parseCreatorDocument } from "../document-parser.js";
import { parseCreatorTextDocument, cleanText } from "../document-parser.js";
import { runDocumentProcessing } from "../document-processing-guard.js";
import { normalizeCreationType } from "../document-structure.js";

export function filenameStem(filename = "") {
  return String(filename).replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "").trim();
}

export async function parseDocxFile(file, creationType = "murder_mystery") {
  return runDocumentProcessing(() =>
    parseCreatorDocument({
      filename: file.filename,
      contentBase64: file.contentBase64,
      creationType: normalizeCreationType(creationType),
      rightsConfirmed: true
    })
  );
}

/** Trial / plain-text path — Opening Package slot already decided kind. */
export async function parseUploadFile(file, creationType = "murder_mystery") {
  if (file?.text != null && String(file.text).trim()) {
    return parseCreatorTextDocument({
      filename: file.filename || "upload.txt",
      text: String(file.text),
      creationType: normalizeCreationType(creationType),
      extraction: { mode: "plain_text" }
    });
  }
  if (file?.contentBase64) {
    return parseDocxFile(file, creationType);
  }
  throw new Error(`Upload file missing text/contentBase64: ${file?.filename || "?"}`);
}

/** True act / chapter titles only — not 灵石/魔石/玉满楼. */
const ACT_CORE_CAPTURE =
  "(序幕|终幕|尾声|楔子|第\\s*[一二三四五六七八九十百千零〇两\\d]+\\s*幕)";

const ACT_LINE_RE = new RegExp(
  `^(?:\\d+\\s*[、.．]\\s*|[（(][一二三四五六七八九十\\d]+[）)]\\s*)?${ACT_CORE_CAPTURE}` +
    `(?:\\s*(?:游戏|小剧场|剧本))?(?:\\s*[（(][^）)]{0,16}[）)])?` +
    `(?:\\s*[：:\\-—－\\s]+(.*))?$`,
  "u"
);

export function isActTitle(title = "") {
  return Boolean(parseActHeadingLine(title));
}

export function parseActHeadingLine(line = "") {
  const t = String(line).replace(/\s+/g, " ").trim();
  if (!t || t.length > 80) return null;
  // Mid-prose mentions are usually long sentences with 。
  if (/[。！？]/.test(t) && t.length > 30) return null;
  const m = t.match(ACT_LINE_RE);
  if (!m) return null;
  const core = m[1].replace(/\s+/g, "");
  const actTitle = core.replace(/(游戏|小剧场|剧本)$/u, "") || core;
  if (!/^(?:序幕|终幕|尾声|楔子|第[一二三四五六七八九十百千零〇两\d]+幕)$/u.test(actTitle)) {
    return null;
  }
  const rest = String(m[2] || "").trim();
  return {
    actTitle,
    sectionHint: rest && rest.length <= 24 && !/本幕|时长|建议/.test(rest) ? rest : null
  };
}

/**
 * Soft section heading: short standalone line, NOT an act.
 * Avoids promoting 灵石/魔石 to Act while still chunking provenance.
 */
export function isSectionHeadingLine(line = "") {
  const t = String(line).replace(/\s+/g, " ").trim();
  if (!t || t.length > 24) return false;
  if (isActTitle(t)) return false;
  if (/[。！？；;]$/.test(t)) return false;
  if (/^[《「]/.test(t)) return false;
  // Prefer title-like: no long prose
  if (/[，,]/.test(t) && t.length > 12) return false;
  return true;
}

/**
 * Split manuscript into Act → Section tree by line scan.
 * - Bare「第一幕」counts as act (document-parser splitSections often requires a suffix).
 * - Non-act short headings become sections under the current act (or UNASSIGNED).
 * - Never invent fallback Acts (「主持手册」「未分幕」). Unassigned → actTitle=null.
 */
export function splitActSectionTree(text) {
  const cleaned = cleanText(text);
  if (!cleaned) return { acts: [], sections: [] };

  const acts = [];
  const sections = [];
  let currentAct = null;
  let currentSectionTitle = "正文";
  let bodyLines = [];

  function ensureExplicitAct(title) {
    const existing = acts.find((a) => a.title === title);
    if (existing) {
      currentAct = existing;
      return existing;
    }
    const act = {
      title,
      explicit: true,
      order: acts.length
    };
    acts.push(act);
    currentAct = act;
    return act;
  }

  function flushSection() {
    const body = bodyLines.join("\n").trim();
    bodyLines = [];
    if (!body) return;
    const actTitle = currentAct?.title ?? null;
    for (const piece of splitReadableChunks(body, currentSectionTitle)) {
      sections.push({
        actTitle,
        actStatus: actTitle ? "ASSIGNED" : "UNASSIGNED",
        headingPath: actTitle ? [actTitle, piece.heading] : [piece.heading],
        title: piece.heading,
        body: piece.body
      });
    }
  }

  for (const line of cleaned.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      bodyLines.push("");
      continue;
    }

    const parsedAct = parseActHeadingLine(trimmed);
    if (parsedAct) {
      flushSection();
      ensureExplicitAct(parsedAct.actTitle);
      currentSectionTitle = parsedAct.sectionHint || "正文";
      continue;
    }

    if (isSectionHeadingLine(trimmed) && bodyLines.join("").trim()) {
      flushSection();
      currentSectionTitle = trimmed;
      continue;
    }
    if (isSectionHeadingLine(trimmed) && !bodyLines.join("").trim()) {
      currentSectionTitle = trimmed;
      continue;
    }

    bodyLines.push(line);
  }
  flushSection();

  // No explicit acts → still emit readable sections with actTitle=null (do NOT invent Act)
  if (!sections.length && cleaned) {
    for (const piece of splitReadableChunks(cleaned, "正文")) {
      sections.push({
        actTitle: null,
        actStatus: "UNASSIGNED",
        headingPath: [piece.heading],
        title: piece.heading,
        body: piece.body
      });
    }
  }

  return { acts, sections };
}

/** Prefer readable subsection size for provenance (~200–2000 chars). */
export function splitReadableChunks(body, heading = "正文", { maxChars = 1800 } = {}) {
  const text = String(body || "").trim();
  if (!text) return [];
  if (text.length <= maxChars) {
    return [{ heading, body: text }];
  }

  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let buf = [];
  let bufLen = 0;
  let part = 1;

  function flush() {
    if (!buf.length) return;
    chunks.push({
      heading: paras.length > 1 ? `${heading} · ${part}` : heading,
      body: buf.join("\n\n")
    });
    part += 1;
    buf = [];
    bufLen = 0;
  }

  for (const p of paras) {
    if (bufLen + p.length > maxChars && buf.length) flush();
    buf.push(p);
    bufLen += p.length + 2;
    if (bufLen >= maxChars) flush();
  }
  flush();
  return chunks.length ? chunks : [{ heading, body: text.slice(0, maxChars) }];
}

export function guessPlayerCountFromText(text = "") {
  const raw = String(text);
  const patterns = [
    /(?:玩家|角色|人数)\s*[:：]?\s*(\d+)\s*人/,
    /(\d+)\s*人(?:局|本|剧本)/,
    /(?:共|计)\s*(\d+)\s*(?:名|位)?(?:玩家|角色)/,
    /([一二三四五六七八九十两\d]+)\s*男\s*([一二三四五六七八九十两\d]+)\s*女/,
    /([一二三四五六七八九十两\d]+)\s*人\s*机制本/
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (!m) continue;
    if (re.source.includes("男")) {
      const a = cnNum(m[1]);
      const b = cnNum(m[2]);
      if (a != null && b != null) {
        const n = a + b;
        if (n >= 2 && n <= 24) return n;
      }
      continue;
    }
    const n = cnNum(m[1]);
    if (n != null && n >= 2 && n <= 24) return n;
  }
  return null;
}

function cnNum(s) {
  const map = { 两: 2, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  const t = String(s || "").trim();
  if (/^\d+$/.test(t)) return Number(t);
  if (map[t] != null) return map[t];
  return null;
}

export function guessActCountFromText(text = "") {
  const raw = String(text);
  const m = raw.match(/(?:共|计)?\s*(\d+)\s*幕/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 20) return n;
  }
  const headings = raw.match(/第[一二三四五六七八九十百\d]+幕/g);
  if (headings?.length) return new Set(headings).size;
  return null;
}

function normalizeBookTitle(raw = "") {
  return String(raw).replace(/\s+/g, "").trim();
}

/** Meta / accessory titles — never use as project title. */
function isMetaBookTitle(title = "") {
  return /发行|作者|版权|工作室|组织者手册|主持人手册|手册$|线索卡|配件|地图|说明书|目录/.test(
    title
  );
}

/**
 * High-confidence title only.
 * Returns { title, confidence: "HIGH"|"LOW"|null }
 * Never AUTO_DETECT publisher lines or handbook names.
 */
export function detectProjectTitle(text = "", filename = "") {
  const raw = String(text || "");

  const labeled = raw.match(/(?:剧本名称|作品名|剧名)\s*[:：]\s*([^\n《」]{1,40})/);
  if (labeled?.[1]) {
    const title = normalizeBookTitle(labeled[1]);
    if (title && !isMetaBookTitle(title) && !/发行|作者|版权/.test(title)) {
      return { title, confidence: "HIGH" };
    }
  }

  // Prefer first non-meta 《书名》 (handles spaced OCR like 《 青 楼 》)
  const bookRe = /[《「]([^》」]{1,40})[》」]/g;
  let m;
  while ((m = bookRe.exec(raw))) {
    const title = normalizeBookTitle(m[1]);
    if (!title || isMetaBookTitle(title)) continue;
    if (title.length > 20) continue;
    return { title, confidence: "HIGH" };
  }

  // Filename stem only as LOW suggestion — caller must NOT AUTO_DETECT
  const stem = normalizeBookTitle(filenameStem(filename));
  if (stem && !isMetaBookTitle(stem) && !/剧本|LARP|Role/i.test(stem) && stem.length <= 40) {
    return { title: stem, confidence: "LOW" };
  }
  return { title: null, confidence: null };
}

/** @deprecated use detectProjectTitle — kept for tests that expect string|null */
export function guessTitleFromText(text = "", filename = "") {
  const hit = detectProjectTitle(text, filename);
  return hit.confidence === "HIGH" ? hit.title : null;
}
