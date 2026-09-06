/**
 * P9.4 calibration fixtures — GOOD / MEDIOCRE / BROKEN CompleteScriptPackage shells.
 * Structure is intentionally similar; prose & hints create the quality delta.
 */

import { normalizeCompleteScriptPackage } from "./complete-script-package-contracts.js";

const STAGES = [
  { id: "act1", order: 1, title: "登站", stageRole: "SETUP" },
  { id: "act2", order: 2, title: "竞价", stageRole: "ESCALATION" },
  { id: "act3", order: 3, title: "回收", stageRole: "PAYOFF" },
];

const ROLES = [
  { id: "role_shen", name: "沈岚", type: "PLAYER", characterId: "char_shen", playerAssignable: true },
  { id: "role_liang", name: "梁赫", type: "PLAYER", characterId: "char_liang", playerAssignable: true },
  { id: "role_bai", name: "白绫", type: "PLAYER", characterId: "char_bai", playerAssignable: true },
  { id: "role_host", name: "主持", type: "HOST", playerAssignable: false },
];

function baseMeta(tier, title) {
  return {
    version: 1,
    id: `csp-quality-${tier.toLowerCase()}`,
    projectId: "p94-calibration",
    status: "READY_FOR_REVIEW",
    metadata: { title, revision: 1, premiseSummary: "赫利俄斯站权限竞价案校准样本" },
    roles: ROLES,
    stages: STAGES,
    permissions: [{ id: "catalog_preview_access", label: "密封目录预览" }],
    mechanismAnnotations: [{ id: "m03_bid", mechanismId: "M03", stageId: "act2" }],
    revision: 1,
  };
}

function withHints(pkg, hints) {
  return { ...pkg, qualityHints: hints };
}

