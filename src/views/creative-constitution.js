/** First-class author intent editor used by diagnostics and future AI workflows. */
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { normalizeError } from "../components/status-ui.js";
import { render, go } from "../runtime/runtime-facade.js";
import { registerView } from "../runtime/view-registry.js";
import { studioStore, worldStore } from "../state/index.js";
import { escapeHtml } from "../utils/format.js";
import {
  creativeConstitutionCoverage,
  normalizeCreativeConstitution
} from "../../shared/creative-constitution.js";

const FIELD_DEFS = [
  ["theme", "核心主题", "这部作品真正想讨论什么？", 3],
  ["intendedEmotion", "玩家最终应该产生什么感受", "例如：先确信自己掌握了真相，随后意识到判断建立在错误时间顺序上。", 3],
  ["experiencePromise", "最重要的体验承诺", "写成可以验收的承诺：玩家在什么时候，通过什么体验，应该意识到什么。", 5],
  ["revealEmotion", "真相揭晓时的目标情绪", "震惊、愧疚、释然、争议，还是重新理解某个角色？", 3],
  ["desiredDebates", "希望玩家争论什么", "局后仍值得讨论的价值判断、关系选择或开放问题。", 3],
  ["avoidMisunderstandings", "不希望玩家误解什么", "明确作品不想传达的结论，防止生成和修改不断跑偏。", 3]
];

const LIST_FIELD_DEFS = [
  ["inviolablePrinciples", "不可破坏原则", "每行一条，例如：真相揭晓前至少出现三条可验证证据。"],
  ["fairPuzzlePromises", "必须公平的谜题", "每行一条，写明哪一个谜题必须能由游戏内信息推出。"],
  ["pacingPrinciples", "节奏原则", "每行一条，例如：第二幕不新增世界观，只加速旧线索碰撞。"],
  ["voicePrinciples", "文风原则", "每行一条，例如：角色本避免全知视角和作者式结论。"],
  ["forbiddenTropes", "禁用套路", "每行一条，例如：失忆、双胞胎、未登场人物完成反转。"]
];

function currentWorld() {
  const worldId = zhimuApi.context.worldId;
  const listed = (worldStore.get().cloudWorlds || []).find((world) => world.id === worldId);
  const preview = worldStore.get().cloudWorkspacePreview?.world;
  const studio = studioStore.get().cloudStudio?.world;
  return {
    ...listed,
    ...(preview?.id === worldId ? preview : {}),
    ...(studio?.id === worldId ? studio : {})
  };
}

function currentRoles() {
  return worldStore.get().cloudWorkspacePreview?.roles
    || studioStore.get().cloudStudio?.roles
    || [];
}

function fieldHtml(constitution, [key, label, placeholder, rows], canEdit) {
  return `<label class="constitution-field">
    <span>${escapeHtml(label)}</span>
    <textarea class="field" data-constitution-field="${escapeHtml(key)}" rows="${rows}"
      maxlength="${key === "experiencePromise" ? 4000 : 2400}" ${canEdit ? "" : "readonly"}
      placeholder="${escapeHtml(placeholder)}">${escapeHtml(constitution[key] || "")}</textarea>
  </label>`;
}

function listFieldHtml(constitution, [key, label, placeholder], canEdit) {
  return `<label class="constitution-field constitution-list-field">
    <span>${escapeHtml(label)} <small>每行一条</small></span>
    <textarea class="field" data-constitution-list="${escapeHtml(key)}" rows="5"
      maxlength="12000" ${canEdit ? "" : "readonly"}
      placeholder="${escapeHtml(placeholder)}">${escapeHtml((constitution[key] || []).join("\n"))}</textarea>
  </label>`;
}

function roleHighlightHtml(role, promises, canEdit) {
  const promise = promises.get(String(role.id)) || "";
  return `<label class="constitution-role-row">
    <span><i>${escapeHtml((role.name || "角").slice(0, 1))}</i><strong>${escapeHtml(role.name || "未命名角色")}</strong></span>
    <textarea class="field" id="constitution-role-${escapeHtml(role.id)}" data-role-highlight="${escapeHtml(role.id)}"
      rows="2" maxlength="1200" ${canEdit ? "" : "readonly"}
      placeholder="只有这个角色能完成的行动、决定或情绪高潮">${escapeHtml(promise)}</textarea>
  </label>`;
}

