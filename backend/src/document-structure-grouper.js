/**
 * Local heuristic structure grouper for murder-mystery / creator manuscripts.
 * Splits text into role / act / scene / clue / secret candidates — no LLM.
 */
import { createHash } from "node:crypto";

function cleanLine(value) {
  return String(value ?? "").replace(/\u00a0/g, " ").trim();
}

function stripMarkdownHeading(line) {
  const match = cleanLine(line).match(/^(#{1,6})\s+(.+)$/);
  return match
    ? { text: cleanLine(match[2]), headingLevel: match[1].length }
    : { text: cleanLine(line), headingLevel: null };
}

function trimLabel(value, fallback) {
  return (
    cleanLine(value)
      .replace(/^[：:、.\-—\s]+/, "")
      .replace(/[：:、.\-—\s]+$/, "")
      .slice(0, 200) || fallback
  );
}

function lookupKey(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("zh-CN");
}

export function candidateId(type, index, heading, body) {
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

/** Independent starred / bracket banners used by store handbooks. */
function classifySectionBanner(rawLine) {
  const line = cleanLine(rawLine).replace(/^#{1,6}\s+/, "");
  if (!line || line.length > 48) return null;
  let inner = "";
  const star = line.match(/^[★☆＊*\s]*([^★☆＊*\n]{2,36})[★☆＊*\s]*$/);
  if (star) inner = cleanLine(star[1]);
  const bracket = line.match(/^【\s*([^】]{2,36})\s*】$/);
  if (bracket) inner = cleanLine(bracket[1]);
  if (!inner) return null;
  const compact = inner.replace(/\s+/g, "");
  if (/角色简介|人物简介|登场角色/.test(compact)) return { kind: "role_roster", title: inner };
  if (/开本流程|流程说明|游戏流程|主持流程/.test(compact)) return { kind: "run_flow", title: inner };
  if (/线索列表|公开线索|线索卡/.test(compact)) return { kind: "clue_list", title: inner };
  if (/组织者手册|DM手册|主持人手册|剧本简介|盒装清单/.test(compact)) return { kind: "host_meta", title: inner };
  return { kind: "other", title: inner };
}

function looksLikeHeading(line, headingLevel) {
  if (headingLevel) return true;
  if (line.length > 80) return false;
  // Require 第 for 幕/章/场 numeric forms to avoid prose like「一幕玉满楼」.
  return /^(?:第\s*[一二三四五六七八九十百千万0-9]+\s*[幕场章节]|(?:角色|人物|角色名|PC|NPC|幕|章节|场景|地点|线索|证据|秘密|隐秘|真相|KP\s*信息|KP\s*专用|HO|HANDOUT|ACT|SCENE|CLUE|SECRET)\s*(?:[0-9一二三四五六七八九十]+)?\s*[：:\-—])/i.test(
    line
  );
}

function classifyHeading(rawLine) {
  const { text, headingLevel } = stripMarkdownHeading(rawLine);
  if (!text || !looksLikeHeading(text, headingLevel)) return null;

  let match = text.match(/^(?:角色|人物|角色名|PC|NPC)\s*(?:[0-9一二三四五六七八九十]+)?\s*[：:\-—]?\s*(.+)$/i);
  if (match) {
    return {
      type: "role",
      title: trimLabel(match[1], "未命名角色"),
      headingLevel,
      sourceHeading: text,
      confidence: "high"
    };
  }

  match = text.match(/^第\s*([一二三四五六七八九十百千万0-9]+)\s*([幕章])\s*[：:、.\-—]?\s*(.*)$/i);
  if (match) {
    const ordinal = `第${cleanLine(match[1])}${match[2]}`;
    return {
      type: "act",
      title: trimLabel(match[3], ordinal),
      headingLevel,
      sourceHeading: text,
      confidence: "high"
    };
  }
  match = text.match(/^(?:幕|章节)\s*(?:[0-9一二三四五六七八九十]+)?\s*[：:\-—]\s*(.+)$/i);
  if (match) {
    return {
      type: "act",
      title: trimLabel(match[1], "未命名幕"),
      headingLevel,
      sourceHeading: text,
      confidence: "high"
    };
  }
  match = text.match(/^ACT\s*([0-9IVX]+)\s*[：:、.\-—]?\s*(.*)$/i);
  if (match) {
    return {
      type: "act",
      title: trimLabel(match[2], `ACT ${match[1]}`),
      headingLevel,
      sourceHeading: text,
      confidence: "high"
    };
  }

  match = text.match(/^第\s*([一二三四五六七八九十百千万0-9]+)\s*场\s*[：:、.\-—]?\s*(.*)$/i);
  if (match) {
    return {
      type: "scene",
      title: trimLabel(match[2], `第${cleanLine(match[1])}场`),
      headingLevel,
      sourceHeading: text,
      confidence: "high"
    };
  }
  match = text.match(/^(?:场景|地点)\s*(?:[0-9一二三四五六七八九十]+)?\s*[：:\-—]\s*(.+)$/i);
  if (match) {
    return {
      type: "scene",
      title: trimLabel(match[1], "未命名场景"),
      headingLevel,
      sourceHeading: text,
      confidence: "high"
    };
  }
  match = text.match(/^SCENE\s*([0-9IVX]+)\s*[：:、.\-—]?\s*(.*)$/i);
  if (match) {
    return {
      type: "scene",
      title: trimLabel(match[2], `SCENE ${match[1]}`),
      headingLevel,
      sourceHeading: text,
      confidence: "high"
    };
  }

  match = text.match(/^(?:线索|证据|CLUE|HO|HANDOUT)\s*(?:[0-9一二三四五六七八九十]+)?\s*[：:\-—]\s*(.+)$/i);
  if (match) {
    return {
      type: "clue",
      title: trimLabel(match[1], "未命名线索"),
      headingLevel,
      sourceHeading: text,
      confidence: "high"
    };
  }

  match = text.match(/^(?:秘密|隐秘|真相|SECRET|KP\s*信息|KP\s*专用)\s*(?:[0-9一二三四五六七八九十]+)?\s*[：:\-—]?\s*(.*)$/i);
  if (match) {
    return {
      type: "secret",
      title: trimLabel(match[1], "未命名秘密"),
      headingLevel,
      sourceHeading: text,
      confidence: "high"
    };
  }

  return null;
}

function filenameRoleHint(filename) {
  const stem = String(filename ?? "")
    .replace(/\.[^.]+$/, "")
    .trim();
  const match = stem.match(/^(?:角色本[：:_\- ]*)?(.+?)(?:[：:_\- ]*角色本|[：:_\- ]*人物本)$/i);
  return match ? trimLabel(match[1], "") : "";
}

function roleNamesFromListLines(text) {
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

function parseRosterNameLine(rawLine) {
  const line = cleanLine(rawLine).replace(/^#{1,6}\s+/, "");
  if (!line || line.length > 200) return null;
  const npc = line.match(/^NPC\s*([一-龥A-Za-z·]{2,12})\s*[：:，,\s]/);
  if (npc) {
    return { name: trimLabel(npc[1], ""), body: trimLabel(line.slice(npc[0].length), ""), isNpc: true };
  }
  const match = line.match(/^([一-龥A-Za-z·]{2,6})\s*[：:]\s*(.+)$/);
  if (match) {
    const name = trimLabel(match[1], "");
    const body = trimLabel(match[2], "");
    if (!name || !body) return null;
    if (/^(发行|作者|美工|提示|注意|注|详见|根据|通过|最后|特别|感谢)/.test(name)) return null;
    return { name, body, isNpc: /NPC|此角色有专属/.test(body) };
  }
  // Handbook rows sometimes use顿号/逗号: 「白斋子，江南第一才子…」
  const loose = line.match(/^([一-龥A-Za-z·]{2,6})\s*[，,]\s*(.+)$/);
  if (!loose) return null;
  const name = trimLabel(loose[1], "");
  const body = trimLabel(loose[2], "");
  if (!name || body.length < 8) return null;
  if (!/此角色|好人|凶手|建议给|名伎|捕快|公子|才子|NPC/.test(body)) return null;
  return { name, body, isNpc: /NPC|此角色有专属/.test(body) };
}

function chaptersFromFlowText(text) {
  const found = [];
  const seen = new Set();
  const push = (title, sourceHeading, snippet) => {
    const key = lookupKey(title);
    if (!key || seen.has(key)) return;
    seen.add(key);
    found.push({ title, sourceHeading, body: snippet });
  };
  const lines = String(text ?? "").split("\n");
  for (const raw of lines) {
    const line = cleanLine(raw);
    if (!line) continue;
    let match = line.match(/玩家读本\s*(第\s*[一二三四五六七八九十百千万0-9]+\s*章)/);
    if (match) {
      const title = cleanLine(match[1].replace(/\s+/g, ""));
      push(title, line.slice(0, 80), line.slice(0, 400));
      continue;
    }
    match = line.match(/(第\s*[一二三四五六七八九十百千万0-9]+\s*章)/);
    if (match && line.length <= 80) {
      const title = cleanLine(match[1].replace(/\s+/g, ""));
      push(title, line.slice(0, 80), line.slice(0, 400));
    }
  }
  // Also scan whole text for "共四章" style — no titles, skip
  return found;
}

/**
 * @returns {{ candidates: object[], structureSource: "heuristic", sectionBanners: object[] }}
 */
export function groupNarrativeStructure(text, { filename = "" } = {}) {
  const lines = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  const candidates = [];
  let current = null;
  let currentActTitle = null;
  let currentRoleName = null;
  let currentBannerKind = null;
  const sectionBanners = [];
  const rosterRoles = [];

  const flush = (endLine) => {
    if (!current) return;
    candidates.push(finalizeCandidate(current, endLine, candidates.length));
    current = null;
  };

  for (const [index, rawLine] of lines.entries()) {
    const banner = classifySectionBanner(rawLine);
    if (banner && banner.kind !== "other") {
      flush(index);
      currentBannerKind = banner.kind;
      sectionBanners.push({ ...banner, line: index + 1 });
      continue;
    }

    if (currentBannerKind === "role_roster") {
      const roster = parseRosterNameLine(rawLine);
      if (roster?.name) {
        rosterRoles.push({ ...roster, lineStart: index + 1 });
        continue;
      }
    }

    const marker = classifyHeading(rawLine);
    if (marker && currentBannerKind === "role_roster") {
      currentBannerKind = null;
    }
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

  const knownRoleNames = new Set(
    candidates.filter((item) => item.type === "role").map((item) => lookupKey(item.title))
  );

  for (const roleName of roleNamesFromListLines(text)) {
    if (knownRoleNames.has(lookupKey(roleName))) continue;
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
    knownRoleNames.add(lookupKey(roleName));
  }

  for (const roster of rosterRoles) {
    if (knownRoleNames.has(lookupKey(roster.name))) continue;
    candidates.push({
      id: candidateId("role", candidates.length, roster.name, roster.body),
      type: "role",
      title: roster.name,
      body: roster.body.slice(0, 200_000),
      confidence: "high",
      sourceHeading: roster.isNpc ? "NPC简介" : "角色简介",
      lineStart: roster.lineStart,
      lineEnd: roster.lineStart,
      parentActTitle: null,
      roleName: roster.name,
      included: true,
      meta: roster.isNpc ? { npc: true } : undefined
    });
    knownRoleNames.add(lookupKey(roster.name));
  }

  const knownActs = new Set(candidates.filter((item) => item.type === "act").map((item) => lookupKey(item.title)));
  const flowChapters = chaptersFromFlowText(text);
  for (const chapter of flowChapters) {
    if (knownActs.has(lookupKey(chapter.title))) continue;
    candidates.push({
      id: candidateId("act", candidates.length, chapter.sourceHeading, chapter.body),
      type: "act",
      title: chapter.title,
      body: chapter.body,
      confidence: "medium",
      sourceHeading: chapter.sourceHeading,
      lineStart: null,
      lineEnd: null,
      parentActTitle: null,
      roleName: null,
      included: true
    });
    knownActs.add(lookupKey(chapter.title));
  }

  const fileRole = filenameRoleHint(filename);
  if (fileRole && !knownRoleNames.has(lookupKey(fileRole))) {
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
  return {
    candidates: boundedCandidates,
    structureSource: "heuristic",
    sectionBanners,
    wasTruncated,
    lineCount: lines.length
  };
}
