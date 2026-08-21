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

const CN_ORDINAL = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10
};

function chapterOrdinal(raw) {
  const text = cleanLine(raw);
  let match = text.match(/第\s*([一二三四五六七八九十百千万0-9]+)\s*章/);
  if (!match) return null;
  const token = cleanLine(match[1]);
  if (/^\d+$/.test(token)) return Number(token);
  if (CN_ORDINAL[token] != null) return CN_ORDINAL[token];
  return null;
}

function parseChapterHeadingLine(rawLine) {
  const line = cleanLine(rawLine).replace(/^#{1,6}\s+/, "");
  if (!line || line.length > 80) return null;
  const match = line.match(/^第\s*([一二三四五六七八九十百千万0-9]+)\s*章\s*[：:、.\-—]?\s*(.*)$/);
  if (!match) return null;
  const ordinal = chapterOrdinal(line);
  if (ordinal == null) return null;
  let subtitle = trimLabel(match[2], "");
  // 「夜阑 夜初」与「夜阑」视为同一章名（页标阅读序仍按章号）。
  if (/^夜阑/.test(subtitle)) subtitle = "夜阑";
  const title = subtitle || `第${cleanLine(match[1])}章`;
  return { ordinal, title, sourceHeading: line };
}

function isPageBreakMarker(rawLine) {
  const line = cleanLine(rawLine);
  if (!line) return false;
  if (/未经主持人允许.*勿翻开下一页/.test(line)) return true;
  if (/^第\s*\d+\s*页$/.test(line)) return true;
  if (/^[—\-－_\s]*\d{1,3}[—\-－_\s]*$/.test(line) && line.replace(/\D/g, "").length <= 3) return true;
  return false;
}

function isRoleBookletStart(rawLine, nextLines = []) {
  const line = cleanLine(rawLine);
  if (/^[①1１]\s*你的任务一/.test(line) || /《\s*青\s*楼\s*》\s*①\s*你的任务一/.test(line)) return true;
  if (/发行方/.test(line) && nextLines.some((item) => /^[①1１]\s*你的任务一/.test(cleanLine(item)))) return true;
  return false;
}

function extractSkillRoleMap(text) {
  const map = new Map();
  for (const raw of String(text ?? "").split("\n")) {
    const line = cleanLine(raw);
    const match = line.match(/^([一-龥A-Za-z·]{2,6})\s*[-—–－]\s*(.+)$/);
    if (!match) continue;
    const name = trimLabel(match[1], "");
    const skill = trimLabel(match[2], "").replace(/\s+/g, "");
    if (!name || !skill || skill.length > 40) continue;
    if (/熟悉地形|博学多才|武功高强|洞悉|聪明伶俐/.test(skill) || skill === "无") {
      map.set(skill, name);
    }
  }
  return map;
}

function inferBookletRoleName(bookletText, skillMap, rosterNames, usedNames) {
  const text = String(bookletText ?? "");
  const skillLine = text.split("\n").map(cleanLine).find((line) => /^[⑤⑥5６]\s*你的技能/.test(line) || line.includes("你的技能"));
  const afterSkill = skillLine
    ? cleanLine(text.split(skillLine)[1] || "")
        .split("\n")
        .map(cleanLine)
        .find(Boolean)
    : "";
  const skillKey = (afterSkill || "").replace(/\s+/g, "").slice(0, 40);
  for (const [skill, name] of skillMap.entries()) {
    if (skillKey.includes(skill.replace(/\s+/g, "")) && !usedNames.has(lookupKey(name))) return name;
  }
  if (/亲姐姐/.test(text) && rosterNames.includes("姜红儿") && !usedNames.has(lookupKey("姜红儿"))) return "姜红儿";
  if (/父母及弟弟|父母及弟/.test(text) && rosterNames.includes("莫怀") && !usedNames.has(lookupKey("莫怀"))) return "莫怀";
  for (const name of rosterNames) {
    if (usedNames.has(lookupKey(name))) continue;
    if (new RegExp(`(?:小生|我乃|你是|自称)${name}|${name}前来`).test(text)) return name;
  }
  for (const name of rosterNames) {
    if (!usedNames.has(lookupKey(name))) return name;
  }
  return "";
}

/**
 * Sequential printed role booklets: cover/tasks → chapters labeled 第N章.
 * Reading order follows chapter ordinal / page labels (1→2→3→4), not raw extract order.
 */
export function extractSequentialRoleBooklets(text) {
  const lines = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  const starts = [];
  for (let i = 0; i < lines.length; i += 1) {
    const lookahead = lines.slice(i + 1, i + 12);
    if (isRoleBookletStart(lines[i], lookahead)) starts.push(i);
  }
  // Collapse cover+任务 pairs; do not merge across a 第N章 boundary.
  const compactStarts = [];
  for (const index of starts) {
    const prev = compactStarts[compactStarts.length - 1];
    if (prev == null) {
      compactStarts.push(index);
      continue;
    }
    const between = lines.slice(prev, index);
    const crossedChapter = between.some((line) => parseChapterHeadingLine(line));
    if (!crossedChapter && index - prev < 30) {
      // Prefer the task-one line as the booklet anchor when both fire.
      if (isRoleBookletStart(lines[index], []) && /^[①1１]/.test(cleanLine(lines[index]))) {
        compactStarts[compactStarts.length - 1] = index;
      }
      continue;
    }
    compactStarts.push(index);
  }
  if (compactStarts.length < 2) return [];

  const skillMap = extractSkillRoleMap(text);
  const rosterNames = [];
  let inRoster = false;
  for (const raw of lines) {
    const banner = classifySectionBanner(raw);
    if (banner?.kind === "role_roster") {
      inRoster = true;
      continue;
    }
    if (banner && banner.kind !== "other") inRoster = false;
    if (!inRoster) continue;
    const roster = parseRosterNameLine(raw);
    if (roster?.name && !roster.isNpc) rosterNames.push(roster.name);
  }

  const usedNames = new Set();
  const booklets = [];
  for (let b = 0; b < compactStarts.length; b += 1) {
    const start = compactStarts[b];
    const end = b + 1 < compactStarts.length ? compactStarts[b + 1] : lines.length;
    const slice = lines.slice(start, end);
    const bookletText = slice.join("\n");
    const roleName =
      inferBookletRoleName(bookletText, skillMap, rosterNames, usedNames) || `角色${b + 1}`;
    usedNames.add(lookupKey(roleName));

    const chapters = [];
    let current = null;
    const flushChapter = (endOffset) => {
      if (!current) return;
      const body = current.bodyLines.join("\n").trim();
      chapters.push({
        ordinal: current.ordinal,
        title: current.title,
        sourceHeading: current.sourceHeading,
        body,
        lineStart: start + current.localStart + 1,
        lineEnd: start + endOffset,
        pageBreaks: current.pageBreaks
      });
      current = null;
    };

    for (let i = 0; i < slice.length; i += 1) {
      const heading = parseChapterHeadingLine(slice[i]);
      if (heading) {
        flushChapter(i);
        current = {
          ...heading,
          localStart: i,
          bodyLines: [],
          pageBreaks: 0
        };
        continue;
      }
      if (!current) continue;
      if (isPageBreakMarker(slice[i])) {
        current.pageBreaks += 1;
        continue;
      }
      current.bodyLines.push(slice[i]);
    }
    flushChapter(slice.length);

    chapters.sort((a, b) => a.ordinal - b.ordinal);
    booklets.push({
      roleName,
      lineStart: start + 1,
      lineEnd: end,
      chapters,
      preamble: slice.slice(0, Math.max(0, slice.findIndex((line) => parseChapterHeadingLine(line)))).join("\n").trim()
    });
  }
  return booklets;
}

function chaptersFromFlowText(text) {
  const found = [];
  const seen = new Set();
  const push = (title, sourceHeading, snippet, ordinal = null) => {
    const key = lookupKey(title);
    if (!key || seen.has(key)) return;
    seen.add(key);
    found.push({ title, sourceHeading, body: snippet, ordinal });
  };
  const lines = String(text ?? "").split("\n");
  for (const raw of lines) {
    const line = cleanLine(raw);
    if (!line) continue;
    // TOC: 「2玩家读本第一章 见6页」— page label anchors reading order.
    let match = line.match(/玩家读本\s*(第\s*[一二三四五六七八九十百千万0-9]+\s*章).*?(?:见\s*(\d+)\s*页)?/);
    if (match) {
      const heading = parseChapterHeadingLine(match[1]) || {
        title: cleanLine(match[1].replace(/\s+/g, "")),
        ordinal: chapterOrdinal(match[1])
      };
      push(heading.title, line.slice(0, 80), line.slice(0, 400), heading.ordinal);
      continue;
    }
    const heading = parseChapterHeadingLine(line);
    if (heading) push(heading.title, line.slice(0, 80), line.slice(0, 400), heading.ordinal);
  }
  found.sort((a, b) => (a.ordinal ?? 99) - (b.ordinal ?? 99));
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
    knownRoleNames.add(lookupKey(fileRole));
  }

  const booklets = extractSequentialRoleBooklets(text);
  let roleBookletCount = 0;
  if (booklets.length >= 2) {
    roleBookletCount = booklets.length;
    // Role booklets own chapter bodies; drop heading-scan acts (appearance order is not reading order).
    for (let i = candidates.length - 1; i >= 0; i -= 1) {
      if (candidates[i].type === "act") candidates.splice(i, 1);
    }
    knownActs.clear();

    for (const booklet of booklets) {
      if (!knownRoleNames.has(lookupKey(booklet.roleName))) {
        candidates.push({
          id: candidateId("role", candidates.length, booklet.roleName, booklet.preamble || ""),
          type: "role",
          title: booklet.roleName,
          body: String(booklet.preamble || "").slice(0, 200_000),
          confidence: "high",
          sourceHeading: "角色本",
          lineStart: booklet.lineStart,
          lineEnd: booklet.lineEnd,
          parentActTitle: null,
          roleName: booklet.roleName,
          included: true
        });
        knownRoleNames.add(lookupKey(booklet.roleName));
      }

      for (const chapter of booklet.chapters) {
        if (!knownActs.has(lookupKey(chapter.title))) {
          candidates.push({
            id: candidateId("act", candidates.length, chapter.sourceHeading, ""),
            type: "act",
            title: chapter.title,
            body: "",
            confidence: "high",
            sourceHeading: chapter.sourceHeading,
            lineStart: chapter.lineStart,
            lineEnd: chapter.lineStart,
            parentActTitle: null,
            roleName: null,
            included: true,
            meta: { ordinal: chapter.ordinal, readingOrder: chapter.ordinal }
          });
          knownActs.add(lookupKey(chapter.title));
        }
        candidates.push({
          id: candidateId("act", candidates.length, `${booklet.roleName}:${chapter.sourceHeading}`, chapter.body),
          type: "act",
          title: chapter.title,
          body: chapter.body.slice(0, 200_000),
          confidence: "high",
          sourceHeading: chapter.sourceHeading,
          lineStart: chapter.lineStart,
          lineEnd: chapter.lineEnd,
          parentActTitle: null,
          roleName: booklet.roleName,
          included: true,
          meta: { ordinal: chapter.ordinal, pageBreaks: chapter.pageBreaks || 0, readingOrder: chapter.ordinal }
        });
      }
    }
  }

  // Prefer reading order: chapter ordinal 1→2→3→4 (page labels), not extract appearance order.
  candidates.sort((a, b) => {
    const roleA = a.type === "role" ? 0 : 1;
    const roleB = b.type === "role" ? 0 : 1;
    if (roleA !== roleB) return roleA - roleB;
    const ordA = Number(a.meta?.ordinal ?? a.meta?.readingOrder ?? 99);
    const ordB = Number(b.meta?.ordinal ?? b.meta?.readingOrder ?? 99);
    if (ordA !== ordB) return ordA - ordB;
    return String(a.roleName || "").localeCompare(String(b.roleName || ""), "zh-CN");
  });

  const wasTruncated = candidates.length > 300;
  const boundedCandidates = candidates.slice(0, 300);
  return {
    candidates: boundedCandidates,
    structureSource: "heuristic",
    sectionBanners,
    wasTruncated,
    lineCount: lines.length,
    roleBookletCount
  };
}