function completionSummary(coverage) {
  const missing = coverage.missing.slice(0, 5);
  return `<aside class="constitution-progress-card">
    <div class="constitution-progress-ring" style="--constitution-score:${coverage.score}" data-constitution-ring>
      <strong data-constitution-score>${coverage.score}</strong><span>%</span>
    </div>
    <div>
      <p class="section-kicker">AUTHOR INTENT</p>
      <h3>宪法完整度</h3>
      <p><span data-constitution-filled>${coverage.filled}</span> / <span data-constitution-total>${coverage.total}</span> 项约束已写明</p>
    </div>
    <div class="constitution-missing" data-constitution-missing>
      ${missing.length
        ? missing.map((item) => `<span>${escapeHtml(item.label)}</span>`).join("")
        : `<span class="complete">核心约束已齐备</span>`}
    </div>
  </aside>`;
}

export function creativeConstitution() {
  const world = currentWorld();
  const roles = currentRoles();
  const constitution = normalizeCreativeConstitution(world?.settings?.creativeConstitution);
  const coverage = creativeConstitutionCoverage(constitution, roles);
  const promises = new Map(constitution.roleHighlights.map((item) => [String(item.roleId), item.promise]));
  const canEdit = ["owner", "editor"].includes(world?.membership_role);
  const readonly = canEdit ? "" : "readonly";

  return `<section class="constitution-page">
    <header class="constitution-hero">
      <div><p class="section-kicker">CREATIVE CONSTITUTION</p><h1>创作宪法</h1>
        <p>把作者意图写成整个项目都能读取的约束。作品诊断、后续 AI 玩家试跑和生成建议会以这里为准。</p>
      </div>
      <div class="constitution-hero-actions">
        <button type="button" class="secondary-btn" data-action="constitution-open-diagnostics">查看诊断</button>
        <button type="button" class="primary-btn" data-action="constitution-save" ${canEdit ? "" : "disabled"}>保存创作宪法</button>
      </div>
    </header>
    ${completionSummary(coverage)}
    ${canEdit ? "" : `<div class="workspace-inline-error"><strong>只读模式</strong><p>只有主创作者或编辑协作者可以修改创作宪法。</p></div>`}
    <div class="constitution-layout">
      <main class="constitution-main">
        <section class="card constitution-section">
          <div class="section-head"><div><p class="section-kicker">NORTH STAR</p><h2>作品的北极星</h2>
            <p>写清“作品为什么存在”，让局部修改不会把整体体验带偏。</p></div></div>
          <div class="constitution-field-grid">
            ${FIELD_DEFS.map((def) => fieldHtml(constitution, def, canEdit)).join("")}
          </div>
        </section>
        <section class="card constitution-section">
          <div class="section-head"><div><p class="section-kicker">GUARDRAILS</p><h2>创作护栏</h2>
            <p>这些内容会转化为诊断条件，而不只是项目备注。</p></div></div>
          <div class="constitution-field-grid constitution-list-grid">
            ${LIST_FIELD_DEFS.map((def) => listFieldHtml(constitution, def, canEdit)).join("")}
          </div>
        </section>
        <section class="card constitution-section">
          <div class="section-head"><div><p class="section-kicker">FAIRNESS</p><h2>推理与世界规则</h2>
            <p>创作宪法中的证据下限会覆盖通用诊断标准。</p></div></div>
          <div class="constitution-rule-grid">
            <label class="constitution-field"><span>每条关键结论的最低显式证据数</span>
              <select class="field" data-constitution-evidence ${canEdit ? "" : "disabled"}>
                ${[1, 2, 3, 4, 5].map((value) => `<option value="${value}" ${constitution.fairness.minimumEvidence === value ? "selected" : ""}>${value} 条</option>`).join("")}
              </select>
            </label>
            <label class="check-label constitution-check"><input type="checkbox" data-constitution-independent
              ${constitution.fairness.requireIndependentPaths ? "checked" : ""} ${canEdit ? "" : "disabled"}>
              <span><strong>关键证据需要独立获得路径</strong><small>避免单一调查点失败后整局卡死。</small></span>
            </label>
            <label class="constitution-field"><span>超自然解释政策</span>
              <select class="field" data-constitution-supernatural ${canEdit ? "" : "disabled"}>
                <option value="forbidden" ${constitution.supernaturalPolicy === "forbidden" ? "selected" : ""}>禁止作为解释</option>
                <option value="ambiguous" ${constitution.supernaturalPolicy === "ambiguous" ? "selected" : ""}>允许保持暧昧</option>
                <option value="allowed" ${constitution.supernaturalPolicy === "allowed" ? "selected" : ""}>允许，但必须提前建立规则</option>
              </select>
            </label>
            <label class="constitution-field constitution-rule-note"><span>超自然解释边界</span>
              <textarea class="field" data-constitution-field="supernaturalRules" rows="4" maxlength="2400"
                ${readonly} placeholder="例如：可以出现无法解释的感知，但不能用超自然力量改变物证。">${escapeHtml(constitution.supernaturalRules)}</textarea>
            </label>
          </div>
        </section>
        <section class="card constitution-section">
          <div class="section-head"><div><p class="section-kicker">ROLE PROMISES</p><h2>角色高光承诺</h2>
            <p>不是比较字数，而是明确每个角色为什么值得被玩家选择。</p></div>
            <span class="status-chip neutral" data-constitution-role-progress>${coverage.roles.filled} / ${coverage.roles.total} 已写明</span></div>
          <div class="constitution-role-list">
            ${roles.length
              ? roles.map((role) => roleHighlightHtml(role, promises, canEdit)).join("")
              : `<div class="empty-state">先创建角色席位，再为每个角色声明高光承诺。</div>`}
          </div>
        </section>
      </main>
      <aside class="constitution-side">
        <article class="card">
          <p class="section-kicker">HOW IT WORKS</p><h3>它会影响什么</h3>
          <ol><li>作品诊断采用你设置的证据下限。</li><li>缺少体验承诺或角色高光时给出可定位提醒。</li><li>后续 AI 玩家试跑以不可破坏原则作为评判边界。</li></ol>
        </article>
        <article class="card constitution-example">
          <p class="section-kicker">EXAMPLE</p><h3>可验收的承诺</h3>
          <blockquote>玩家在最后三十分钟应逐渐意识到，他们一直在用错误的时间顺序理解案件。</blockquote>
          <small>比“做一个震撼的反转”更容易被诊断和测试。</small>
        </article>
      </aside>
    </div>
    <div class="constitution-save-bar">
      <span>保存后，现有作品诊断会自动失效并按新宪法重新计算。</span>
      <button type="button" class="primary-btn" data-action="constitution-save" ${canEdit ? "" : "disabled"}>保存创作宪法</button>
    </div>
  </section>`;
}

