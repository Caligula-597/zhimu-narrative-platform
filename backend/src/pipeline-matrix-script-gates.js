/**
 * Post-generation quality gates — mechanical, non-LLM.
 * Runs after each script cell before continuing the waterfall.
 */
import { actIndex } from "./prompts/matrix-prompt-engine.js";
import { cleanText } from "./prompts/shared.js";
import { scanKillerSpoilers, tokensFromForbiddenFact } from "./pipeline-matrix-killer-guard.js";
import { diagnosePlayerScript } from "../../shared/prose-quality-gate.js";

const DISCOVERY_VERBS = /(?:发现|看到|看见|捡到|捡起|拾起|打开|读到|翻出|找到|抽出|掏出|核对|确认|翻阅)/;
const GUILT_PATTERNS = [
  /必须隐瞒/,
  /(?:我|你).{0,6}(?:杀了|杀害|灭口|谋杀|害死)/,
  /(?:是我|凶手就是我)/,
  /(?:心里清楚|我知道).{0,12}(?:杀人|作案|走私|改频)/,
  /走私记录.{0,12}(?:圆|毁|藏|祈祷)/,
  /(?:设置|做了).{0,8}机关/,
  /(?:威胁.{0,8}上报|举报我)/
];

const INTERNAL_MARKERS = [
  /\[规定疑惑\]/,
  /\[规定情绪\]/,
  /(?:^|[^a-z])state-[a-z0-9-]+/i,
  /(?:^|[^a-z])resource-[a-z0-9-]+/i,
  /(?:写入|设置|修改)(?:内部)?状态/,
  /后续权限、材料与结局路线/
];

const COMMON_SURNAMES =
  "赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵汪祁毛禹狄米贝明臧计伏成戴宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣贲邓郁单杭洪包诸左石崔吉龚程邢裴陆荣翁荀羊甄魏家封芮羿储靳汲邴糜松井段富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾暴甘钭厉戎祖武符刘景詹束龙叶幸司韶黎乔苍双闻莘党翟谭贡劳逄姬申扶堵冉宰郦雍桑桂濮牛寿通边扈燕冀郏浦尚农温别庄晏柴瞿阎充慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡国文寇广禄阙东欧殳沃利蔚越夔隆师巩聂晁勾敖融冷辛阚那简饶空曾毋沙乜养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公";
const NAME_CONTEXT =
  "说|问|答|喊|叫|哭|笑|抖|站|走|来|去|在|从|向|对|把|将|拿|递|转身|开口|点头|摇头|沉默|皱眉|看|望|听|低声|压低";
const NAME_CANDIDATE_RE = new RegExp(
  `(?:^|[\\s，。！？；：“”「」、])([${COMMON_SURNAMES}][\\u4e00-\\u9fa5]{1,2}?)(?=(?:${NAME_CONTEXT}))`,
  "gu"
);
const NAME_FALSE_POSITIVES = new Set([
  "方才", "何人", "何时", "周围", "当前", "后来", "其中", "有人", "别人", "主人", "成员", "众人",
  "现场", "时间", "系统", "玩家", "角色", "主持", "所有", "陈述", "说明", "向前", "方在", "于是在",
  "和他", "和她", "向他", "向她", "与他", "与她", "和此刻", "和此前", "时间戳", "那是"
]);

