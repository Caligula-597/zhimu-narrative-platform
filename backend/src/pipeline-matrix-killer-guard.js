/**
 * Mechanical spoiler scan for killer-role scripts before final act.
 * Pure functions — used post-generation to trigger sanitize rewrite.
 */
import { cleanText } from "./prompts/shared.js";

function normalize(text) {
  return String(text || "").replace(/\s+/g, "");
}

/** Extract matchable substrings from a forbiddenFact phrase. */
export function tokensFromForbiddenFact(fact) {
  const raw = cleanText(fact, 300);
  if (!raw) return [];
  const chunks = raw.split(/[，。；、：\s]+/).filter((s) => s.length >= 2);
  const tokens = [normalize(raw), ...chunks.map(normalize)].filter((t) => t.length >= 2);
  return [...new Set(tokens)];
}

const KILLER_PATTERNS_CH1 = [
  /(?:偷偷|私下|私自).{0,6}(?:配|复制|打|做).{0,6}钥匙/,
  /(?:走私|改频|频率干扰|暗号|情报|走私记录)/,
  /(?:设置|安装|布置|做了).{0,8}机关/,
  /(?:推了|推倒|推落|推下|将他推|把她推|推他下去|推她下去)/,
  /(?:杀害|杀了|灭口|谋杀|害死)/,
  /(?:我承认|是我(?:干|做|害)|凶手就是我)/,
  /(?:诱使|诱骗|引.{0,4}进).{0,8}(?:暗格|坠|摔)/,
  /(?:威胁.{0,8}上报|举报我)/,
  /(?:日志里|记录在).{0,12}(?:走私|改频|频率)/
];

const KILLER_PATTERNS_CH2 = [
  ...KILLER_PATTERNS_CH1,
  /我昨晚(?:确实|真的)?.{0,6}(?:去过|在).{0,10}灯室/,
  /(?:动了|做了|设置).{0,6}手脚/,
  /(?:用|拿).{0,4}细线.{0,8}(?:反锁|锁门)/,
  /(?:不是意外|制造意外|意外假象)/
];

/**
 * @returns {{ passed: boolean, violations: Array<{ type: string, match: string, fact?: string }> }}
 */
export function scanKillerSpoilers(body, { spoilerContract, actIndex, isKiller, finalActIndex = 2 } = {}) {
  if (!isKiller || actIndex >= finalActIndex) {
    return { passed: true, violations: [] };
  }
  const rawBody = String(body || "");
  const flat = normalize(rawBody);
  const violations = [];

  for (const fact of spoilerContract?.forbiddenFacts || []) {
    for (const token of tokensFromForbiddenFact(fact)) {
      if (token.length >= 2 && flat.includes(token)) {
        violations.push({ type: "forbiddenFact", match: token, fact });
      }
    }
  }

  const patterns = actIndex === 0 ? KILLER_PATTERNS_CH1 : KILLER_PATTERNS_CH2;
  for (const re of patterns) {
    const m = rawBody.match(re);
    if (m) violations.push({ type: "confessionPattern", match: m[0] });
  }

  const seen = new Set();
  const deduped = violations.filter((v) => {
    const key = `${v.type}:${v.match}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { passed: deduped.length === 0, violations: deduped };
}
