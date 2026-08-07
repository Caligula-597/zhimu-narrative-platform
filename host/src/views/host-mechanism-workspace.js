import { escapeHtml } from "../utils/format.js";
import { state } from "../state.js";
import {
  mechanismKeyLabel,
  mechanismValueLabel,
  normalizeHostMechanismRuntime,
} from "../runtime/host-mechanism-model.js";
import {
  mechanismInteractionCard,
  normalizeMechanismInteraction,
  normalizeMechanismOptionPresentation,
} from "../../../shared/mechanism-interactions.js";

function metricRows(rows, emptyText) {
  if (!rows.length)
    return `<div class="host-mechanism-empty">${escapeHtml(emptyText)}</div>`;
  return rows
    .map(
      (row) => `<div class="host-mechanism-metric">
    <span>${escapeHtml(row.label)}</span><strong>${escapeHtml(mechanismValueLabel(row.value))}</strong>
    <small>${escapeHtml(row.key)}</small>
  </div>`,
    )
    .join("");
}

export function mechanismDeadlineStatus(
  roundStartedAt,
  deadlineSeconds,
  now = Date.now(),
) {
  if (!roundStartedAt) return null;
  const startedAt = new Date(roundStartedAt).getTime();
  const seconds = Number(deadlineSeconds) || 0;
  if (!Number.isFinite(startedAt) || seconds <= 0) return null;
  const deadlineMs = startedAt + seconds * 1000;
  const remainingSeconds = Math.max(
    0,
    Math.ceil((deadlineMs - Number(now)) / 1000),
  );
  return {
    deadlineAt: new Date(deadlineMs).toISOString(),
    expired: remainingSeconds === 0,
    remainingSeconds,
    label:
      remainingSeconds === 0
        ? "已到期"
        : `剩余 ${Math.ceil(remainingSeconds / 60)} 分钟`,
  };
}

function decisionRows(model, busy) {
  if (!model.decisions.length)
    return `<div class="host-mechanism-empty">当前轮次没有待结算选择，可以核对后推进。</div>`;
  return model.decisions
    .map((decision) => {
      const interaction = normalizeMechanismInteraction(decision.interaction);
      const card = mechanismInteractionCard(interaction.kind);
      const resource = interaction.resourceKey
        ? model.resources.find((item) => item.key === interaction.resourceKey)
        : null;
      const deadline = mechanismDeadlineStatus(
        model.roundStartedAt,
        interaction.deadlineSeconds,
      );
      const defaultOption = decision.options.find(
        (option) => option.key === interaction.defaultOptionKey,
      );
      const submissions = model.submissionSummary.find(
        (entry) => entry.decisionKey === decision.key,
      ) || { total: 0, options: [], roles: [] };
      const privateSubmission = interaction.submissionMode === "private_choice";
      const optionDisabled = busy || Boolean(deadline?.expired);
      return `<article class="host-mechanism-action-card mechanism-kind-${escapeHtml(interaction.kind)}">
      <div class="host-mechanism-action-head"><span class="mechanism-kind-chip is-${escapeHtml(card.theme)}">${escapeHtml(interaction.label)}</span><div><h4>${escapeHtml(decision.question || mechanismKeyLabel(decision.key))}</h4><p>${escapeHtml(interaction.hostInstruction)}</p></div></div>
      ${
        interaction.deadlineSeconds || resource
          ? `<div class="host-mechanism-constraints">
        ${interaction.deadlineSeconds ? `<span>时限 <b>${deadline ? escapeHtml(deadline.label) : `${Math.ceil(interaction.deadlineSeconds / 60)} 分钟`}</b></span>` : ""}
        ${resource ? `<span>${escapeHtml(resource.label)} <b>${escapeHtml(mechanismValueLabel(resource.value))}</b></span>` : ""}
      </div>`
          : ""
      }
      <div class="host-mechanism-options">${(decision.options || [])
        .map((option, index) => {
          const presentation = normalizeMechanismOptionPresentation(
            option.presentation,
          );
          const preferenceCount =
            submissions.options.find((entry) => entry.optionKey === option.key)
              ?.count ?? 0;
          const roleNames = submissions.roles
            .filter((entry) => entry.optionKey === option.key)
            .map((entry) => entry.roleName)
            .filter(Boolean);
          return `<button type="button" class="host-mechanism-option" data-action="host-mechanism-decision" data-decision-key="${escapeHtml(decision.key)}" data-option-key="${escapeHtml(option.key)}" ${optionDisabled ? "disabled" : ""}>
          <span>${escapeHtml(presentation.eyebrow || `${card.shortLabel} ${String(index + 1).padStart(2, "0")}`)}</span>
          <strong>${escapeHtml(option.choiceText || mechanismKeyLabel(option.key))}</strong>
          ${presentation.publicPreview ? `<small>${escapeHtml(presentation.publicPreview)}</small>` : ""}
          ${presentation.costLabel || presentation.riskLabel || presentation.sequenceLabel ? `<em>${[presentation.sequenceLabel, presentation.costLabel, presentation.riskLabel].filter(Boolean).map(escapeHtml).join(" · ")}</em>` : ""}
          <small class="host-mechanism-preference">玩家倾向 ${preferenceCount}${roleNames.length ? ` · ${escapeHtml(roleNames.join("、"))}` : ""}</small>
        </button>`;
        })
        .join("")}</div>
      <p class="host-mechanism-submission-note">${
        privateSubmission
          ? `已收到 ${submissions.total} 份秘密承诺；仅主持人可见承诺人与内容，其他玩家不会看到。`
          : `已收到 ${submissions.total} 份玩家倾向；倾向仅供参考，仍由主持人确认最终结算。`
      }</p>
      ${
        interaction.kind === "timed_crisis"
          ? defaultOption
            ? `<div class="host-mechanism-deadline-default"><div><strong>超时默认：${escapeHtml(defaultOption.choiceText)}</strong><small>${deadline ? `${escapeHtml(new Date(deadline.deadlineAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))} 后可执行` : "等待服务器轮次时钟"}</small></div><button type="button" class="secondary-btn" data-action="host-mechanism-deadline-default" data-decision-key="${escapeHtml(decision.key)}" data-option-key="${escapeHtml(defaultOption.key)}" ${busy || !deadline?.expired ? "disabled" : ""}>按默认方案结算</button></div>`
            : `<p class="host-mechanism-deadline-warning">本限时决策尚未配置超时默认方案，请返回创作者端补齐后再运行。</p>`
          : ""
      }
    </article>`;
    })
    .join("");
}

