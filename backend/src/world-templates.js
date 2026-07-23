/**
 * Built-in world skeleton templates for creator onboarding.
 */
import { normalizeNarrativeSettings } from "../../shared/narrative-profile.js";

function templateSettings(worldMode, settings) {
  return normalizeNarrativeSettings({ worldMode, ...settings });
}

const CLASSIC_ROLES = [
  {
    name: "记者",
    goal: "调查真相",
    publicProfile: "追踪旧案线索的记者",
    privateProfile: "你收到过一封没有署名的来信。",
    sectionTitle: "角色序章：抵达现场",
    sectionBody: "夜色落下后，你收到了一封没有署名的来信。信中只有一处地址，以及一句话：请在午夜前抵达。"
  },
  {
    name: "医生",
    goal: "隐瞒过去",
    publicProfile: "在本地经营诊所的医生",
    privateProfile: "你认得档案上被涂去的名字。",
    sectionTitle: "角色序章：抵达现场",
    sectionBody: "诊所打烊后，你仍留在灯下整理病历。门外传来敲门声——比约定时间早了一小时。"
  },
  {
    name: "巡警",
    goal: "保护证人",
    publicProfile: "负责该片区治安的巡警",
    privateProfile: "你收到过一份不能公开的证人名单。",
    sectionTitle: "角色序章：抵达现场",
    sectionBody: "对讲机里传来模糊杂音。你知道今晚的巡逻路线，会把你带到一个不该独自前往的地方。"
  },
  {
    name: "商人",
    goal: "完成交易",
    publicProfile: "往来于港口与内地的商人",
    privateProfile: "你手里握着一份会改变所有人命运的手稿。",
    sectionTitle: "角色序章：抵达现场",
    sectionBody: "货单上的数字对不上。你决定先赴约，再决定要不要把真相说出来。"
  }
];

const INVESTIGATION_ROLES = [
  {
    name: "记录者",
    goal: "整理线索",
    publicProfile: "负责记录调查进展的编辑",
    privateProfile: "你收到过来自未来章节的残页。",
    sectionTitle: "个人节点：共同调查前夜",
    sectionBody: "公开调查将在午夜开始，但你提前收到了一条只属于自己的消息。"
  },
  {
    name: "守夜人",
    goal: "维持秩序",
    publicProfile: "熟悉夜路的守夜人",
    privateProfile: "你保管着一把只能打开一次的钥匙。",
    sectionTitle: "个人节点：共同调查前夜",
    sectionBody: "你巡夜时看见有人从侧门离开，手里提着与你记忆中相同的箱子。"
  },
  {
    name: "调解人",
    goal: "连接阵营",
    publicProfile: "负责协调各方关系的中间人",
    privateProfile: "你和对方约定过一个不能公开的交换条件。",
    sectionTitle: "个人节点：共同调查前夜",
    sectionBody: "各方都信任你，但没有人知道你真正站在哪一边。"
  },
  {
    name: "技术员",
    goal: "还原证据",
    publicProfile: "负责设备与取证的技师",
    privateProfile: "你在备份里发现了被删除的监控片段。",
    sectionTitle: "个人节点：共同调查前夜",
    sectionBody: "硬盘上的时间戳被人为改写过。你知道这不是系统故障。"
  },
  {
    name: "联络员",
    goal: "传递消息",
    publicProfile: "负责对外联络的后勤",
    privateProfile: "你掌握一条只有你能打通的紧急线路。",
    sectionTitle: "个人节点：共同调查前夜",
    sectionBody: "电话铃响时，你犹豫了三秒才接起——因为来电显示本不该存在。"
  }
];

const CAMPAIGN_ROLES = [
  {
    name: "调查员",
    goal: "追查异象",
    publicProfile: "受邀前来的自由调查员",
    privateProfile: "你曾在梦中见过这座城镇。",
    sectionTitle: "开场钩子：失踪的向导",
    sectionBody: "潮水退去后，码头留下了一艘没有船员的旧艇。你们需要决定先调查航海日志还是失踪者住处。"
  },
  {
    name: "领航员",
    goal: "绘制路线",
    publicProfile: "熟悉近海航线的领航员",
    privateProfile: "你的旧海图上标记着一座不存在的灯塔。",
    sectionTitle: "开场钩子：失踪的向导",
    sectionBody: "风向变了。你意识到今晚的航线，会经过一片从不在任何官方图纸上出现的水域。"
  },
  {
    name: "民俗学者",
    goal: "解释仪式",
    publicProfile: "研究沿海传说的学者",
    privateProfile: "你知道潮落时不能回应谁的呼唤。",
    sectionTitle: "开场钩子：失踪的向导",
    sectionBody: "当地老人提到的禁忌，与你们即将前往的坐标惊人地重合。"
  }
];

