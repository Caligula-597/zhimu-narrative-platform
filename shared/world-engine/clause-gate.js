import { list } from "./catalog.js";
import { detectInternalIdentifierLeak } from "./surface-ref.js";

export const CLAUSE_TYPES = Object.freeze([
  "WORLD_ASSERTION",
  "OBSERVATION",
  "ACTION",
  "SPEECH",
  "BELIEF",
  "CONNECTIVE"
]);

const CONNECTIVE = /^(后来|处理完以后|同一时间|这时|随后|接着)[，。]?$/u;
const SPEECH = /[“「][^”」]+[”」]/u;
const BELIEF = /心里|你清楚|盘算|意味着|谁负责|这场与|才刚刚开始/u;
const ATMOSPHERE = /灯光|日光灯|白晃晃|嗡嗡|汗|雾|烟灰|保温杯|咸腥|云压|神态|眼睛发酸|晨雾|清脆的声响/u;
const LITERARY = /节拍|赛跑|照得人|货轮的身影|逐渐清晰|才刚刚开始/u;
const UNSUPPORTED_SURFACE = /烟灰缸|皱巴巴|拍在桌上|愣了|嘟囔|敲桌子|年轻人|财务电话/u;
const PHONE = /电话|对讲机/u;
const INTERPRETATION = /每一步都踩在|与潮水的赛跑|谁负责今晚/u;

export function clausesOf(text) {
  return String(text || "")
    .split(/[。！？!?\n]+/u)
    .map((row) => row.trim())
    .filter(Boolean);
}

export function classifyClause(clause) {
  if (CONNECTIVE.test(clause)) return "CONNECTIVE";
  if (SPEECH.test(clause)) return "SPEECH";
  if (ATMOSPHERE.test(clause) || LITERARY.test(clause)) return "WORLD_ASSERTION";
  if (BELIEF.test(clause) || INTERPRETATION.test(clause)) return "BELIEF";
  if (/看见|发现|对不上|少了|多了|写着/u.test(clause)) return "OBSERVATION";
  if (/走|拿|盖|回|问|说|停|开|回绝|核对/u.test(clause)) return "ACTION";
  return "WORLD_ASSERTION";
}

function allowedWithoutRef(type, clause) {
  return type === "CONNECTIVE" && CONNECTIVE.test(clause);
}

export function clauseProvenanceGate(text, { allowSpeech = false, allowPhone = false } = {}) {
  const issues = [];
  if (detectInternalIdentifierLeak(text)) {
    issues.push({ code: "internal_identifier_leak", clause: null, type: "WORLD_ASSERTION" });
  }
  for (const clause of clausesOf(text)) {
    const type = classifyClause(clause);
    if (type === "CONNECTIVE" && allowedWithoutRef(type, clause)) continue;
    if (ATMOSPHERE.test(clause) || UNSUPPORTED_SURFACE.test(clause)) {
      issues.push({ code: "unsupported_world_detail", clause, type });
      issues.push({ code: "unsupported_surface_detail", clause, type });
    }
    if (LITERARY.test(clause)) {
      issues.push({ code: "literary_surface_backfill", clause, type });
    }
    if (INTERPRETATION.test(clause) || (BELIEF.test(clause) && !/回绝|对不上|只能/u.test(clause))) {
      issues.push({ code: "unsupported_interpretation", clause, type });
    }
    if (PHONE.test(clause) && !allowPhone) {
      issues.push({ code: "runtime_event_backfill", clause, type });
      issues.push({ code: "runtime_scene_expansion", clause, type });
    }
    if (type === "SPEECH" && !allowSpeech && (clause.match(/[“「][^”」]{8,}[”」]/gu) || []).length) {
      issues.push({ code: "invented_speech_act", clause, type });
    }
  }
  return issues;
}

export function uniqueGateCodes(issues) {
  return [...new Set(list(issues).map((row) => row.code).filter(Boolean))];
}