export function collectCreativeConstitution(root = document) {
  const values = {};
  root.querySelectorAll("[data-constitution-field]").forEach((input) => {
    values[input.dataset.constitutionField] = input.value || "";
  });
  root.querySelectorAll("[data-constitution-list]").forEach((input) => {
    values[input.dataset.constitutionList] = input.value || "";
  });
  values.supernaturalPolicy = root.querySelector("[data-constitution-supernatural]")?.value;
  values.roleHighlights = [...root.querySelectorAll("[data-role-highlight]")].map((input) => ({
    roleId: input.dataset.roleHighlight,
    promise: input.value || ""
  }));
  values.fairness = {
    minimumEvidence: root.querySelector("[data-constitution-evidence]")?.value,
    requireIndependentPaths: Boolean(root.querySelector("[data-constitution-independent]")?.checked)
  };
  return normalizeCreativeConstitution(values);
}

function applySavedConstitution(worldId, constitution, updated) {
  const nextSettings = { ...(updated?.settings || currentWorld()?.settings || {}), creativeConstitution: constitution };
  const preview = worldStore.get().cloudWorkspacePreview;
  if (preview?.world?.id === worldId) {
    worldStore.set({
      cloudWorkspacePreview: {
        ...preview,
        world: {
          ...preview.world,
          settings: nextSettings,
          content_revision: updated?.content_revision ?? preview.world.content_revision
        }
      }
    });
  }
  const studio = studioStore.get().cloudStudio;
  if (studio?.world?.id === worldId) {
    studioStore.set({
      cloudStudio: {
        ...studio,
        world: {
          ...studio.world,
          settings: nextSettings,
          content_revision: updated?.content_revision ?? studio.world.content_revision
        }
      }
    });
  }
  worldStore.set({
    cloudWorlds: (worldStore.get().cloudWorlds || []).map((world) => world.id === worldId
      ? {
          ...world,
          settings: nextSettings,
          content_revision: updated?.content_revision ?? world.content_revision
        }
      : world),
    cloudStoryDiagnostics: null,
    cloudStoryDiagnosticsLoading: false,
    cloudStoryDiagnosticsError: ""
  });
}

