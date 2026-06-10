window.zhimuState = {
  currentUser: null,
  view: "overview",
  voiceRoom: "尚未选择",
  voiceRoomId: null,
  voiceMessages: [],
  voiceLiveStatus: "idle",
  voiceMicEnabled: false,
  voiceParticipants: [],
  cloudPlayer: null,
  cloudHost: [],
  cloudHostPlayers: [],
  cloudHostStuckCount: 0,
  cloudExploration: null,
  cloudHostEvents: [],
  cloudHostClueMatrix: null,
  cloudHostAuditLog: [],
  cloudWorldLogs: [],
  cloudCheckpoints: [],
  cloudRecaps: [],
  cloudRecapLatest: null,
  cloudRecapDetail: null,
  activeRecapId: null,
  cloudStudio: null,
  cloudLoading: true,
  cloudWorlds: [],
  cloudCatalog: [],
  cloudCatalogError: "",
  cloudRules: [],
  cloudCreatorChecks: [],
  studioSelectedNode: null,
  studioAnchorEditing: false,
  studioFilter: "all",
  studioZoom: 1,
  searchFocus: null,
  cluesSearchQuery: "",
  cluesSelectedId: null,
  cluesBulkSelection: [],
  voiceLiveError: "",
  cloudAssets: [],
  assetKindFilter: "",
  assetSearchQuery: "",
  assetShowRecycle: false,
  assetTotal: 0,
  hostEventSelection: [],
  cloudRoomSettings: { hostVoiceListen: false },
  cloudRulesPreview: null,
  storageUsage: null,
  accountView: null,
  accountViewLoading: false,
  apiError: "",
  roomEventsConnected: false,
  wizardStep: 0,
  wizardRoleEditor: null,
  wizardDraft: {
    worldName: "我的长线世界",
    summary: "一个可持续推进的线上调查故事",
    worldMode: "scripted",
    contentSource: "document",
    roleSets: {
      scripted: [
        { name:"记者", goal:"调查真相", publicProfile:"追踪旧港航运记录的记者", privateProfile:"你在寻找父亲失踪前寄出的最后一封信。" },
        { name:"医生", goal:"隐瞒过去", publicProfile:"在雾港经营诊所的医生", privateProfile:"你认得旧档案上被涂去的名字。" },
        { name:"巡警", goal:"保护证人", publicProfile:"负责旧港片区的巡警", privateProfile:"你收到过一份不能公开的证人名单。" }
      ],
      campaign: [
        { name:"调查员", goal:"追查异象", publicProfile:"受邀来到雾港的自由调查员", privateProfile:"你曾在梦中见过这座港口。" },
        { name:"领航员", goal:"绘制路线", publicProfile:"熟悉近海航线的领航员", privateProfile:"你的旧海图上标记着一座不存在的灯塔。" },
        { name:"民俗学者", goal:"解释仪式", publicProfile:"研究沿海传说的民俗学者", privateProfile:"你知道潮落时不能回应谁的呼唤。" }
      ],
      hybrid: [
        { name:"记录者", goal:"整理线索", publicProfile:"负责记录调查进展的编辑", privateProfile:"你收到过来自未来章节的残页。" },
        { name:"守夜人", goal:"维持秩序", publicProfile:"熟悉港区夜路的守夜人", privateProfile:"你保管着一把只能打开一次的钥匙。" },
        { name:"调解人", goal:"连接阵营", publicProfile:"负责协调各方关系的中间人", privateProfile:"你和馆长约定过一个不能公开的交换条件。" }
      ]
    },
    contentSets: {
      scripted: {
        chapterTitle:"序章",
        sectionTitle:"角色序章：抵达现场",
        sectionBody:"夜色落下后，你收到了一封没有署名的来信。信中只有一处地址，以及一句话：请在午夜前抵达。"
      },
      campaign: {
        chapterTitle:"第一次冒险：雾港异象",
        sectionTitle:"开场钩子：失踪的领航员",
        sectionBody:"潮水退去后，码头留下了一艘没有船员的旧艇。你们需要决定先调查航海日志、失踪者住处，还是海图上的异常坐标。"
      },
      hybrid: {
        chapterTitle:"第一阶段：雾中来信",
        sectionTitle:"个人节点：共同调查前夜",
        sectionBody:"公开调查将在午夜开始，但你提前收到了一条只属于自己的消息。它会影响你在第一个开放场景中的选择。"
      }
    },
    automationTemplates: {
      reading: true,
      clue: true,
      chapter: true,
      hint: false
    }
  }
};
export {};
