/* Creator mini-game design — test feature backed by room mini-game runtime. */
import * as zhimuApi from "../api/index.js";
import { formField, formSelect } from "../components/form-fields.js";
import { normalizeMiniGameTemplate } from "../../shared/mini-game-protocol.js";
import { showToast } from "../components/toast.js";
import {
  bindWorkspaceDraft,
  renderWorkspaceEditor,
  setWorkspaceSaving,
  showWorkspaceErrors,
  workspaceValues
} from "../components/workspace-editor.js";
import { render } from "../runtime/runtime-facade.js";
import { registerView } from "../runtime/view-registry.js";
import { studioStore, worldStore } from "../state/index.js";
import * as F from "../utils/format.js";
import * as U from "../components/emptyState.js";
import { normalizeError } from "../components/status-ui.js";
  const escapeHtml = F.escapeHtml || ((value = "") => String(value));
  const catalogExperienceBanner = U.catalogExperienceBanner || (() => "");
  const showError = (error, fallback = "操作失败，请稍后重试") => showToast(normalizeError(error, fallback));
  let miniGameEditorState = null;

  function templates() {
    const world = studioStore.get().cloudStudio?.world;
    const saved = world?.settings?.miniGameTemplates;
    if (Array.isArray(saved)) return saved;
    return [];
  }

  function normalizeTemplate(raw = {}) {
    return { ...normalizeMiniGameTemplate(raw), status: "test" };
  }

  async function saveTemplates(nextTemplates) {
    const studio = studioStore.get().cloudStudio;
    const world = studio?.world;
    if (!world || !zhimuApi.context.worldId) throw new Error("请先选择剧本世界");
    const revision = world.content_revision;
    const settingsPatch = { miniGameTemplates: nextTemplates.map(normalizeTemplate) };
    const updated = await zhimuApi.patchWorld({ settings: settingsPatch }, zhimuApi.context.worldId, { revision });
    const nextSettings = updated.settings || { ...(world.settings || {}), ...settingsPatch };
    studioStore.set({
      cloudStudio: {
        ...studio,
        world: { ...world, settings: nextSettings, content_revision: updated.content_revision ?? world.content_revision }
      }
    });
    worldStore.set({
      cloudWorlds: (worldStore.get().cloudWorlds || []).map((item) =>
        item.id === zhimuApi.context.worldId ? { ...item, settings: nextSettings } : item
      )
    });
  }

  function templatePayload(template) {
    return normalizeMiniGameTemplate(template);
  }

  function miniGameDraft(template) {
    return {
      miniPluginKey: template.pluginKey || template.gameType || "zhimu_lock",
      miniTitle: template.title,
      miniPrompt: template.prompt,
      miniHint: template.hint,
      miniAnswer: template.answer,
      miniLength: String(template.length || 4),
      miniAttempts: String(template.maxAttempts || 3),
      miniTimeout: String(template.timeoutSeconds || 0),
      miniRecovery: template.allowRecovery === false ? "false" : "true",
      miniSuccessText: template.successText || "",
      miniFailureText: template.failureText || "",
      miniRecapLabel: template.recapLabel || template.title || ""
    };
  }

  function templateCard(template, index) {
    const typeLabel = template.pluginKey === "zhimu_sequence"
      ? "顺序还原"
      : template.pluginKey === "zhimu_guess"
        ? "歌猜 / 口令"
        : "数字锁";
    const answerLabel = template.pluginKey === "zhimu_sequence"
      ? (template.answer ? `${String(template.answer).split(",").filter(Boolean).length} 步` : "未填写答案")
      : (template.answer ? `${template.answer.length} 位答案` : "未填写答案");
    return `<article class="mini-template-card">
      <div class="mini-template-head">
        <div><span class="test-badge">测试功能</span><h3>${escapeHtml(template.title)}</h3><p>${escapeHtml(template.prompt || "未填写提示")}</p></div>
        <strong>${escapeHtml(answerLabel)}</strong>
      </div>
      <div class="mini-template-meta">
        <span>类型：${escapeHtml(typeLabel)}</span>
        <span>尝试次数：${Number(template.maxAttempts || 3)}</span>
        <span>玩家输入长度：${Number(template.length || 4)}</span>
        <span>${template.timeoutSeconds ? `限时：${Number(template.timeoutSeconds)} 秒` : "不限时"}</span>
        <span>${template.allowRecovery === false ? "失败后不可恢复" : "允许主持恢复"}</span>
      </div>
      ${template.hint ? `<p class="mini-template-hint">提示：${escapeHtml(template.hint)}</p>` : ""}
      <div class="row mini-template-actions">
        <button class="primary-btn" data-action="mini-game-launch" data-template="${escapeHtml(template.id)}">在当前房间测试启动</button>
        <button class="secondary-btn" data-action="mini-game-edit" data-template="${escapeHtml(template.id)}">编辑</button>
        <button class="text-btn danger-text" data-action="mini-game-delete" data-template="${escapeHtml(template.id)}">删除</button>
      </div>
    </article>`;
  }

  function backendStatusCard() {
    const room = U.activeRuntimeRoom?.();
    return `<aside class="mini-backend-card">
      <p class="section-kicker">BACKEND</p>
      <h3>后端已接好的能力</h3>
      <ul>
        <li>主持端可启动数字锁 / 顺序还原 / 歌猜口令小游戏</li>
        <li>玩家端可提交答案并同步结果</li>
        <li>运行房会记录事件和主持操作日志</li>
        <li>同一房间只保留一个进行中的小游戏</li>
      </ul>
      <div class="rule-block">
        <strong>当前测试房</strong>
        <p>${room ? `${escapeHtml(room.name || "运行房")} · ${escapeHtml(room.invite_code || "")}` : "尚未选择运行房"}</p>
      </div>
      <button class="secondary-btn full-btn" data-action="open-host-console" data-room-id="${escapeHtml(room?.id || "")}">打开${room ? "当前房间" : ""}主持端</button>
    </aside>`;
  }

  function renderMiniGameEditor() {
    if (!miniGameEditorState) return "";
    const value = miniGameEditorState.draft;
    const isSequence = value.miniPluginKey === "zhimu_sequence";
    const isGuess = value.miniPluginKey === "zhimu_guess";
    const body =
      formSelect("类型", "miniPluginKey", [
        { id: "zhimu_lock", name: "数字密码锁" },
        { id: "zhimu_sequence", name: "顺序还原" },
        { id: "zhimu_guess", name: "歌猜 / 口令" }
      ], value.miniPluginKey || "zhimu_lock") +
      formField("标题", "miniTitle", "input", value.miniTitle) +
      formField("玩家提示", "miniPrompt", "textarea", value.miniPrompt, { rows: 5 }) +
      formField("额外提示（可选）", "miniHint", "textarea", value.miniHint, { rows: 4 }) +
      formField(
        isSequence ? "答案（逗号分隔顺序）" : isGuess ? "答案（歌名 / 口令）" : "答案",
        "miniAnswer",
        "input",
        value.miniAnswer,
        isSequence || isGuess ? {} : { inputMode: "numeric" }
      ) +
      formField("输入长度", "miniLength", "input", value.miniLength, { inputType: "number", inputMode: "numeric" }) +
      formField("尝试次数", "miniAttempts", "input", value.miniAttempts, { inputType: "number", inputMode: "numeric" }) +
      formField("限时秒数（0 表示不限时）", "miniTimeout", "input", value.miniTimeout, { inputType: "number", inputMode: "numeric" }) +
      formSelect("失败后恢复", "miniRecovery", [
        { id: "true", name: "允许主持人恢复新机会" },
        { id: "false", name: "失败即结束" }
      ], value.miniRecovery) +
      formField("成功反馈", "miniSuccessText", "textarea", value.miniSuccessText, { rows: 3 }) +
      formField("失败反馈", "miniFailureText", "textarea", value.miniFailureText, { rows: 3 }) +
      formField("复盘显示名称", "miniRecapLabel", "input", value.miniRecapLabel);
    return renderWorkspaceEditor({
      title: miniGameEditorState.existing ? `编辑小游戏 · ${value.miniTitle}` : `新建小游戏 · ${isSequence ? "顺序还原" : isGuess ? "歌猜 / 口令" : "数字锁"}`,
      kicker: "MINI GAME EDITOR",
      intro: "模板内容随剧本替换，运行协议保持固定；保存后可从主持端启动、恢复和结算。",
      body,
      status: `<span class="test-badge">测试功能</span><p>当前支持数字锁、顺序还原与歌猜口令；答案仅用于运行房校验，不会展示给玩家。</p>`,
      submitLabel: miniGameEditorState.existing ? "保存模板" : "创建模板",
      submitAction: "mini-game-editor-save",
      cancelAction: "mini-game-editor-close",
      className: "mini-game-workspace-editor"
    });
  }

  export function miniGames() {
    const data = studioStore.get().cloudStudio;
    if (!data) {
      return U.creatorWorkspaceEmpty?.({
        title: "小游戏设计",
        kicker: "TEST FEATURE",
        intro: "用于设计运行房中的简单互动机关。请先选择或创建剧本世界。",
        guideTitle: "当前支持",
        guideItems: [
          { label: "数字锁", title: "测试功能", text: "密码机关：创作者保存模板，主持人启动，玩家端答题。" },
          { label: "顺序还原", title: "测试功能", text: "按正确顺序提交步骤（逗号分隔）。" },
          { label: "歌猜 / 口令", title: "测试功能", text: "根据提示提交歌名或口令。" }
        ]
      }) || `<section class="card"><h3>尚未选择剧本</h3></section>`;
    }
    const list = templates().map(normalizeTemplate);
    return `${catalogExperienceBanner(data.world)}<section class="mini-games-page">
      <div class="section-head">
        <div><p class="section-kicker">TEST FEATURE</p><h2>小游戏设计</h2><p>支持数字锁、顺序还原与歌猜口令三类模板；保存后可在主持端启动测试。</p></div>
        <div class="row">
          <button class="primary-btn" data-action="mini-game-new" data-plugin="zhimu_lock">＋ 数字锁</button>
          <button class="secondary-btn" data-action="mini-game-new" data-plugin="zhimu_sequence">＋ 顺序还原</button>
          <button class="secondary-btn" data-action="mini-game-new" data-plugin="zhimu_guess">＋ 歌猜口令</button>
        </div>
      </div>
      <div class="mini-games-layout">
        <main class="mini-template-list">
          <article class="mini-template-guide">
            <span class="test-badge">测试功能</span>
            <h3>三类机关</h3>
            <p>数字锁适合密码柜；顺序还原适合流程步骤；歌猜/口令适合暗号。导入主持手册时会预置三类示例模板。</p>
          </article>
          ${list.length ? list.map(templateCard).join("") : `<div class="empty-state enriched-empty"><p><strong>还没有小游戏模板</strong></p><p>任选一类创建，或重新执行结构化导入以预置三类模板。</p><div class="row"><button class="primary-btn" data-action="mini-game-new" data-plugin="zhimu_lock">＋ 数字锁</button><button class="secondary-btn" data-action="mini-game-new" data-plugin="zhimu_sequence">＋ 顺序还原</button><button class="secondary-btn" data-action="mini-game-new" data-plugin="zhimu_guess">＋ 歌猜口令</button></div></div>`}
        </main>
        ${renderMiniGameEditor() || backendStatusCard()}
      </div>
    </section>`;
  }

  export function openMiniGameEditor(templateId = "", pluginKey = "zhimu_lock") {
    const current = templates().map(normalizeTemplate);
    const existing = current.find((item) => item.id === templateId);
    const template = normalizeTemplate(existing || { pluginKey: pluginKey || "zhimu_lock" });
    miniGameEditorState = { existing: Boolean(existing), templateId: template.id, draft: miniGameDraft(template) };
    render();
  }

  export function closeMiniGameEditor() {
    miniGameEditorState = null;
    render();
  }

  export function bindMiniGameEditor() {
    const root = document.querySelector(".mini-game-workspace-editor[data-workspace-editor]");
    bindWorkspaceDraft(root, miniGameEditorState?.draft);
  }

  export async function saveMiniGameEditor() {
    if (!miniGameEditorState) return;
    const root = document.querySelector(".mini-game-workspace-editor[data-workspace-editor]");
    const values = workspaceValues(root);
    if (!values.miniTitle) {
      showWorkspaceErrors(root, ["请填写小游戏标题"]);
      root?.querySelector('[data-studio-field="miniTitle"]')?.focus();
      return;
    }
    if (!values.miniAnswer) {
      showWorkspaceErrors(root, ["请填写用于校验的答案"]);
      root?.querySelector('[data-studio-field="miniAnswer"]')?.focus();
      return;
    }
    const current = templates().map(normalizeTemplate);
    const next = normalizeTemplate({
      id: miniGameEditorState.templateId,
      pluginKey: values.miniPluginKey || "zhimu_lock",
      title: values.miniTitle,
      prompt: values.miniPrompt,
      hint: values.miniHint,
      answer: values.miniAnswer,
      length: values.miniLength,
      maxAttempts: values.miniAttempts,
      timeoutSeconds: values.miniTimeout,
      allowRecovery: values.miniRecovery !== "false",
      successText: values.miniSuccessText,
      failureText: values.miniFailureText,
      recapLabel: values.miniRecapLabel
    });
    miniGameEditorState.draft = miniGameDraft(next);
    setWorkspaceSaving(root, true);
    showWorkspaceErrors(root, []);
    try {
      const nextList = miniGameEditorState.existing
        ? current.map((item) => item.id === next.id ? next : item)
        : [next, ...current];
      const wasExisting = miniGameEditorState.existing;
      await saveTemplates(nextList);
      miniGameEditorState = null;
      render();
      showToast(wasExisting ? "小游戏模板已保存" : "小游戏模板已创建");
    } catch (error) {
      setWorkspaceSaving(root, false);
      showWorkspaceErrors(root, [error?.message || "小游戏模板保存失败"]);
      showError(error, "小游戏模板保存失败");
    }
  }

  export async function deleteMiniGameTemplate(templateId) {
    const current = templates().map(normalizeTemplate);
    const next = current.filter((item) => item.id !== templateId);
    try {
      await saveTemplates(next);
      if (miniGameEditorState?.templateId === templateId) miniGameEditorState = null;
      render();
      showToast("小游戏模板已删除");
    } catch (error) {
      showError(error, "小游戏模板删除失败");
    }
  }

  export async function launchMiniGameTemplate(templateId) {
    const room = U.activeRuntimeRoom?.();
    if (!room) return showToast("请先在世界总览选择或创建运行房");
    const template = templates().map(normalizeTemplate).find((item) => item.id === templateId);
    if (!template) return showToast("小游戏模板不存在");
    if (!template.answer) return showToast("请先填写答案再测试启动");
    try {
      await zhimuApi.hostStartMiniGame(templatePayload(template));
      showToast("小游戏已在当前运行房启动，玩家端会实时显示");
    } catch (error) {
      showError(error, "小游戏启动失败");
    }
  }

export const miniGamesViewApi = { miniGames, openMiniGameEditor, closeMiniGameEditor, bindMiniGameEditor, saveMiniGameEditor, deleteMiniGameTemplate, launchMiniGameTemplate };
registerView("miniGames", miniGamesViewApi);
