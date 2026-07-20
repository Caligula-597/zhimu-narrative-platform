import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeNarrativeStructure,
  CREATOR_TERMINOLOGY,
  normalizeCreationType
} from "../src/document-structure.js";

test("narrative structure recognizes roles, acts, scenes, clues and secrets", () => {
  const result = analyzeNarrativeStructure([
    "# 角色：林夏",
    "她是旧港的法医。",
    "秘密：她藏起了第二把钥匙",
    "## 第一幕 雾港",
    "场景：旧码头",
    "凌晨两点仍有船灯。",
    "线索：生锈钥匙",
    "钥匙上刻着字母 L。",
    "## KP 信息：仓库门从内部反锁"
  ].join("\n"), { filename: "雾港模组.docx", creationType: "tabletop_rpg" });

  assert.deepEqual(result.counts, { role: 1, act: 1, scene: 1, clue: 1, secret: 2 });
  assert.equal(result.terminology.clue, "HO");
  assert.equal(result.candidates.find((item) => item.type === "scene").parentActTitle, "雾港");
  assert.equal(result.candidates.find((item) => item.type === "clue").body, "钥匙上刻着字母 L。");
  assert.equal(result.candidates.find((item) => item.type === "secret").roleName, "林夏");
});

test("narrative structure derives bounded role hints without treating dialogue as headings", () => {
  const result = analyzeNarrativeStructure([
    "角色列表：张三、李四",
    "张三：我昨晚没有离开房间。",
    "这是一段普通对白。"
  ].join("\n"), { filename: "公共幕.md" });

  assert.equal(result.counts.role, 2);
  assert.deepEqual(result.candidates.map((item) => item.title).sort(), ["张三", "李四"]);
  assert.ok(result.candidates.every((item) => item.confidence === "medium"));
});

test("filename role-book hint preserves the original document as a role candidate", () => {
  const result = analyzeNarrativeStructure("没有显式标题的角色正文", { filename: "沈砚角色本.docx" });
  assert.equal(result.counts.role, 1);
  assert.equal(result.candidates[0].title, "沈砚");
  assert.equal(result.candidates[0].body, "没有显式标题的角色正文");
});

test("filename-derived role is attached to act candidates without duplicating the full manuscript", () => {
  const result = analyzeNarrativeStructure([
    "# 第一幕 雨夜",
    "这是沈砚第一幕的私人正文。",
    "# 第二幕 旧案",
    "这是沈砚第二幕的私人正文。"
  ].join("\n"), { filename: "沈砚角色本.docx" });
  const role = result.candidates.find((item) => item.type === "role");
  const acts = result.candidates.filter((item) => item.type === "act");
  assert.equal(role.body, "");
  assert.equal(acts.length, 2);
  assert.ok(acts.every((item) => item.roleName === "沈砚"));
});

test("creation type normalization is closed and exposes stable terminology", () => {
  assert.equal(normalizeCreationType("TABLETOP_RPG"), "tabletop_rpg");
  assert.equal(normalizeCreationType("unknown"), "murder_mystery");
  assert.equal(CREATOR_TERMINOLOGY.murder_mystery.role, "角色本");
});
