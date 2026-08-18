import * as zhimuApi from "../api/index.js";
import { canEditWorldContent } from "../components/emptyState.js";
import { normalizeError } from "../components/status-ui.js";
import { showToast } from "../components/toast.js";
import { render } from "../runtime/runtime-facade.js";
import { studioStore } from "../state/index.js";
import { worldEngineWorkspaceHtml } from "./world-engine-view.js";
import {
  beginWriterToolSession,
  getWriterToolSession,
  writerToolSessionIsCurrent
} from "./writer-tool-session.js";
import "./world-engine-workspace.css";

export { worldEngineWorkspaceHtml } from "./world-engine-view.js";

function currentSession() {
  const data = studioStore.get().cloudStudio;
  const session = getWriterToolSession(data);
  if (!session || session.type !== "world-engine") return null;
  if (!canEditWorldContent(data?.world)) {
    showToast("当前身份不能改世界引擎");
    return null;
  }
  return session;
}

function readSeed(root, session) {
  const venue = root.querySelector('input[name="world-engine-venue"]:checked')?.value || "photo_studio";
  const playerCount = Number(root.querySelector('[data-engine-field="playerCount"]')?.value) || 6;
  const dramaLevel = Number(root.querySelector('[data-engine-field="dramaLevel"]')?.value) || 3;
  const inspiration = root.querySelector('[data-engine-field="inspiration"]')?.value || "";
  const banned = root.querySelector('[data-engine-field="banned"]')?.value || "";
  session.draft = { ...session.draft, venueKey: venue, playerCount, dramaLevel, inspiration, banned };
  return session.draft;
}

export async function openWorldEngineWorkspace() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canEditWorldContent(data.world)) return showToast("当前身份不能使用世界引擎");
  const session = beginWriterToolSession("world-engine", data, {
    view: { venues: [] },
    draft: { venueKey: "photo_studio", playerCount: 6, dramaLevel: 3, inspiration: "", banned: "" },
    savingAction: "load"
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
  try {
    session.view = await zhimuApi.getWorldEngine();
    if (session.view?.seed) session.draft = { ...session.draft, ...session.view.seed };
    session.savingAction = "";
  } catch (error) {
    session.savingAction = "";
    session.error = normalizeError(error, "读取世界引擎失败");
  }
  if (writerToolSessionIsCurrent(session)) render();
}

export function bindWorldEngineWorkspace(data, session) {
  const root = document.querySelector('[data-writer-tool="world-engine"]');
  if (!root || root.dataset.bound || !session) return;
  root.dataset.bound = "1";
  root.querySelectorAll("[data-engine-field]").forEach((field) => {
    field.addEventListener("input", () => {
      readSeed(root, session);
      session.dirty = true;
      session.discardArmed = false;
    });
  });
}

async function withSave(session, action, work) {
  session.savingAction = action;
  session.error = "";
  render();
  try {
    session.view = await work();
    session.dirty = true;
  } catch (error) {
    session.error = normalizeError(error, "世界引擎操作失败");
    showToast(session.error);
  } finally {
    session.savingAction = "";
    if (writerToolSessionIsCurrent(session)) render();
  }
}

export async function seedWorldEngineWorkspace() {
  const session = currentSession();
  if (!session) return;
  const root = document.querySelector('[data-writer-tool="world-engine"]');
  const seed = readSeed(root, session);
  await withSave(session, "seed", () => zhimuApi.seedWorldEngine(seed));
}

export async function searchWorldEngineWorkspace() {
  const session = currentSession();
  if (!session) return;
  await withSave(session, "search", () => zhimuApi.searchWorldEngineEvents());
}

export async function commitWorldEngineWorkspace(candidateId) {
  const session = currentSession();
  if (!session || !candidateId) return;
  await withSave(session, "commit", () => zhimuApi.commitWorldEngineEvents({ candidateIds: [candidateId] }));
}

export async function lowerWorldEngineWorkspace(actionType) {
  const session = currentSession();
  if (!session || !actionType) return;
  await withSave(session, "lower", () => zhimuApi.lowerWorldEngineType(actionType));
}

export async function searchWorldEngineEpistemicWorkspace() {
  const session = currentSession();
  if (!session) return;
  await withSave(session, "epistemic", () => zhimuApi.searchWorldEngineEpistemic());
}

export async function renderWorldEngineWorkspace(characterId) {
  const session = currentSession();
  if (!session || !characterId) return;
  await withSave(session, "render", async () => {
    const rendered = await zhimuApi.renderWorldEngineScript({ characterId, actId: "ACT_1" });
    const latest = await zhimuApi.getWorldEngine();
    latest.lastRender = rendered;
    return latest;
  });
}