function investigationRows(model, busy) {
  if (!model.investigations.length)
    return `<div class="host-mechanism-empty">当前轮次没有待执行调查。</div>`;
  return model.investigations
    .map(
      (item) => `<article class="host-mechanism-action-card">
    <div><span class="cloud-pill">调查行动</span><h4>${escapeHtml(item.action || mechanismKeyLabel(item.key))}</h4><p>${escapeHtml(item.operation || "按作品约定执行调查")}${item.success?.artifactProduced ? ` · 产物：${escapeHtml(item.success.artifactProduced)}` : ""}</p></div>
    <div class="host-mechanism-options">
      <button type="button" class="primary-btn" data-action="host-mechanism-investigation" data-investigation-key="${escapeHtml(item.key)}" data-outcome="success" ${busy ? "disabled" : ""}>调查成功</button>
      ${item.failure ? `<button type="button" class="secondary-btn" data-action="host-mechanism-investigation" data-investigation-key="${escapeHtml(item.key)}" data-outcome="failure" ${busy ? "disabled" : ""}>按失败后果结算</button>` : ""}
    </div>
  </article>`,
    )
    .join("");
}

function latestChanges(model) {
  if (!model.latestChanges.length)
    return `<div class="host-mechanism-empty">尚无状态变更记录。</div>`;
  return model.latestChanges
    .slice(0, 8)
    .map(
      (change) => `<div class="host-mechanism-change">
    <span>${escapeHtml(change.targetType || "状态")}</span><b>${escapeHtml(mechanismKeyLabel(change.targetKey || ""))}</b>
    <small>${escapeHtml(mechanismValueLabel(change.before))} → ${escapeHtml(mechanismValueLabel(change.after))}</small>
  </div>`,
    )
    .join("");
}

function endingProspects(model) {
  if (!model.endingProspects.length) return "";
  return `<section class="host-mechanism-prospects"><div class="section-head compact"><div><h4>结局前景</h4><p>从当前房间状态继续枚举合法动作；“不可达”表示现有选择已经关闭该路线。</p></div>${model.reachabilityTruncated ? `<span class="status-chip testing">路径较多，结果已截断</span>` : ""}</div>
    <div class="host-mechanism-prospect-list">${model.endingProspects
      .map(
        (
          route,
        ) => `<article class="host-mechanism-prospect ${route.reachable ? "is-reachable" : "is-closed"}">
      <div><span class="status-chip ${route.reachable ? "published" : "draft"}">${route.reachable ? "仍可达" : "已关闭"}</span><strong>${escapeHtml(route.title || mechanismKeyLabel(route.key))}</strong></div>
      <p>${
        route.unmetRequirements?.length
          ? route.unmetRequirements
              .map(
                (item) =>
                  `${mechanismKeyLabel(item.targetKey)}：当前 ${mechanismValueLabel(item.current)}，目标 ${item.operator} ${mechanismValueLabel(item.expected)}`,
              )
              .map(escapeHtml)
              .join("<br>")
          : "当前条件已经满足；仍需完成剩余轮次后正式结算。"
      }</p>
      <small>${escapeHtml(route.key)}</small>
    </article>`,
      )
      .join("")}</div>
  </section>`;
}

