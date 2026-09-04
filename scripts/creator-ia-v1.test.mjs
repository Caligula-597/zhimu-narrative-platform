import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("Creator IA V1：主导航收束为创作/试跑/房间 + 高级工具", () => {
  const html = read("../index.html");
  assert.match(html, /nav-text">创作</);
  assert.match(html, /nav-text">试跑</);
  assert.match(html, /nav-text">房间</);
  assert.match(html, /data-nav-advanced-label>高级工具</);
  assert.doesNotMatch(html, /创作驾驶舱|玩家试跑实验室|剧本杀编辑器/);
  assert.match(html, /data-view="diagnostics"/);
  assert.match(html, /id="nav-advanced"/);
});

test("Creator IA V1：驾驶舱阶段用户语言更新且内部 id 保留", () => {
  const model = read("../src/views/creator-cockpit-model.js");
  assert.match(model, /id: "concept"/);
  assert.match(model, /title: "定方向"/);
  assert.match(model, /title: "搭剧情"/);
  assert.match(model, /title: "整母稿"/);
  assert.match(model, /title: "加玩法"/);
  assert.match(model, /title: "写成品"/);
  assert.match(model, /title: "试跑发布"/);
  assert.match(model, /剧情积木篮/);
  assert.match(model, /添加幕内玩法/);
  assert.doesNotMatch(model, /灵魂的种子|剧情机制骨架/);
});

test("Creator IA V1：内容生产墙不再平铺世界域编辑器", () => {
  const workspaces = read("../src/views/creator-workspaces.js");
  assert.match(workspaces, /写成品/);
  assert.match(workspaces, /高级工具已收纳/);
  assert.doesNotMatch(workspaces, /data-action="misidentification"/);
  assert.doesNotMatch(workspaces, /data-action="world-engine"/);
  assert.doesNotMatch(workspaces, /data-action="econ-system"/);
});

test("Creator IA V1：剧情积木篮默认列表壳", () => {
  const wb = read("../src/views/creator-story-mechanism-workbench.js");
  assert.match(wb, /剧情积木篮/);
  assert.match(wb, /mode: "basket"/);
  assert.match(wb, /添加剧情结构/);
  assert.match(wb, /角色负载/);
  assert.match(wb, /你希望这本里有什么/);
  assert.match(wb, /尝试交织成整本骨架/);
  assert.match(wb, /persistState|apiSaveProjectStoryState|getProjectStoryState/);
  assert.doesNotMatch(wb, /STORY MECHANISM WORKBENCH/);
});

test("Creator IA V1：整母稿交织入口", () => {
  const model = read("../src/views/creator-cockpit-model.js");
  assert.match(model, /交织骨架/);
  assert.match(model, /cockpit-open-master-outline/);
  const outline = read("../src/views/creator-master-outline-workbench.js");
  assert.match(outline, /先编排后写作|尝试交织成整本骨架|角色负载/);
});