export function buildGoodQualityPackage() {
  return withHints(
    normalizeCompleteScriptPackage({
    ...baseMeta("GOOD", "GOOD · 赫利俄斯站可玩样本"),
    hostScript: {
      documentId: "doc_host",
      sections: [
        {
          id: "host_act1",
          stageId: "act1",
          title: "主持·登站",
          paragraphs: [
            "本幕目的：让玩家熟悉舰员身份认证日志与权限档案终端，不要解释真凶。",
            "开场主持词：灯光只留终端一角。提醒玩家核对各自腕带编号。",
            "线索何时可发：当有人主动检查配电箱封条后再发「封条残片」。",
            "观察：谁先回避「22:14」这个时间。不可泄露后台真相：真凶是梁赫。",
            "推进下一幕条件：三名玩家都读过公共简介，且至少一人提到认证日志。",
          ],
        },
        {
          id: "host_act2",
          stageId: "act2",
          title: "主持·竞价",
          paragraphs: [
            "本幕目的：启动一次最高价竞价；规则真值 winnerCount=1。",
            "为什么启动：密封目录只能给一个人提前看，争夺会撕开关系。",
            "启动说明：拍卖师关掉大厅的灯，只留下照着密封目录的台灯。",
            "结算：最高价者获得 catalog_preview_access；其他人记住谁抢走了资格。",
            "如果玩家提前猜到梁赫——不要确认，引导他们用目录权限去证伪。",
            "发线索：竞价结束后按胜者发放「目录残页」。推进下一幕前记录结算后果。",
          ],
        },
        {
          id: "host_act3",
          stageId: "act3",
          title: "主持·回收",
          paragraphs: [
            "本幕目的：回收「两封没有寄出的信」与目录权限的关系。",
            "后台真相备注：真凶是梁赫；信件证明他改过认证日志。",
            "推进：公开决定性线索后进入终局。观察玩家是否重新理解第一幕的封条。",
          ],
        },
      ],
    },
    roleScripts: {
      role_shen: [
        {
          id: "shen_act1",
          stageId: "act1",
          title: "沈岚·登站",
          paragraphs: [
            "你是沈岚，舱段调度。配电箱的封条是你昨晚亲手贴上的，现在封条裂了。",
            "你记得梁赫关门前看你的眼神，但你不知道他改过什么。",
            "本幕目标：在别人发现之前，确认谁动过权限档案终端。",
          ],
        },
        {
          id: "shen_act2",
          stageId: "act2",
          title: "沈岚·竞价",
          paragraphs: [
            "你必须在第二轮竞价前确认梁赫有没有看过那份目录。",
            "如果他已经看过，你宁愿让目录落到白绫手里，也不能让他再拿到第二份证物。",
            "你把「22:14」念错一分钟，然后看向梁赫——他若纠正你，你就知道他当晚在场。",
          ],
        },
        {
          id: "shen_act3",
          stageId: "act3",
          title: "沈岚·回收",
          paragraphs: [
            "竞价结果改变了你的策略：你现在要追的不是「谁进过档案室」，而是谁用目录掩盖了信件。",
            "两封没有寄出的信若公开，你的调度权限也会被审查——你得决定是否先撕毁复本。",
          ],
        },
      ],
      role_liang: [
        {
          id: "liang_act1",
          stageId: "act1",
          title: "梁赫·登站",
          paragraphs: [
            "你是梁赫，安保值班主任。你怕封条裂口被沈岚当成把柄。",
            "你掌握别人不知道的东西：你改过舰员身份认证日志里 22:14 的一条记录。",
            "本幕目标：把话题引向「外部入侵」，别让人盯住认证日志。",
          ],
        },
        {
          id: "liang_act2",
          stageId: "act2",
          title: "梁赫·竞价",
          paragraphs: [
            "目录预览权对你不是荣誉，是灭口工具。你必须拿下最高价。",
            "若沈岚出价凶猛，你可以暗示白绫：沈岚昨晚单独待过配电箱。",
            "你不会长篇解释自己的委屈；你只问一句：「谁授权你查我的舱段？」",
          ],
        },
        {
          id: "liang_act3",
          stageId: "act3",
          title: "梁赫·回收",
          paragraphs: [
            "结算后大家都记得你是否抢走了资格。若你输了，就改用两封没有寄出的信做交换。",
            "你的新目标：阻止信件被宣读，哪怕承认部分篡改。",
          ],
        },
      ],
      role_bai: [
        {
          id: "bai_act1",
          stageId: "act1",
          title: "白绫·登站",
          paragraphs: [
            "你是白绫，站内审计。你说话短，爱反问。",
            "「谁最后碰过终端？」——你只丢问题，不补情绪注解。",
            "本幕目标：收集时间证词冲突，不急着站队。",
          ],
        },
        {
          id: "bai_act2",
          stageId: "act2",
          title: "白绫·竞价",
          paragraphs: [
            "你不一定要赢竞价；你要看谁不惜成本。",
            "若梁赫拿下目录，你就去核对权限档案终端的访问差——机会成本是你放弃当场指控。",
            "对沈岚你称呼「调度」；对梁赫你只说「值班主任」。",
          ],
        },
        {
          id: "bai_act3",
          stageId: "act3",
          title: "白绫·回收",
          paragraphs: [
            "旧判断不再成立：三个人进过档案室，但只有一人的身份记录是伪造的。",
            "你要把两封没有寄出的信和目录权限放在同一张时间线上。",
          ],
        },
      ],
    },
    publicScripts: [
      {
        id: "pub_act1",
        stageId: "act1",
        title: "公共·登站",
        paragraphs: [
          "赫利俄斯站第三舱段的权限档案终端亮着冷光。舰员身份认证日志在滚动。",
          "有人发现配电箱封条裂了。",
        ],
      },
      {
        id: "pub_act2",
        stageId: "act2",
        title: "公共·竞价",
        paragraphs: [
          "拍卖师关掉大厅的灯，只留下一盏照着密封目录的台灯。",
          "「完整目录只有一个人能提前看。想要资格，就拿出筹码。」规则：最高价者一人获得预览权。",
        ],
      },
      {
        id: "pub_act3",
        stageId: "act3",
        title: "公共·回收",
        paragraphs: ["站广播要求所有人回到观测廊。两封没有寄出的信被放上长桌。"],
      },
    ],
    clues: [
      {
        id: "clue_seal",
        title: "封条残片",
        stageId: "act1",
        paragraphs: ["透明胶带边缘有指甲掐痕。内侧铅笔字：22:14。"],
        supportsFact: "有人在 22:14 前后动过配电箱",
        isMisleading: false,
        isDecisive: false,
      },
      {
        id: "clue_log",
        title: "舰员身份认证日志节选",
        stageId: "act1",
        paragraphs: ["22:14 条目显示梁赫刷入，随后被标记为「校正」。"],
        supportsFact: "梁赫时段记录曾被改动",
        isMisleading: true,
        isDecisive: false,
      },
      {
        id: "clue_catalog",
        title: "目录残页",
        stageId: "act2",
        paragraphs: ["残页写着：预览权持有者可核对「未寄出信件」索引。"],
        supportsFact: "目录权限通向信件索引",
        isMisleading: false,
        isDecisive: false,
        permissionId: "catalog_preview_access",
      },
      {
        id: "clue_letters",
        title: "两封没有寄出的信",
        stageId: "act3",
        paragraphs: ["第一封指责篡改认证日志；第二封未署名，要求销毁目录副本。"],
        supportsFact: "梁赫篡改认证日志",
        isMisleading: false,
        isDecisive: true,
      },
    ],
    endingContent: {
      finalStageId: "act3",
      resolutionMode: "MIXED",
      sections: [
        {
          id: "ending_main",
          stageId: "act3",
          title: "终局",
          paragraphs: [
            "揭晓：真凶是梁赫。他改过舰员身份认证日志，又争夺目录预览权掩盖两封没有寄出的信。",
            "沈岚在竞价中的选择决定了信件能否被公开；白绫把旧线索重新理解成时间线矛盾。",
            "兑现：封条、目录与信件落到同一条因果上——谁有资格决定别人知道什么。",
          ],
        },
      ],
    },
  }),
    {
      tier: "GOOD",
      hasGame: true,
      truthCulpritId: "梁赫",
      gameRuntimeTruth: { winnerCount: 1, resolution: "HIGHEST_BID" },
    },
  );
}

