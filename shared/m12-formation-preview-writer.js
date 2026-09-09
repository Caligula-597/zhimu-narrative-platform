/**
 * F3 后受控生成实验 — M12 Preview Writer 运行器 V1。
 *
 * 把 Writer Packet 交给模型，产出「实际成品」（角色本 / 主持文本）。
 * Writer 不拿整份 Artifact JSON 自由发挥——只拿可见性投射后的 Packet。
 *
 * 输出契约：
 *   { kind: "CHARACTER_SHEET"|"HOST_SHEET", title, sections: [{heading, body}], writerNote? }
 *
 * 产出后确定性自检（diagnostics，不拦截落盘，供人工审）：
 *   metaPromptHits   — 成品文本命中作者指令 lint（应为零）
 *   prewrittenDealHits — 成品文本命中预写成交 lint（应为零）
 *   parseOk          — 模型输出是否为合法 JSON
 *
 * Mock LLM：deterministic（把 Packet 内容直渲染成 sections），供无 key / 测试 /
 * CI 使用——保证链路与可见性投射可离线验证。
 */

import {
  M12_META_PROMPT_PATTERNS,
  M12_PREWRITTEN_DEAL_PATTERNS,
} from "./m12-formation-validator.js";

export const M12_PREVIEW_WRITER_VERSION = 1;

