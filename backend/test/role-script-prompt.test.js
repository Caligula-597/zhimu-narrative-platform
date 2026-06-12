import test from "node:test";
import assert from "node:assert/strict";
import { compactChaptersForRoleScriptPrompt, buildRoleScriptFromNarrativeMessages } from "../src/prompts/role-script-from-narrative.js";

test("compactChaptersForRoleScriptPrompt focuses current chapter", () => {
  const longBody = "章".repeat(9000);
  const compact = compactChaptersForRoleScriptPrompt([
    { chapterKey: "ch1", title: "一", summary: "s1", narrativeBody: longBody },
    { chapterKey: "ch2", title: "二", summary: "s2", narrativeBody: longBody }
  ], "ch2");
  assert.equal(compact[0].narrativeBodyEnding.length, 1800);
  assert.ok(compact[1].narrativeBody.length <= 5000);
  assert.match(compact[1].note || "", /9000/);
});

test("buildRoleScriptFromNarrativeMessages scopes to single chapterKey", () => {
  const messages = buildRoleScriptFromNarrativeMessages({
    setting: { theme: "测试", wordsPerChapter: 8000, playerCount: 4 },
    synopsis: { body: "纲要" },
    role: { key: "role-1", name: "角色A", publicProfile: "p", privateProfile: "s" },
    chapters: [
      { chapterKey: "ch1", title: "一", summary: "s1", narrativeBody: "a".repeat(10000) },
      { chapterKey: "ch2", title: "二", summary: "s2", narrativeBody: "b".repeat(10000) }
    ],
    chapterKey: "ch1"
  });
  const system = messages[0].content;
  const user = messages[1].content;
  assert.match(system, /chapterKey=ch1/);
  assert.match(user, /sections 必须覆盖：ch1/);
  assert.ok(user.length < 12000, "prompt should stay compact vs full 20k×2 bodies");
});
