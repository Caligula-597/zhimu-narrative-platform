/**
 * P9.4 AI-pattern diagnostics (feed E aesthetic; not hard blockers by themselves).
 */

import { AI_PATTERN_TYPES } from "./content-quality-contracts.js";
import { collectPackageTextUnits, playerRoles } from "./content-quality-package-text.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

const GENERIC_EMOTION = /复杂的情绪|不由得|内心涌起|感到一种|巨大的压力|心情复杂|五味杂陈/;
const ABSTRACT_STAKES = /真相|秘密|命运|一切|改变一切|至关重要|隐藏着秘密/g;
const SIGNIFICANCE = /这意味着|这让你意识到|这说明|由此可知|不难看出/;
const FALSE_INTENSITY = /更加紧张|愈发紧张|气氛凝固|空气突然|更大的秘密|真相逐渐浮出水面|事情远没有那么简单/;
const TEMPLATE_VOICE = /事情恐怕没有我们想象中那么简单|你希望调查真相|你必须找出真相|气氛愈发/;

function pushPattern(map, type, unit, observation, excerpt) {
  if (!AI_PATTERN_TYPES.includes(type)) return;
  if (!map.has(type)) {
    map.set(type, { type, count: 0, message: observation, evidence: [] });
  }
  const row = map.get(type);
  row.count += 1;
  if (row.evidence.length < 3) {
    row.evidence.push({
      sectionId: unit.sectionId,
      roleId: unit.roleId,
      stageId: unit.stageId,
      clueId: unit.clueId,
      excerpt: String(excerpt || unit.text).slice(0, 120),
      observation,
    });
  }
}

function normalizeWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function roleVoiceSignature(text) {
  const t = normalizeWhitespace(text);
  const shortRatio = (t.match(/[。！？]/g) || []).length;
  const avgLen = t.length / Math.max(1, shortRatio);
  const hasQuestion = /[？?]/.test(t);
  const hasExplain = /因为|所以|因此/.test(t);
  return `${avgLen > 40 ? "L" : "S"}${hasQuestion ? "Q" : ""}${hasExplain ? "E" : ""}`;
}

/**
 * @returns {object[]} normalized-ish ai pattern rows
 */
export function detectAiPatterns(pkg) {
  const units = collectPackageTextUnits(pkg);
  const map = new Map();

  for (const unit of units) {
    const text = unit.text || "";
    if (GENERIC_EMOTION.test(text)) {
      pushPattern(map, "GENERIC_EMOTION_EXPLANATION", unit, "重复解释人物情绪", text.match(GENERIC_EMOTION)?.[0]);
    }
    const abstractHits = text.match(ABSTRACT_STAKES) || [];
    if (abstractHits.length >= 3) {
      pushPattern(map, "ABSTRACT_STAKES", unit, "抽象 stake 词密度过高", abstractHits.slice(0, 3).join("/"));
    }
    if (SIGNIFICANCE.test(text)) {
      pushPattern(map, "SIGNIFICANCE_RESTATEMENT", unit, "事件后立即解释意义", text.match(SIGNIFICANCE)?.[0]);
    }
    if (FALSE_INTENSITY.test(text)) {
      pushPattern(map, "FALSE_INTENSITY", unit, "局势未变却堆叠强度词", text.match(FALSE_INTENSITY)?.[0]);
    }
  }

  const roles = playerRoles(pkg);
  const roleBodies = roles.map((r) => {
    const secs = asArray(pkg?.roleScripts?.[r.id]);
    const text = secs.map((s) => asArray(s.paragraphs).join("")).join("\n");
    return { roleId: r.id, text, signature: roleVoiceSignature(text), structure: secs.map((s) => asArray(s.paragraphs).length).join(",") };
  });

  if (roleBodies.length >= 2) {
    const sigSet = new Set(roleBodies.map((r) => r.signature));
    const templateHits = roleBodies.filter((r) => TEMPLATE_VOICE.test(r.text)).length;
    if (sigSet.size === 1 || templateHits >= Math.ceil(roleBodies.length * 0.6)) {
      pushPattern(
        map,
        "SAME_VOICE",
        { sectionId: `role:${roleBodies[0].roleId}`, roleId: roleBodies[0].roleId },
        "多角色句式/措辞高度雷同",
        roleBodies[0].text.slice(0, 80),
      );
    }
    const structures = roleBodies.map((r) => r.structure);
    const firstParas = roleBodies.map((r) => normalizeWhitespace(r.text).slice(0, 48));
    const templateIdentical =
      firstParas.length >= 2 &&
      firstParas.every((p) => p.replace(/沈岚|梁赫|白绫|[A-Za-z_\d]+/g, "NAME") === firstParas[0].replace(/沈岚|梁赫|白绫|[A-Za-z_\d]+/g, "NAME"));
    if (
      structures.length >= 2 &&
      structures.every((s) => s === structures[0]) &&
      structures[0] &&
      (sigSet.size === 1 || templateIdentical)
    ) {
      pushPattern(
        map,
        "SYMMETRIC_ROLEBOOK",
        { sectionId: `role:${roleBodies[0].roleId}`, roleId: roleBodies[0].roleId },
        "角色本幕结构长度几乎完全一致",
        structures[0],
      );
    }
  }

  // Exposition duplication: identical paragraph shared across host + public + role
  const paraIndex = new Map();
  for (const unit of units) {
    for (const p of String(unit.text).split(/\n+/).map((x) => normalizeWhitespace(x)).filter((x) => x.length > 24)) {
      if (!paraIndex.has(p)) paraIndex.set(p, []);
      paraIndex.get(p).push(unit);
    }
  }
  for (const [para, hits] of paraIndex) {
    const kinds = new Set(hits.map((h) => h.kind));
    if (kinds.size >= 2 && hits.length >= 2) {
      pushPattern(map, "EXPOSITION_DUPLICATION", hits[0], "公共/角色/主持重复完整叙述", para.slice(0, 80));
      break;
    }
  }

  // Genre noun swap heuristic: sci-fi nouns + office behavior templates
  const full = units.map((u) => u.text).join("\n");
  if (/舰员|舱段|权限档案终端|空间站/.test(full) && /开会讨论|提交报告|领导批复|办公室/.test(full)) {
    pushPattern(
      map,
      "GENRE_NOUN_SWAP",
      units[0] || { sectionId: "pkg" },
      "题材名词已换，行为逻辑仍像通用办公室模板",
      "舰员/舱段 + 开会讨论",
    );
  }

  return [...map.values()];
}
