/**
 * Match mechanism manuscript text against existing catalogs.
 * Uses shared/mechanism-catalog.js kits (in-product) as the live matcher.
 * M01–M11 family hints are soft signals toward mechanism-catalog-v2.ts —
 * Stage 7 must not invent a second template system.
 */

import {
  listMechanismKits,
  getMechanismKit
} from "../../../shared/mechanism-catalog.js";
import { MECHANISM_MATCH } from "./state.js";

const FAMILY_HINTS = Object.freeze([
  { family: "M01", keywords: ["投票", "表决", "票选"] },
  { family: "M02", keywords: ["拍卖", "出价", "竞价"] },
  { family: "M03", keywords: ["行动点", "AP", "回合行动"] },
  { family: "M04", keywords: ["搜索", "搜查", "调查点"] },
  { family: "M05", keywords: ["资源", "计数", "配额", "银两", "氧气"] },
  { family: "M06", keywords: ["权限", "通行证", "签字权"] },
  { family: "M07", keywords: ["证据", "质证", "异议"] },
  { family: "M08", keywords: ["通讯", "暗号", "时间窗"] },
  { family: "M09", keywords: ["承诺", "契约", "违约"] },
  { family: "M10", keywords: ["身份", "伪装", "公开身份"] },
  { family: "M11", keywords: ["现场改写", "世界状态", "因果"] }
]);

function scoreKit(text, kit) {
  const hay = text.toLowerCase();
  let score = 0;
  const needles = [
    kit.label,
    kit.family,
    kit.key,
    ...(kit.genres || []),
    kit.summary
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());

  for (const n of needles) {
    if (n.length >= 2 && hay.includes(n)) score += n === kit.label.toLowerCase() ? 5 : 2;
  }
  for (const pit of kit.pitfalls || []) {
    if (hay.includes(String(pit).toLowerCase().slice(0, 6))) score += 1;
  }
  return score;
}

function softFamilyHint(text) {
  for (const row of FAMILY_HINTS) {
    if (row.keywords.some((k) => text.includes(k))) return row.family;
  }
  return null;
}

/**
 * @returns {{ status, templateKey?, family?, label?, note?, suggestedClueIds?, suggestedSceneIds? }}
 */
export function matchMechanismAgainstCatalog(text) {
  const raw = String(text || "");
  if (!raw.trim()) {
    return {
      status: MECHANISM_MATCH.CUSTOM_MECHANISM,
      note: "空机制文本"
    };
  }

  const kits = listMechanismKits();
  let best = null;
  let bestScore = 0;
  for (const kit of kits) {
    const score = scoreKit(raw, kit);
    if (score > bestScore) {
      bestScore = score;
      best = kit;
    }
  }

  const family = softFamilyHint(raw);

  if (best && bestScore >= 5) {
    const full = getMechanismKit(best.key) || best;
    return {
      status: MECHANISM_MATCH.MATCHED,
      templateKey: full.key,
      family: family || full.family,
      label: full.label,
      note: null,
      suggestedClueIds: [],
      suggestedSceneIds: []
    };
  }

  if (best && bestScore >= 2) {
    return {
      status: MECHANISM_MATCH.PARTIAL_MATCH,
      templateKey: best.key,
      family: family || best.family,
      label: best.label,
      note: family
        ? `弱匹配 kit=${best.key}；亦命中家族提示 ${family}（对照 mechanism-catalog-v2）`
        : `弱匹配 kit=${best.key}，需人工确认`,
      suggestedClueIds: [],
      suggestedSceneIds: []
    };
  }

  return {
    status: MECHANISM_MATCH.CUSTOM_MECHANISM,
    templateKey: null,
    family,
    label: null,
    note: family
      ? `未匹配成品 kit；家族提示 ${family}，请对照 mechanism-catalog-v2 手工绑定`
      : "未匹配已有机制 Catalog",
    suggestedClueIds: [],
    suggestedSceneIds: []
  };
}
