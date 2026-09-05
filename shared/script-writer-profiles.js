/**
 * P9.3 Writer Profiles V1 — one profile per Packet Kind (no whole-PMD prompt).
 */

import { PACKET_KINDS, WRITER_CONSTRAINTS } from "./script-writer-result-contracts.js";

export const WRITER_PROFILE_VERSION = "v1";

const SHARED_RULES = Object.freeze([
  "不得新增 Canon / 事实真假 / 人物 / 幕 / OWNER",
  "不得改变 clue semantics（isMisleading / isDecisive / supportsFact / finders）",
  "不得改变 GAME outcome / Runtime 结算规则",
  "必须输出结构化 ScriptWriterResult JSON（sections + provenance）",
  "proposedCanonicalChanges 仅在确有缺口时提出，默认 []",
  "优先使用 packet 中已实例化的专有名词；禁止把具体实体重新抽象化为「关键记录/关键场所/关键权限/关键资源」",
  "可以扩写体验与文风，不能扩写未给出的事实",
]);

const SCHEMA_HINT = Object.freeze({
  requestId: "string",
  packetKind: "HOST_SCRIPT|ROLE_SCRIPT|CLUE_WRITER|PUBLIC_STAGE|ENDING",
  sections: [
    {
      sectionId: "string",
      stageId: "string",
      title: "string",
      paragraphs: ["string"],
      provenance: {
        sourceBeatIds: ["string"],
        sourceClueIds: ["string"],
        sourceFactIds: ["string"],
      },
      canonicalClaims: [],
      inventedCharacterIds: [],
      inventedStageIds: [],
    },
  ],
  proposedCanonicalChanges: [],
  diagnostics: [],
});

function profile(spec) {
  return Object.freeze({
    id: spec.id,
    packetKind: spec.packetKind,
    promptVersion: `${spec.id}.${WRITER_PROFILE_VERSION}`,
    constraints: { ...WRITER_CONSTRAINTS },
    sharedRules: SHARED_RULES,
    duties: Object.freeze(spec.duties),
    outputSchemaHint: SCHEMA_HINT,
  });
}

export const WRITER_PROFILES = Object.freeze({
  HOST_SCRIPT: profile({
    id: "HOST_WRITER_V1",
    packetKind: "HOST_SCRIPT",
    duties: [
      "组织主持本：本幕目的、开场词、玩家可知信息、关键事件、线索发放时机",
      "若 packet.gameNarrative 存在：写清 why-now / stake / 何时启动 / 各 outcome 主持处理",
      "后台真相备注仅写 packet 已给 hostTruth，不发明真凶",
    ],
  }),
  ROLE_SCRIPT: profile({
    id: "ROLE_WRITER_V1",
    packetKind: "ROLE_SCRIPT",
    duties: [
      "写出可读角色本：处境、记忆、本幕经历、对他人认知、目标、行动空间、新压力",
      "只使用 allowedKnowledgeLabels / contributions / publicContext",
      "不得写入 forbiddenFactIds 或后台 GAME 秘密",
      "若 packet.roleGameSurface 存在，仅写该角色允许知道的玩法信息",
    ],
  }),
  CLUE_WRITER: profile({
    id: "CLUE_WRITER_V1",
    packetKind: "CLUE_WRITER",
    duties: [
      "把线索写成真实可读载体（日志/短信/账册残页/照片描述/信件等）",
      "lockedSemantics 字段不可改写；只决定「长什么样」",
      "优先使用 contextLexicon 中的具体名词",
    ],
  }),
  PUBLIC_STAGE: profile({
    id: "PUBLIC_STAGE_WRITER_V1",
    packetKind: "PUBLIC_STAGE",
    duties: [
      "写公共层可见叙述与规则包装",
      "若有 gameNarrative：剧情化 why/stake，但不得改 runtimeTruth（如 winnerCount）",
    ],
  }),
  ENDING: profile({
    id: "ENDING_WRITER_V1",
    packetKind: "ENDING",
    duties: [
      "写终局呈现：玩家表决结果与 Canon 真相分开表述",
      "不得把多数票写成改写后的真相",
      "对齐 truthEvents / decisiveClues",
    ],
  }),
});

export function getWriterProfile(packetKind) {
  const kind = PACKET_KINDS.includes(packetKind) ? packetKind : null;
  return kind ? WRITER_PROFILES[kind] : null;
}

export function buildWriterSystemPrompt(profile) {
  if (!profile) return "You are a constrained script writer. Output JSON only.";
  return [
    `You are ${profile.id} (${profile.promptVersion}).`,
    "Output ONE JSON object matching ScriptWriterResult. No markdown fences.",
    "Shared rules:",
    ...profile.sharedRules.map((r) => `- ${r}`),
    "Duties:",
    ...profile.duties.map((r) => `- ${r}`),
    `Constraints: ${JSON.stringify(profile.constraints)}`,
  ].join("\n");
}

export function buildWriterUserPrompt({ request, profile }) {
  const packet = request?.packet || {};
  return [
    `requestId=${request?.requestId}`,
    `packetKind=${request?.packetKind || profile?.packetKind}`,
    "Write sections for this packet only. Use provenance ids from allow-lists.",
    "<<<PACKET_JSON>>>",
    JSON.stringify(packet),
    "<<<END_PACKET_JSON>>>",
    "<<<SCHEMA_HINT>>>",
    JSON.stringify(profile?.outputSchemaHint || SCHEMA_HINT),
    "<<<END_SCHEMA_HINT>>>",
  ].join("\n");
}

export function buildFormatRepairPrompt({ previousRaw, parseError, profile }) {
  return [
    "FORMAT_REPAIR_ONLY: Re-output valid ScriptWriterResult JSON.",
    "Do not change narrative semantics; only fix structure/schema.",
    `parseError=${parseError}`,
    `profile=${profile?.id || "unknown"}`,
    "Previous raw (may be truncated):",
    String(previousRaw || "").slice(0, 6000),
    "Schema hint:",
    JSON.stringify(profile?.outputSchemaHint || SCHEMA_HINT),
  ].join("\n");
}
