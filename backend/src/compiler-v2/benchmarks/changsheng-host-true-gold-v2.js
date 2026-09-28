/**
 * 长生叹 Host TRUE Gold V2 — claim + sourceRefs（人工锚定）
 *
 * V1 仅靠关键词，假命中严重。V2 要求：
 * - requiredClaims：可判定的事实组（anyOf 内全中）
 * - sourceRefs：原文区域；与候选 sourceSectionIds 无交集 → 不得判 HIT
 *
 * 判定档位由 gold-scorer-v2.js 产出：HIT | PARTIAL | MISS | FALSE_MATCH
 */

/** @typedef {{ id: string, label: string, anyOf: string[][] }} GoldClaim */

/**
 * @typedef {object} GoldEventV2
 * @property {string} id
 * @property {string} title
 * @property {"EVENT"|"PROCESS"|"DECISION"|"REVEAL"|"BRANCH"} nodeType
 * @property {GoldClaim[]} requiredClaims
 * @property {GoldClaim[]} [optionalClaims]
 * @property {string[]} sourceRefs
 * @property {string[]} [notes]
 */

/** @type {GoldEventV2[]} */
export const CHANGSHENG_HOST_TRUE_GOLD_V2 = [
  {
    id: "G01",
    title: "开场：众人于墓室苏醒/失忆困局",
    nodeType: "EVENT",
    sourceRefs: ["src_8242083ac35d4313"],
    requiredClaims: [
      {
        id: "wake_in_tomb",
        label: "众人在墓室苏醒/睁开眼",
        anyOf: [
          ["墓室", "睁开"],
          ["墓室", "苏醒"],
          ["墓室", "醒来"],
          ["晕倒", "睁开", "墓室"]
        ]
      },
      {
        id: "amnesia",
        label: "失忆/想不起来",
        anyOf: [["失忆"], ["想不起来"], ["什么也想不起来"], ["瘴气"]]
      }
    ],
    notes: ["开篇小剧场；勿匹配远史/结局仪式"]
  },
  {
    id: "G02",
    title: "陶老板之死 / 吊灯案发",
    nodeType: "EVENT",
    sourceRefs: ["src_85fcf1bf58c741d7", "src_d757681be82c41d3", "src_d0b35b78b7604484"],
    requiredClaims: [
      {
        id: "chandelier",
        label: "吊灯砸向陶老板/舞台",
        anyOf: [
          ["吊灯", "砸"],
          ["吊灯", "陶老板"],
          ["玻璃吊灯"]
        ]
      },
      {
        id: "tao_dead",
        label: "陶老板死亡/命案",
        anyOf: [
          ["陶老板", "死"],
          ["陶老板", "杀害"],
          ["杀死陶老板"],
          ["拍卖会", "命案"]
        ]
      }
    ]
  },
  {
    id: "G03",
    title: "搜证与投凶推进",
    nodeType: "PROCESS",
    sourceRefs: ["src_40446d1c175846be", "src_7c80c1b245e44719", "src_d506376a40b142dc"],
    requiredClaims: [
      {
        id: "search_or_vote",
        label: "搜证/取证或投凶环节",
        anyOf: [
          ["搜证"],
          ["取证"],
          ["投凶"],
          ["公共线索"]
        ]
      }
    ],
    optionalClaims: [
      {
        id: "both",
        label: "搜证与投凶同时出现",
        anyOf: [["搜证", "投凶"], ["取证", "投凶"]]
      }
    ]
  },
  {
    id: "G04",
    title: "发现刘警探尸体 / 深入主墓室",
    nodeType: "EVENT",
    sourceRefs: ["src_d1527d793f36434d", "src_85fcf1bf58c741d7"],
    requiredClaims: [
      {
        id: "main_tomb_or_liu",
        label: "主墓室探索或刘警探相关",
        anyOf: [
          ["主墓室"],
          ["刘警探"],
          ["警探", "尸体"],
          ["警探", "聚集"]
        ]
      }
    ],
    notes: ["完整 HIT 需同时覆盖警探线与主墓室时可用 optional；V2 先要求至少一条"]
  },
  {
    id: "G05",
    title: "第二幕：主墓室探索开始",
    nodeType: "EVENT",
    sourceRefs: ["src_d1527d793f36434d", "src_d506376a40b142dc"],
    requiredClaims: [
      {
        id: "act2_explore",
        label: "第二幕探索/查探墓室",
        anyOf: [
          ["探索", "墓室"],
          ["主墓室"],
          ["第二幕", "探索"],
          ["一同探索"],
          ["四处查探"]
        ]
      }
    ],
    notes: ["原「真相浮现」过抽象，已收窄为可判定的第二幕探索节点"]
  },
  {
    id: "G06",
    title: "婴儿啼哭 / 晕倒危机",
    nodeType: "EVENT",
    sourceRefs: ["src_51dd9e5b815f4f91"],
    requiredClaims: [
      {
        id: "cry",
        label: "婴儿啼哭声再次出现",
        anyOf: [["啼哭"], ["婴儿", "哭"], ["婴儿般的啼哭"]]
      },
      {
        id: "crisis",
        label: "意识被夺/头痛/晕倒危机",
        anyOf: [
          ["意识", "夺"],
          ["头好痛"],
          ["晕倒"],
          ["招魂"],
          ["危机"]
        ]
      }
    ],
    notes: ["仅「询问晕倒前声音」而无啼哭危机 → PARTIAL"]
  },
  {
    id: "G07",
    title: "第三幕身份揭示（小剧场）",
    nodeType: "REVEAL",
    sourceRefs: ["src_4d32c81f06b34f75", "src_3d4973b80163409c"],
    requiredClaims: [
      {
        id: "identity_reveal",
        label: "身份/前世或面具相关揭示",
        anyOf: [
          ["人皮面具"],
          ["揭下", "面具"],
          ["傅月生"],
          ["我又究竟是谁"],
          ["先祖"]
        ]
      }
    ]
  },
  {
    id: "G08",
    title: "杨峥人皮面具 / 傅月生点名",
    nodeType: "REVEAL",
    sourceRefs: ["src_4d32c81f06b34f75"],
    requiredClaims: [
      {
        id: "mask",
        label: "杨峥揭下人皮面具",
        anyOf: [
          ["杨峥", "人皮面具"],
          ["杨峥", "面具"],
          ["揭下", "人皮面具"],
          ["揭下了自己的人皮面具"]
        ]
      },
      {
        id: "fuyuesheng",
        label: "点名傅月生/顾怀辰即傅月生",
        anyOf: [
          ["傅月生"],
          ["顾怀辰", "傅月生"],
          ["叫你傅月生"]
        ]
      }
    ],
    notes: ["勿匹配「白初揭露顾怀辰」若无面具+傅月生双 claim"]
  },
  {
    id: "G09",
    title: "长生水真相（公聊/揭示）",
    nodeType: "REVEAL",
    sourceRefs: ["src_4d32c81f06b34f75", "src_51dd9e5b815f4f91", "src_a2e087bd063a4194"],
    requiredClaims: [
      {
        id: "water",
        label: "长生水",
        anyOf: [["长生水"]]
      },
      {
        id: "truth",
        label: "真相/由来/秘密被揭示",
        anyOf: [["真相"], ["由来"], ["秘密"], ["揭示"], ["窃取", "寿命"]]
      }
    ]
  },
  {
    id: "G10",
    title: "阵法启动（局内抉择规则）",
    nodeType: "PROCESS",
    sourceRefs: ["src_49fe822720af4a96", "src_85fcf1bf58c741d7"],
    requiredClaims: [
      {
        id: "array_start",
        label: "阵法已经启动",
        anyOf: [
          ["阵法已经启动"],
          ["阵法", "启动"],
          ["制造的阵法"]
        ]
      }
    ],
    notes: ["结局对峙场景含「阵法」但非规则启动 → 应靠 sourceRefs 挡掉"]
  },
  {
    id: "G11",
    title: "生门/死门抉择规则",
    nodeType: "DECISION",
    sourceRefs: ["src_49fe822720af4a96"],
    requiredClaims: [
      {
        id: "gates",
        label: "生门与死门对应规则",
        anyOf: [
          ["生门", "死门"],
          ["死门", "生门"],
          ["抉择的规则"]
        ]
      }
    ]
  },
  {
    id: "G12",
    title: "结局分支框架",
    nodeType: "BRANCH",
    sourceRefs: ["src_1882149f984f477e"],
    requiredClaims: [
      {
        id: "ending_framework",
        label: "结局按抉择分支触发",
        anyOf: [
          ["结局", "分支"],
          ["抉择", "结局"],
          ["不同的结局"],
          ["结局部分"]
        ]
      }
    ]
  },
  {
    id: "G13",
    title: "众人齐聚日月山庄（远因/今日开端）",
    nodeType: "EVENT",
    sourceRefs: ["src_7bb2c185cfa64793", "src_45be44f30e55401b"],
    requiredClaims: [
      {
        id: "gather",
        label: "众人来到/齐聚日月山庄",
        anyOf: [
          ["来到了日月山庄"],
          ["出现在日月山庄"],
          ["齐聚", "日月山庄"],
          ["日月山庄", "开启了我们今天的故事"]
        ]
      }
    ],
    notes: ["勿匹配结局「顾怀辰生陶梦芸死」"]
  },
  {
    id: "G14",
    title: "长生水远史/炼制关键节点",
    nodeType: "EVENT",
    sourceRefs: ["src_a2e087bd063a4194", "src_7671ba07c61f4a23"],
    requiredClaims: [
      {
        id: "refine",
        label: "炼制长生水",
        anyOf: [
          ["炼制", "长生水"],
          ["制造长生水"],
          ["研制", "长生水"]
        ]
      },
      {
        id: "history",
        label: "杨氏/远史节点",
        anyOf: [["杨氏"], ["1419"], ["1416"], ["第二次炼制"], ["第一次炼制"]]
      }
    ]
  }
];
