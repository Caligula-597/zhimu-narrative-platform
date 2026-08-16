import { cleanText } from "./shared.js";

export const TERMINOLOGY_GROUNDING_VERSION = "v1.1-provenance-closed-source-lexicon";

const unique = (items, limit = 40) => {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = JSON.stringify(item);
    if (!item || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
};

const text = (value, maxLength = 260) => cleanText(value, maxLength);

function creatorSourceExcerpts(setting, synopsis) {
  return unique([
    text(setting?.theme, 120),
    text(setting?.extraConflicts, 1200),
    text(setting?.eraNotes, 600),
    text(synopsis?.body, 1800),
    text(synopsis?.charactersSketch, 900)
  ].filter(Boolean), 8);
}

function registeredWorldTerms({ characterArchive, clueLedger, actMaterials }) {
  const entries = [];
  for (const resource of characterArchive?.resources || []) {
    const term = text(resource?.name, 100);
    if (!term) continue;
    entries.push({
      term,
      source: "characterArchive.resources",
      originKind: "locked_upstream_artifact",
      confidence: "confirmed",
      groundedMeaning: text(resource?.meaning, 220)
    });
  }
  for (const clue of clueLedger || []) {
    const term = text(clue?.name, 120);
    if (!term) continue;
    entries.push({
      term,
      source: "clueLedger",
      originKind: "locked_upstream_artifact",
      confidence: "confirmed",
      groundedMeaning: text(clue?.observable || clue?.description, 260)
    });
  }
  for (const material of actMaterials || []) {
    const name = text(material?.name, 120);
    if (name) {
      entries.push({
        term: name,
        source: "actMaterials",
        originKind: "locked_upstream_artifact",
        confidence: "confirmed",
        groundedMeaning: text(material?.description || material?.hostMeaning, 260)
      });
    }
    const physicalForm = text(material?.physicalForm, 180);
    if (physicalForm) {
      entries.push({
        term: physicalForm,
        source: "actMaterials.physicalForm",
        originKind: "locked_upstream_artifact",
        confidence: "confirmed",
        groundedMeaning: "已确认的物理形态；只授权原文所写形态，不授权继续发明部件名"
      });
    }
  }
  return unique(entries, 48);
}

function registeredActions({ characterArchive, matrixRow, clueLedger, actMaterials }) {
  const entries = [];
  for (const action of characterArchive?.playableMoves || []) {
    if (text(action, 260)) entries.push({ action: text(action, 260), source: "characterArchive.playableMoves", originKind: "locked_upstream_artifact", confidence: "confirmed" });
  }
  for (const action of matrixRow?.tasks || []) {
    if (text(action, 260)) entries.push({ action: text(action, 260), source: "matrixRow.tasks", originKind: "locked_upstream_artifact", confidence: "confirmed" });
  }
  for (const item of [...(clueLedger || []), ...(actMaterials || [])]) {
    for (const action of item?.affordances || []) {
      if (text(action, 180)) entries.push({ action: text(action, 180), source: "clue.affordances", originKind: "locked_upstream_artifact", confidence: "confirmed" });
    }
  }
  return unique(entries, 36);
}

function presetLexicon(styleCard) {
  const split = (value) => text(value, 600)
    .split(/[、，,；;\s]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
  return unique([
    ...split(styleCard?.era?.vocabulary),
    ...split(styleCard?.era?.props)
  ], 32);
}

/**
 * Builds a closed-source contract for specialized vocabulary.
 *
 * This is deliberately narrower than a general Chinese lexicon. Everyday nouns and
 * verbs remain free; only precise-looking occupational, procedural, institutional,
 * historical and component names require a traceable source.
 */
export function buildTerminologyGroundingContract({
  setting = null,
  synopsis = null,
  styleCard = null,
  characterArchive = null,
  matrixRow = null,
  clueLedger = [],
  actMaterials = [],
  roleKey = "",
  actKey = ""
} = {}) {
  return {
    version: TERMINOLOGY_GROUNDING_VERSION,
    mode: "closed_source_for_specialized_terms",
    roleKey,
    actKey,
    creatorSourceExcerpts: creatorSourceExcerpts(setting, synopsis),
    creatorSourceRecords: creatorSourceExcerpts(setting, synopsis).map((excerpt, index) => ({
      key: `creator-source-${index + 1}`,
      excerpt,
      source: "creatorInput",
      originKind: "creator_input",
      confidence: "source_exact"
    })),
    registeredWorldTerms: registeredWorldTerms({ characterArchive, clueLedger, actMaterials }),
    registeredActionDescriptions: registeredActions({ characterArchive, matrixRow, clueLedger, actMaterials }),
    eraPresetLexicon: presetLexicon(styleCard),
    eraPresetRecords: presetLexicon(styleCard).map((term) => ({
      term,
      source: "styleCard.era",
      originKind: "preset_reference",
      confidence: "context_only"
    })),
    eraLexiconLimit: "只证明该词在时代中可用，不证明对应物件已存在于本场；物件仍须由剧情或物料登记",
    nonAuthorityFields: [
      "characterArchive.publicIdentity",
      "characterArchive.voiceHints",
      "styleCard.literaryStyle",
      "styleCard.rhythm",
      "styleCard.dialogueGuide"
    ],
    provenancePolicy: {
      requiredFields: ["source", "originKind", "confidence"],
      confidenceOrder: ["source_exact", "confirmed", "context_only", "research_required"],
      rule: "creator_input 可证明原素材出现；locked_upstream_artifact 只证明已被上游锁定；preset_reference 只提供时代候选，不能证明本场存在"
    },
    fallback: "找不到来源时，用日常汉语写清谁碰了什么、怎样做、产生什么可见结果；不得给动作另起短名"
  };
}

export const TERMINOLOGY_GROUNDING_BLOCK = `【术语溯源门禁 · 专业感不是造词权】
- 这是世界事实门禁，不是“少用几个生僻词”的文风建议。可自由使用普通日常汉语；但任何看似精确的行业黑话、工序名、器件部件名、制度简称、旧规矩、门派称呼、历史专名和人物自造缩写，都必须能在 terminologyGroundingContract 中逐字找到来源。
- publicIdentity 只说明角色是谁，voiceHints 只决定他注意什么、句子怎么说；两者都不是专业知识库。不得因为角色是某种工匠、医生、军人、账房或老人，就推演一套输入从未出现的行话、手势、口诀、规矩或内部零件。
- 文风预设只管节奏，时代词表只说明某个词在该时代可能存在。它们不能证明某件道具已经在现场，也不能授权把普通动作压成一个更像行话的新短词。
- registeredWorldTerms 只授权表中原词及 groundedMeaning 明确写出的事实；registeredActionDescriptions 只授权那段具体动作，不授权为它另造简称、术语或“业内都这么叫”的背景。
- 若当前旧链路没有提供 terminologyGroundingContract，则只能沿用本次输入材料中逐字出现的专门名词；没有逐字来源就按未登记处理，不能把“缺少合同”理解为自由发挥。
- 找不到来源时，必须降级成普通人能看见的动作：谁拿起什么、手落在哪里、怎样移动或处理、现场出现什么结果。宁可朴素准确，也不能用“貌似专业的精确”填补资料空白。
- 已登记的陌生词第一次进入正文，也必须落在实际动作或可见物上，让不懂行的玩家从现场读懂；禁止括号释义、词典解释、百科介绍和角色突然给自己讲专业常识。
- 若剧情确实离不开一个输入未提供、你也无法确认的术语：正文暂用普通动作描述；支持 suggestions 的阶段须写入“terminology_research_required: 待核实对象与用途”。绝不猜一个最像真的名称。
- 改写阶段同样受此门禁约束：删除来源不明的词后，不得换成另一批更冷僻、更精确但仍无来源的词。`;
