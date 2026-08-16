import assert from "node:assert/strict";
import test from "node:test";
import {
  HUMAN_AUTHORSHIP_VERSION,
  HUMAN_STORY_FOUNDATION_BLOCK,
  scanAutonomousPremiseRegression,
  scanExperienceFirstPremise
} from "../src/prompts/human-authorship.js";

test("human-authorship foundation preserves linked source conflicts", () => {
  assert.equal(HUMAN_AUTHORSHIP_VERSION, "v1.10-grounded-reader-language");
  assert.ok(HUMAN_STORY_FOUNDATION_BLOCK.includes("多组递进、互相反噬的矛盾"));
  assert.ok(HUMAN_STORY_FOUNDATION_BLOCK.includes("不得为追求“一句话钩子”"));
  assert.ok(HUMAN_STORY_FOUNDATION_BLOCK.includes("同一批人物的命运"));
  assert.ok(HUMAN_STORY_FOUNDATION_BLOCK.includes("不能并列成议题清单"));
  assert.ok(HUMAN_STORY_FOUNDATION_BLOCK.includes("AI 自主选题禁区"));
  assert.ok(HUMAN_STORY_FOUNDATION_BLOCK.includes("游戏公平只指规则可理解"));
  assert.ok(HUMAN_STORY_FOUNDATION_BLOCK.includes("明确赢家与受损者"));
  assert.ok(HUMAN_STORY_FOUNDATION_BLOCK.includes("误解、错过、共同克制、合作、假胜利或安静重估"));
  assert.ok(HUMAN_STORY_FOUNDATION_BLOCK.includes("概念/体验 → 架构/真相 → 人物/关系 → 流程/机制 → 文稿/物料"));
  assert.ok(HUMAN_STORY_FOUNDATION_BLOCK.includes("六张不同名称的否决票"));
  assert.ok(HUMAN_STORY_FOUNDATION_BLOCK.includes("值得第二天讲给别人听"));
});

test("autonomous premise gate blocks recurring safe topics but preserves author-anchored source", () => {
  const retirement = scanAutonomousPremiseRegression({
    summary: "六名退休职工围绕养老金方案重新分配旧账。",
    centralQuestion: "退休金应该怎样分"
  });
  const missing = scanAutonomousPremiseRegression({
    summary: "一名员工失踪后，众人寻找失联人员。"
  });
  const sharp = scanAutonomousPremiseRegression({
    summary: "直播决赛前，队长冒名签走唯一转会席位，被替换的选手可以公开偷拍视频反制。"
  });
  const sourceAnchored = scanAutonomousPremiseRegression(
    { summary: "原素材中的养老院争夺仍然是故事核心。" },
    { sourceText: "口播素材明确围绕养老院控制权展开。" }
  );
  assert.equal(retirement.passed, false);
  assert.equal(missing.passed, false);
  assert.equal(sharp.passed, true);
  assert.equal(sourceAnchored.passed, true);
  assert.equal(sourceAnchored.sourceAnchored, true);
});

test("experience-first gate rejects decision-only premises and symmetric permission casts", () => {
  const administrative = scanExperienceFirstPremise({
    summary: "六名利益相关者被召集到会议室，每个人掌握一项别人绕不过去的权限。",
    centralQuestion: "他们必须决定哪一版方案公开、谁署名、谁承担代价。",
    publicCrisis: "今晚必须完成签署与授权。",
    playerExperiencePromise: "玩家协商并投票选择最终版本。",
    retellableMoment: "六个人交换权限后签署最终方案。",
    worldSpecificActions: [
      { action: "签署授权", whyOnlyHere: "这是当前项目", changes: "进入结算" },
      { action: "投票选择版本", whyOnlyHere: "这是当前会议", changes: "确定结果" }
    ]
  });
  assert.equal(administrative.passed, false);
  assert.ok(administrative.violations.some((item) => item.code === "decision_only_administrative_premise"));
  assert.ok(administrative.violations.some((item) => item.code === "symmetric_permission_characters"));
});

test("experience-first gate accepts embodied and world-specific play promises", () => {
  const result = scanExperienceFirstPremise({
    summary: "足浴店晨会结束后，店长把客人号码当众发给不同技师；暗中的收购者则要让整晚营业额跌破门槛。",
    centralQuestion: "谁能在闭店前控制这家店。",
    publicCrisis: "第一批客人已经进门，错误分客会立即改变收入和站队。",
    playerExperiencePromise: "玩家要亲自喊晨会口号、抢上钟、分客并在服务过程中认出藏在店里的亲人和接头人。",
    retellableMoment: "众人一边争抢最后一位高消费客人，一边发现被派去服务的人正在把师门秘籍交给外国接头人。",
    worldSpecificActions: [
      { action: "给不同编号技师分配上钟客人", whyOnlyHere: "动作依赖足浴店的排钟与技师编号", changes: "立刻改变个人营业额和店长阵营" },
      { action: "在服务客人时完成秘籍接头", whyOnlyHere: "上钟形成只有技师与客人接触的传递窗口", changes: "改变秘籍归属并暴露内鬼" }
    ]
  });
  assert.equal(result.passed, true);
  assert.equal(result.proof.completeWorldSpecificActions, 2);
});