export function buildMediocreQualityPackage() {
  const sameVoice = (name, stage) => [
    `你是${name}。此刻你感到一种巨大的压力，这件事情可能改变一切。`,
    "你希望调查真相。事情恐怕没有我们想象中那么简单。",
    "气氛愈发紧张。真相逐渐浮出水面。这让你意识到，他一定还有秘密，而这个秘密可能和案情有关。",
    `本幕你的目标：确认真相（${stage}）。`,
  ];

  return withHints(
    normalizeCompleteScriptPackage({
    ...baseMeta("MEDIOCRE", "MEDIOCRE · 结构正确的 AI 腔样本"),
    hostScript: {
      documentId: "doc_host",
      sections: STAGES.map((st) => ({
        id: `host_${st.id}`,
        stageId: st.id,
        title: `主持·${st.title}`,
        paragraphs: [
          `本幕目的：推进剧情。发线索：按需发放。推进下一幕：走完流程即可。`,
          "观察玩家反应。后台真相：真凶是梁赫。启动玩法：走完竞价流程按钮。",
          "结算后继续。不可泄露额外内容。气氛愈发紧张。",
        ],
      })),
    },
    roleScripts: {
      role_shen: STAGES.map((st) => ({
        id: `shen_${st.id}`,
        stageId: st.id,
        title: `沈岚·${st.title}`,
        paragraphs: sameVoice("沈岚", st.id),
      })),
      role_liang: STAGES.map((st) => ({
        id: `liang_${st.id}`,
        stageId: st.id,
        title: `梁赫·${st.title}`,
        paragraphs: sameVoice("梁赫", st.id),
      })),
      role_bai: STAGES.map((st) => ({
        id: `bai_${st.id}`,
        stageId: st.id,
        title: `白绫·${st.title}`,
        paragraphs: sameVoice("白绫", st.id),
      })),
    },
    publicScripts: STAGES.map((st) => ({
      id: `pub_${st.id}`,
      stageId: st.id,
      title: `公共·${st.title}`,
      paragraphs: [
        "关键场所里，大家讨论关键线索。权限档案终端只是换了个名字的办公室系统。",
        "开会讨论后提交报告。事情远没有那么简单。更大的秘密即将出现。",
        st.id === "act2" ? "开始竞价。走完流程即可。最高价者获得资格。" : "气氛凝固。",
      ],
    })),
    clues: [
      {
        id: "clue_a",
        title: "关键记录",
        stageId: "act1",
        paragraphs: ["【线索】该线索支持：某人有嫌疑。"],
        supportsFact: "赵某有嫌疑",
      },
      {
        id: "clue_b",
        title: "关键场所备注",
        stageId: "act2",
        paragraphs: ["【线索】该线索支持：某人行为可疑。"],
        supportsFact: "赵某行为可疑",
        isMisleading: true,
      },
      {
        id: "clue_c",
        title: "关键权限",
        stageId: "act3",
        paragraphs: ["【线索】该线索支持：有人看到某人。"],
        supportsFact: "有人看到赵某",
        isDecisive: true,
      },
    ],
    endingContent: {
      finalStageId: "act3",
      resolutionMode: "MIXED",
      sections: [
        {
          id: "ending_main",
          stageId: "act3",
          title: "终局",
          paragraphs: [
            "主持宣布真凶。真凶是梁赫。这意味着一切都有了答案。",
            "把 TruthView 念出来。复杂的情绪涌上心头。",
          ],
        },
      ],
    },
  }),
    {
      tier: "MEDIOCRE",
      hasGame: true,
      truthCulpritId: "梁赫",
      gameRuntimeTruth: { winnerCount: 1, resolution: "HIGHEST_BID" },
    },
  );
}

