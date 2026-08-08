import assert from "node:assert/strict";
import test from "node:test";

import { applyCreatorContextToPipelineInput } from "../src/pipeline-creator-context.js";

test("matrix pipeline receives confirmed cockpit spine and constitution", () => {
  const input = {
    setting: { theme: "原始主题", extraConflicts: "弹窗冲突", styleAnchor: "短句" },
    synopsis: { body: "弹窗纲要", charactersSketch: "", truthSketch: "", redHerringsSketch: "" },
    config: { notes: ["标准档"] }
  };
  const result = applyCreatorContextToPipelineInput(input, {
    creatorBrief: {
      sellingPoints: ["实时调水"],
      target: "六人玩家",
      duration: "4 小时",
      type: "工业伦理悬疑",
      magicNote: "机制失败也必须推进剧情",
      sparks: [{ tag: "现场", text: "潮窗每十八分钟关闭一次" }]
    },
    creativeConstitution: {
      theme: "程序责任",
      experiencePromise: "每幕选择改变下幕",
      inviolablePrinciples: ["不得最后临时投票"],
      fairPuzzlePromises: ["双源印证"],
      pacingPrinciples: ["先救灾再质证"],
      voicePrinciples: ["工业现场感"],
      forbiddenTropes: ["万能信任值"],
      avoidMisunderstandings: "死亡与制度危机不是同一行为"
    },
    storySpine: {
      title: "六号闸",
      logline: { text: "死者签名生效", status: "author_confirmed", sourceRefs: [] },
      mechanismLoop: { text: "每十八分钟调水", status: "author_confirmed", sourceRefs: [] },
      truthAndReversal: { text: "签名真实但授权越界", status: "author_confirmed", sourceRefs: [] },
      roleFunctions: [{ roleId: "role-1", roleName: "方既白", storyFunction: "运行主任", goal: "救主环", pressure: "越权会曝光" }],
      chapterArc: [{ chapterId: "ch1", sequence: 1, title: "潮窗", cause: "潮位上升", playerAction: "选择区域", turn: "签名真实", consequence: "区域关闭" }],
      endingDirections: [{ key: "repair", title: "带伤合闸", requirements: "保留许可", consequence: "公开责任" }]
    },
    mechanismDesign: {
      interactionKind: "timed_crisis",
      title: "潮窗分洪许可",
      summary: "玩家每轮分配闸门许可，在救援、供电与证据保全之间作出取舍。",
      recurringAction: "每轮分配一份闸门许可",
      conflictReason: "救人、供电与保全证据不能同时完成",
      limitedResource: "三份开封许可",
      immediateFeedback: "未保护区域立即发生损失",
      failureAdvance: "超时执行默认分洪并继续下一窗",
      genreSpecificity: "依赖潮汐城闸门制度",
      endingCausality: "前三窗保留的区域决定最终合闸路线",
      status: "confirmed"
    }
  });

  assert.match(result.synopsis.body, /创作驾驶舱·权威创作上下文/);
  assert.match(result.synopsis.body, /作者已确认故事主轴/);
  assert.match(result.synopsis.body, /产品与体验目标/);
  assert.match(result.synopsis.body, /工业伦理悬疑/);
  assert.match(result.synopsis.body, /机制失败也必须推进剧情/);
  assert.match(result.synopsis.body, /潮窗每十八分钟关闭一次/);
  assert.match(result.synopsis.body, /每十八分钟调水/);
  assert.match(result.synopsis.body, /章节因果/);
  assert.match(result.synopsis.body, /创作驾驶舱·机制设计/);
  assert.match(result.synopsis.body, /潮窗分洪许可/);
  assert.match(result.synopsis.body, /超时执行默认分洪/);
  assert.match(result.premise, /大纲与剧本生成契约/);
  assert.match(result.premise, /潮窗分洪许可/);
  assert.match(result.conflicts, /不可忽略的机制约束/);
  assert.match(result.synopsis.charactersSketch, /方既白/);
  assert.match(result.synopsis.truthSketch, /签名真实但授权越界/);
  assert.match(result.setting.extraConflicts, /不得最后临时投票/);
  assert.match(result.setting.styleAnchor, /工业现场感/);
  assert.ok(result.config.notes.some((note) => note.includes("实时调水")));
  assert.ok(result.config.notes.some((note) => note.includes("限时危机")));
  assert.equal(result.mechanismDesign.status, "confirmed");
  assert.equal(result.creatorContext.mechanismDesign.status, "confirmed");
  assert.equal(input.synopsis.body, "弹窗纲要", "source input must not be mutated");
});

test("draft mechanism context is explicit and remains non-canonical", () => {
  const result = applyCreatorContextToPipelineInput(
    { synopsis: { body: "原始纲要" } },
    {
      mechanismDesign: {
        title: "尚未确认的潮窗",
        recurringAction: "每轮分配一份许可",
        status: "draft",
      },
    },
  );
  assert.equal(result.mechanismDesign.status, "draft");
  assert.equal(result.creatorContext.mechanismDesign.status, "draft");
  assert.match(result.synopsis.body, /作者草稿/);
});

test("confirmed mechanism context cannot enter outline or scripts with missing answers", () => {
  assert.throws(
    () =>
      applyCreatorContextToPipelineInput(
        { synopsis: { body: "原始纲要" } },
        { mechanismDesign: { title: "残缺机制", status: "confirmed" } },
      ),
    (error) => {
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.equal(error.statusCode, 400);
      assert.equal(error.details.reason, "mechanism_design_incomplete");
      assert.ok(error.details.fields.includes("recurringAction"));
      return true;
    },
  );
});

test("creator context injection is idempotent", () => {
  const first = applyCreatorContextToPipelineInput(
    { synopsis: { body: "用户纲要" } },
    { creatorBrief: { sellingPoints: ["机械潮窗"] } }
  );
  const second = applyCreatorContextToPipelineInput(first, {
    creatorBrief: { sellingPoints: ["机械潮窗"] }
  });
  assert.equal((second.synopsis.body.match(/创作驾驶舱·权威创作上下文/g) || []).length, 1);
});

test("confirmed cockpit context is preserved when the popup synopsis is near its length limit", () => {
  const result = applyCreatorContextToPipelineInput(
    { synopsis: { body: "旧".repeat(12_000) } },
    { creatorBrief: { sellingPoints: ["必须保留的潮窗机制"] } }
  );
  assert.ok(result.synopsis.body.length <= 12_000);
  assert.match(result.synopsis.body, /必须保留的潮窗机制/);
});
