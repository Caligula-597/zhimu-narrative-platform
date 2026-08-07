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
const { renderMechanismProgress } =
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