const WORLD_TEMPLATES = [
  {
    id: "classic-script",
    label: "经典剧本杀",
    description: "4 个角色席位、序章分幕、起始场景与线索，适合第一次搭建可跑通的剧本杀房间。",
    playerCountHint: "4 人",
    worldMode: "scripted",
    tags: ["剧本杀", "搜证", "分幕"],
    includes: ["roles", "chapter", "sections", "starter_scene", "starter_clue", "test_room", "automation_rules"],
    defaults: {
      name: "我的剧本杀",
      summary: "经典剧本杀骨架：角色席位、序章分幕、起始场景与线索。",
      settings: templateSettings("scripted", {
        contentSource: "template",
        templateId: "classic-script"
      }),
      chapter: { title: "序章", summary: "故事从这里开始。" },
      roles: CLASSIC_ROLES,
      automationTemplates: { reading: true, clue: true, chapter: true, hint: false },
      includeStarterGraph: true,
      createTestRoom: true
    }
  },
  {
    id: "online-investigation",
    label: "线上调查",
    description: "5 个角色、混合长线结构，含起始场景与可搜证线索，适合悬疑/调查题材。",
    playerCountHint: "4–5 人",
    worldMode: "hybrid",
    tags: ["调查", "悬疑", "长线"],
    includes: ["roles", "chapter", "sections", "starter_scene", "starter_clue", "test_room", "automation_rules"],
    defaults: {
      name: "我的调查故事",
      summary: "线上调查骨架：私人节点、公共场景与线索入口。",
      settings: templateSettings("hybrid", {
        contentSource: "template",
        templateId: "online-investigation"
      }),
      chapter: { title: "第一阶段：来信", summary: "调查从一封匿名消息开始。" },
      roles: INVESTIGATION_ROLES,
      automationTemplates: { reading: true, clue: true, chapter: true, hint: false },
      includeStarterGraph: true,
      createTestRoom: true
    }
  },
  {
    id: "campaign-lite",
    label: "轻量跑团",
    description: "3 个探索角色与开场钩子，保留开放探索空间，适合首场冒险快速开跑。",
    playerCountHint: "3 人",
    worldMode: "campaign",
    tags: ["跑团", "探索", "开放"],
    includes: ["roles", "chapter", "sections", "test_room", "automation_rules"],
    defaults: {
      name: "我的跑团冒险",
      summary: "轻量跑团骨架：开场钩子与测试房，场景与道具可在创作台继续扩展。",
      settings: templateSettings("campaign", {
        contentSource: "template",
        templateId: "campaign-lite"
      }),
      chapter: { title: "第一次冒险", summary: "首场冒险的开场。" },
      roles: CAMPAIGN_ROLES,
      automationTemplates: { reading: true, clue: false, chapter: true, hint: false },
      includeStarterGraph: false,
      createTestRoom: true
    }
  }
];

function mergePayload(base, overrides = {}) {
  const next = { ...base, ...overrides };
  if (overrides.settings) {
    next.settings = { ...base.settings, ...overrides.settings };
  }
  if (overrides.chapter) {
    next.chapter = { ...base.chapter, ...overrides.chapter };
  }
  if (overrides.automationTemplates) {
    next.automationTemplates = { ...base.automationTemplates, ...overrides.automationTemplates };
  }
  if (Array.isArray(overrides.roles)) {
    next.roles = overrides.roles;
  }
  return next;
}

export function listWorldTemplates() {
  return WORLD_TEMPLATES.map(({ id, label, description, playerCountHint, worldMode, tags, includes, defaults }) => ({
    id,
    label,
    description,
    playerCountHint,
    worldMode,
    tags,
    includes,
    narrativeProfile: defaults.settings.narrativeProfile
  }));
}

export function getWorldTemplate(templateId) {
  return WORLD_TEMPLATES.find((item) => item.id === templateId) ?? null;
}

export function buildBootstrapPayloadFromTemplate(templateId, overrides = {}) {
  const template = getWorldTemplate(templateId);
  if (!template) return null;
  return mergePayload(template.defaults, overrides);
}
