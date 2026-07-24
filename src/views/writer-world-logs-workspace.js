import * as zhimuApi from "../api/index.js";
import { normalizeError } from "../components/status-ui.js";
import { showToast } from "../components/toast.js";
import { render } from "../runtime/runtime-facade.js";
import { studioStore } from "../state/index.js";
import {
  WORLD_LOG_MAX_LIMIT,
  WORLD_LOG_PAGE_SIZE,
  canReadWorldLogs,
  normalizeWorldLogFilters,
  worldLogQuery
} from "./writer-world-logs-model.js";
import { worldLogsWorkspaceHtml } from "./writer-world-logs-view.js";
import {
  beginWriterToolSession,
  getWriterToolSession,
  writerToolSessionIsCurrent
} from "./writer-tool-session.js";
import "./writer-world-logs-workspace.css";

export { worldLogsWorkspaceHtml } from "./writer-world-logs-view.js";

function currentWorldLogsSession() {
  const data = studioStore.get().cloudStudio;
  const session = getWriterToolSession(data);
  if (!session || session.type !== "logs") return null;
  if (!canReadWorldLogs(data?.world)) {
    showToast("当前身份不能查看世界运行日志");
    return null;
  }
  return { data, session };
}

function filterSummary(data, filters) {
  const room = (data?.rooms || []).find((item) => String(item.id) === filters.roomId);
  const parts = [];
  if (room) parts.push(`运行房：${room.name || "未命名"}`);
  if (filters.eventType) parts.push(`事件：${filters.eventType}`);
  if (filters.keyword) parts.push(`关键词：${filters.keyword}`);
  return parts.length ? parts.join(" · ") : "全部运行房 · 全部事件";
}

async function loadWorldLogs(data, session) {
  const sequence = ++session.requestSequence;
  session.loading = true;
  session.error = "";
  session.summary = filterSummary(data, session.filters);
  render();
  try {
    const logs = await zhimuApi.getWorldLogs(worldLogQuery(data, session.filters), session.worldId);
    if (!writerToolSessionIsCurrent(session) || sequence !== session.requestSequence) return false;
    session.logs = Array.isArray(logs) ? logs : [];
    return true;
  } catch (error) {
    if (writerToolSessionIsCurrent(session) && sequence === session.requestSequence) {
      session.error = normalizeError(error, "世界运行日志加载失败");
    }
    return false;
  } finally {
    if (writerToolSessionIsCurrent(session) && sequence === session.requestSequence) {
      session.loading = false;
      render();
    }
  }
}

export async function openWorldLogsWorkspace() {
  const data = studioStore.get().cloudStudio;
  if (!data?.world) return showToast("请先选择一个剧本");
  if (!canReadWorldLogs(data.world)) return showToast("当前身份不能查看世界运行日志");
  const filters = normalizeWorldLogFilters(data, { limit: WORLD_LOG_PAGE_SIZE });
  const session = beginWriterToolSession("logs", data, {
    loading: true,
    error: "",
    requestSequence: 0,
    filters,
    keywordDraft: "",
    logs: [],
    summary: "全部运行房 · 全部事件"
  });
  if (!session) return showToast("当前工具还有未保存修改，请先返回处理");
  render();
  return loadWorldLogs(data, session);
}

export function bindWorldLogsWorkspace(data, session) {
  const root = document.querySelector('[data-writer-tool="logs"]');
  if (!root || root.dataset.bound || !session || !canReadWorldLogs(data?.world)) return;
  root.dataset.bound = "1";
  const keyword = root.querySelector("[data-writer-log-keyword]");
  keyword?.addEventListener("input", () => {
    session.keywordDraft = keyword.value;
  });
  keyword?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    void applyWorldLogFilters();
  });
}

export function setWorldLogFilter(kind, value) {
  const current = currentWorldLogsSession();
  if (!current) return;
  const next = { ...current.session.filters, limit: WORLD_LOG_PAGE_SIZE };
  if (kind === "room") next.roomId = value;
  else if (kind === "event") next.eventType = value;
  current.session.filters = normalizeWorldLogFilters(current.data, next);
  return loadWorldLogs(current.data, current.session);
}

export function applyWorldLogFilters() {
  const current = currentWorldLogsSession();
  if (!current || current.session.loading) return;
  const field = document.querySelector('[data-writer-tool="logs"] [data-writer-log-keyword]');
  current.session.keywordDraft = field?.value ?? current.session.keywordDraft;
  current.session.filters = normalizeWorldLogFilters(current.data, {
    ...current.session.filters,
    keyword: current.session.keywordDraft,
    limit: WORLD_LOG_PAGE_SIZE
  });
  current.session.keywordDraft = current.session.filters.keyword;
  return loadWorldLogs(current.data, current.session);
}

export function clearWorldLogFilters() {
  const current = currentWorldLogsSession();
  if (!current || current.session.loading) return;
  current.session.filters = normalizeWorldLogFilters(current.data, { limit: WORLD_LOG_PAGE_SIZE });
  current.session.keywordDraft = "";
  return loadWorldLogs(current.data, current.session);
}

export function refreshWorldLogs() {
  const current = currentWorldLogsSession();
  if (current && !current.session.loading) return loadWorldLogs(current.data, current.session);
}

export function loadMoreWorldLogs() {
  const current = currentWorldLogsSession();
  if (!current || current.session.loading || current.session.filters.limit >= WORLD_LOG_MAX_LIMIT) return;
  current.session.filters = {
    ...current.session.filters,
    limit: Math.min(WORLD_LOG_MAX_LIMIT, current.session.filters.limit + WORLD_LOG_PAGE_SIZE)
  };
  return loadWorldLogs(current.data, current.session);
}
