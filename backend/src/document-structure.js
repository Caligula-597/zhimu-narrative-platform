import { createHash } from "node:crypto";
import {
  CREATOR_TERMINOLOGY,
  normalizeCreationType
} from "../../shared/creator-terminology.js";

export { CREATOR_TERMINOLOGY, normalizeCreationType } from "../../shared/creator-terminology.js";

function cleanLine(value) {
  return String(value ?? "").replace(/\u00a0/g, " ").trim();
}

function stripMarkdownHeading(line) {
  const match = cleanLine(line).match(/^(#{1,6})\s+(.+)$/);
  return match ? { text: cleanLine(match[2]), headingLevel: match[1].length } : { text: cleanLine(line), headingLevel: null };
}

function trimLabel(value, fallback) {
  return cleanLine(value).replace(/^[：:、.\-—\s]+/, "").replace(/[：:、.\-—\s]+$/, "").slice(0, 200) || fallback;
}

function looksLikeHeading(line, headingLevel) {
  if (headingLevel) return true;
  if (line.length > 100) return false;
  return /^(?:第\s*[一二三四五六七八九十百千万0-9]+\s*[幕场章节]|(?:角色|人物|角色名|PC|NPC|幕|章节|场景|地点|线索|证据|秘密|隐秘|真相|KP\s*信息|KP\s*专用|HO|HANDOUT|ACT|SCENE|CLUE|SECRET)\s*(?:[0-9一二三四五六七八九十]+)?\s*[：:\-—])/i.test(line);
}

function classifyHeading(rawLine) {
  const { text, headingLevel } = stripMarkdownHeading(rawLine);
  if (!text || !looksLikeHeading(text, headingLevel)) return null;

  let match = text.match(/^(?:角色|人物|角色名|PC|NPC)\s*(?:[0-9一二三四五六七八九十]+)?\s*[：:\-—]?\s*(.+)$/i);
  if (match) return { type: "role", title: trimLabel(match[1], "未命名角色"), headingLevel, sourceHeading: text, confidence: "high" };

  match = text.match(/^((?:第\s*)?[一二三四五六七八九十百千万0-9]+\s*[幕章]|ACT\s*[0-9IVX]+)\s*[：:、.\-—]?\s*(.*)$/i);
  if (match) return { type: "act", title: trimLabel(match[2], cleanLine(match[1])), headingLevel, sourceHeading: text, confidence: "high" };
  match = text.match(/^(?:幕|章节)\s*(?:[0-9一二三四五六七八九十]+)?\s*[：:\-—]\s*(.+)$/i);
  if (match) return { type: "act", title: trimLabel(match[1], "未命名幕"), headingLevel, sourceHeading: text, confidence: "high" };

  match = text.match(/^((?:第\s*)?[一二三四五六七八九十百千万0-9]+\s*场|SCENE\s*[0-9IVX]+)\s*[：:、.\-—]?\s*(.*)$/i);
  if (match) return { type: "scene", title: trimLabel(match[2], cleanLine(match[1])), headingLevel, sourceHeading: text, confidence: "high" };
  match = text.match(/^(?:场景|地点)\s*(?:[0-9一二三四五六七八九十]+)?\s*[：:\-—]\s*(.+)$/i);
  if (match) return { type: "scene", title: trimLabel(match[1], "未命名场景"), headingLevel, sourceHeading: text, confidence: "high" };

  match = text.match(/^(?:线索|证据|CLUE|HO|HANDOUT)\s*(?:[0-9一二三四五六七八九十]+)?\s*[：:\-—]\s*(.+)$/i);
  if (match) return { type: "clue", title: trimLabel(match[1], "未命名线索"), headingLevel, sourceHeading: text, confidence: "high" };

  match = text.match(/^(?:秘密|隐秘|真相|SECRET|KP\s*信息|KP\s*专用)\s*(?:[0-9一二三四五六七八九十]+)?\s*[：:\-—]?\s*(.*)$/i);
  if (match) return { type: "secret", title: trimLabel(match[1], "未命名秘密"), headingLevel, sourceHeading: text, confidence: "high" };

  return null;
}

function filenameRoleHint(filename) {
  const stem = String(filename ?? "").replace(/\.[^.]+$/, "").trim();
  const match = stem.match(/^(?:角色本[：:_\- ]*)?(.+?)(?:[：:_\- ]*角色本|[：:_\- ]*人物本)$/i);
  return match ? trimLabel(match[1], "") : "";
}

function candidateId(type, index, heading, body) {
  return `${type}:${index + 1}:${createHash("sha256").update(`${heading}\n${body}`).digest("hex").slice(0, 12)}`;
}

function finalizeCandidate(candidate, endLine, index) {
  const body = candidate.bodyLines.join("\n").trim().slice(0, 200_000);
  return {
    id: candidateId(candidate.type, index, candidate.sourceHeading, body),
    type: candidate.type,
    title: candidate.title,
    body,
    confidence: candidate.confidence,
    sourceHeading: candidate.sourceHeading,
    lineStart: candidate.lineStart,
    lineEnd: Math.max(candidate.lineStart, endLine),
    parentActTitle: candidate.parentActTitle || null,
    roleName: candidate.roleName || null,
    included: true
  };
}

function roleNamesFromText(text) {
  const names = [];
  for (const rawLine of String(text ?? "").split("\n")) {
    const line = cleanLine(rawLine).replace(/^#{1,6}\s+/, "");
    const match = line.match(/^(?:角色列表|人物列表|登场角色|PC\s*列表)\s*[：:]\s*(.+)$/i);
    if (!match) continue;
    for (const value of match[1].split(/[、,，;；/|]/)) {
      const name = trimLabel(value, "");
      if (name && name.length <= 40) names.push(name);
    }
  }
  return [...new Set(names)];
}

export function analyzeNarrativeStructure(text, { filename = "", creationType = "murder_mystery" } = {}) {
  const normalizedType = normalizeCreationType(creationType);
  const lines = String(text ?? "").replace(/\r\n/g, "\n").split("\n");
  const candidates = [];
  let current = null;
  let currentActTitle = null;
  let currentRoleName = null;

  const flush = (endLine) => {
    if (!current) return;
    candidates.push(finalizeCandidate(current, endLine, candidates.length));
    current = null;
  };

  for (const [index, rawLine] of lines.entries()) {
    const marker = classifyHeading(rawLine);
    if (!marker) {
      if (current) current.bodyLines.push(rawLine);
      continue;
    }
    flush(index);
    if (marker.type === "act") currentActTitle = marker.title;
    if (marker.type === "role") currentRoleName = marker.title;
    current = {
      ...marker,
      lineStart: index + 1,
      parentActTitle: marker.type === "act" ? null : currentActTitle,
      roleName: marker.type === "role" ? marker.title : currentRoleName,
      bodyLines: []
    };
  }
  flush(lines.length);

  const explicitRoleNames = roleNamesFromText(text);
  const knownRoleNames = new Set(candidates.filter((item) => item.type === "role").map((item) => item.title.toLocaleLowerCase("zh-CN")));
  for (const roleName of explicitRoleNames) {
    if (knownRoleNames.has(roleName.toLocaleLowerCase("zh-CN"))) continue;
    candidates.push({
      id: candidateId("role", candidates.length, roleName, ""),
      type: "role",
      title: roleName,
      body: "",
      confidence: "medium",
      sourceHeading: "角色列表",
      lineStart: null,
      lineEnd: null,
      parentActTitle: null,
      roleName,
      included: true
    });
    knownRoleNames.add(roleName.toLocaleLowerCase("zh-CN"));
  }

  const fileRole = filenameRoleHint(filename);
  if (fileRole && ![...knownRoleNames].includes(fileRole.toLocaleLowerCase("zh-CN"))) {
    for (const candidate of candidates) {
      if (candidate.type !== "role" && !candidate.roleName) candidate.roleName = fileRole;
    }
    const hasActSections = candidates.some((candidate) => candidate.type === "act");
    candidates.push({
      id: candidateId("role", candidates.length, filename, text),
      type: "role",
      title: fileRole,
      body: hasActSections ? "" : String(text ?? "").trim().slice(0, 200_000),
      confidence: "medium",
      sourceHeading: filename,
      lineStart: 1,
      lineEnd: lines.length,
      parentActTitle: null,
      roleName: fileRole,
      included: true
    });
  }

  const wasTruncated = candidates.length > 300;
  const boundedCandidates = candidates.slice(0, 300);
  const counts = { role: 0, act: 0, scene: 0, clue: 0, secret: 0 };
  for (const candidate of boundedCandidates) counts[candidate.type] += 1;
  const recognized = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const warnings = [];
  if (!recognized) warnings.push("未识别到明确的角色、幕、场景、线索或秘密标题；建议先调整标题格式再进行结构化导入。");
  if (recognized && !counts.role) warnings.push("未识别到角色名；角色本内容可在预览后手动选择目标角色。");
  if (boundedCandidates.some((item) => item.confidence !== "high")) warnings.push("部分结构由文件名或角色列表推断，导入前请人工复核。");
  if (wasTruncated) warnings.push("识别结果超过 300 项，仅保留前 300 项；建议拆分稿件后分批导入。");

  return {
    creationType: normalizedType,
    terminology: CREATOR_TERMINOLOGY[normalizedType],
    counts,
    candidateCount: boundedCandidates.length,
    candidates: boundedCandidates,
    warnings
  };
}
