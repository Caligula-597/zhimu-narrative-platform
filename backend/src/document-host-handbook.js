/**
 * Mechanical host-handbook extraction from murder-mystery manuscripts — no LLM.
 * Produces endings, role alignment, core-trick draft, and relationship stubs
 * for the「谜底与关系」workspace.
 */

function cleanLine(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lookupKey(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("zh-CN");
}

/**
 * Infer a short host-facing trigger condition from exploration/clue prose.
 */
export function inferClueTriggerCondition(body = "", title = "") {
  const text = `${title}\n${body}`;
  const parts = [];
  if (/搜证|搜查|探索|搜厢/.test(text)) parts.push("玩家在对应场景发起搜证/探索");
  if (/衙门令|搜证令|令牌/.test(text)) parts.push("消耗衙门令或搜证令牌");
  if (/银两|银票|花费|一半银两/.test(text)) parts.push("满足银两/花费条件");
  if (/一次|仅可|只能搜/.test(text)) parts.push("每处默认一次（按手册例外）");
  if (/报备|杀人|武器/.test(text)) parts.push("主持记录报备信息后发放");
  if (/公开线索|衙门公开/.test(text)) parts.push("开本后由主持人公开宣读");
  if (!parts.length) parts.push("挂靠对应场景后，由主持确认或探索发放");
  return parts.slice(0, 4).join("；");
}

/**
 * Pair key shared by a map location scene and its colocated clue.
 */
export function explorationPairKey(index) {
  if (index == null || Number.isNaN(Number(index))) return null;
  return `explore:${Number(index)}`;
}

function extractRoleAlignments(text) {
  const alignments = [];
  const seen = new Set();
  const lines = String(text ?? "").replace(/\r\n/g, "\n").split("\n");
  for (const raw of lines) {
    const line = cleanLine(raw);
    if (!line || line.length > 200) continue;
    const match = line.match(
      /^([一-龥A-Za-z·]{2,12})[：:,，]\s*.{0,40}?(此角色为|身份为)?(凶手|好人|NPC)/
    );
    if (!match) continue;
    const name = match[1];
    const key = lookupKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    const alignment = /凶手/.test(line) ? "killer" : /NPC/.test(line) ? "npc" : "innocent";
    alignments.push({
      name,
      alignment,
      note: line.slice(0, 240)
    });
  }
  return alignments;
}

function extractEndingBlocks(text) {
  const lines = String(text ?? "").replace(/\r\n/g, "\n").split("\n");
  const endings = [];
  let current = null;
  const flush = () => {
    if (!current) return;
    const body = current.bodyLines.join("\n").trim();
    if (current.title || body) {
      endings.push({
        key: `ending-${endings.length + 1}`,
        title: current.title,
        summary: body || current.title,
        routeHint: current.routeHint || ""
      });
    }
    current = null;
  };

  for (const raw of lines) {
    const line = cleanLine(raw);
    if (!line) {
      if (current && current.bodyLines.length > 40) flush();
      continue;
    }
    const heading =
      line.match(/^[★＊*]?\s*(灵石结局|魔石结局|结局一|结局二|结局三|好结局|坏结局|真结局|假结局|默认结局)[★＊*]?\s*[：:]?\s*(.*)$/) ||
      line.match(/^([一二三四五六七八九十0-9]+)[、.．]\s*(.{0,20}结局.{0,20})$/) ||
      line.match(/^结局导向[：:]\s*(.+)$/);
    if (heading) {
      flush();
      const title = cleanLine(heading[1] || heading[0]).slice(0, 80) || "结局";
      const rest = cleanLine(heading[2] || "");
      current = {
        title: /结局/.test(title) ? title : `结局 · ${title}`,
        routeHint: title,
        bodyLines: rest ? [rest] : []
      };
      continue;
    }
    if (/^★/.test(line) && current) {
      flush();
      continue;
    }
    if (current) current.bodyLines.push(raw);
  }
  flush();

  if (!endings.length && /灵石|结局/.test(String(text ?? ""))) {
    endings.push({
      key: "ending-default",
      title: "灵石结局（待补全文）",
      summary: "文稿含结局相关章节，请在导入后核对主持手册并补全各结局正文与导向条件。",
      routeHint: "default"
    });
  }
  return endings.slice(0, 12);
}

function extractFlowNotes(text) {
  const lines = String(text ?? "").replace(/\r\n/g, "\n").split("\n");
  const notes = [];
  let capturing = false;
  for (const raw of lines) {
    const line = cleanLine(raw);
    if (/开本流程|组织者手册|严禁盲开/.test(line)) capturing = true;
    if (capturing) {
      if (line) notes.push(line.slice(0, 200));
      if (notes.length >= 12) break;
      if (/角色简介|玩家读本第一章|发行方/.test(line) && notes.length > 3) break;
    }
  }
  return notes;
}

/**
 * @param {string} text
 * @returns {{ alignments: object[], endings: object[], flowNotes: string[], coreTrickDraft: object, relationships: object[] }}
 */
export function extractHostHandbookDigest(text) {
  const alignments = extractRoleAlignments(text);
  const endings = extractEndingBlocks(text);
  const flowNotes = extractFlowNotes(text);
  const killers = alignments.filter((item) => item.alignment === "killer").map((item) => item.name);
  const innocents = alignments.filter((item) => item.alignment === "innocent").map((item) => item.name);
  const relationships = [];
  for (let i = 0; i < killers.length; i += 1) {
    for (let j = i + 1; j < killers.length; j += 1) {
      relationships.push({
        fromName: killers[i],
        toName: killers[j],
        label: "凶手方关联",
        relationType: "faction",
        strength: 4,
        visibility: "host"
      });
    }
  }
  if (killers.length && innocents.length) {
    relationships.push({
      fromName: killers[0],
      toName: innocents[0],
      label: "对立（示例口径）",
      relationType: "conflict",
      strength: -3,
      visibility: "host"
    });
  }

  const coreTrickDraft = {
    summary: killers.length
      ? `主持手册识别凶手席：${killers.join("、")}。请对照组织者手册核对手法、动机与公开口径。`
      : "尚未从手册识别明确凶手席，请手工填写核心谜底。",
    method: "",
    motive: "",
    victim: "",
    hostNotes: [
      flowNotes.slice(0, 6).join("\n"),
      killers.length ? `凶手席：${killers.join("、")}` : "",
      innocents.length ? `好人席：${innocents.join("、")}` : ""
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 4000),
    metadata: {
      source: "document_host_handbook",
      killerNames: killers,
      innocentNames: innocents
    }
  };

  return {
    alignments,
    endings,
    flowNotes,
    coreTrickDraft,
    relationships
  };
}

export function defaultMiniGameTemplatesFromHandbook(text = "") {
  const templates = [
    {
      id: "handbook-lock",
      pluginKey: "zhimu_lock",
      title: "数字密码锁",
      prompt: "输入从线索中得到的密码。",
      hint: "对照搜证与公开线索。",
      answer: "0000",
      length: 4,
      maxAttempts: 3,
      allowRecovery: true
    },
    {
      id: "handbook-sequence",
      pluginKey: "zhimu_sequence",
      title: "顺序还原",
      prompt: "按正确顺序提交关键步骤（逗号分隔）。",
      hint: "参考开本流程与章节顺序。",
      answer: "发本,读本,搜证,宣判",
      maxAttempts: 3,
      allowRecovery: true
    },
    {
      id: "handbook-guess",
      pluginKey: "zhimu_guess",
      title: "歌猜 / 口令",
      prompt: "根据主持提示提交口令或歌名。",
      hint: "口令仅主持可见答案。",
      answer: "玉满楼",
      maxAttempts: 3,
      allowRecovery: true
    }
  ];
  if (/青楼|玉满楼|561/.test(String(text))) {
    templates[0] = {
      ...templates[0],
      id: "qinglou-lock",
      title: "账房柜锁",
      prompt: "输入四位柜锁密码。",
      hint: "花魁夜编号。",
      answer: "5610"
    };
    templates[1] = {
      ...templates[1],
      id: "qinglou-sequence",
      title: "酒水上菜顺序",
      prompt: "按正确顺序提交上菜步骤（逗号分隔）。",
      hint: "先清后花，再点心结账。",
      answer: "清酒,花酒,点心,结账"
    };
    templates[2] = {
      ...templates[2],
      id: "qinglou-guess",
      title: "楼名口令",
      prompt: "说出本局花魁夜所在楼名。",
      hint: "角色简介与开场。",
      answer: "玉满楼"
    };
  }
  return templates;
}
