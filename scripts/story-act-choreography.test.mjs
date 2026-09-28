import test from "node:test";
import assert from "node:assert/strict";
import { validateStoryActChoreography } from "../shared/story-act-choreography-contract.js";

function act(id, beats) {
  return {
    actId: id,
    payoff: "回收旧问题",
    reveal: "出现新事实",
    shift: { knowledge: "知识改变" },
    hook: "产生更大的问题",
    causalChain: {
      payoffToReveal: "旧问题的答案带出新事实",
      revealToShift: "新事实改变当前状态",
      shiftToHook: "状态变化产生更大问题",
    },
    beats,
  };
}

test("act choreography requires payoff, reveal, shift, hook and 2-3 beats", () => {
  const result = validateStoryActChoreography({
    acts: [act("act1", [
      { mechanismId: "M07-3", phase: "SEED", authored: true },
      { mechanismId: "M01-FRAMING", phase: "SEED", authored: true },
    ])],
  });
  assert.equal(result.ok, true);
  assert.equal(result.code, "CHOREOGRAPHY_READY");
});

test("unfinished mechanism Gold blocks Writer readiness", () => {
  const result = validateStoryActChoreography({
    acts: [
      act("act1", [
        { mechanismId: "M07-3", phase: "SEED", authored: true },
        { mechanismId: "M01-FRAMING", phase: "SEED", authored: false, requiresAuthoredGold: true },
      ]),
      act("act2", [
        { mechanismId: "M07-3", phase: "PAYOFF", authored: true },
        { mechanismId: "M08-6", phase: "SEED", authored: false, requiresAuthoredGold: true },
      ]),
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "CHOREOGRAPHY_REVIEW");
  assert.ok(result.issues.some((issue) => issue.code === "CHOREOGRAPHY_NOT_WRITER_READY"));
});

test("one mechanism cannot own every act", () => {
  const result = validateStoryActChoreography({
    acts: [
      act("act1", [{ mechanismId: "M07-3" }, { mechanismId: "M01-FRAMING" }]),
      act("act2", [{ mechanismId: "M07-3" }, { mechanismId: "M01-FRAMING" }]),
    ],
  });
  assert.ok(result.issues.some((issue) => issue.code === "MECHANISM_OWNS_EVERY_ACT" && issue.mechanismId === "M07-3"));
});

test("V2 requires dramatic needs to be covered by mechanism jobs and scene affordances", () => {
  const result = validateStoryActChoreography({
    version: 2,
    acts: [{
      ...act("act1", [{ mechanismId: "M07-3" }, { mechanismId: "M01-FRAMING" }]),
      dramaticNeeds: ["公开异常", "时间压力"],
      mechanismContributions: [{ mechanismId: "M07-3", job: "呈现异常", needsCovered: ["公开异常"], output: "异常进入公共视野" }],
      sceneAffordances: [{
        sceneId: "public-desk",
        label: "值班台",
        affordances: ["公开观察", "封存倒计时"],
        needsCovered: ["时间压力"],
        whyThisScene: "名册和收档时间同时出现",
        deletionImpact: "删除后公共观察与倒计时同时消失",
      }],
    }],
  });
  assert.equal(result.ok, true);
});

function authoredSlices() {
  return {
    m01: {
      sliceId: "M01-FRAMING:V02:CHOREOGRAPHY-SLICE",
      mechanismId: "M01-FRAMING",
      variantId: "V02",
      initialInterpretation: "表面解释仍然合理",
      counterEvidence: {
        statement: "M07 交付的原始记录与公开说明冲突",
        source: { mechanismId: "M07-3", actId: "act2", phase: "PAYOFF", outputRef: "m07-payoff" },
      },
      reinterpretation: "第一幕的撕痕获得新的意义",
      newQuestion: "谁需要把这段风险伪装成普通撤展？",
      dependsOn: ["M07-3:act2:PAYOFF:m07-payoff"],
    },
    m08: {
      sliceId: "M08-6:V01:CHOREOGRAPHY-SLICE",
      mechanismId: "M08-6",
      variantId: "V01",
      sideAHas: "A 持有公开核验",
      sideBHas: "B 持有原始语境",
      mutualDependency: "双方各缺另一半",
      sharingBoundary: "只共享当前记录，不交出全部背景",
      timeWindow: "封存前",
      cooperationCanAdvance: "对齐两份记录",
      cooperationCannotResolve: "不能确定最终责任",
    },
  };
}

test("V2 authored slices can satisfy choreography without declaring full mechanism Gold", () => {
  const result = validateStoryActChoreography({
    version: 2,
    status: "DESIGN_ONLY",
    authoredSlices: authoredSlices(),
    acts: [{
      ...act("act1", [
        { mechanismId: "M01-FRAMING", authored: false, requiresAuthoredGold: true, authoredSliceRef: "M01-FRAMING:V02:CHOREOGRAPHY-SLICE" },
        { mechanismId: "M08-6", authored: false, requiresAuthoredGold: true, authoredSliceRef: "M08-6:V01:CHOREOGRAPHY-SLICE" },
      ]),
      dramaticNeeds: ["反证", "有限合作"],
      mechanismContributions: [
        { mechanismId: "M01-FRAMING", job: "重解释", needsCovered: ["反证"], output: "旧事实改义" },
        { mechanismId: "M08-6", job: "有限共享", needsCovered: ["有限合作"], output: "两半信息对齐" },
      ],
      sceneAffordances: [{
        sceneId: "archive-window",
        label: "调档窗口",
        affordances: ["资格门槛", "封存倒计时"],
        needsCovered: ["反证", "有限合作"],
        whyThisScene: "两份记录只能在窗口前短暂对照",
        deletionImpact: "删除后记录对照和窗口压力消失",
      }],
    }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.choreography.status, "DESIGN_ONLY");
});

test("M01 authored slice must depend on the M07 act2 PAYOFF", () => {
  const slices = authoredSlices();
  slices.m01.counterEvidence.source.phase = "SEED";
  slices.m01.dependsOn = ["M07-3:act1:SEED:m07-seed"];
  const result = validateStoryActChoreography({
    version: 2,
    authoredSlices: slices,
    acts: [act("act1", [{ mechanismId: "M01-FRAMING" }, { mechanismId: "M07-3" }])],
  });
  assert.ok(result.issues.some((issue) => issue.code === "M01_COUNTER_EVIDENCE_NOT_FROM_M07_PAYOFF"));
  assert.ok(result.issues.some((issue) => issue.code === "M01_M07_PAYOFF_DEPENDENCY_MISSING"));
});
