import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let s = fs.readFileSync(path.join(root, "host/src/views/_director-chunk.js"), "utf8");
s = s.replace(/\n\s*viewExports\.[^\n]+\n/g, "\n");
s = s.replace(/\n\}\)\(window\);\s*\nexport \{\};?\s*$/m, "\n");
s = s.replace("function director()", "export function renderConsole()");
s = s.replace(/state\.cloudStudio/g, "state.studio");
s = s.replace(/state\.cloudRules/g, "state.rules");
s = s.replace(
  "请先在总览中选择或创建一个平行运行房。",
  "请先在下方选择平行运行房，或通过 ?room= 链接直接进入。"
);
s = s.replace(
  '<button class="text-btn" data-go="writer">前往剧本创作</button><button class="text-btn" data-action="world-rooms">管理平行房</button>',
  '<button class="text-btn" data-action="open-creator">前往创作者端</button><button class="text-btn" data-action="go-pick-room">选择平行房</button>'
);
s = s.replace(/\bmodal\.className/g, "modalEl.root.className");
s = s.replace(/\bmodal\.innerHTML/g, "modalEl.root.innerHTML");
s = s.replace(/\bmodal\.querySelectorAll/g, "modalEl.root.querySelectorAll");
s = s.replace(/\bmodal\.querySelector/g, "modalEl.root.querySelector");
s = s.replace(/\bmodalBackdrop\.classList/g, "modalEl.backdrop.classList");
s = s.replace(/\bzhimuApi\./g, "api.");
s = s.replace(/\bloadCloudData\b/g, "loadHostData");
s = s.replace(/window\.zhimuUserMessages\?\.rulePreviewStatusLabel\|\|\(\(s\)=>s\)/, "rulePreviewStatusLabel");
const asyncHandlers = [
  "batchHostEventsAction",
  "openHostPlayerDetail",
  "kickHostPlayer",
  "openHostClueNote",
  "dismissHostEvent",
  "executeHostEvent",
  "refreshRulesPreview",
  "triggerManualRuleFromDirector"
];
for (const name of asyncHandlers) {
  s = s.replace(new RegExp(`async function ${name}`), `export async function ${name}`);
}
const syncHandlers = [
  "hostPlayerTableRows",
  "toggleHostEventSelection",
  "syncHostEventSelectAll",
  "openHostEventContext",
  "openHostGrantClueModal",
  "openDelayHostEventModal",
  "openHostGrantItemModal",
  "openHostUnlockSectionModal",
  "openHostUnlockSceneModal",
  "openHostLogModal",
  "openHostNudgeWaitingModal"
];
for (const name of syncHandlers) {
  s = s.replace(new RegExp(`function ${name}`), `export function ${name}`);
}
s = s.replace(/modalEl\.root\.className=/g, "mountModal(); modalEl.root.className=");
const header = `import { api } from "../api.js";
import { state } from "../state.js";
import { collapsibleCard } from "../components/collapse.js";
import { activeRuntimeRoom, cloudStatus, runtimeEmpty, stat, activity } from "../components/ui.js";
import {
  closeModal,
  modalEl,
  mountModal,
  openModal,
  studioField,
  studioSelect,
  studioOptionsHtml,
  studioValues
} from "../components/modal.js";
import {
  escapeHtml,
  formatRelativeTime,
  formatTime,
  hostAuditActionLabel,
  hostAuditDetail,
  hostOperationLabel,
  hostPlayerColor,
  logActivityType,
  rulePreviewStatusLabel
} from "../utils/format.js";
import { loadHostData } from "../runtime/data.js";

let renderRef = () => {};
let showToastRef = (_msg) => {};

export function bindConsoleContext({ render, showToast }) {
  renderRef = render;
  showToastRef = showToast;
}

function render() { renderRef(); }
function showToast(msg) { showToastRef(msg); }

`;
fs.writeFileSync(path.join(root, "host/src/views/console.js"), header + s);
console.log("wrote console.js", (header + s).split("\n").length, "lines");
