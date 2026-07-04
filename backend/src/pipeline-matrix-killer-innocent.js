/**
 * Killer script — innocent channel + rule-based contradiction injection.
 */
import { cleanText } from "./prompts/shared.js";

const ALIBI_TEMPLATES = {
  ch1: "本幕按登岛理由正常工作，只观察声响、气味、他人表情等表层异常，不追究根因。",
  ch2: "本幕参与讨论与搜检，对争议给出表面合理解释，不主动深挖他人秘密。",
  default: "保持配合调查，记忆与情绪与前幕衔接。"
};

export function buildInnocentAlibiBrief({ characterArchive, matrixRow, actKey, actIndex }) {
  const tasks = (matrixRow?.tasks || []).slice(0, 3);
  const lies = (matrixRow?.lies || characterArchive?.lies || []).slice(0, 3);
  return {
    actKey,
    actIndex,
    mode: "innocent_witness",
    publicAlibi: cleanText(characterArchive?.publicIdentity, 200),
    scheduledActions: tasks,
    outwardClaims: lies.length ? lies : ["按本幕任务行事，对疑点保持中性态度"],
    narrativeTemplate: ALIBI_TEMPLATES[actKey] || ALIBI_TEMPLATES.default,
    hardRules: [
      "你**不是凶手**，也**不知道**谁是凶手。",
      "禁止内心认罪、禁止「必须隐瞒杀人/走私/机关」式独白。",
      "禁止写穿 spoilerContract.forbiddenFacts。",
      "可写与死者/他人的争执，但只写情绪与对话，不写导致死亡的动作。",
      "对他人只写可观察行为，禁止全知。"
    ]
  };
}

const CONTRADICTION_RULES = [
  {
    test: /我(?:一直|始终|整个晚上都)在电台室/,
    replace: "我大部分时间在电台室整理设备，中间出去过一两趟，日志上只记了「信号异常」"
  },
  {
    test: /从未(?:碰过|使用过|去过)细线/,
    replace: "细线这种东西我很少碰，灯塔上常见的是缆绳和扎带"
  },
  {
    test: /从未(?:碰过|操作过)旋转机构/,
    replace: "旋转机构我只在例行检修时碰过，不算熟悉"
  },
  {
    test: /护目镜(?:一直|还)戴(?:着|好)/,
    replace: "护目镜应该在抽屉里——你下意识摸了摸鼻梁，那里有一道浅浅的压痕"
  },
  {
    test: /把(?:电台|设备)(?:修好了|恢复正常)/,
    replace: "我摆弄了几下电台，日志上只写了「信号异常，待复查」"
  },
  {
    test: /我(?:没有|没)(?:去|上)(?:过)?灯室/,
    replace: "灯室我只在例行巡检时待过一会儿，说不上整晚都在那儿"
  }
];

const TELL_INSERTIONS = [
  {
    anchor: /护目镜/,
    tell: "你指尖在镜框边缘停了一瞬——那里有一道新鲜划痕，与你说法里的「一直收好」不太一致。",
    skipIf: /压痕|划痕|不一致/
  },
  {
    anchor: /细线/,
    tell: "你说话时目光短暂飘向门闩方向，又很快收回。",
    skipIf: /门闩|飘向/
  }
];

export function injectKillerContradictions(body, { matrixRow, actIndex, maxInjections = 3 } = {}) {
  let text = cleanText(body, 12000);
  const injections = [];
  let applied = 0;

  for (const rule of CONTRADICTION_RULES) {
    if (applied >= maxInjections) break;
    if (rule.test.test(text)) {
      text = text.replace(rule.test, rule.replace);
      injections.push(`rule:${rule.test.source.slice(0, 24)}`);
      applied++;
    }
  }

  for (const item of TELL_INSERTIONS) {
    if (applied >= maxInjections) break;
    if (!item.anchor.test(text)) continue;
    if (item.skipIf?.test(text)) continue;
    text = text.replace(item.anchor, (m) => `${m}。${item.tell}`);
    injections.push(`tell:${item.tell.slice(0, 20)}`);
    applied++;
  }

  if (actIndex === 1 && applied < maxInjections && !/日志/.test(text)) {
    text += "\n\n你补记检修日志时，发现有一行时间与你的记忆对不上——你没有改它，只是把笔放下了。";
    injections.push("append:log_time_mismatch");
  }

  return { body: text, injections };
}
