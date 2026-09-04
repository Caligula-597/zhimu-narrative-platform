/** M01-FRAMING variant/preset data only (engine-agnostic). */

export const M01_FRAMING_TEMPLATE_ID = "M01-FRAMING";
export const M01_FRAMING_MECHANISM_ID = "M01-FRAMING";
export const M01_FRAMING_FAMILY_ID = "M01";

export const M01_FRAMING = Object.freeze({
  id: M01_FRAMING_TEMPLATE_ID,
  familyId: M01_FRAMING_FAMILY_ID,
  mechanismId: M01_FRAMING_MECHANISM_ID,
  title: "嫁祸型追凶",
  purpose: "真凶制造指向他人的假象；玩家先形成错误嫌疑，再被反证推翻并锁定真凶。",
  roleSlots: Object.freeze({
    victim: Object.freeze({ required: true, label: "死者/被害关联", allowNpc: true }),
    culprit: Object.freeze({
      required: true,
      label: "真凶",
      mustDifferFrom: Object.freeze(["victim"]),
      allowNpc: false,
    }),
    framedCharacter: Object.freeze({
      required: true,
      label: "被嫁祸者",
      mustDifferFrom: Object.freeze(["culprit", "victim"]),
      allowNpc: false,
    }),
    discoverer: Object.freeze({
      required: false,
      label: "发现异常者",
      mustDifferFrom: Object.freeze(["culprit"]),
      allowNpc: false,
    }),
  }),
  plotSlots: Object.freeze({
    trueMotive: Object.freeze({ label: "真实动机" }),
    trueMethod: Object.freeze({ label: "真实手法" }),
    plantedEvidence: Object.freeze({ label: "栽赃/误导物" }),
    apparentConclusion: Object.freeze({ label: "第一层错误判断" }),
    contradiction: Object.freeze({ label: "反证" }),
    decisiveEvidence: Object.freeze({ label: "关键突破" }),
    concealmentMethod: Object.freeze({ label: "掩饰方式" }),
  }),
  clueSlots: Object.freeze(["FALSE_LEAD", "CONTRADICTION", "TRUE_EVIDENCE", "DECISIVE_EVIDENCE"]),
  stagePattern: Object.freeze([
    "SETUP",
    "CRIME_DISCOVERY",
    "FALSE_DIRECTION",
    "CONTRADICTION",
    "TRUTH_REVEAL",
  ]),
});

