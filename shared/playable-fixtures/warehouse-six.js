/**
 * P7.0 Complete Script Fixture — 「商会库房案」
 * 已写完的完整剧本（非 AI 母稿）。用于验证 Playable Compiler 合同。
 * 文学性不重要；结构完整最重要。
 */

export const WAREHOUSE_SIX_FIXTURE_ID = "fixture-warehouse-six-v1";
export const WAREHOUSE_SIX_FIXTURE_REVISION = "1.0.0";

export function buildWarehouseSixFixture() {
  const roles = [
    { id: "role_host", name: "主持人", type: "HOST", playerAssignable: false },
    { id: "role_a", name: "沈孤鸿", type: "PLAYER", characterId: "char_a", playerAssignable: true },
    { id: "role_b", name: "陆晚晴", type: "PLAYER", characterId: "char_b", playerAssignable: true },
    { id: "role_c", name: "赵启明", type: "PLAYER", characterId: "char_c", playerAssignable: true },
    { id: "role_d", name: "白素", type: "PLAYER", characterId: "char_d", playerAssignable: true },
    { id: "role_e", name: "周衡", type: "PLAYER", characterId: "char_e", playerAssignable: true },
    { id: "role_f", name: "方砚", type: "PLAYER", characterId: "char_f", playerAssignable: true },
  ];

  const stages = [
    {
      id: "stage_1",
      order: 0,
      title: "第一幕·报案",
      stageRole: "SETUP",
      enterCondition: { type: "HOST_START" },
      exitCondition: { type: "HOST_ADVANCE" },
    },
    {
      id: "stage_2",
      order: 1,
      title: "第二幕·库房争夺",
      stageRole: "PRESSURE",
      enterCondition: { type: "HOST_ADVANCE" },
      exitCondition: { type: "HOST_ADVANCE" },
      mechanismAnnotationIds: ["place_m03_storage"],
    },
    {
      id: "stage_3",
      order: 2,
      title: "第三幕·账册余烬",
      stageRole: "ESCALATION",
      enterCondition: { type: "HOST_ADVANCE" },
      exitCondition: { type: "HOST_ADVANCE" },
    },
    {
      id: "stage_4",
      order: 3,
      title: "第四幕·投票结算",
      stageRole: "PAYOFF",
      enterCondition: { type: "HOST_ADVANCE" },
      exitCondition: { type: "MECHANISM_SETTLED", placementId: "place_m09_final" },
      mechanismAnnotationIds: ["place_m09_final"],
    },
  ];

  const hostScript = {
    documentId: "doc_host_manual",
    sections: [
      {
        id: "host_s1",
        stageId: "stage_1",
        title: "主持·第一幕后台",
        paragraphs: [
          "第一幕开场：宣读公共案情，确认六名玩家就位。",
          "可发放线索：血迹照片。不要提前发放烧毁账册。",
        ],
      },
      {
        id: "host_s2",
        stageId: "stage_2",
        title: "主持·第二幕后台",
        paragraphs: [
          "宣布商会规则：库房只允许一人进入。",
          "启动库房进入资格竞价（M03）。赢家将获得查看烧毁账册的权限。",
        ],
      },
      {
        id: "host_s3",
        stageId: "stage_3",
        title: "主持·第三幕后台",
        paragraphs: ["发放关键线索：库房钥匙残件。确认赢家是否已读私人账册内容。"],
      },
      {
        id: "host_s4",
        stageId: "stage_4",
        title: "主持·终幕后台",
        paragraphs: ["启动最终指凶投票（M09）。按多数票宣读结算。"],
      },
    ],
  };

  const roleScripts = {
    role_a: [
      {
        id: "a_s1",
        stageId: "stage_1",
        title: "沈孤鸿·第一幕",
        paragraphs: ["你是商会书记沈孤鸿。昨夜你在库房门口见过一个模糊身影。", "你需要先弄清昨夜争执的起因。"],
      },
      {
        id: "a_s2",
        stageId: "stage_2",
        title: "沈孤鸿·第二幕",
        paragraphs: ["商会宣布库房只许一人进入。你决定参与争夺进入资格。"],
      },
      {
        id: "a_s2_win",
        stageId: "stage_2",
        title: "沈孤鸿·库房私人（竞价赢家解锁）",
        paragraphs: ["你进入库房，看见半页烧毁的账册残页写着：赵启明经手银两去向不明。"],
        unlockPermissionId: "storage_room_access",
        delivery: "CONDITION_UNLOCK",
      },
      {
        id: "a_s3",
        stageId: "stage_3",
        title: "沈孤鸿·第三幕",
        paragraphs: ["你开始怀疑赵启明。你昨夜在库房门口见过沈孤鸿——不，那是别人看见你。你需要核对时间。"],
      },
      {
        id: "a_s4",
        stageId: "stage_4",
        title: "沈孤鸿·终幕",
        paragraphs: ["最终投票时，你必须根据已掌握的账册与证词作出选择。"],
      },
    ],
    role_b: [
      {
        id: "b_s1",
        stageId: "stage_1",
        title: "陆晚晴·第一幕",
        paragraphs: ["你是账房陆晚晴。死者是你的上司。你隐瞒了账目缺口。"],
      },
      {
        id: "b_s2",
        stageId: "stage_2",
        title: "陆晚晴·第二幕",
        paragraphs: ["你不希望任何人进入库房。你会尽量阻止竞价，或确保赢家不是赵启明。"],
      },
      {
        id: "b_s3",
        stageId: "stage_3",
        title: "陆晚晴·第三幕",
        paragraphs: ["钥匙残件让你不安。你知道库房里还有第二套账。"],
      },
      {
        id: "b_s4",
        stageId: "stage_4",
        title: "陆晚晴·终幕",
        paragraphs: ["你需要在投票中自保，同时把嫌疑推到真正动手的人身上。"],
      },
    ],
    role_c: [
      {
        id: "c_s1",
        stageId: "stage_1",
        title: "赵启明·第一幕",
        paragraphs: ["你是管事赵启明。你昨夜确实去过库房附近，但你坚称只是巡夜。"],
      },
      {
        id: "c_s2",
        stageId: "stage_2",
        title: "赵启明·第二幕",
        paragraphs: ["你必须阻止别人先看到账册。你会全力竞价。"],
      },
      {
        id: "c_s3",
        stageId: "stage_3",
        title: "赵启明·第三幕",
        paragraphs: ["若账册已被人看过，你需要制造新的解释。"],
      },
      {
        id: "c_s4",
        stageId: "stage_4",
        title: "赵启明·终幕",
        paragraphs: ["最终投票关系到你是否被指认为真凶。"],
      },
    ],
    role_d: [
      {
        id: "d_s1",
        stageId: "stage_1",
        title: "白素·第一幕",
        paragraphs: ["你是死者远亲白素。你来商会是为了追问一笔旧债。"],
      },
      {
        id: "d_s2",
        stageId: "stage_2",
        title: "白素·第二幕",
        paragraphs: ["你对库房兴趣不大，但你会观察谁最急着进去。"],
      },
      {
        id: "d_s3",
        stageId: "stage_3",
        title: "白素·第三幕",
        paragraphs: ["你发现钥匙残件上的纹样与你家旧物相似。"],
      },
      {
        id: "d_s4",
        stageId: "stage_4",
        title: "白素·终幕",
        paragraphs: ["你掌握的旧债信息可能改写票型。"],
      },
    ],
    role_e: [
      {
        id: "e_s1",
        stageId: "stage_1",
        title: "周衡·第一幕",
        paragraphs: ["你是更夫周衡。你作证看见沈孤鸿在库房门口停留。"],
      },
      {
        id: "e_s2",
        stageId: "stage_2",
        title: "周衡·第二幕",
        paragraphs: ["你不敢进库房，但你愿意把证词卖个好价钱。"],
      },
      {
        id: "e_s3",
        stageId: "stage_3",
        title: "周衡·第三幕",
        paragraphs: ["你开始怀疑自己认错了人。"],
      },
      {
        id: "e_s4",
        stageId: "stage_4",
        title: "周衡·终幕",
        paragraphs: ["你的票可能决定沈孤鸿的命运。"],
      },
    ],
    role_f: [
      {
        id: "f_s1",
        stageId: "stage_1",
        title: "方砚·第一幕",
        paragraphs: ["你是外聘师爷方砚。你与死者有秘密通信。"],
      },
      {
        id: "f_s2",
        stageId: "stage_2",
        title: "方砚·第二幕",
        paragraphs: ["你想进库房找那封信，但也不想暴露通信。"],
      },
      {
        id: "f_s3",
        stageId: "stage_3",
        title: "方砚·第三幕",
        paragraphs: ["钥匙残件不是你要的东西，你仍需要那封信。"],
      },
      {
        id: "f_s4",
        stageId: "stage_4",
        title: "方砚·终幕",
        paragraphs: ["你可以选择公开通信内容，或沉默投票。"],
      },
    ],
  };

  // Shared A+B content
  const sharedScripts = [
    {
      id: "ab_shared_s1",
      stageId: "stage_1",
      roleIds: ["role_a", "role_b"],
      title: "沈孤鸿与陆晚晴·共享记忆",
      paragraphs: ["你们昨夜在账房短暂交谈过，约定天亮后再对账。"],
    },
  ];

  const publicScripts = [
    {
      id: "public_s1",
      stageId: "stage_1",
      title: "公共案情",
      paragraphs: [
        "商会管事昨夜死于库房外侧走廊。现场有血迹。商会宣布即日起调查。",
      ],
    },
    {
      id: "public_s2",
      stageId: "stage_2",
      title: "公共规则·库房",
      paragraphs: ["商会只允许一人进入库房。进入资格将通过竞价决定。"],
    },
    {
      id: "public_s4_result",
      stageId: "stage_4",
      title: "最终指认结果",
      type: "REVEAL",
      delivery: "CONDITION_UNLOCK",
      unlockPermissionId: "ending_reveal_access",
      paragraphs: ["最终指认已结算。请对照票数与真相宣读。"],
    },
    {
      id: "public_s4_truth",
      stageId: "stage_4",
      title: "案件真相",
      type: "REVEAL",
      delivery: "CONDITION_UNLOCK",
      unlockPermissionId: "ending_reveal_access",
      paragraphs: [
        "真相：赵启明（role_c）挪用银两并在争执中致死管事。多数指认只代表玩家集体决定，不等于自动改写真相。",
      ],
    },
  ];

  const clues = [
    {
      id: "clue_blood_photo",
      title: "血迹照片",
      stageId: "stage_1",
      delivery: "HOST_RELEASE",
      visibility: "PUBLIC",
      paragraphs: ["走廊血迹照片显示拖拽痕迹朝向库房门。"],
      documentId: "doc_clue_blood",
    },
    {
      id: "clue_burned_ledger",
      title: "烧毁的账册残页",
      stageId: "stage_2",
      delivery: "CONDITION_UNLOCK",
      visibility: "PRIVATE",
      roleIds: [], // granted via permission after M03
      permissionId: "storage_room_access",
      paragraphs: ["残页写着：赵启明经手银两去向不明。"],
      documentId: "doc_clue_ledger",
    },
    {
      id: "clue_key_fragment",
      title: "库房钥匙残件",
      stageId: "stage_3",
      delivery: "HOST_RELEASE",
      visibility: "PUBLIC",
      paragraphs: ["钥匙齿残缺，纹样似旧式商会印。"],
      documentId: "doc_clue_key",
    },
  ];

  const mechanismAnnotations = [
    {
      id: "place_m03_storage",
      mechanismTemplateId: "M03-1",
      familyId: "M03",
      stageId: "stage_2",
      title: "库房进入资格竞价",
      trigger: "HOST_START",
      participantRule: { type: "ALL_PLAYERS" },
      introParagraphs: ["请各位提交竞价。最高价者获得库房进入资格。"],
      outcomeBindings: [
        {
          outcomeMatcher: { type: "WINNER" },
          effects: [
            {
              type: "PERMISSION_GRANT",
              permissionId: "storage_room_access",
              target: "WINNER",
            },
            {
              type: "STATE_APPLY",
              key: "storage_room",
              value: "UNLOCKED_FOR_WINNER",
            },
          ],
        },
      ],
      fallback: { type: "HOST_OVERRIDE_PICK_WINNER" },
    },
    {
      id: "place_m09_final",
      mechanismTemplateId: "M09-1",
      familyId: "M09",
      stageId: "stage_4",
      title: "最终指认真凶",
      trigger: "HOST_START",
      participantRule: { type: "ALL_PLAYERS" },
      requiredForStageCompletion: true,
      introParagraphs: ["请投票指认真凶。每名玩家提交一个选项，多数票生效。"],
      runtimeConfig: {
        candidates: ["role_a", "role_b", "role_c", "role_d", "role_e", "role_f"],
        submit_seconds: 600,
        tie_exit: "KEEP_ALL",
        correctOptionId: "role_c",
      },
      outcomeBindings: [
        {
          outcomeMatcher: { type: "MAJORITY" },
          effects: [
            {
              type: "STATE_APPLY",
              key: "final_accused_role",
              value: "$majority_choice",
            },
            {
              type: "STATE_APPLY",
              key: "truth_revealed",
              value: true,
            },
            {
              type: "PERMISSION_GRANT",
              permissionId: "ending_reveal_access",
              target: "ALL_PLAYERS",
            },
          ],
        },
        {
          outcomeMatcher: { type: "TIE" },
          effects: [
            {
              type: "STATE_APPLY",
              key: "final_vote_status",
              value: "TIE",
            },
            {
              type: "STATE_APPLY",
              key: "truth_revealed",
              value: true,
            },
            {
              type: "PERMISSION_GRANT",
              permissionId: "ending_reveal_access",
              target: "ALL_PLAYERS",
            },
          ],
        },
        {
          outcomeMatcher: { type: "NO_DECISION" },
          effects: [
            {
              type: "STATE_APPLY",
              key: "final_vote_status",
              value: "NO_DECISION",
            },
            {
              type: "PERMISSION_GRANT",
              permissionId: "ending_reveal_access",
              target: "ALL_PLAYERS",
            },
          ],
        },
      ],
      fallback: { type: "HOST_OVERRIDE_SETTLEMENT" },
    },
  ];

  const permissions = [
    {
      id: "storage_room_access",
      grants: ["VIEW_CONTENT", "RECEIVE_CLUE"],
      summary: "允许查看库房私人文本与烧毁账册线索",
      // content/clue ids filled by compiler
    },
    {
      id: "ending_reveal_access",
      grants: ["VIEW_CONTENT"],
      summary: "允许查看终局指认结果与案件真相",
    },
  ];

  return Object.freeze({
    metadata: {
      fixtureId: WAREHOUSE_SIX_FIXTURE_ID,
      revision: WAREHOUSE_SIX_FIXTURE_REVISION,
      title: "商会库房案",
      playerCount: 6,
      sourceType: "FIXTURE",
    },
    roles,
    stages,
    hostScript,
    roleScripts,
    sharedScripts,
    publicScripts,
    clues,
    mechanismAnnotations,
    permissions,
  });
}
