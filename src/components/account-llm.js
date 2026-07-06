/* Account settings — BYOK LLM connections */
import * as F from "../utils/format.js";

const escapeHtml = F.escapeHtml || ((v = "") => String(v));

const ROUTING_LABELS = {
  prefer_own: "优先自备 API（无配置时用平台额度）",
  own_only: "仅使用自备 API",
  platform_only: "仅使用平台额度（消耗织幕积分）"
};

export function renderAccountLlmSection(llm) {
  if (!llm) {
    return `<section class="form-group account-llm-section"><h3>AI 模型连接</h3><p class="muted-note">加载中…</p></section>`;
  }
  if (!llm.encryptionReady) {
    return `<section class="form-group account-llm-section"><h3>AI 模型连接</h3><p class="muted-note">服务器尚未启用 API Key 加密存储，暂无法保存自备连接。创作时可使用平台 AI 额度（若已开放）。</p></section>`;
  }

  const prefs = llm.preferences || { routingMode: "prefer_own" };
  const connections = llm.connections || [];
  const presets = llm.presets || {};
  const presetOptions = Object.entries(presets)
    .map(([key, preset]) => `<option value="${escapeHtml(key)}">${escapeHtml(preset.label || key)}</option>`)
    .join("");
  const routingOptions = Object.entries(ROUTING_LABELS)
    .map(([value, label]) => `<option value="${value}" ${prefs.routingMode === value ? "selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");

  const rows = connections
    .map((conn) => {
      const active = conn.isActive && conn.enabled;
      return `<div class="collab-row account-llm-row" data-llm-row="${escapeHtml(conn.id)}">
        <div>
          <b>${escapeHtml(conn.name)}</b>
          ${active ? `<span class="cloud-pill">当前</span>` : ""}
          <p class="muted-note">${escapeHtml(conn.provider)} · ${escapeHtml(conn.model)} · ${escapeHtml(conn.baseUrl)} · Key ${escapeHtml(conn.apiKeyHint || "****")}</p>
        </div>
        <div class="row" style="gap:6px;flex-wrap:wrap">
          ${active ? "" : `<button type="button" class="text-btn" data-llm-activate="${escapeHtml(conn.id)}">设为当前</button>`}
          <button type="button" class="text-btn" data-llm-test="${escapeHtml(conn.id)}">测试</button>
          <button type="button" class="text-btn danger-text" data-llm-delete="${escapeHtml(conn.id)}">删除</button>
        </div>
      </div>`;
    })
    .join("");

  const platformNote = llm.platform?.available
    ? escapeHtml(llm.platform.note || "未配置自备 API 时将消耗织幕积分")
    : "平台 AI 额度暂未开放";

  return `<section class="form-group account-llm-section">
    <h3>AI 模型连接</h3>
    <p class="muted-note">推荐配置您自己的 OpenAI 兼容 API（DeepSeek、OpenAI 等）。${platformNote}</p>
    <div class="form-group" style="margin-top:12px">
      <label>路由策略</label>
      <select class="field" data-llm-routing>${routingOptions}</select>
      <button type="button" class="secondary-btn" style="margin-top:8px" data-llm-save-routing>保存策略</button>
    </div>
    <div class="collab-list" style="margin-top:14px">${rows || `<div class="empty-state">尚未添加连接</div>`}</div>
    <details class="account-llm-add" style="margin-top:14px">
      <summary class="text-btn" style="cursor:pointer">添加 API 连接</summary>
      <div class="form-group" style="margin-top:10px">
        ${field("连接名称", "llmName", "input", "默认连接")}
        <label>提供商</label>
        <select class="field" data-llm-provider>${presetOptions}</select>
        ${field("Base URL", "llmBaseUrl", "input", "https://api.deepseek.com")}
        ${field("模型", "llmModel", "input", "deepseek-chat")}
        ${field("API Key", "llmApiKey", "input", "sk-…")}
        <button type="button" class="primary-btn" style="margin-top:10px" data-llm-create>保存连接</button>
      </div>
    </details>
  </section>`;
}

function field(label, key, type, placeholder) {
  return `<label>${escapeHtml(label)}</label><input class="field" type="${type === "input" && key.includes("Key") ? "password" : "text"}" data-studio-field="${escapeHtml(key)}" placeholder="${escapeHtml(placeholder)}">`;
}

export function bindAccountLlmPanel(root, api, { onRefresh, showToast, handleApiError }) {
  root.querySelector("[data-llm-save-routing]")?.addEventListener("click", async () => {
    const select = root.querySelector("[data-llm-routing]");
    try {
      await api.updateAccountLlmPreferences({ routingMode: select?.value || "prefer_own" });
      showToast("路由策略已保存");
      await onRefresh?.();
    } catch (error) {
      handleApiError(error, showToast);
    }
  });

  root.querySelector("[data-llm-create]")?.addEventListener("click", async () => {
    const provider = root.querySelector("[data-llm-provider]")?.value || "openai_compatible";
    const presets = window.__zhimuLlmPresets || {};
    const preset = presets[provider] || {};
    const btn = root.querySelector("[data-llm-create]");
    if (btn) btn.disabled = true;
    try {
      await api.createAccountLlmConnection({
        name: root.querySelector('[data-studio-field="llmName"]')?.value || "默认连接",
        provider,
        baseUrl: root.querySelector('[data-studio-field="llmBaseUrl"]')?.value || preset.baseUrl,
        model: root.querySelector('[data-studio-field="llmModel"]')?.value || preset.defaultModel,
        apiKey: root.querySelector('[data-studio-field="llmApiKey"]')?.value || ""
      });
      showToast("API 连接已保存");
      await onRefresh?.();
    } catch (error) {
      handleApiError(error, showToast);
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  root.querySelectorAll("[data-llm-activate]").forEach((btn) => {
    btn.onclick = async () => {
      try {
        await api.activateAccountLlmConnection(btn.dataset.llmActivate);
        showToast("已切换当前连接");
        await onRefresh?.();
      } catch (error) {
        handleApiError(error, showToast);
      }
    };
  });

  root.querySelectorAll("[data-llm-test]").forEach((btn) => {
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        const result = await api.testAccountLlmConnection(btn.dataset.llmTest);
        showToast(result.message || "连接成功");
      } catch (error) {
        handleApiError(error, showToast);
      } finally {
        btn.disabled = false;
      }
    };
  });

  root.querySelectorAll("[data-llm-delete]").forEach((btn) => {
    btn.onclick = async () => {
      if (!window.confirm("确定删除该 API 连接？")) return;
      try {
        await api.deleteAccountLlmConnection(btn.dataset.llmDelete);
        showToast("连接已删除");
        await onRefresh?.();
      } catch (error) {
        handleApiError(error, showToast);
      }
    };
  });

  const providerSelect = root.querySelector("[data-llm-provider]");
  providerSelect?.addEventListener("change", () => {
    const preset = (window.__zhimuLlmPresets || {})[providerSelect.value];
    if (!preset) return;
    const base = root.querySelector('[data-studio-field="llmBaseUrl"]');
    const model = root.querySelector('[data-studio-field="llmModel"]');
    if (base && !base.value.trim()) base.value = preset.baseUrl || "";
    if (model && !model.value.trim()) model.value = preset.defaultModel || "";
  });
}

export function stashLlmPresets(llm) {
  window.__zhimuLlmPresets = llm?.presets || {};
}
