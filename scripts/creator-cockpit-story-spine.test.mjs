import assert from "node:assert/strict";
import test from "node:test";
import { renderStorySpinePanel } from "../src/views/creator-cockpit-story-spine.js";

function context(storySpine, overrides = {}) {
  return {
    studio: {
      world: {
        summary: "六名旧友必须在停电前决定是否公开一场旧案。",
        settings: { storySpine }
      }
    },
    draft: {
      logline: "停电前的最后一次复核",
      sparks: ["封闭空间", "共同责任"]
    },
    counts: { roles: 6, chapters: 5 },
    truthClaims: [{ id: "truth-1" }],
    relationships: [{ id: "relation-1" }],
    storySpineLlmStatus: { configured: true },
    ...overrides
  };
}

function completeSpine(overrides = {}) {
  return {
    title: "停电前的最后一次复核",
    logline: {
      text: "六名旧友必须决定是否公开一场由所有人共同造成的旧案。",
      status: "author_confirmed",
      sourceRefs: ["world:summary"]
    },
    overview: {
      text: "他们带着彼此冲突的目标回到废弃档案馆，并在停电前完成三轮复核。",
      status: "ai_draft",
      sourceRefs: ["world:summary", "truth:truth-1"]
    },
    openingState: { text: "档案馆只剩一套应急电源。", status: "ai_draft" },
    incitingIncident: { text: "一份已销毁的录音自动开始播放。", status: "ai_draft" },
    centralConflict: { text: "公开真相会救下一名无辜者，也会毁掉六人的共同生活。", status: "ai_draft" },
    playerPremise: { text: "六人分别掌握一段不可替代的复核材料。", status: "ai_draft" },
    mechanismLoop: { text: "玩家反复选择调取、质证或封存一份材料，并立刻失去相应权限。", status: "ai_draft" },
    truthAndReversal: { text: "旧案不是一人作恶，而是六次看似合理的自保共同造成。", status: "ai_draft" },
    roleFunctions: [
      { roleId: "role-1", roleName: "周岚", storyFunction: "掌握原始录音", goal: "保护证人", pressure: "公开录音会暴露自己", status: "ai_draft" }
    ],
    chapterArc: [
      { chapterId: "chapter-1", sequence: 1, title: "应急电源", cause: "录音启动", playerAction: "分配读取权限", turn: "权限只能给三人", consequence: "未获权限者转向私人交易", status: "ai_draft" }
    ],
    endingDirections: [
      { key: "ending-public", title: "完整公开", requirements: "前三章保留原始录音并取得证人同意", consequence: "旧案重启，六人承担各自责任", status: "ai_draft" }
    ],
    unresolvedQuestions: [
      { key: "question-1", question: "证人是否仍然在世？", whyItMatters: "决定最终公开是否会造成新的伤害" }
    ],
    assumptions: [],
    provenance: { generatedAt: "2026-08-04T08:00:00.000Z" },
    ...overrides
  };
}

test("empty story overview explains assembly and exposes one bounded backend action", () => {
  const html = renderStorySpinePanel(context(null), {});

  assert.match(html, /data-action="cockpit-story-spine-assemble"/);
  assert.match(html, /STORY ASSEMBLY/);
  assert.match(html, /现有材料可参与装配/);
  assert.doesNotMatch(html, /cockpit-story-spine-adopt|cockpit-story-spine-confirm/);
});

test("current overview separates author canon from AI draft and escapes remote text", () => {
  const html = renderStorySpinePanel(context(completeSpine({
    overview: {
      text: '<img src=x onerror="alert(1)">仍需作者确认',
      status: "ai_draft",
      sourceRefs: ["world:summary"]
    }
  })), {});

  assert.match(html, /LIVING STORY OVERVIEW/);
  assert.match(html, /AUTHOR DECISIONS/);
  assert.match(html, /data-story-spine-section="overview"/);
  assert.match(html, /data-story-spine-key="overview"/);
  assert.doesNotMatch(html, /data-story-spine-key="logline"/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.doesNotMatch(html, /<img src=x/);
});

test("candidate overview can only be adopted or discarded and cannot silently become canon", () => {
  const current = completeSpine();
  const candidate = completeSpine({
    overview: { text: "候选版本调整了整体故事。", status: "ai_draft" }
  });
  const html = renderStorySpinePanel(context(current), {
    storySpineCandidate: candidate,
    storySpineAssembling: false
  });

  assert.match(html, /ASSEMBLY CANDIDATE/);
  assert.match(html, /data-action="cockpit-story-spine-adopt"/);
  assert.match(html, /data-action="cockpit-story-spine-discard"/);
  assert.doesNotMatch(html, /data-action="cockpit-story-spine-confirm"/);
});

test("assembly loading state promises a candidate instead of an overwrite", () => {
  const html = renderStorySpinePanel(context(completeSpine()), {
    storySpineAssembling: true
  });

  assert.match(html, /正在组装整体故事/);
  assert.match(html, /只会成为候选版本/);
  assert.doesNotMatch(html, /cockpit-story-spine-adopt|cockpit-story-spine-confirm/);
});
