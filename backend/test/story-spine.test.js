import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmStorySpineSection,
  normalizeStorySpine,
  storySpineDiff
} from "../../shared/story-spine.js";
import {
  assembleStorySpine,
  buildStorySpineSourceCatalog
} from "../src/story-spine-assembler.js";

function fixtureSnapshot() {
  return {
    world: {
      id: "world-1",
      name: "无灯站台",
      summary: "六名旅客登上一列不在时刻表中的军列。",
      content_revision: 12,
      settings: {
        creatorBrief: {
          sellingPoints: ["移动密室", "身份冲突"],
          type: "民国谍战"
        },
        storySpine: normalizeStorySpine({
          title: "无灯站台",
          logline: {
            text: "作者锁定的一句话故事。",
            status: "author_confirmed",
            sourceRefs: ["world:summary"]
          }
        })
      }
    },
    roles: [
      { id: "role-1", name: "沈青", public_profile: "列车报务员" }
    ],
    roleArchives: [
      { id: "archive-1", role_slot_id: "role-1", external_goal: "确认列车真正目的地" }
    ],
    chapters: [
      { id: "chapter-1", sequence: 1, title: "无灯进站", summary: "列车停在废弃站台。" }
    ],
    truthClaims: [
      { id: "truth-1", title: "时刻表被替换", claim: "站长收到的是一份伪造调度令。" }
    ],
    roleRelationships: [],
    timelineEvents: [],
    segments: [],
    clues: []
  };
}

function generatedCandidate() {
  return {
    title: "无灯站台",
    logline: { text: "模型试图改写作者锁定文本。", sourceRefs: ["world:summary"] },
    overview: { text: "六人必须在抵达终点前确定谁伪造了调度令。", sourceRefs: ["world:summary", "truth:truth-1"] },
    openingState: { text: "六人各自以普通旅客身份登车。", sourceRefs: ["world:summary"] },
    incitingIncident: { text: "列车停靠不存在的站台。", sourceRefs: ["world:summary"] },
    centralConflict: { text: "公开身份有助于验证命令，却会暴露各自任务。", sourceRefs: ["brief:selling-points"] },
    playerPremise: { text: "只有六名乘客拥有互相冲突但可拼合的调度信息。", sourceRefs: ["world:summary"] },
    mechanismLoop: { text: "玩家交换一次身份凭证，换取一次调度记录核验。", sourceRefs: ["truth:truth-1"] },
    truthAndReversal: { text: "所谓临时军令来自被替换的时刻表。", sourceRefs: ["truth:truth-1", "unknown:source"] },
    roleFunctions: [{
      roleId: "role-1",
      roleName: "沈青",
      storyFunction: "唯一能识别报务格式",
      goal: "确认列车真正目的地",
      pressure: "承认身份会暴露电台来源",
      sourceRefs: ["role:role-1", "role-archive:archive-1"]
    }],
    chapterArc: [1, 2, 3].map((sequence) => ({
      chapterId: `draft-chapter-${sequence}`,
      sequence,
      title: `第${sequence}章`,
      cause: sequence === 1 ? "列车异常停靠" : `第${sequence - 1}章留下的权限变化`,
      playerAction: "玩家必须核验一份具体调度记录",
      turn: "核验暴露一项身份矛盾",
      consequence: "下一章失去一项匿名权限",
      sourceRefs: ["world:summary"]
    })),
    endingDirections: [1, 2].map((index) => ({
      key: `ending-${index}`,
      title: `结局${index}`,
      requirements: "读取第一章身份公开与第三章命令核验结果",
      consequence: "列车进入不同终点",
      sourceRefs: ["truth:truth-1"]
    })),
    unresolvedQuestions: [],
    assumptions: []
  };
}

test("story spine source catalog keeps stable authored references", () => {
  const catalog = buildStorySpineSourceCatalog(fixtureSnapshot(), {
    sparks: [{ tag: "机制", text: "每次查验都会暴露一人身份" }]
  });
  const keys = new Set(catalog.map((item) => item.key));
  assert.ok(keys.has("world:summary"));
  assert.ok(keys.has("brief:sparks"));
  assert.ok(keys.has("role:role-1"));
  assert.ok(keys.has("role-archive:archive-1"));
  assert.ok(keys.has("truth:truth-1"));
});

test("story spine assembly preserves author-confirmed blocks and filters fake sources", async () => {
  const snapshot = fixtureSnapshot();
  const result = await assembleStorySpine(snapshot, {}, {
    requestId: "request-1",
    now: () => "2026-08-04T10:00:00.000Z",
    requestJson: async () => ({
      model: "test-model",
      value: generatedCandidate(),
      usage: { totalTokens: 123 }
    })
  });

  assert.equal(result.storySpine.logline.text, "作者锁定的一句话故事。");
  assert.equal(result.storySpine.logline.status, "author_confirmed");
  assert.deepEqual(result.storySpine.truthAndReversal.sourceRefs, ["truth:truth-1"]);
  assert.equal(result.storySpine.overview.status, "ai_draft");
  assert.equal(result.storySpine.provenance.model, "test-model");
  assert.equal(result.storySpine.provenance.sourceRevision, 12);
  assert.equal(result.storySpine.chapterArc.length, 3);
});

test("authors can confirm one spine section without canonizing every AI draft", () => {
  const original = normalizeStorySpine(generatedCandidate());
  const confirmed = confirmStorySpineSection(original, "centralConflict");
  assert.equal(confirmed.centralConflict.status, "author_confirmed");
  assert.equal(confirmed.overview.status, "ai_draft");

  const diff = storySpineDiff(original, {
    ...original,
    overview: { ...original.overview, text: "更新后的整体故事" }
  });
  assert.deepEqual(diff.changedSections.map((item) => item.key), ["overview"]);
});

test("story spine assembly refuses a project with no usable creative material", async () => {
  await assert.rejects(
    () => assembleStorySpine({ world: { name: "空项目", settings: {} } }, {}, {
      requestJson: async () => {
        throw new Error("should not call model");
      }
    }),
    (error) => error?.code === "BAD_REQUEST"
  );
});
