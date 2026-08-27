import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPlayerContext,
  normalizeAiPlaytestConfig,
  runMultiAgentPlaytest
} from "../src/ai-playtest-simulator.js";

const roleA = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "侦探",
  public_profile: "负责梳理现场证据"
};
const roleB = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "记者",
  public_profile: "负责追问证词"
};

function fixtureSnapshot() {
  return {
    world: {
      id: "33333333-3333-4333-8333-333333333333",
      name: "错序之夜",
      summary: "玩家必须重建停摆时钟背后的时间线。"
    },
    roles: [roleA, roleB],
    chapters: [
      { id: "chapter-1", title: "停摆", sequence: 1 },
      { id: "chapter-2", title: "错序", sequence: 2 }
    ],
    sections: [
      {
        id: "section-a",
        role_slot_id: roleA.id,
        chapter_id: "chapter-1",
        title: "侦探序幕",
        content: "你注意到时钟停在 22:15。"
      },
      {
        id: "section-b",
        role_slot_id: roleB.id,
        chapter_id: "chapter-1",
        title: "记者序幕",
        content: "你掌握一份被改过日期的采访记录。"
      }
    ],
    clues: [
      {
        id: "clue-public",
        name: "停摆时钟",
        visibility: "public",
        public_text: "时针停在 22:15。"
      },
      {
        id: "clue-author",
        name: "作者底牌",
        visibility: "author",
        role_slot_id: roleB.id,
        public_text: "只有记者能看见。"
      }
    ],
    truthClaims: [
      {
        id: "truth-hidden",
        title: "真实顺序",
        claim: "停电发生在死亡之后。",
        role_visibility: {},
        evidence: [{ type: "clue", id: "clue-public", label: "停摆时钟" }]
      },
      {
        id: "truth-known",
        title: "记者已知事实",
        claim: "采访记录日期被改过。",
        role_visibility: { [roleB.id]: true }
      }
    ],
    roleArchives: [],
    scenes: [],
    segments: [],
    coreTrick: { summary: "错序叙事" }
  };
}

const profiles = [
  { seatId: "seat-1", roleSlotId: roleA.id, archetype: "logical" },
  { seatId: "seat-2", roleSlotId: roleB.id, archetype: "silent" }
];

test("player context keeps author truth isolated and only exposes role-visible claims", () => {
  const snapshot = fixtureSnapshot();
  const config = normalizeAiPlaytestConfig({ profiles }, snapshot.roles);
  const detective = buildPlayerContext(snapshot, config.profiles[0]);
  const reporter = buildPlayerContext(snapshot, config.profiles[1]);

  assert.equal(detective.visibleTruth.length, 0);
  assert.equal(reporter.visibleTruth.length, 1);
  assert.equal(reporter.visibleTruth[0].ref.id, "truth-known");
  assert.equal(detective.privateSections.length, 1);
  assert.equal(detective.privateSections[0].ref.id, "section-a");
  assert.equal(detective.visibleClues.some((item) => item.ref.id === "clue-author"), false);
});

test("multi-agent playtest runs isolated players before observer synthesis", async () => {
  const phases = [];
  const requestJson = async (_messages, options) => {
    phases.push({ phase: options.phase, seatId: options.context?.seatId });
    if (options.phase === "ai-playtest-player") {
      return {
        value: {
          objectiveUnderstanding: "确认时钟是否可信",
          timeline: [{
            stageId: "chapter-1",
            stageLabel: "停摆",
            belief: "22:15 是案发时刻",
            confidence: 70,
            evidenceUsed: [{ type: "clue", id: "clue-public", label: "停摆时钟" }],
            action: "检查时钟",
            communication: "向同伴询问时间",
            confusion: "",
            hostHelp: false
          }],
          finalBelief: "需要重建时间顺序",
          truthConfidence: 60,
          hostInterventions: 0
        }
      };
    }
    return {
      value: {
        headline: "时间线反转可被发现，但交流仍有单点",
        summary: "两名玩家都注意到时钟，其中沉默型玩家没有及时共享日期信息。",
        score: 76,
        truthSolved: true,
        consensusStage: "错序",
        metrics: {
          clarity: 82,
          fairness: 78,
          agency: 70,
          pacing: 76,
          communication: 60,
          intentAlignment: 88
        },
        issues: [{
          severity: "warning",
          category: "communication",
          title: "日期信息依赖单人分享",
          detail: "沉默型席位不分享时，另一席位无法验证时钟。",
          recommendation: "增加独立的日期核验入口。",
          refs: [{ type: "clue", id: "clue-public", label: "停摆时钟" }],
          seatIds: ["seat-2"]
        }]
      }
    };
  };

  const report = await runMultiAgentPlaytest(fixtureSnapshot(), {
    depth: "quick",
    focus: "时间线理解",
    profiles
  }, { requestJson, requestId: "test-run" });

  assert.deepEqual(phases.map((item) => item.phase), [
    "ai-playtest-player",
    "ai-playtest-player",
    "ai-playtest-observer"
  ]);
  assert.equal(report.players.length, 2);
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0].refs[0].id, "clue-public");
  assert.equal(report.score, 76);
  assert.equal(report.summaryCounts.warning, 1);
});

test("playtest rejects unknown role assignments before any model call", () => {
  const snapshot = fixtureSnapshot();
  assert.throws(
    () => normalizeAiPlaytestConfig({
      profiles: [
        { roleSlotId: roleA.id, archetype: "logical" },
        { roleSlotId: "99999999-9999-4999-8999-999999999999", archetype: "social" }
      ]
    }, snapshot.roles),
    /不存在的角色/
  );
});
