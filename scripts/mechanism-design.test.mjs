import assert from "node:assert/strict";
import test from "node:test";
import {
  formatMechanismDesignForPrompt,
  mechanismDesignHasContent,
  mechanismDesignCoverage,
  normalizeMechanismDesign,
  validateMechanismDesignConfirmation,
} from "../shared/mechanism-design.js";

test("mechanism design turns seven author answers into a stable generation contract", () => {
  const design = normalizeMechanismDesign({
    interactionKind: "timed_crisis",
    title: "潮窗分洪许可",
    recurringAction: "每轮在三处区域中分配一份闸门许可",
    conflictReason: "救人、保电和保存现场不能同时完成",
    limitedResource: "三份开封许可",
    immediateFeedback: "未保护区域立刻失去设施或证据",
    failureAdvance: "超时后系统按上一轮方案执行并扩大损失",
    genreSpecificity: "只有潮汐城闸门制度允许代理调水",
    endingCausality: "前三轮保留的区域和许可共同决定合闸路线",
    status: "confirmed"
  });
  assert.equal(mechanismDesignCoverage(design).complete, true);
  const prompt = formatMechanismDesignForPrompt(design).join("\n");
  assert.match(prompt, /作者已确认/);
  assert.match(prompt, /限时危机/);
  assert.match(prompt, /三份开封许可/);
  assert.doesNotMatch(prompt, /state-|resource-/);
});

test("incomplete mechanism drafts remain explicitly non-canonical", () => {
  const prompt = formatMechanismDesignForPrompt({ title: "待设计机制" }).join("\n");
  assert.match(prompt, /作者草稿/);
  assert.equal(mechanismDesignCoverage({ title: "待设计机制" }).score, 0);
  assert.equal(mechanismDesignHasContent({ title: "待设计机制" }), true);
  const validation = validateMechanismDesignConfirmation({
    title: "待设计机制",
    status: "confirmed",
  });
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((issue) => issue.key === "summary"));
  assert.ok(validation.issues.some((issue) => issue.key === "endingCausality"));
});

test("numeric allocation keeps an author-defined fixed private budget", () => {
  const design = normalizeMechanismDesign({
    interactionKind: "numeric_allocation",
    title: "救援额度",
    allocationTotal: 12,
    allocationUnitLabel: "枚许可",
  });
  assert.equal(design.allocationTotal, 12);
  assert.equal(design.allocationUnitLabel, "枚许可");
  const prompt = formatMechanismDesignForPrompt(design).join("\n");
  assert.match(prompt, /数值分配/);
  assert.match(prompt, /12 枚许可/);
});
