/**
 * Extract numbered city-rumor / character clue cards from 青楼-style host manuscripts.
 * Preferred source: 剧本.docx「城闻线索」+「线索列表」sections.
 * 青楼线索卡正/背 are mostly images; only a thin text layer is usable as fallback.
 */

function cleanLine(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function lookupKey(value) {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .toLocaleLowerCase("zh-CN");
}

function normalizeTitle(title) {
  return cleanLine(title)
    .replace(/^[0-9０-９]+[.、．\s]*/, "")
    .replace(/\s+/g, "");
}

function sliceSection(text, startRe, endRe) {
  const source = String(text ?? "");
  const start = source.search(startRe);
  if (start < 0) return "";
  const rest = source.slice(start);
  const endMatch = rest.search(endRe);
  return endMatch > 0 ? rest.slice(0, endMatch) : rest.slice(0, 8000);
}

/**
 * Parse「城闻线索」1–14 (numbers may share a line).
 */
export function extractCityRumorClueCards(text) {
  const section = sliceSection(
    text,
    /城闻线索/,
    /\n\s*衙门令[：:]|\n\s*★\s*线索列表|\n\s*线索列表/
  );
  if (!section) return [];

  const flat = section
    .replace(/城闻线索卡?[：:]?/, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const chunks = flat
    .split(/(?<=^|[^0-9])(?=\d{1,2}\s*[一-龥A-Za-z·]{2,24}\s*[：:])/)
    .map((part) => part.trim())
    .filter(Boolean);
  const cards = [];
  for (const chunk of chunks) {
    const match = chunk.match(/^(\d{1,2})\s*([一-龥A-Za-z·]{2,24})\s*[：:]\s*(.+)$/);
    if (!match) continue;
    const index = Number(match[1]);
    if (index < 1 || index > 40) continue;
    const titleBase = normalizeTitle(match[2]);
    const body = cleanLine(match[3]);
    if (!titleBase || body.length < 4) continue;
    cards.push({
      title: titleBase,
      body,
      index,
      kind: "city_rumor",
      sourceHeading: `城闻线索·${index}`
    });
  }
  // Disambiguate duplicate titles (e.g. two「莫府家仆」).
  const counts = new Map();
  for (const card of cards) {
    const key = lookupKey(card.title);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const seen = new Map();
  for (const card of cards) {
    const key = lookupKey(card.title);
    if ((counts.get(key) || 0) <= 1) continue;
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    card.title = `${card.title}${n}`;
  }
  return cards;
}

/**
 * Parse「线索列表」character-owned public cards.
 */
export function extractCharacterClueCards(text) {
  const section = sliceSection(
    text,
    /★\s*线索列表\s*★|线索列表/,
    /\n\s*开本前|\n\s*1\.\s*发本|\n\s*《\s*青\s*楼\s*》|\n\s*★\s*开本流程|\n\s*发本、宣读/
  );
  if (!section) return [];

  const lines = section.replace(/\r\n/g, "\n").split("\n");
  const cards = [];
  let roleName = null;
  let current = null;

  const flush = () => {
    if (!current || !roleName) return;
    const body = current.bodyLines.join("").replace(/\s+/g, "").length
      ? current.bodyLines.join("\n").trim()
      : "";
    if (!body) return;
    // Drop publisher watermarks accidentally glued to short character cards.
    const cleaned = body
      .replace(/\s*黑\s*羽\s*发\s*行\s*工\s*作\s*室\s*/g, "")
      .replace(/\s*《\s*青\s*楼\s*》\s*/g, "")
      .trim();
    if (!cleaned) return;
    cards.push({
      title: `${roleName}·线索${current.index}`,
      body: cleaned,
      index: current.index,
      kind: "character",
      roleName,
      sourceHeading: `人物线索·${roleName}·${current.index}`
    });
    current = null;
  };

  for (const raw of lines) {
    const line = cleanLine(raw);
    if (!line || /线索列表/.test(line)) continue;
    if (/^《|^开本前|^发本|^主持人/.test(line)) break;

    const roleInline = line.match(/^([一-龥A-Za-z·]{2,12})[：:]\s*$/);
    if (roleInline) {
      flush();
      roleName = normalizeTitle(roleInline[1]);
      continue;
    }

    const item = line.match(/^(\d{1,2})[.、．]?\s*(.+)$/);
    if (item && roleName) {
      // Ignore process steps like「1.发本」
      if (/^(发本|宣读|玩家读本|领取物品)/.test(item[2])) break;
      flush();
      current = { index: Number(item[1]), bodyLines: [item[2]] };
      continue;
    }
    if (current) current.bodyLines.push(line);
  }
  flush();
  return cards;
}

/**
 * Thin text layer inside 青楼线索卡正.docx.
 */
export function extractFrontClueCardDocText(text) {
  const compact = String(text ?? "").replace(/\r\n/g, "\n");
  const cards = [];
  const patterns = [
    { title: "皇书", re: /家中有\s*一\s*皇书[\s\S]*?—\s*唐国公/ },
    { title: "莫寒房间", re: /莫寒房间[：:][\s\S]*?(?=忘|莫玄宗房间|晕厥粉|$)/ },
    { title: "忘忧病", re: /忘\s*优\s*病\s*[：:][\s\S]*?(?=莫玄宗房间|晕厥粉|莫府家仆|$)/ },
    { title: "莫玄宗房间", re: /莫玄宗房间[：:][\s\S]*?(?=晕厥粉|莫府家仆|$)/ },
    { title: "晕厥粉", re: /晕厥粉[：:][\s\S]*?(?=莫府家仆|$)/ },
    { title: "莫府家仆", re: /莫府家仆[：:][\s\S]*$/ }
  ];
  for (const pattern of patterns) {
    const match = compact.match(pattern.re);
    if (!match) continue;
    const body = cleanLine(match[0].replace(/^[^：:]*[：:]/, "") || match[0]);
    if (body.length < 8) continue;
    cards.push({
      title: pattern.title,
      body,
      kind: "card_front_doc",
      sourceHeading: "青楼线索卡正"
    });
  }
  return cards;
}

export function mergeClueCardCatalogs(...lists) {
  const byKey = new Map();
  for (const list of lists) {
    for (const card of list || []) {
      const key = lookupKey(card.title);
      if (!key) continue;
      const prev = byKey.get(key);
      // Prefer city_rumor / character over thin front-doc fallback; else longer body.
      const score = (item) => {
        const kindScore = item.kind === "city_rumor" ? 3 : item.kind === "character" ? 2 : 1;
        return kindScore * 10000 + String(item.body || "").length;
      };
      if (!prev || score(card) > score(prev)) byKey.set(key, card);
    }
  }
  return [...byKey.values()];
}

export function extractQinglouClueCardCatalog(scriptText, frontCardText = "") {
  return mergeClueCardCatalogs(
    extractCityRumorClueCards(scriptText),
    extractCharacterClueCards(scriptText),
    extractFrontClueCardDocText(frontCardText)
  );
}