export function buildBrokenQualityPackage() {
  return withHints(
    normalizeCompleteScriptPackage({
    ...baseMeta("BROKEN", "BROKEN · 硬阻断样本"),
    hostScript: {
      documentId: "doc_host",
      sections: [
        {
          id: "host_act1",
          stageId: "act1",
          title: "主持·残缺",
          paragraphs: [
            "剧情很精彩。真凶是梁赫。",
            "NEEDS_DETAIL：此处待补主持流程。",
            "本幕必须启动竞价。",
          ],
        },
        {
          id: "host_act2",
          stageId: "act2",
          title: "主持·规则写错",
          paragraphs: [
            "告诉玩家：前两名都可以查看完整目录。",
            "{ctx.stationName} 的气氛愈发紧张。",
          ],
        },
        {
          id: "host_act3",
          stageId: "act3",
          title: "主持·三",
          paragraphs: ["继续。"],
        },
      ],
    },
    roleScripts: {
      role_shen: STAGES.map((st) => ({
        id: `shen_${st.id}`,
        stageId: st.id,
        title: `沈岚·${st.title}`,
        paragraphs: [
          "你只需要听别人说，等待真相。没有行动。",
          st.id === "act1" ? "【他人秘密】梁赫才是改日志的人。HOST_ONLY_TRUTH: 梁赫作案。" : "等待主持公布。",
          "两封没有寄出的信被提起，但你什么都做不了。",
        ],
      })),
      role_liang: STAGES.map((st) => ({
        id: `liang_${st.id}`,
        stageId: st.id,
        title: `梁赫·${st.title}`,
        paragraphs: ["你希望调查真相。等待真相。"],
      })),
      role_bai: STAGES.map((st) => ({
        id: `bai_${st.id}`,
        stageId: st.id,
        title: `白绫·${st.title}`,
        paragraphs: ["你希望调查真相。等待真相。"],
      })),
    },
    publicScripts: [
      {
        id: "pub_act2",
        stageId: "act2",
        title: "公共",
        paragraphs: ["前两名都可以获得预览权。两人都获得奖励。"],
      },
    ],
    clues: [
      {
        id: "clue_x",
        title: "空线索",
        stageId: "act1",
        paragraphs: [],
        supportsFact: "无",
      },
    ],
    endingContent: {
      finalStageId: "act3",
      resolutionMode: "MIXED",
      sections: [
        {
          id: "ending_main",
          stageId: "act3",
          title: "终局",
          paragraphs: [
            "揭晓：真凶是沈岚。关键结论缺少证据，依赖从未出现的证据。",
            "正解还需要玩家无法合理获得的信息。",
            "CANON_CONTRADICTION_MARKER",
          ],
        },
      ],
    },
  }),
    {
      tier: "BROKEN",
      hasGame: true,
      truthCulpritId: "梁赫",
      gameRuntimeTruth: { winnerCount: 1, resolution: "HIGHEST_BID" },
      forbiddenFactsByRole: {
        role_shen: ["梁赫才是改日志的人"],
      },
      requiredPayoffTokens: ["两封没有寄出的信"],
    },
  );
}