export async function saveCreativeConstitution() {
  const worldId = zhimuApi.context.worldId;
  if (!worldId) return showToast("请先选择剧本");
  const constitution = collectCreativeConstitution();
  const buttons = [...document.querySelectorAll('[data-action="constitution-save"]')];
  buttons.forEach((button) => {
    button.disabled = true;
    button.dataset.originalLabel ||= button.textContent;
    button.textContent = "保存中…";
  });
  try {
    const revision = window.zhimuWorldRevision?.currentRevision?.(worldId);
    const updated = await zhimuApi.patchWorld(
      { settings: { creativeConstitution: constitution } },
      worldId,
      { revision }
    );
    applySavedConstitution(worldId, constitution, updated);
    window.zhimuWorldRevision?.clearEditorDirty?.();
    window.zhimuWorldRevision?.clearDraft?.("constitution");
    render();
    showToast("创作宪法已保存，作品诊断将按新约束重新计算");
  } catch (error) {
    buttons.forEach((button) => {
      button.disabled = false;
      button.textContent = button.dataset.originalLabel || "保存创作宪法";
    });
    showToast(normalizeError(error, "创作宪法保存失败，请稍后重试"));
  }
}

function updateCompletionPreview(root = document) {
  const coverage = creativeConstitutionCoverage(collectCreativeConstitution(root), currentRoles());
  const score = root.querySelector("[data-constitution-score]");
  const filled = root.querySelector("[data-constitution-filled]");
  const total = root.querySelector("[data-constitution-total]");
  const ring = root.querySelector("[data-constitution-ring]");
  const missing = root.querySelector("[data-constitution-missing]");
  const roleProgress = root.querySelector("[data-constitution-role-progress]");
  if (score) score.textContent = String(coverage.score);
  if (filled) filled.textContent = String(coverage.filled);
  if (total) total.textContent = String(coverage.total);
  if (ring) ring.style.setProperty("--constitution-score", coverage.score);
  if (roleProgress) roleProgress.textContent = `${coverage.roles.filled} / ${coverage.roles.total} 已写明`;
  if (missing) {
    missing.textContent = coverage.missing.length
      ? `待补：${coverage.missing.slice(0, 5).map((item) => item.label).join("、")}`
      : "核心约束已齐备";
  }
}

export function bindCreativeConstitutionForm(root = document) {
  const page = root.querySelector(".constitution-page");
  if (!page || page.dataset.bound) return;
  page.dataset.bound = "1";
  page.addEventListener("input", () => {
    window.zhimuWorldRevision?.markEditorDirty?.();
    updateCompletionPreview(root);
  });
  page.addEventListener("change", () => {
    window.zhimuWorldRevision?.markEditorDirty?.();
    updateCompletionPreview(root);
  });
  window.zhimuWorldRevision?.watchDirtyInputs?.(page, "constitution");
}

export function openConstitutionDiagnostics() {
  go("diagnostics");
}

registerView("creativeConstitution", {
  creativeConstitution,
  collectCreativeConstitution,
  saveCreativeConstitution,
  bindCreativeConstitutionForm,
  openConstitutionDiagnostics
});