/** 结构形式池：只定义结构，不预写完整剧情。 */
export const M01_FRAMING_VARIANTS = Object.freeze([
  Object.freeze({
    id: "V01",
    name: "伪造凶器",
    summary: "真凶放置假凶器，引导玩家认定被嫁祸者行凶工具。",
    defaults: Object.freeze({
      plantedEvidence: "带血匕首（非致命创口所用）",
      trueMethod: "绳索勒杀",
      contradiction: "致命伤形态与匕首不符",
      decisiveEvidence: "绳痕纤维来自真凶衣物",
      concealmentMethod: "清洗并藏起绳索",
    }),
    beatOutline: Object.freeze({
      setup: "真凶准备假凶器与真实勒杀工具",
      crime: "真凶实施勒杀并留下假凶器",
      falseDirection: "众人认定被嫁祸者持刀行凶",
      contradiction: "致命伤与假凶器矛盾浮现",
      reveal: "纤维与藏匿点锁定真凶",
    }),
  }),
  Object.freeze({
    id: "V02",
    name: "栽赃物品",
    summary: "真凶将被嫁祸者相关物品放入现场，制造其到过现场的假象。",
    defaults: Object.freeze({
      plantedEvidence: "被嫁祸者遗失的玉佩",
      trueMethod: "勒杀",
      contradiction: "玉佩沾有仅库房存在的红蜡",
      decisiveEvidence: "库房钥匙记录证明真凶曾移动该物",
      concealmentMethod: "从库房取出遗失物再放入现场",
    }),
    beatOutline: Object.freeze({
      setup: "真凶取得与被嫁祸者相关的物品",
      crime: "实施犯行并将物品放入现场",
      falseDirection: "玩家第一轮形成对被嫁祸者的错误嫌疑",
      contradiction: "物品出现方式不合理（红蜡等）",
      reveal: "追查物品移动链反向锁定真凶",
    }),
  }),
  Object.freeze({
    id: "V03",
    name: "伪造时间线",
    summary: "真凶篡改或诱导错误时间认知，让被嫁祸者看起来有作案窗。",
    defaults: Object.freeze({
      plantedEvidence: "被拨慢的座钟记录",
      trueMethod: "投毒后离开",
      contradiction: "邻室更鼓时间与座钟不一致",
      decisiveEvidence: "真凶当晚校准过座钟的证词交叉",
      concealmentMethod: "拨动时钟制造时间错位",
    }),
    beatOutline: Object.freeze({
      setup: "真凶制造可被误读的时间标记",
      crime: "在真实时间窗内作案",
      falseDirection: "按错误时间线指向被嫁祸者",
      contradiction: "独立时间源揭穿错位",
      reveal: "谁动过时间标记 → 真凶",
    }),
  }),
  Object.freeze({
    id: "V04",
    name: "借他人行为制造不在场",
    summary: "真凶利用被嫁祸者真实行为片段，拼出虚假完整作案叙事。",
    defaults: Object.freeze({
      plantedEvidence: "被嫁祸者与死者争执的片段目击",
      trueMethod: "争执后由真凶接手致命一击",
      contradiction: "致命伤发生在争执者离开之后",
      decisiveEvidence: "后门脚印尺码不符被嫁祸者",
      concealmentMethod: "只公开争执片段、隐瞒后续",
    }),
    beatOutline: Object.freeze({
      setup: "真凶预知或挑起被嫁祸者与死者冲突",
      crime: "冲突后真凶完成致命行为",
      falseDirection: "众人把争执等同于行凶",
      contradiction: "时间与伤口显示致命在后",
      reveal: "后续进入者足迹指向真凶",
    }),
  }),
  Object.freeze({
    id: "V05",
    name: "移尸改变现场",
    summary: "真凶移动尸体，使现场指向被嫁祸者常出入之处。",
    defaults: Object.freeze({
      plantedEvidence: "尸体出现在被嫁祸者厢房外廊",
      trueMethod: "他处勒杀后移尸",
      contradiction: "尸斑与移尸拖痕方向矛盾",
      decisiveEvidence: "原始现场残留真凶专属香灰",
      concealmentMethod: "移尸并清理原始现场",
    }),
    beatOutline: Object.freeze({
      setup: "真凶选择移尸目的地以嫁祸",
      crime: "他处杀害并搬运尸体",
      falseDirection: "发现地点强化对被嫁祸者怀疑",
      contradiction: "法医学迹象显示尸体被移动",
      reveal: "原始现场残留锁定真凶",
    }),
  }),
  Object.freeze({
    id: "V06",
    name: "伪造死因",
    summary: "真凶伪装成中毒/病死等，实际另有致命方式，并嫁祸擅此道者。",
    defaults: Object.freeze({
      plantedEvidence: "死者床边药瓶（被嫁祸者常用）",
      trueMethod: "机械性窒息",
      contradiction: "胃中无毒物、颈部有隐匿勒痕",
      decisiveEvidence: "袖口细纤维与真凶衣袍匹配",
      concealmentMethod: "摆放药瓶并散播中毒说法",
    }),
    beatOutline: Object.freeze({
      setup: "真凶准备伪造死因道具",
      crime: "以真实手法杀害并摆放假死因证据",
      falseDirection: "表面死因指向被嫁祸者专长",
      contradiction: "检验否定表面死因",
      reveal: "真实手法痕迹指向真凶",
    }),
  }),
  Object.freeze({
    id: "V07",
    name: "冒充他人行动",
    summary: "真凶穿着或模仿被嫁祸者特征出现在关键目击中。",
    defaults: Object.freeze({
      plantedEvidence: "目击「穿被嫁祸者外氅的人」进出",
      trueMethod: "冒充后入室行凶",
      contradiction: "同一时间被嫁祸者另有可证行踪",
      decisiveEvidence: "外氅内侧残留真凶独有熏香",
      concealmentMethod: "盗用外氅制造目击",
    }),
    beatOutline: Object.freeze({
      setup: "真凶取得可冒充的外观特征",
      crime: "以冒充身份接近并杀害",
      falseDirection: "目击将真凶行为记在被嫁祸者头上",
      contradiction: "不在场证明成立",
      reveal: "冒充物证反指真凶",
    }),
  }),
  Object.freeze({
    id: "V08",
    name: "利用既有矛盾嫁祸",
    summary: "放大被嫁祸者与死者的旧怨，使动机看似充足。",
    defaults: Object.freeze({
      plantedEvidence: "公开旧怨信稿副本",
      trueMethod: "投毒",
      contradiction: "信稿墨迹干燥时间早于案发夜",
      decisiveEvidence: "真凶书房同批纸张水印",
      concealmentMethod: "提前复制旧信并在案发后「发现」",
    }),
    beatOutline: Object.freeze({
      setup: "真凶收集并复制旧矛盾材料",
      crime: "作案后抛出旧怨作为动机证据",
      falseDirection: "玩家被强烈动机叙事带走",
      contradiction: "物证时间线对不上",
      reveal: "复制来源指向真凶",
    }),
  }),
  Object.freeze({
    id: "V09",
    name: "故意留下属于他人的物件",
    summary: "真凶故意遗落被嫁祸者所有物，强化「慌乱逃离」叙事。",
    defaults: Object.freeze({
      plantedEvidence: "被嫁祸者私人印章",
      trueMethod: "钝器击打",
      contradiction: "印章印泥颜色与死者书房常用印泥不同",
      decisiveEvidence: "真凶袖中残留同色印泥",
      concealmentMethod: "盗窃印章后故意「遗落」",
    }),
    beatOutline: Object.freeze({
      setup: "真凶窃取被嫁祸者小物件",
      crime: "行凶后故意遗落",
      falseDirection: "遗落物被解读为慌逃证据",
      contradiction: "物件使用痕迹不合理",
      reveal: "转移痕迹锁回真凶",
    }),
  }),
  Object.freeze({
    id: "V10",
    name: "制造假证词",
    summary: "真凶诱导或胁迫证人作出指向被嫁祸者的虚假陈述。",
    defaults: Object.freeze({
      plantedEvidence: "证人称看见被嫁祸者离开现场",
      trueMethod: "室内毒杀",
      contradiction: "证人所述出口当时上锁",
      decisiveEvidence: "证人收受真凶好处的账记",
      concealmentMethod: "买通/胁迫证人",
    }),
    beatOutline: Object.freeze({
      setup: "真凶布置可被假证词支撑的表面叙事",
      crime: "作案并安排假证词",
      falseDirection: "证词巩固错误嫌疑",
      contradiction: "物理条件否定证词",
      reveal: "证词利益链指向真凶",
    }),
  }),
]);

export const M01_PLOT_CANDIDATES = Object.freeze({
  trueMotive: Object.freeze([
    "掩盖十年前的私吞行为",
    "争夺继承权",
    "灭口以免旧案曝光",
    "报复被揭穿的欺瞒",
    "夺取关键信物控制权",
  ]),
  plantedEvidence: Object.freeze([
    "玉佩",
    "账册残页",
    "带血手帕",
    "私人印章",
    "药瓶",
    "钥匙",
    "信件",
  ]),
  trueMethod: Object.freeze(["勒杀", "投毒", "钝器击打", "机械性窒息", "刀刺后伪装"]),
});

export function getM01FramingVariant(variantId) {
  return M01_FRAMING_VARIANTS.find((v) => v.id === String(variantId)) || null;
}

export function listM01FramingVariants() {
  return M01_FRAMING_VARIANTS.map((v) => ({
    id: v.id,
    name: v.name,
    summary: v.summary,
  }));
}
