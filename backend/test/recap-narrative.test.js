import assert from "node:assert/strict";
import test from "node:test";
import {
  applyRoleRankings,
  buildChapterSynopsis,
  buildRevelationTrack,
  buildTruthConclusion,
  pickRecapExcerpt,
  truncateExcerpt
} from "../src/recap-narrative.js";

test("truncateExcerpt trims long text", () => {
  assert.equal(truncateExcerpt("  hello   world  ", 8), "hello w…");
  assert.equal(truncateExcerpt("", 10), "");
});

test("buildRevelationTrack merges host, rules, and clue host text", () => {
  const track = buildRevelationTrack({
    hostConfirmedEvents: [{
      status: "executed",
      title: "公开真相",
      description: "第二节可以讨论了",
      resolvedAt: "2026-06-03T10:00:00.000Z"
    }],
    endingTriggers: [{
      executedAt: "2026-06-03T11:00:00.000Z",
      ruleName: "结局A",
      conditionsSummary: "全员读完",
      actionsSummary: "开放复盘",
      mode: "automatic"
    }],
    clueDiscovery: [{
      clueId: "c1",
      clueName: "车票",
      roleName: "林记者",
      readAt: "2026-06-03T09:30:00.000Z",
      acquiredAt: "2026-06-03T09:00:00.000Z"
    }],
    worldCluesById: new Map([
      ["c1", { name: "车票", hostText: "这张票指向真凶" }]
    ])
  });
  assert.equal(track.length, 3);
  assert.equal(track[0].kind, "clue_revelation");
  assert.equal(track[1].kind, "host_revelation");
  assert.equal(track[2].kind, "rule_revelation");
});

test("buildChapterSynopsis weaves readers scenes clues and host nodes", () => {
  const synopsis = buildChapterSynopsis({
    chapter: { title: "登车" },
    chapterReads: [{ roleName: "林记者" }, { roleName: "车长" }],
    beats: [
      { kind: "scene_unlock", sceneName: "餐车" },
      { kind: "host_event", status: "executed", title: "公开第二节" }
    ],
    rolesFinished: 2,
    roleTotal: 6,
    cluesInAct: [{ clueName: "撕角车票" }]
  });
  assert.match(synopsis, /林记者、车长/);
  assert.match(synopsis, /餐车/);
  assert.match(synopsis, /撕角车票/);
  assert.match(synopsis, /公开第二节/);
});

test("pickRecapExcerpt prefers creator recapSummary", () => {
  assert.equal(
    pickRecapExcerpt({
      recapSummary: "  局后专用摘要  ",
      summary: "普通摘要",
      publicText: "公开正文"
    }),
    "局后专用摘要"
  );
  assert.equal(
    pickRecapExcerpt({ summary: "普通摘要", publicText: "公开正文" }),
    "普通摘要"
  );
});

test("buildTruthConclusion merges authored summary with ending rules", () => {
  const conclusion = buildTruthConclusion({
    recapTruthSummary: "真凶是车长。",
    finalChapter: { sequence: 3, title: "终章" },
    endingTriggers: [{
      ruleName: "结局A",
      actionsSummary: "开放复盘"
    }],
    hostConfirmedEvents: [{
      status: "executed",
      title: "公开真相",
      description: "可以讨论了"
    }],
    stats: { joinedPlayers: 6, cluesDiscovered: 4, investigationsCompleted: 2 },
    undiscoveredClues: [{ clueName: "隐藏票" }],
    joinedPlayers: 6
  });
  assert.match(conclusion.summary, /真凶是车长/);
  assert.match(conclusion.summary, /结局A/);
  assert.equal(conclusion.authoredSummary, "真凶是车长。");
  assert.ok(conclusion.bullets.some((row) => row.kind === "ending_rule"));
});

test("applyRoleRankings assigns comparative badges", () => {
  const ranked = applyRoleRankings([
    {
      joined: true,
      roleName: "A",
      roleSlotId: "1",
      stats: { completedSections: 5, totalSections: 5, ownedClues: 3, investigations: 2, notes: 1 }
    },
    {
      joined: true,
      roleName: "B",
      roleSlotId: "2",
      stats: { completedSections: 3, totalSections: 5, ownedClues: 1, investigations: 0, notes: 0 }
    }
  ]);
  assert.ok(ranked[0].badges.includes("阅读进度领先"));
  assert.ok(ranked[0].badges.includes("线索最多"));
  assert.ok(ranked[0].narrativeSummary.includes("A"));
});