export function buildPreviewWriterMessages(packet) {
  const isHost = packet.audienceType === "HOST";
  const who = isHost
    ? "一位剧本杀主持手册 Writer"
    : `剧本杀角色本 Writer（为「${packet.audience.name}」写角色本）`;

  const system = [
    `你是${who}。你会收到一份结构化 Writer Packet（JSON）。`,
    isHost
      ? "你的任务：写一份主持手册文本，让主持人能运营场景、把握时窗，但对任何角色的私有信息保持无知。"
      : "你的任务：写一份角色本，让扮演者代入这个人物：他是谁、他开场知道什么、他想要什么。",
    "",
    "必须遵守 Packet 里的 writingRules（每一条）。",
    "只准使用 Packet 提供的信息；Packet 没有的信息一律不准编造。",
    isHost
      ? "Packet 中 castDirectory 里每个在场人物的 identity 是公开身份，提及人物时必须以此为准。"
      : "Packet 中 publicCastDirectory 里每个在场人物的 publicIdentity 是公开身份，提及任何其他人物时必须以此为准，不得另行编造身份。",
    "Packet 中每条事实 entry 的 provenance（若非空）说明该信息的来历：写进成品时必须采用这个来历，不得替换成其他来历。",
    "每条事实 entry 的 projectionType 标明该信息对你的性质：SELF_KNOWN_FACT / SELF_KNOWN_NEED 是关于你自己的事实或需求，用你的自身视角表述；OWNED_OBJECT 是你拥有的物件；PRIVATE_MEMORY 是你的私人记忆；ACTIONABLE_INFERENCE 是你自己形成的推断，必须保留其不确定语气；OBSERVED_FACT 是你亲自观察到的；CANON_FACT / PUBLIC_RULE 是世界既定事实或规则。",
    "若 entry 附带 subjectCharacterIds 且包含你的 characterId：这条事实描述的是你自己。只准表述 entry 的 text 给出的内容，绝不由它外推任何更大的结论（例如不得由「参与过资料整理」推出「看过内部目录」）。",
    "输出必须是单个 JSON 对象，不要包裹 markdown 代码块。",
  ].join("\n");

  const outputContract = {
    kind: isHost ? "HOST_SHEET" : "CHARACTER_SHEET",
    title: `${isHost ? "主持手册" : "角色本"}标题`,
    sections: [
      { heading: "章节标题", body: "正文（可多段，用\\n分段）" },
    ],
    writerNote: "（可选）给审校的一句说明",
  };

  const user = [
    "Writer Packet 如下：",
    JSON.stringify(packet, null, 2),
    "",
    "输出 JSON 形状（严格遵守）：",
    JSON.stringify(outputContract, null, 2),
    "",
    isHost
      ? "要求：sections 至少覆盖「场景与时窗」「公共规则」「在场人物」「主持注意事项」。"
      : "要求：sections 至少覆盖「你是谁」「开场时你知道的事」「你的目标」；所有 characterKnowledge 都要自然融进「你知道的事」。",
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function lintText(text, patterns) {
  const hits = [];
  for (const { id, re } of patterns) {
    if (re.test(text)) hits.push(id);
  }
  return hits;
}

/**
 * 运行一次 Preview Writer。
 *
 * @param {{ packet: object, llm: { completeJson({messages}): Promise<{text,...}> } }} input
 * @returns {Promise<{ ok: boolean, output?: { kind, title, sections, writerNote? },
 *                     raw?: string, diagnostics: object, usage?: object|null }>}
 */
export async function runM12PreviewWriter({ packet, llm } = {}) {
  if (!packet || !llm || typeof llm.completeJson !== "function") {
    return { ok: false, diagnostics: { error: "BAD_INPUT" } };
  }
  const messages = buildPreviewWriterMessages(packet);
  let raw = "";
  let usage = null;
  try {
    const res = await llm.completeJson({ messages });
    raw = res?.text || "";
    usage = res?.usage || null;
  } catch (error) {
    return { ok: false, diagnostics: { error: `LLM_CALL_FAILED:${String(error?.message || error).slice(0, 200)}` } };
  }

  let parsed = null;
  let parseOk = false;
  try {
    const candidate = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    parsed = JSON.parse(candidate);
    parseOk =
      Boolean(parsed) &&
      typeof parsed.title === "string" &&
      Array.isArray(parsed.sections) &&
      parsed.sections.length > 0 &&
      parsed.sections.every((s) => s && typeof s.heading === "string" && typeof s.body === "string");
  } catch {
    parseOk = false;
  }

  const flatText = parseOk
    ? parsed.sections.map((s) => `${s.heading}\n${s.body}`).join("\n")
    : raw;

  const diagnostics = {
    parseOk,
    metaPromptHits: lintText(flatText, M12_META_PROMPT_PATTERNS),
    prewrittenDealHits: lintText(flatText, M12_PREWRITTEN_DEAL_PATTERNS),
    sectionCount: parseOk ? parsed.sections.length : 0,
    modelUsage: usage,
  };

  if (!parseOk) {
    return { ok: false, raw, diagnostics };
  }
  return { ok: true, output: parsed, raw, diagnostics };
}

/**
 * Mock LLM（deterministic）：把 Packet 内容直接渲染成合法输出。
 * 用于离线链路验证与测试——不调任何外部服务。
 */
export class MockPreviewWriterLlm {
  constructor() {
    this.calls = 0;
  }

  async completeJson({ messages } = {}) {
    this.calls += 1;
    const userMessage = (messages || []).find((m) => m.role === "user") || {};
    const packetMatch = /Writer Packet 如下：\n([\s\S]*?)\n\n输出 JSON 形状/.exec(
      userMessage.content || "",
    );
    if (!packetMatch) {
      return { text: "{}", modelId: "mock", adapterId: "mock-preview-writer", usage: null };
    }
    let packet = null;
    try {
      packet = JSON.parse(packetMatch[1]);
    } catch {
      return { text: "{}", modelId: "mock", adapterId: "mock-preview-writer", usage: null };
    }

    const facts = (packet.fixedFacts || []).map((f) => `· ${f.text}`);
    const knowledge = (packet.characterKnowledge || []).map((f) => `· ${f.text}`);
    const isHost = packet.audienceType === "HOST";

    const sections = isHost
      ? [
          {
            heading: "场景与时窗",
            body: `${packet.scene?.title || ""}\n${packet.scene?.timeWindow || ""}`.trim(),
          },
          { heading: "公共规则", body: facts.join("\n") || "（无）" },
          {
            heading: "在场人物",
            body: (packet.castDirectory || [])
              .map((c) => `· ${c.name}——${c.identity}`)
              .join("\n"),
          },
          { heading: "主持注意事项", body: (packet.hostDuties || []).join("\n") },
        ]
      : [
          {
            heading: "你是谁",
            body: `${packet.audience?.name || ""}——${packet.audience?.identity || ""}`.trim(),
          },
          { heading: "开场时你知道的事", body: [...facts, ...knowledge].join("\n") || "（无）" },
          { heading: "你的目标", body: packet.audience?.openingGoal || "（未提供）" },
        ];

    const output = {
      kind: isHost ? "HOST_SHEET" : "CHARACTER_SHEET",
      title: isHost
        ? `${packet.scene?.title || "场景"} · 主持手册`
        : `${packet.audience?.name || "角色"} · 角色本`,
      sections,
      writerNote: "MockPreviewWriterLlm deterministic output",
    };
    return {
      text: JSON.stringify(output),
      modelId: "mock",
      adapterId: "mock-preview-writer",
      usage: { prompt_tokens: 0, completion_tokens: 0 },
    };
  }
}
