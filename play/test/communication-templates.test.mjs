import assert from "node:assert/strict";
import test from "node:test";

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const { state } = await import("../src/state.js");
const { renderSocialTab, renderTasksTab } = await import("../src/views/game-play-views.js");

test("player communication forms are authored data rather than hardcoded choices", () => {
  const previous = state.home;
  state.home = {
    currentActKey: "act-1",
    tasks: [],
    testimonies: [],
    activeVotes: [],
    privateActions: [],
    communicationTemplates: [
      { key: "testimony", kind: "testimony", enabled: true, title: "密室证言", privacyNotice: "主持可见", placeholder: "如实写下", deadlineMinutes: 30 },
      { key: "public_statement", kind: "public_statement", enabled: true, title: "全场宣告", privacyNotice: "全员可见", placeholder: "公开内容", deadlineMinutes: 0 },
      { key: "secret_action", kind: "secret_action", enabled: false, title: "不应出现", privacyNotice: "", placeholder: "", deadlineMinutes: 0 },
    ],
  };
  try {
    const tasks = renderTasksTab();
    const social = renderSocialTab();
    assert.match(tasks, /密室证言/);
    assert.match(tasks, /正式开场后 30 分钟截止/);
    assert.match(social, /全场宣告/);
    assert.doesNotMatch(social, /不应出现/);
    assert.doesNotMatch(social, /<select[^>]*data-private-action-type/);
  } finally {
    state.home = previous;
  }
});
