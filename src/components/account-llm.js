/* Account settings — BYOK LLM connections */
import * as F from "../utils/format.js";

const escapeHtml = F.escapeHtml || ((v = "") => String(v));

const ROUTING_LABELS = {
  prefer_own: "优先自备 API（平台池开放时可兜底）",
  own_only: "仅使用自备 API",
  platform_only: "仅使用平台额度（消耗织幕积分）"
};

export function renderAccountLlmSection(llm) {
  if (!llm) {
    return `<section class="form-group account-llm-section"><h3>AI 模型连接</h3><p class="muted-note">加载中…</p></section>`;
  }
  if (!llm.encryptionReady) {
    return `<section class="form-group account-llm-section"><h3>AI 模型连接</h3><p class="muted-note">服务器尚未启用 API Key 加密存储，暂无法保存自备连接。</p></section>`;
  }

  const prefs = llm.preferences || { routingMode: "own_only" };
  const connections = llm.connections || [];
  const presets = llm.presets || {};
  const defaultPreset = Object.values(presets)[0] || {};
  const presetOptions = Object.entries(presets)
    .map(([key, preset]) => `<option value="${escapeHtml(key)}">${escapeHtml(preset.label || key)}</option>`)
    .join("");
  const suggestedModels = [...new Set(
    Object.values(presets).flatMap((preset) => preset.models || []).filter(Boolean)
  )];
  const modelOptions = suggestedModels
    .map((model) => `<option value="${escapeHtml(model)}"></option>`)
    .join("");
  const routingOptions = Object.entries(ROUTING_LABELS)
    .map(([value, label]) => `<option value="${value}" ${prefs.routingMode === value ? "selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");

  const rows = connections
    .map((conn) => {
      const active = conn.isActive && conn.enabled;
      const providerLabel = presets[conn.provider]?.label || conn.provider;
      return `<div class="collab-row account-llm-row" data-llm-row="${escapeHtml(conn.id)}">
        <div>
          <b>${escapeHtml(conn.name)}</b>
          ${active ? `<span class="cloud-pill">当前</span>` : ""}
          <p class="muted-note">${escapeHtml(providerLabel)} · ${escapeHtml(conn.model)} · ${escapeHtml(conn.baseUrl)} · Key ${escapeHtml(conn.apiKeyHint || "****")}</p>
        </div>
        <div class="row" style="gap:6px;flex-wrap:wrap">
          ${active ? "" : `<button type="button" class="text-btn" data-llm-activate="${escapeHtml(conn.id)}">设为当前</button>`}
          <button type="button" class="text-btn" data-llm-test="${escapeHtml(conn.id)}">测试</button>
          <button type="button" class="text-btn danger-text" data-llm-delete="${escapeHtml(conn.id)}">删除</button>
        </div>
      </div>`;
    })
    .join("");

  const platformAvailable = Boolean(llm.platform?.available);
  const platformNote = escapeHtml(
    llm.platform?.note
      || (platformAvailable ? "平台 AI 池已开放" : "平台 AI 池暂不面向用户开放")
  );
  const routingControls = platformAvailable
    ? `<div class="form-group" style="margin-top:12px">
        <label>路由策略</label>
        <select class="field" data-llm-routing>${routingOptions}</select>
        <button type="button" class="secondary-btn" style="margin-top:8px" data-llm-save-routing>保存策略</button>
      </div>`
    : `<div class="check-result success" style="margin-top:12px">
        <b>仅使用您的 API</b>
        <span>平台密钥不会加入用户调用池，AI 消耗由您选择的服务商账户承担。</span>
      </div>`;

  return `<section class="form-group account-llm-section">
    <h3>AI 模型连接</h3>
    <p class="muted-note">选择服务商和模型，使用您自己的 API Key 与额度。Key 加密保存在服务器，页面只显示末尾提示。${platformNote}</p>
    ${routingControls}
    <div class="collab-list" style="margin-top:14px">${rows || `<div class="empty-state">尚未添加连接</div>`}</div>
    <details class="account-llm-add" style="margin-top:14px">
      <summary class="text-btn" style="cursor:pointer">添加 API 连接</summary>
      <div class="form-group" style="margin-top:10px">
        ${field("连接名称", "llmName", "input", "默认连接")}
        <label>服务商 / 兼容接口</label>
        <select class="field" data-llm-provider>${presetOptions}</select>
        ${field("API 地址（Base URL）", "llmBaseUrl", "input", defaultPreset.baseUrl || "https://api.deepseek.com")}
        ${field("模型标识（可输入自定义模型）", "llmModel", "input", defaultPreset.defaultModel || "", "llm-model-options")}
        <datalist id="llm-model-options">${modelOptions}</datalist>
        ${field("API Key", "llmApiKey", "input", "sk-…")}
        <button type="button" class="primary-btn" style="margin-top:10px" data-llm-create>保存连接</button>
      </div>
    </details>
  </section>`;
}

function field(label, key, type, placeholder, listId = "") {
  const list = listId ? ` list="${escapeHtml(listId)}"` : "";
  return `<label>${escapeHtml(label)}</label><input class="field" type="${type === "input" && key.includes("Key") ? "password" : "text"}" data-studio-field="${escapeHtml(key)}" placeholder="${escapeHtml(placeholder)}"${list}>`;
}

export function bindAccountLlmPanel(root, api, { onRefresh, showToast, handleApiError }) {
  root.querySelector("[data-llm-save-routing]")?.addEventListener("click", async () => {
    const select = root.querySelector("[data-llm-routing]");
    try {
      await api.updateAccountLlmPreferences({ routingMode: select?.value || "own_only" });
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
  const syncProviderPreset = () => {
    if (!providerSelect) return;
    const preset = (window.__zhimuLlmPresets || {})[providerSelect.value];
    if (!preset) return;
    const base = root.querySelector('[data-studio-field="llmBaseUrl"]');
    const model = root.querySelector('[data-studio-field="llmModel"]');
    if (base) base.value = preset.baseUrl || "";
    if (model) {
      model.value = preset.defaultModel || "";
      model.placeholder = preset.models?.length
        ? `例如：${preset.models.join("、")}`
        : "输入服务商支持的模型标识";
    }
  };
  providerSelect?.addEventListener("change", syncProviderPreset);
  syncProviderPreset();
}

export function stashLlmPresets(llm) {
  window.__zhimuLlmPresets = llm?.presets || {};
}
