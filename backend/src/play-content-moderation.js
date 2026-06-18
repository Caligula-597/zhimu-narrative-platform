import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { throwErr } from "./api-errors.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BLOCKLIST_PATH = path.join(MODULE_DIR, "../config/play-content-blocklist.json");

/** @type {{ forbidden: string[], ad: string[] } | null} */
let cachedTerms = null;

const AD_URL_PATTERNS = [
  /(?:https?|ftp|hxxps?):\/\/[^\s]+/i,
  /\bwww\.[a-z0-9][-a-z0-9./?&=#%+]+\b/i,
  /\b[a-z0-9][-a-z0-9]{0,62}\.(?:com|cn|net|org|top|xyz|vip|shop|site|link|me|io|cc|tv|app|work|info|biz|co|club|live|store|online|tech|pro|asia)(?:\/|\b)/i,
  /\bt\.me\/\S+/i,
  /\b(?:bit\.ly|url\.cn|dwz\.cn|suo\.im|u\.nu)\/\S+/i
];

const AD_CONTACT_PATTERNS = [
  /\b1[3-9]\d{9}\b/,
  /\b(?:qq|QQ)\s*[:：]?\s*\d{5,12}\b/,
  /\b(?:微信|weixin|wechat|vx|wx|v信|薇信|威信)\s*[:：]?\s*[a-zA-Z][-_a-zA-Z0-9]{4,20}\b/i,
  /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/
];

const AD_COMPACT_PATTERNS = [
  /(?:https?|hxxps?|www)[a-z0-9./?&=#%-]{4,}/i,
  /加[\s·•|_\-]*[vVwW微薇威][\s·•|_\-]*信?/,
  /扫[\s·•|_\-]*码/,
  /微[\s·•|_\-]*商/,
  /代[\s·•|_\-]*购/,
  /兼[\s·•|_\-]*职[\s·•|_\-]*日[\s·•|_\-]*结/
];

function loadBlocklistFile() {
  const filePath = process.env.PLAY_CONTENT_BLOCKLIST_PATH || DEFAULT_BLOCKLIST_PATH;
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      forbidden: Array.isArray(parsed.forbiddenTerms) ? parsed.forbiddenTerms : [],
      ad: Array.isArray(parsed.adTerms) ? parsed.adTerms : []
    };
  } catch {
    return { forbidden: [], ad: [] };
  }
}

function loadExtraTerms() {
  const extra = String(process.env.PLAY_CONTENT_EXTRA_BLOCK_TERMS || "")
    .split(/[,，;；\n]/)
    .map((term) => term.trim())
    .filter(Boolean);
  return extra;
}

function getTerms() {
  if (cachedTerms) return cachedTerms;
  const fileTerms = loadBlocklistFile();
  const extra = loadExtraTerms();
  const normalizeList = (items) =>
    [...new Set(items.map((term) => normalizeCompact(String(term))).filter((term) => term.length >= 2))];
  cachedTerms = {
    forbidden: normalizeList([...fileTerms.forbidden, ...extra]),
    ad: normalizeList(fileTerms.ad)
  };
  return cachedTerms;
}

export function resetPlayContentModerationForTests() {
  cachedTerms = null;
}

function toHalfWidth(value) {
  return String(value).replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

function stripZeroWidth(value) {
  return String(value).replace(/[\u200b-\u200d\ufeff]/g, "");
}

function normalizeCompact(value) {
  let text = stripZeroWidth(toHalfWidth(String(value ?? ""))).toLowerCase();
  text = text.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 48));
  text = text.replace(/[Ａ-Ｚａ-ｚ]/g, (ch) => {
    const code = ch.charCodeAt(0);
    return String.fromCharCode(code <= 0xff3a ? code - 0xff21 + 65 : code - 0xff41 + 97);
  });
  return text.replace(/[\s\-_.·•|/\\,，。!！?？@#￥$%^&*()（）[\]{}<>《》:：;；'"`~～+＋=＝]/g, "");
}

function buildScanForms(text) {
  const raw = stripZeroWidth(toHalfWidth(String(text ?? "")));
  const lower = raw.toLowerCase();
  const compact = normalizeCompact(raw);
  const digits = lower.replace(/\D/g, "");
  return { raw, lower, compact, digits };
}

function includesTerm(compact, term) {
  if (!term) return false;
  return compact.includes(term);
}

function matchesForbidden(compact) {
  const { forbidden } = getTerms();
  return forbidden.some((term) => includesTerm(compact, term));
}

function matchesAdTerms(compact) {
  const { ad } = getTerms();
  return ad.some((term) => includesTerm(compact, term));
}

function matchesAdPatterns(forms) {
  const candidates = [forms.raw, forms.lower, forms.compact, forms.digits];
  for (const pattern of AD_URL_PATTERNS) {
    if (candidates.some((value) => pattern.test(value))) return true;
  }
  for (const pattern of AD_CONTACT_PATTERNS) {
    if (pattern.test(forms.raw) || pattern.test(forms.lower)) return true;
  }
  for (const pattern of AD_COMPACT_PATTERNS) {
    if (pattern.test(forms.compact) || pattern.test(forms.raw)) return true;
  }
  if (/^1[3-9]\d{9}$/.test(forms.digits)) return true;
  if (forms.digits.length >= 11) {
    for (let i = 0; i <= forms.digits.length - 11; i += 1) {
      const slice = forms.digits.slice(i, i + 11);
      if (/^1[3-9]\d{9}$/.test(slice)) return true;
    }
  }
  return false;
}

/**
 * Scan user-generated play-portal social text (plaza / DM). Script in-world content is out of scope.
 * @returns {{ ok: true } | { ok: false, reason: 'ad' | 'forbidden' }}
 */
export function scanPlaySocialContent(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return { ok: true };
  const forms = buildScanForms(trimmed);
  if (matchesAdTerms(forms.compact) || matchesAdPatterns(forms)) {
    return { ok: false, reason: "ad" };
  }
  if (matchesForbidden(forms.compact)) {
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true };
}

export function assertPlaySocialContentAllowed(text) {
  const verdict = scanPlaySocialContent(text);
  if (verdict.ok) return;
  if (verdict.reason === "ad") {
    throwErr(
      "PLAY_CONTENT_AD",
      "广场与私信禁止发布广告、外链、联系方式引流或推广信息。"
    );
  }
  throwErr("PLAY_CONTENT_FORBIDDEN", "内容包含违禁词，无法发布。请修改后重试。");
}
