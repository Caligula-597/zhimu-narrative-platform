import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { formField, formSelect } from "../src/components/form-fields.js";
import { renderWorkspaceEditor } from "../src/components/workspace-editor.js";
import {
  buildHostRunbookMarkdown,
  contentPackagePreviewHtml,
  fileFingerprint
} from "../src/views/writer-transfer-files.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("workspace editor renders as an embedded surface without a modal backdrop", () => {
  const html = renderWorkspaceEditor({
    title: "新建线索",
    body: formField("名称", "name", "input", "测试"),
    submitLabel: "保存",
    submitAction: "editor-save",
    cancelAction: "editor-close"
  });
  assert.match(html, /<aside class="workspace-editor-panel/);
  assert.match(html, /data-workspace-editor/);
  assert.match(html, /data-action="editor-save"/);
  assert.match(html, /data-action="editor-close"/);
  assert.doesNotMatch(html, /modal-backdrop|class="modal/);
});

test("shared workspace fields escape labels, values and options", () => {
  const field = formField("<img>", "name", "input", '"><script>alert(1)</script>');
  const select = formSelect("类型", "type", [{ id: "x", name: "<b>危险</b>" }], "x");
  assert.doesNotMatch(field, /<script>|<img>/);
  assert.match(field, /&lt;img&gt;/);
  assert.match(select, /&lt;b&gt;危险&lt;\/b&gt;/);
  assert.match(select, /selected/);
});

