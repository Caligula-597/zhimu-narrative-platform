import assert from "node:assert/strict";
import test from "node:test";

globalThis.localStorage = {
  getItem() {
    return "";
  },
  setItem() {},
  removeItem() {},
};

const { state } = await import("../src/state.js");
const { loadPlayerTabletopStage } = await import("../src/views/game-tabletop-stage-loader.js");
await loadPlayerTabletopStage();
const { renderGameHome, renderMechanismProgress } =
  await import("../src/views/game-home-views.js");

test("player mechanism progress renders authored online form without internal effects", () => {
  const previousHome = state.home;
  state.home = {
    currentState: {
      mechanism: {
        initialized: true,
        stale: false,
        status: "running",
        totalRounds: 5,
        currentRound: {
          sequence: 2,
          title: "第二次潮窗",
          goal: "保住一个区域并留下可复核材料",
          playerAction: "在十八分钟内决定保护对象",
        },
        decisions: [
          {
            key: "choice-1",
            question: "本轮把闸门容量留给哪里？",
            interaction: {
              kind: "timed_crisis",
              label: "潮窗危机",
              playerInstruction: "在时限内形成一个可执行方案。",
              deadlineSeconds: 1080,
              defaultOptionKey: "option-1",
            },
            deadlineAt: "2999-08-06T10:00:00.000Z",
            submission: {
              optionKey: "option-1",
              submittedAt: "2026-08-06T10:00:00Z",
            },
            options: [
              {
                key: "option-1",
                choiceText: "保护旧港",
                presentation: {
                  eyebrow: "区域方案 01",
                  publicPreview: "保住旧港人口与现场",
                  costLabel: "消耗一次开封许可",
                  riskLabel: "医疗环容量下降",
                },
              },
            ],
          },
        ],
      },
    },
  };
  try {
    const html = renderMechanismProgress();
    assert.match(html, /潮窗危机/);
    assert.match(html, /服务器截止时间/);
    assert.match(html, /超时默认方案/);
    assert.match(html, /保护旧港/);
    assert.match(html, /消耗一次开封许可/);
    assert.match(html, /医疗环容量下降/);
    assert.match(html, /submit-mechanism-choice/);
    assert.match(html, /已提交此倾向/);
    assert.match(html, /不会立即改写剧情/);
    assert.match(html, /主持端结算/);
    assert.doesNotMatch(html, /state-|effects|hostInstruction/);
  } finally {
    state.home = previousHome;
  }
});

test("player role commitment clearly stays private to the player and host", () => {
  const previousHome = state.home;
  state.home = {
    currentState: {
      mechanism: {
        initialized: true,
        stale: false,
        status: "running",
        totalRounds: 1,
        currentRound: { sequence: 1, title: "私人立场" },
        decisions: [
          {
            key: "choice-1",
            question: "你愿意为谁承担责任？",
            interaction: {
              kind: "role_commitment",
              label: "秘密承诺",
              playerInstruction: "选择你的个人立场。",
            },
            deadlineAt: null,
            submission: null,
            options: [
              { key: "option-1", choiceText: "保护证人", presentation: {} },
            ],
          },
        ],
      },
    },
  };
  try {
    const html = renderMechanismProgress();
    assert.match(html, /秘密提交承诺/);
    assert.match(html, /只对本人和主持人可见/);
    assert.doesNotMatch(html, /全桌倾向/);
  } finally {
    state.home = previousHome;
  }
});

test("completed mechanism renders the shared ending and only this player's epilogue", () => {
  const previousHome = state.home;
  state.home = {
    currentState: {
      mechanism: {
        initialized: true,
        stale: false,
        status: "completed",
        totalRounds: 3,
        currentRound: null,
        decisions: [],
        ending: {
          title: "共同持有",
          consequence: "旧账没有被抹掉，共同账户继续运行。",
          roleEpilogue: {
            title: "名字仍在账上",
            consequence: "你保住了署名，却要继续面对另一名持有人。"
          }
        }
      }
    }
  };
  try {
    const html = renderMechanismProgress();
    assert.match(html, /共同持有/);
    assert.match(html, /旧账没有被抹掉/);
    assert.match(html, /你的个人尾声/);
    assert.match(html, /名字仍在账上/);
    assert.match(html, /前面各轮已经发生的行动/);
  } finally {
    state.home = previousHome;
  }
});

