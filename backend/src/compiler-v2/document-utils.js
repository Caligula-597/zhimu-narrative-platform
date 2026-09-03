/**
 * Shared docx parse helpers for Compiler V2 — mirrors opening-package patterns
 * without coupling stages to the opening-package service.
 */

import { parseCreatorDocument } from "../document-parser.js";
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

/** Split character / host sections into act-like script chunks (same heuristic as opening-package). */
export function sectionsFromParsedDocument(document, { characterId = null, sourceKey, filename, roleName } = {}) {
  const sections = Array.isArray(document?.sections) ? document.sections : [];
  const usable = sections.filter((section) => String(section?.body || "").trim());
  if (!usable.length) {
    const body = String(document?.text || "").trim();
    if (!body) return [];
    return [{
      characterId,
      actKey: null,
      title: roleName || filenameStem(filename) || "正文",
      body,
      filename,
      importKey: `${sourceKey}:section:0`,
      headingPath: [roleName || filenameStem(filename) || "正文"]
    }];
  }
  return usable.map((section, index) => ({
    characterId,
    actKey: null,
    title: String(section.title || `分幕 ${index + 1}`).trim(),
    body: String(section.body || "").trim(),
    filename,
    importKey: `${sourceKey}:section:${index}`,
    headingPath: [String(section.title || `分幕 ${index + 1}`).trim()]
  }));
}

export function guessPlayerCountFromText(text = "") {
  const raw = String(text);
  const patterns = [
    /(?:玩家|角色|人数)\s*[:：]?\s*(\d+)\s*人/,
    /(\d+)\s*人(?:局|本|剧本)/,
    /(?:共|计)\s*(\d+)\s*(?:名|位)?(?:玩家|角色)/
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m) {
      const n = Number(m[1]);
      if (n >= 2 && n <= 24) return n;
    }
  }
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

export function guessTitleFromText(text = "", filename = "") {
  const lines = String(text).split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 8)) {
    if (line.length >= 2 && line.length <= 40 && !/第.+幕/.test(line)) {
      if (/剧本|手册|说明|目录/.test(line)) continue;
      return line;
    }
  }
  const stem = filenameStem(filename);
  return stem || null;
}
