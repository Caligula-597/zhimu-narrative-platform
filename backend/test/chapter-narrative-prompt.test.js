import test from "node:test";
import assert from "node:assert/strict";
import { compactPreviousChaptersForPrompt, buildChapterNarrativeMessages } from "../src/prompts/chapter-narrative.js";

test("compactPreviousChaptersForPrompt truncates long prior chapters", () => {
  const longBody = "起".repeat(9000);
  const compact = compactPreviousChaptersForPrompt([
    { chapterKey: "ch1", title: "第一章", summary: "摘要", narrativeBody: longBody }
  ]);
  assert.equal(compact.length, 1);
  assert.equal(compact[0].narrativeBodyLength, 9000);
  assert.ok(compact[0].narrativeBodyEnding.length <= 2400);
  assert.ok(!compact[0].narrativeBody);
  assert.match(compact[0].note, /9000/);
});

test("compactPreviousChaptersForPrompt keeps short chapters intact", () => {
  const body = "短".repeat(500);
  const compact = compactPreviousChaptersForPrompt([
    { chapterKey: "ch1", title: "第一章", summary: "摘要", narrativeBody: body }
  ]);
  assert.equal(compact[0].narrativeBody, body);
  assert.equal(compact[0].narrativeBodyLength, undefined);
});

test("buildChapterNarrativeMessages uses compact prior context", () => {
  const longBody = "章".repeat(10000);
  const messages = buildChapterNarrativeMessages({
    setting: { theme: "测试", wordsPerChapter: 8000, playerCount: 4, chapterCount: 3 },
    synopsis: { body: "纲要" },
    config: { chapterKeys: ["ch1", "ch2", "ch3"] },
    chapterKey: "ch3",
    chapterIndex: 2,
    chapterCount: 3,
    previousChapters: [
      { chapterKey: "ch1", title: "一", summary: "s1", narrativeBody: longBody },
      { chapterKey: "ch2", title: "二", summary: "s2", narrativeBody: longBody }
    ]
  });
  const userContent = messages[1].content;
  const systemContent = messages[0].content;
  assert.match(userContent, /摘要\+末尾片段/);
  assert.match(systemContent, /生活先于命题/);
  assert.match(systemContent, /延迟解释|立刻解释/);
  assert.ok(userContent.length < longBody.length * 2, "prompt should be much smaller than full prior bodies");
});