test("player renders private ranking and fixed-total allocation sessions with opaque handles", () => {
  const previousHome = state.home;
  state.home = {
    currentState: {
      mechanism: {
        initialized: true,
        stale: false,
        status: "running",
        totalRounds: 1,
        currentRound: { sequence: 1, title: "确定救援次序" },
        decisions: [
          {
            key: "choice-1",
            question: "先救哪一处？",
            interaction: { kind: "free_ranking" },
            submission: {
              answer: { type: "ranking", optionKeys: ["option-2", "option-1"] },
            },
            options: [
              { key: "option-1", choiceText: "旧港", presentation: {} },
              { key: "option-2", choiceText: "医疗环", presentation: {} },
            ],
          },
          {
            key: "choice-2",
            question: "如何分配救援额度？",
            interaction: {
              kind: "numeric_allocation",
              allocationTotal: 100,
              allocationUnitLabel: "点",
            },
            submission: null,
            options: [
              { key: "option-1", choiceText: "旧港", presentation: {} },
              { key: "option-2", choiceText: "医疗环", presentation: {} },
            ],
          },
        ],
      },
    },
  };
  try {
    const html = renderMechanismProgress();
    assert.match(html, /自由排序/);
    assert.match(html, /submit-mechanism-ranking/);
    assert.ok(html.indexOf("医疗环") < html.indexOf("旧港"));
    assert.match(html, /数值分配/);
    assert.match(html, /分配 100 点/);
    assert.match(html, /submit-mechanism-allocation/);
    assert.match(html, /其他玩家看不到内容、顺序或分配数值/);
    assert.doesNotMatch(html, /decision-internal|resource-secret|state-secret/);
  } finally {
    state.home = previousHome;
  }
});

test("player home renders host-controlled flow and only the public map projection", () => {
  const previousHome = state.home;
  const previousExploration = state.exploration;
  state.roomEventsConnected = true;
  state.exploration = { scenes: [] };
  state.home = {
    room: { name: "测试房", contentBinding: { mode: "live", runtimeSource: "live_draft" } },
    role: { name: "调查员", private_profile: "角色资料" },
    sections: [], clues: [], sharedClues: [], inventory: [], tasks: [], activeVotes: [],
    currentState: {
      audience: "player",
      currentBeat: {
        id: "beat-1", key: "ch2", title: "穿过沉钟塔", sequence: 2,
        position: 2, total: 4, source: "host_control",
        player: { content: "跟随潮声进入塔内。", tasks: ["找到上层入口"], tips: ["留意钟摆"] },
        host: { hostTruth: "不得显示" }
      },
      presentation: {
        activeSegmentKey: "ch2",
        map: {
          title: "盐雾群岛", visible: true, activeLocationId: "tower",
          revealedLocationIds: ["harbor", "tower"],
          locations: [
            { id: "harbor", name: "白帆港", type: "港口", description: "潮水退去。", x: 0.2, y: 0.4 },
            { id: "tower", name: "沉钟塔", type: "危险场景", description: "塔门已经开启。", x: 0.8, y: 0.6 }
          ],
          routes: [["harbor", "tower"]],
          party: [{ id: "pc", name: "调查员", hp: 9, maxHp: 12 }],
          dice: { count: 1, sides: 20, modifier: 2, defaultTarget: 12 },
          activeCheck: {
            id: "check-1", label: "推开塔门", instruction: "说明如何协力打开机关门。",
            target: 14, bonus: 1, rollMode: "normal", status: "pending", result: null,
            dice: { count: 1, sides: 20, modifier: 2, defaultTarget: 12 },
            outcomeText: "", successText: "不得提前显示成功", failureText: "不得提前显示失败"
          },
          host: { locations: [{ hostNotes: "不得显示" }] }
        }
      },
      phase: { key: "playing", label: "剧情进行中", detail: "" },
      suggestedActions: [], blockers: [],
      syncState: { status: "synced", runtimeSource: "live_draft", isFrozen: false, serverCursor: 2 },
      metrics: {}
    }
  };
  try {
    const html = renderGameHome();
    assert.match(html, /主持流程同步/);
    assert.match(html, /穿过沉钟塔/);
    assert.match(html, /找到上层入口/);
    assert.match(html, /当前场景地图/);
    assert.match(html, /盐雾群岛/);
    assert.match(html, /塔门已经开启/);
    assert.match(html, /HP 9\/12/);
    assert.match(html, /主持人发起判定/);
    assert.match(html, /推开塔门/);
    assert.match(html, /目标 14/);
    assert.doesNotMatch(html, /不得显示/);
  } finally {
    state.home = previousHome;
    state.exploration = previousExploration;
  }
});