function shortName(value) {
  return String(value || "").split("·")[0].trim();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildRegisteredCharacterNames(characterArchives, truthBible) {
  const names = new Set();
  for (const role of characterArchives?.roles || []) {
    const name = shortName(role?.name);
    if (name) names.add(name);
  }
  const victim = shortName(truthBible?.victim);
  if (victim) names.add(victim);
  for (const event of truthBible?.physicalTimeline || truthBible?.timeline || []) {
    for (const participant of event?.participants || []) {
      const name = shortName(participant);
      if (name && /^[\u4e00-\u9fa5]{2,4}$/u.test(name)) names.add(name);
    }
  }
  return [...names];
}

export function scanUnregisteredCharacterNames(body, characterArchives, truthBible, infoMatrix) {
  const allowed = buildRegisteredCharacterNames(characterArchives, truthBible);
  if (!characterArchives?.roles?.length && !truthBible) {
    return { passed: true, skipped: true, allowed, violations: [] };
  }
  const violations = [];
  const authoritativeText = JSON.stringify({ characterArchives, truthBible, infoMatrix });
  for (const match of String(body || "").matchAll(NAME_CANDIDATE_RE)) {
    const name = match[1];
    if (NAME_FALSE_POSITIVES.has(name)) continue;
    if (authoritativeText.includes(name)) continue;
    if (allowed.some((registered) => registered === name || registered.includes(name) || name.includes(registered))) continue;
    violations.push({ type: "unregisteredCharacter", name });
  }
  const unique = [...new Map(violations.map((item) => [item.name, item])).values()];
  return { passed: unique.length === 0, allowed, violations: unique };
}

export function scanInternalMarkers(body) {
  const raw = String(body || "");
  const violations = INTERNAL_MARKERS.flatMap((pattern) => {
    const match = raw.match(pattern);
    return match ? [{ type: "internalMarker", match: match[0] }] : [];
  });
  return { passed: violations.length === 0, violations };
}

export function scanPovConsistency(body, expectedPov = "second", roleName = "") {
  const narration = String(body || "")
    .replace(/「[^」]*」/gu, "")
    .replace(/『[^』]*』/gu, "")
    .replace(/“[^”]*”/gu, "")
    .replace(/"[^"]*"/gu, "");
  const selfName = shortName(roleName);
  const selfThirdPerson = selfName
    ? narration.match(new RegExp(`${escapeRegExp(selfName)}(?:说|问|答|喊|看|走|站|坐|抬|低|转身|点头|摇头|沉默|伸手)`, "u"))
    : null;
  if (expectedPov === "first") {
    const match = narration.match(/(?:^|[，。！？；：、\s])你(?:们|自己|的|在|没|不|要|会|能|把|将|曾|正|又|却|也|只|先|想|看|听|说|问|答|点|抬|低|伸|转|走|站|坐|蹲|回|盯|记|知道|清楚|觉得|以为|需要|必须|决定|打开|按|拿|从|向|对|被|让|还|已经|依然|仍)/u);
    const violations = [
      ...(match ? [{ type: "povDrift", match: match[0].trim() }] : []),
      ...(selfThirdPerson ? [{ type: "selfThirdPerson", match: selfThirdPerson[0] }] : [])
    ];
    return { passed: violations.length === 0, expectedPov, violations };
  }
  const match = narration.match(/(?:^|[，。！？；：、\s])我(?:们|自己|的|在|没|不|要|会|能|把|将|曾|正|又|却|也|只|先|想|看|听|说|问|答|点|抬|低|伸|转|走|站|坐|蹲|回|盯|记|知道|清楚|觉得|以为|需要|必须|决定|打开|按|拿|从|向|对|被|让|还|已经|依然|仍)/u);
  const violations = [
    ...(match ? [{ type: "povDrift", match: match[0].trim() }] : []),
    ...(selfThirdPerson ? [{ type: "selfThirdPerson", match: selfThirdPerson[0] }] : [])
  ];
  return { passed: violations.length === 0, expectedPov, violations };
}

function charBigrams(text) {
  const flat = normalize(text);
  const out = new Set();
  for (let index = 0; index < flat.length - 1; index += 1) out.add(flat.slice(index, index + 2));
  return out;
}

function jaccard(left, right) {
  const a = charBigrams(left);
  const b = charBigrams(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

export function scanDuplicatePassages(body) {
  const raw = String(body || "");
  const violations = [];
  const groups = [
    raw.split(/\n{2,}/u),
    raw.split(/(?<=[。！？])\s*/u),
    raw.split(/[，,。！？；;\n]+/u)
  ];
  for (const group of groups) {
    const units = group
      .map((part) => part.trim())
      .filter((part) => normalize(part).length >= (group === groups[2] ? 16 : 32));
    for (let left = 0; left < units.length; left += 1) {
      for (let right = left + 1; right < units.length; right += 1) {
        const a = normalize(units[left]);
        const b = normalize(units[right]);
        const similarity = a === b ? 1 : Math.min(a.length, b.length) >= 60 ? jaccard(a, b) : 0;
        if (similarity >= (a === b ? 1 : 0.76)) {
          violations.push({
            type: "duplicatePassage",
            similarity: Number(similarity.toFixed(3)),
            excerpt: units[right].slice(0, 100)
          });
        }
      }
    }
  }
  return { passed: violations.length === 0, violations: violations.slice(0, 6) };
}

function normalize(text) {
  return String(text || "").replace(/\s+/g, "");
}

/** Clue names this role may reference by direct discovery in this act and prior acts. */
export function buildAuthorizedClueNames(infoMatrix, matrixRow, actKey, config) {
  const keys = config?.chapterKeys || [];
  const actIdx = actIndex(config, actKey);
  const authorizedIds = new Set();
  for (const row of infoMatrix?.rows || []) {
    if (row.roleKey !== matrixRow?.roleKey) continue;
    const rowIdx = keys.indexOf(row.actKey);
    if (rowIdx < 0 || rowIdx > actIdx) continue;
    for (const id of row.newClueIds || []) authorizedIds.add(id);
  }
  const names = new Set();
  for (const clue of infoMatrix?.clues || []) {
    const clueIdx = keys.indexOf(clue.actKey);
    if (clueIdx < 0 || clueIdx > actIdx) continue;
    if (authorizedIds.has(clue.key) || clue.scope === "public_anchor") {
      if (clue.name) names.add(clue.name);
    }
  }
  return [...names];
}

/**
 * Scan sentences for unauthorized physical discoveries of host_confirm clues.
 */
export function scanUnauthorizedDiscoveries(body, infoMatrix, matrixRow, actKey, config) {
  const authorized = new Set(buildAuthorizedClueNames(infoMatrix, matrixRow, actKey, config).map(normalize));
  const violations = [];
  const sentences = String(body || "").split(/(?<=[。！？\n])/);

  for (const clue of infoMatrix?.clues || []) {
    const name = clue.name;
    if (!name || name.length < 2) continue;
    if (authorized.has(normalize(name))) continue;
    if (clue.grantMode !== "host_confirm") continue;
    for (const sentence of sentences) {
      if (!sentence.includes(name)) continue;
      if (DISCOVERY_VERBS.test(sentence)) {
        violations.push({ type: "unauthorizedDiscovery", clueName: name, sentence: sentence.trim().slice(0, 120) });
      }
    }
  }
  const seen = new Set();
  return {
    passed: violations.length === 0,
    violations: violations.filter((v) => {
      const key = `${v.clueName}:${v.sentence.slice(0, 40)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
  };
}

export function scanForbiddenFacts(body, spoilerContract) {
  const flat = normalize(body);
  const violations = [];
  for (const fact of spoilerContract?.forbiddenFacts || []) {
    for (const token of tokensFromForbiddenFact(fact)) {
      if (token.length >= 2 && flat.includes(token)) {
        violations.push({ type: "forbiddenFact", match: token, fact });
      }
    }
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

export function scanGuiltStatements(body) {
  const raw = String(body || "");
  const matches = [];
  for (const re of GUILT_PATTERNS) {
    const m = raw.match(re);
    if (m) matches.push({ type: "guiltStatement", match: m[0] });
  }
  return { passed: matches.length <= 2, count: matches.length, violations: matches };
}

const VAGUE_REPLACEMENT = "你注意到那个角落，但光线太暗，什么也看不清。";

export function stripUnauthorizedDiscoveries(body, violations) {
  let text = String(body || "");
  for (const v of violations || []) {
    if (v.type !== "unauthorizedDiscovery" || !v.sentence) continue;
    const escaped = v.sentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped);
    if (re.test(text)) {
      text = text.replace(re, VAGUE_REPLACEMENT);
    } else if (v.clueName) {
      const parts = text.split(/(?<=[。！？\n])/);
      text = parts
        .map((s) => (s.includes(v.clueName) && DISCOVERY_VERBS.test(s) ? VAGUE_REPLACEMENT : s))
        .join("");
    }
  }
  return cleanText(text, 12000);
}

export function applyScriptQualityGates(body, {
  spoilerContract,
  infoMatrix,
  matrixRow,
  actKey,
  config,
  isKillerInnocentMode = false,
  actIndex: actIdx,
  isKiller,
  finalActIndex,
  characterArchives,
  truthBible,
  pov = "second",
  roleName = ""
}) {
  const gates = {};

  gates.forbiddenFacts = scanForbiddenFacts(body, spoilerContract);
  gates.internalMarkers = scanInternalMarkers(body);
  gates.povConsistency = scanPovConsistency(body, pov, roleName);
  gates.duplicatePassages = scanDuplicatePassages(body);
  gates.playerProse = diagnosePlayerScript(body, { expectedPov: pov });
  gates.unregisteredCharacters = scanUnregisteredCharacterNames(body, characterArchives, truthBible, infoMatrix);
  gates.unauthorizedDiscovery = scanUnauthorizedDiscoveries(body, infoMatrix, matrixRow, actKey, config);
  if (!gates.unauthorizedDiscovery.passed) {
    body = stripUnauthorizedDiscoveries(body, gates.unauthorizedDiscovery.violations);
    gates.unauthorizedDiscovery = scanUnauthorizedDiscoveries(body, infoMatrix, matrixRow, actKey, config);
  }

  if (isKiller && isKillerInnocentMode && actIdx < finalActIndex) {
    gates.guiltStatements = scanGuiltStatements(body);
    gates.killerSpoilers = { passed: true, violations: [] };
  } else if (isKiller && actIdx < finalActIndex) {
    gates.killerSpoilers = scanKillerSpoilers(body, {
      spoilerContract,
      actIndex: actIdx,
      isKiller: true,
      finalActIndex
    });
  } else {
    gates.killerSpoilers = { passed: true, violations: [] };
  }

  const passed =
    gates.forbiddenFacts.passed &&
    gates.internalMarkers.passed &&
    gates.povConsistency.passed &&
    gates.duplicatePassages.passed &&
    gates.playerProse.passed &&
    gates.unregisteredCharacters.passed &&
    gates.unauthorizedDiscovery.passed &&
    (gates.guiltStatements ? gates.guiltStatements.passed : true) &&
    gates.killerSpoilers.passed;

  return { body, gates, passed };
}