export function renderHostMechanismWorkspace() {
  const model = normalizeHostMechanismRuntime(state.cloudHostMechanismRuntime);
  const busy = Boolean(state.hostMechanismBusy);
  const header = `<div class="section-head compact">
    <div><p class="section-kicker">MECHANISM RUNTIME</p><h3>机制运行</h3><p>按作品机制包结算选择、调查、资源与证据；所有操作都会记录版本和主持审计。</p></div>
    <button type="button" class="secondary-btn" data-action="host-mechanism-refresh" ${busy ? "disabled" : ""}>刷新</button>
  </div>`;

  if (!model.loaded)
    return `<section class="card host-mechanism-workspace">${header}<div class="empty-state">正在等待机制运行态加载。</div></section>`;
  if (!model.initialized) {
    const missingPackage = model.errorCode === "MECHANISM_PACKAGE_NOT_FOUND";
    return `<section class="card host-mechanism-workspace">${header}
      <div class="host-mechanism-onboarding ${model.error ? "is-warning" : ""}">
        <span class="host-mechanism-mark">${missingPackage ? "—" : "01"}</span>
        <div><h4>${missingPackage ? "当前剧本还没有可执行机制包" : model.error ? "机制运行态暂时不可用" : "本房间尚未初始化机制"}</h4><p>${escapeHtml(model.error || (missingPackage ? "请先在创作者端补齐机制蓝图并重新发布。" : "初始化会读取当前冻结发布版本，建立独立的房间状态、资源和证据账本。"))}</p></div>
        ${model.error || missingPackage ? "" : `<button type="button" class="primary-btn" data-action="host-mechanism-initialize" ${busy ? "disabled" : ""}>${busy ? "正在初始化…" : "初始化机制"}</button>`}
      </div>
    </section>`;
  }

  return `<section class="card host-mechanism-workspace ${model.stale ? "is-stale" : ""}">
    ${header}
    ${model.stale ? `<div class="host-mechanism-warning"><b>内容绑定已变化，当前运行态停止结算。</b><span>请先建立检查点并由高级恢复流程重新绑定，系统不会静默套用新版本。</span></div>` : ""}
    ${state.hostMechanismError ? `<div class="host-mechanism-warning"><b>上一操作未完成</b><span>${escapeHtml(state.hostMechanismError)}</span></div>` : ""}
    <div class="host-mechanism-hero">
      <div><span class="cloud-pill">${model.status === "completed" ? "已完成" : `第 ${model.roundSequence || "—"} 轮`}</span><h4>${escapeHtml(model.roundTitle)}</h4><p>${escapeHtml(model.roundKey)}${model.variantKey ? ` · 分支 ${escapeHtml(model.variantKey)}` : ""}</p></div>
      <div class="host-mechanism-revision"><span>运行版本</span><strong>R${model.revision}</strong><small>${busy ? escapeHtml(state.hostMechanismBusy) : "已与服务器核对"}</small></div>
    </div>
    <div class="host-mechanism-grid">
      <section><h4>状态账本</h4><div class="host-mechanism-metrics">${metricRows(model.states, "本作没有登记状态变量。")}</div></section>
      <section><h4>题材资源</h4><div class="host-mechanism-metrics">${metricRows(model.resources, "本作没有登记可消耗资源。")}</div></section>
      <section><h4>证据状态</h4><div class="host-mechanism-metrics">${metricRows(model.evidence, "本作没有登记证据开关。")}</div></section>
    </div>
    ${endingProspects(model)}
    ${
      model.status === "completed"
        ? `<div class="host-mechanism-ending"><span>命中结局</span><strong>${escapeHtml(mechanismKeyLabel(model.ending?.resolvedRouteKey || "default"))}</strong><p>候选路线：${escapeHtml((model.ending?.matchedRouteKeys || []).map(mechanismKeyLabel).join("、") || "默认路线")}</p></div>`
        : `<div class="host-mechanism-action-grid"><section><h4>待决选择</h4>${decisionRows(model, busy || model.stale)}</section><section><h4>可执行调查</h4>${investigationRows(model, busy || model.stale)}</section></div>
    <div class="host-mechanism-footer"><div><h4>最近变化</h4>${latestChanges(model)}</div><button type="button" class="primary-btn" data-action="host-mechanism-advance" ${busy || model.stale || !model.canAdvance ? "disabled" : ""}>${model.canAdvance ? "推进到下一轮" : "先完成本轮待决选择"}</button></div>`
    }
  </section>`;
}
