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

const QINGLOU_HANDBOOK_EXCERPT = [
  "请注意！因剧本中有较多不同于常规剧本的地方，所以此剧本是严禁盲开的。",
  "请您务必仔细阅读此《组织者手册》。",
  "★剧本简介 ★",
  "此剧本《青楼》为四男三女的古装七人机制本，整本共四章。",
  "★角色简介★",
  "莫怀：莫府大少爷，莫玄宗与红姨之子，此角色为好人，建议给配置最高的玩家。",
  "陈一兔：玉满楼四大名伎之月伎，此角色为好人，建议给女生比较爱盘的玩家。",
  "姜红儿：玉满楼四大名伎之玉伎，此角色为凶手，建议给女生中比较感性的玩家。",
  "齐剑心：江南第一剑客，此角色为凶手，建议给喜欢玩凶手的玩家。",
  "舒悦：玉满楼四大名伎之玉伎，此角色为凶手，凶手方内乱之一。",
  "杜霄元：衙门捕快，此角色为凶手，建议给喜欢玩凶手的玩家。",
  "白斋子，江南第一才子，此角色为好人，建议给比较感性的玩家。",
  "NPC柳诗诗：玉满楼四大名伎之花伎，此角色有专属的NPC剧本。",
  "★开本流程★",
  "1发本、宣读故事背景 见5页",
  "2玩家读本第一章 见6页",
  "6玩家读本第二章 见12页",
  "12演绎第三章 见 1 7 页",
  "14玩家读本第三、四章见19页",
  "主持人直接按照以上流程完整进行完即可。",
  "白斋子  -  博学多才（搜到宝箱开启仅需要一半银两）",
  "齐剑心  -  武功高强（可以免死一次）",
  "发行方：黑羽发行工作室 作者：发阳",
  "①你的任务一：",
  "你是为数不多的未染鲜血之人。",
  "⑤你的技能：",
  "博学多才（搜到宝箱开启仅需要一半银两）",
  "第一章：玉满楼",
  "白斋子在玉满楼开场正文。",
  "第四章：灵石",
  "白斋子灵石正文（印本页序靠后，阅读仍是第四章）。",
  "第三章：魔石",
  "白斋子魔石正文。",
  "第二章：夜阑",
  "白斋子夜阑正文。",
  "—未经主持人允许，请勿翻开下一页—",
  "发行方：黑羽发行工作室 作者：发阳",
  "①你的任务一：",
  "你是手染鲜血之人。",
  "⑤你的技能：",
  "武功高强（可以免死一次）",
  "第一章：玉满楼",
  "齐剑心在玉满楼开场正文。",
  "第四章：灵石",
  "齐剑心灵石正文。",
  "第三章：魔石",
  "齐剑心魔石正文。",
  "第二章：夜阑",
  "齐剑心夜阑正文。"
].join("\n");

test("qinglou handbook excerpt groups roster roles and flow chapters without prose act false positives", () => {
  const result = analyzeNarrativeStructure(QINGLOU_HANDBOOK_EXCERPT, { filename: "剧本.docx" });
  const roleTitles = result.candidates.filter((item) => item.type === "role").map((item) => item.title);
  for (const name of ["莫怀", "陈一兔", "姜红儿", "齐剑心", "舒悦", "杜霄元", "白斋子", "柳诗诗"]) {
    assert.ok(roleTitles.includes(name), `missing role ${name}`);
  }
  assert.ok(result.counts.role >= 7);
  const shells = result.candidates.filter((item) => item.type === "act" && !item.roleName);
  assert.ok(shells.some((item) => item.title === "玉满楼"));
  assert.ok(shells.some((item) => item.title === "夜阑"));
  assert.equal(shells.some((item) => /灵石|魔石|玉满楼/.test(item.title) && item.title.includes("一幕")), false);
  assert.equal(result.structureSource, "heuristic");
  assert.ok(result.roleBookletCount >= 2);
  assert.ok(result.gate.plan.some((item) => item.action === "import_role_sections"));
});

test("role booklet chapters follow page-label reading order 1-2-3-4 not extract appearance order", () => {
  const result = analyzeNarrativeStructure(QINGLOU_HANDBOOK_EXCERPT, { filename: "剧本.docx" });
  const bai = result.candidates.filter((item) => item.type === "act" && item.roleName === "白斋子" && item.body);
  assert.deepEqual(
    bai.map((item) => item.title),
    ["玉满楼", "夜阑", "魔石", "灵石"]
  );
  assert.deepEqual(
    bai.map((item) => item.meta?.readingOrder),
    [1, 2, 3, 4]
  );
  assert.match(bai[0].body, /玉满楼开场/);
  assert.match(bai[1].body, /夜阑正文/);
});

test("prose lines like 一幕玉满楼 are not treated as act headings", () => {
  const result = analyzeNarrativeStructure(
    ["普通叙述。", "莫怀复盘：莫怀醒来时，一幕玉满楼的灯还亮着，灵石与魔石都在桌上。", "夜阑之后他才离开。"].join("\n")
  );
  assert.equal(result.counts.act, 0);
});
