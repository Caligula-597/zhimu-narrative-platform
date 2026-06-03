import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const domInject = `  const { content, toast, modal, modalBackdrop } = window.zhimuDom;\n`;

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (name.endsWith(".js") && name !== "dom.js") patchFile(p);
  }
}

function patchFile(filePath) {
  let src = fs.readFileSync(filePath, "utf8");
  if (src.includes("window.zhimuDom")) return;
  src = src.replace(
    "  const zhimuApi = window.zhimuApi;\n",
    `  const zhimuApi = window.zhimuApi;\n${domInject}`
  );
  fs.writeFileSync(filePath, src);
}

walk(path.join(root, "src"));

// toast.js: remove shadowing + stray poll vars
const toastPath = path.join(root, "src/components/toast.js");
let toast = fs.readFileSync(toastPath, "utf8");
toast = toast.replace("  const showToast = T.showToast || (() => {});\n", "");
toast = toast.replace(/\nlet directorPollTimer=null;[\s\S]*?let roomEventReconnectTimer=null;\n/, "\n");
fs.writeFileSync(toastPath, toast);

// modal.js: remove shadowing closeModal
const modalPath = path.join(root, "src/components/modal.js");
let modal = fs.readFileSync(modalPath, "utf8");
modal = modal.replace("  const closeModal = M.closeModal || (() => {});\n", "");
fs.writeFileSync(modalPath, modal);

// data.js: remove early loadCloudData(), add poll vars
const dataPath = path.join(root, "src/runtime/data.js");
let data = fs.readFileSync(dataPath, "utf8");
data = data.replace("\nloadCloudData();\n\n", "\n");
if (!data.includes("let directorPollTimer")) {
  data = data.replace(
    "  window.zhimuViews = window.zhimuViews || {};\n",
    `  window.zhimuViews = window.zhimuViews || {};
  const updateNotifyBadge = T.updateNotifyBadge || (() => {});
  let directorPollTimer = null;
  const DIRECTOR_POLL_MS = 15000;
  let roomEventAbort = null;
  let roomEventReconnectTimer = null;
`
  );
}
data = data.replace(
  "   if(data.voiceRoomId===state.voiceRoomId)await refreshVoiceMessages();",
  "   if(data.voiceRoomId===state.voiceRoomId)await (V.player?.refreshVoiceMessages || (async () => {}))();"
);
fs.writeFileSync(dataPath, data);

// writer.js: append creator snapshot helpers
const writerPath = path.join(root, "src/views/writer.js");
let writer = fs.readFileSync(writerPath, "utf8");
if (!writer.includes("createCreatorSnapshot")) {
  const insert = `
function createCreatorSnapshot(){studioModal("保存创作版本",studioField("版本名称","label","input",\`创作快照 \${new Date().toLocaleString("zh-CN")}\`),"保存快照",async()=>{try{await zhimuApi.createContentVersion(studioValues());closeModal();await loadCloudData();showToast("创作版本已保存")}catch(error){showToast(error.message)}})}
async function restoreCreatorSnapshot(versionId){try{await zhimuApi.restoreContentVersion(versionId);await loadCloudData();showToast("已恢复该版本的正文与发布状态")}catch(error){showToast(error.message)}}
async function deleteCreatorSnapshot(versionId){try{await zhimuApi.deleteContentVersion(versionId);await loadCloudData();showToast("创作版本记录已删除")}catch(error){showToast(error.message)}}
`;
  writer = writer.replace(
    "  viewExports.writer = writer;",
    insert + "  viewExports.writer = writer;\n  viewExports.createCreatorSnapshot = createCreatorSnapshot;\n  viewExports.restoreCreatorSnapshot = restoreCreatorSnapshot;\n  viewExports.deleteCreatorSnapshot = deleteCreatorSnapshot;"
  );
  fs.writeFileSync(writerPath, writer);
}

console.log("Patched src modules");