test("long creator editors no longer depend on the global modal surface", () => {
  for (const file of [
    "src/views/clues-editor.js",
    "src/views/mini-games.js",
    "src/views/rules.js",
    "src/views/rooms.js",
    "src/views/writer-metadata-editor.js",
    "src/views/studio-create-editor.js",
    "src/views/writer-tool-session.js",
    "src/views/writer-tool-workspace.js",
    "src/views/writer-manuscript-workspace.js",
    "src/views/writer-impact-workspace.js",
    "src/views/writer-document-workspace.js",
    "src/views/writer-package-workspace.js"
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /\bstudioModal\b|\bmodalBackdrop\b|from\s+["']\.\.\/dom\.js["']/, file);
  }
  assert.match(read("src/views/clues-editor.js"), /clue-workspace-editor/);
  assert.match(read("src/views/mini-games.js"), /mini-game-workspace-editor/);
  assert.match(read("src/views/rules.js"), /rule-workspace-page/);
  assert.match(read("src/views/rooms.js"), /room-workspace-page/);
  assert.match(read("src/views/writer-metadata-editor.js"), /writer-metadata-workspace/);
  assert.match(read("src/views/studio-create-editor.js"), /studio-create-editor/);
  assert.match(read("src/views/writer-tool-workspace.js"), /writerToolWorkspaceHtml/);
});

test("save, close and tab actions are registered through the domain dispatchers", () => {
  const clues = read("src/runtime/actions-clues.js");
  const miniGames = read("src/runtime/actions-mini-games.js");
  const rules = read("src/runtime/actions-rules.js");
  for (const action of ["clue-editor-close", "clue-editor-save"]) assert.match(clues, new RegExp(action));
  for (const action of ["mini-game-editor-close", "mini-game-editor-save"]) assert.match(miniGames, new RegExp(action));
  for (const action of ["rule-editor-close", "rule-editor-tab", "rule-editor-save"]) assert.match(rules, new RegExp(action));
});

test("editor drafts are rebound after view rerenders", () => {
  const actions = read("src/runtime/actions.js");
  assert.match(actions, /callView\("clues", "bindClueEditor"\)/);
  assert.match(actions, /callView\("miniGames", "bindMiniGameEditor"\)/);
  assert.match(actions, /callView\("rules", "bindRuleEditor"\)/);
  assert.match(actions, /callView\("rooms", "bindRoomWorkspace"\)/);
  assert.match(actions, /callView\("writer", "bindWriterMetadataEditor"\)/);
  assert.match(actions, /callView\("writer", "bindWriterToolWorkspace"\)/);
  assert.match(actions, /callView\("studio", "bindStudioCreateEditor"\)/);
});

test("writer heavy tools use guarded full-page sessions", () => {
  const writer = read("src/views/writer.js");
  const session = read("src/views/writer-tool-session.js");
  const manuscript = read("src/views/writer-manuscript-workspace.js");
  const document = read("src/views/writer-document-workspace.js");
  const packages = read("src/views/writer-package-workspace.js");
  const actions = read("src/runtime/actions-writer.js");
  assert.match(writer, /writerToolWorkspaceHtml\(data\)/);
  assert.match(session, /activeSession === session/);
  assert.match(session, /zhimuApi\.context\.worldId === session\.worldId/);
  assert.match(manuscript, /session\.savingAction/);
  assert.match(manuscript, /session\.replaceArmed/);
  assert.match(manuscript, /session\.graphImportArmed/);
  assert.match(document, /session\.previewFingerprint !== session\.sourceFingerprint/);
  assert.match(document, /canEditWorldContent\(data\?\.world\)/);
  assert.match(packages, /session\.previewFingerprint !== importFingerprint\(session\)/);
  assert.match(packages, /切勿重复导入/);
  assert.match(packages, /zhimuApi\.selectWorld\(newWorldId\)/);
  assert.match(packages, /requestId: zhimuApi\.createIdempotencyKey\(\)/);
  assert.match(packages, /requestId: session\.requestId/);
  for (const action of [
    "writer-tool-close",
    "writer-manuscript-save",
    "writer-document-parse",
    "writer-document-import",
    "writer-export-run",
    "writer-import-preview",
    "writer-import-run"
  ]) {
    assert.match(actions, new RegExp(action));
  }
});

test("writer transfer helpers preserve store order and escape package previews", () => {
  const segments = [
    { sequence: 2, segmentKey: "B", title: "后段", operations: {} },
    { sequence: 1, segmentKey: "A", title: "前段", operations: {} }
  ];
  const before = segments.map((item) => item.segmentKey);
  const markdown = buildHostRunbookMarkdown(segments, "测试");
  assert.deepEqual(segments.map((item) => item.segmentKey), before, "导出不应原地排序并污染 store");
  assert.ok(markdown.indexOf("A · 前段") < markdown.indexOf("B · 后段"));
  const html = contentPackagePreviewHtml({
    sourceWorldName: "<img src=x>",
    summary: {},
    warnings: [{ level: 'x" onclick="bad', title: "<script>", detail: "<b>" }],
    roles: [],
    chapters: [],
    clues: []
  });
  assert.doesNotMatch(html, /<script>|<img|onclick="bad/);
  assert.match(html, /&lt;script&gt;/);
  assert.equal(fileFingerprint({ name: "a.json", size: 2, lastModified: 3, type: "application/json" }), "a.json:2:3:application/json");
});

test("studio create flows keep the graph visible and use one guarded editor", () => {
  const studio = read("src/views/studio.js");
  const editor = read("src/views/studio-create-editor.js");
  const actions = read("src/runtime/actions-studio.js");
  for (const wrapper of ["openStudioChapter", "openStudioScene", "openStudioClue", "openStudioItem", "openStudioPoint"]) {
    assert.match(studio, new RegExp(`export function ${wrapper}\\(`));
  }
  assert.doesNotMatch(studio, /studioModal\("新增公共章节"|studioModal\("新增公共场景"|studioModal\("新增剧本杀线索"|studioModal\("新增物品"|studioModal\("新增场景调查点"/);
  assert.match(editor, /createSession !== activeSession/);
  assert.match(editor, /zhimuApi\.context\.worldId !== activeSession\.worldId/);
  assert.match(editor, /context\.session\.saving/);
  assert.match(editor, /canEditWorldContent\(data\.world\)/);
  assert.match(studio, /requireStudioEdit\(\)/);
  assert.match(studio, /只读编排视图/);
  assert.match(studio, /studioViewApi = \{[^\n]*openStudioCreateEditor/);
  for (const action of ["studio-create-type", "studio-create-close", "studio-create-save"]) assert.match(actions, new RegExp(action));
});

test("room management is a routed workspace with stale response protection", () => {
  const resolver = read("src/bootstrap/view-resolver.js");
  const loader = read("src/runtime/view-loader.js");
  const roomView = read("src/views/rooms.js");
  const authWorld = read("src/runtime/auth-world.js");
  assert.match(resolver, /case "rooms"/);
  assert.match(loader, /views\/rooms\.js/);
  assert.match(authWorld, /openWorldRooms\(\)\{go\("rooms"\)\}/);
  assert.doesNotMatch(authWorld, /export async function createParallelRoom/);
  assert.match(roomView, /sequence !== loadSequence/);
  assert.match(roomView, /zhimuApi\.context\.worldId !== worldId/);
  assert.match(roomView, /isCurrentRoomWorkspace\(state\)/);
  assert.match(roomView, /运行房已创建，但当前数据刷新失败/);
  assert.equal((roomView.match(/getWorldRooms\(/g) || []).length, 1, "切换房间不应重新请求整个列表");
});

test("role and chapter editors use guarded workspace actions", () => {
  const writer = read("src/views/writer.js");
  const editor = read("src/views/writer-metadata-editor.js");
  const actions = read("src/runtime/actions-writer.js");
  assert.match(writer, /openWriterRoleEditor\(roleId\)/);
  assert.match(writer, /openWriterChapterEditor\(chapterId\)/);
  assert.match(editor, /context\.session\.saving/);
  assert.match(editor, /metadataSession !== activeSession/);
  assert.match(editor, /zhimuApi\.context\.worldId !== activeSession\.worldId/);
  assert.match(editor, /writer-metadata-delete-role/);
  for (const action of ["writer-metadata-close", "writer-metadata-save", "writer-metadata-delete-role"]) {
    assert.match(actions, new RegExp(action));
  }
});
