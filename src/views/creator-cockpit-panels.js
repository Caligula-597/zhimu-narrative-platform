/**
 * Creator cockpit canvas panels — native editing without requiring legacy workspace UIs.
 */
import { worldStore } from "../state/index.js";
import { escapeHtml } from "../utils/format.js";
import {
  LOGLINE_TEMPLATE,
  SPARK_TAGS,
  loglineStats,
  buildContentOverview,
  resolveCheckTarget,
} from "./creator-cockpit-model.js";
import {
  renderClueHitRateEmbed,
  renderSegmentCompletionEmbed,
} from "./creator-cockpit-insights.js";
import { renderTimelineSwimlane } from "./creator-cockpit-timeline.js";
import { creativeConstitutionCoverage } from "../../shared/creative-constitution.js";
import { renderStorySpinePanel } from "./creator-cockpit-story-spine.js";

export function linkButton(link, className = "secondary-btn compact") {
  if (!link) return "";
  if (link.view) {
    return `<button type="button" class="${className}" data-go="${escapeHtml(link.view)}">${escapeHtml(link.label || "打开")}</button>`;
  }
  if (link.action) {
    return `<button type="button" class="${className}" data-action="${escapeHtml(link.action)}">${escapeHtml(link.label || "执行")}</button>`;
  }
  return "";
}

export function field(name, value, label, rows = 3) {
  return `<label class="cockpit-field"><span>${label}</span><textarea data-cockpit-field="${name}" rows="${rows}">${escapeHtml(value || "")}</textarea></label>`;
}

function targetButton(target, label = "打开相关视图") {
  if (!target) return "";
  return `<button type="button" class="text-btn compact" data-action="cockpit-goto-target" data-cockpit-target="${escapeHtml(JSON.stringify(target))}">${escapeHtml(label)}</button>`;
}

function refButton(ref, label) {
  if (!ref) return "";
  if (ref.type === "action") {
    return `<button type="button" class="secondary-btn compact" data-action="${escapeHtml(ref.action)}">${escapeHtml(label || ref.button || "执行")}</button>`;
  }
  if (ref.type === "view") {
    return `<button type="button" class="secondary-btn compact" data-go="${escapeHtml(ref.view)}">${escapeHtml(label || ref.button || "打开")}</button>`;
  }
  if (ref.type === "target" && ref.target) {
    return targetButton(ref.target, label || "打开相关视图");
  }
  return "";
}

function roleOptions(roles, selected = "") {
  return roles
    .map(
      (r) =>
        `<option value="${escapeHtml(r.id)}" ${r.id === selected ? "selected" : ""}>${escapeHtml(r.name)}</option>`,
    )
    .join("");
}

function renderQuickForm(title, body, submitAction, submitLabel = "添加") {
  return `<form class="cockpit-quick-form" data-cockpit-form="${submitAction}">
    <strong>${escapeHtml(title)}</strong>${body}
    <button type="button" class="primary-btn compact" data-action="${escapeHtml(submitAction)}">${escapeHtml(submitLabel)}</button>
  </form>`;
}

function renderInspirationWall(cockpit) {
  const sparks = cockpit.sparks || [];
  const cards = sparks.length
    ? sparks
        .map(
          (s) => `<article class="spark-card">
        <span class="spark-tag">${escapeHtml(s.tag || "灵感")}</span>
        <p>${escapeHtml(s.text)}</p>
        <div class="row">
          <button type="button" class="text-btn" data-action="cockpit-adopt-spark" data-spark-id="${escapeHtml(s.id)}">填入梗概</button>
          <button type="button" class="text-btn" data-action="cockpit-remove-spark" data-spark-id="${escapeHtml(s.id)}">删除</button>
        </div></article>`,
        )
        .join("")
    : `<div class="empty-state">尚无灵感卡。</div>`;
  const tagOpts = SPARK_TAGS.map(
    (t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`,
  ).join("");
  return `<section class="cockpit-panel">
    <div class="panel-heading"><div><p>灵感池</p><h3>${sparks.length} 张灵感卡 · 可合并进梗概</h3></div></div>
    <div class="spark-compose row">
      <input class="field" data-cockpit-field="sparkDraft" placeholder="例如：暴风雪夜，所有人困在一座断电的公馆里…" value="${escapeHtml(cockpit.sparkDraft || "")}">
      <select class="field" data-cockpit-field="sparkTag">${tagOpts}</select>
      <button type="button" class="secondary-btn" data-action="cockpit-add-spark">记一条</button>
    </div>
    <div class="spark-wall">${cards}</div>
  </section>`;
}

function renderContentOverviewPanel(ctx) {
  const rows = buildContentOverview(ctx)
    .map(
      ([label, value]) => `
    <article class="overview-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`,
    )
    .join("");
  return `<section class="cockpit-panel"><div class="panel-heading"><div><p>内容一览</p><h3>当前剧本已写入的数据统计</h3></div></div>
    <div class="content-overview-grid">${rows}</div>
    <p class="muted-note">仅展示计数与字段状态，不对剧情设计作评判。</p></section>`;
}

export function renderConceptCanvas(ctx, cockpit, findItemLink) {
  const link = findItemLink("concept", cockpit.activeItem);
  if (cockpit.activeCanvas === "story" || cockpit.activeItem === "story") {
    return renderStorySpinePanel(ctx, cockpit);
  }
  if (cockpit.activeCanvas === "overview") {
    return renderContentOverviewPanel(ctx);
  }
  if (
    cockpit.activeCanvas === "inspiration" ||
    cockpit.activeItem === "spark"
  ) {
    return renderInspirationWall(cockpit);
  }
  if (cockpit.activeCanvas === "constitution") {
    const coverage = creativeConstitutionCoverage(
      ctx.studio?.world?.settings?.creativeConstitution,
      ctx.studio?.roles || [],
    );
    return `<section class="cockpit-panel">
      <div class="panel-heading"><div><p>创作宪法</p><h3>${coverage.score}% · ${coverage.filled}/${coverage.total} 项约束已写明</h3></div>
        ${linkButton({ view: "constitution", label: "打开创作宪法" })}</div>
      <div class="constitution-cockpit-summary">
        <strong>${coverage.missing.length ? "先把作者意图变成可检查的约束" : "核心创作约束已经齐备"}</strong>
        <p>${
          coverage.missing.length
            ? `待补：${coverage.missing
                .slice(0, 5)
                .map((item) => escapeHtml(item.label))
                .join("、")}`
            : "作品诊断将使用你的体验承诺、证据下限和角色高光要求。"
        }</p>
      </div>
    </section>`;
  }
  if (cockpit.activeCanvas === "selling") {
    return `<section class="cockpit-panel">
      <div class="panel-heading"><div><p>核心卖点</p><h3>${(cockpit.sellingPoints || []).filter(Boolean).length} / 3 槽已填写</h3></div></div>
      <div class="selling-slots">${cockpit.sellingPoints
        .map(
          (point, index) => `
        <article class="selling-slot"><span>卖点 ${index + 1}</span>
          <textarea data-cockpit-field="selling-${index}" rows="3">${escapeHtml(point)}</textarea></article>`,
        )
        .join("")}
      </div></section>`;
  }
  if (cockpit.activeCanvas === "positioning") {
    return `<section class="cockpit-panel">
      <div class="panel-heading"><div><p>商业定位</p><h3>目标玩家 · 时长 · 类型</h3></div>${linkButton({ view: "settings", label: "世界设置" })}</div>
      <div class="positioning-grid">
        ${field("target", cockpit.target, "目标玩家", 2)}
        ${field("duration", cockpit.duration, "预期时长", 2)}
        ${field("type", cockpit.type, "类型与形式", 2)}
      </div>
      <p class="muted-note">卖点与定位会自动保存到世界 settings（跨设备同步）。</p></section>`;
  }
  return `<section class="cockpit-panel cockpit-logline-panel">
    <div class="panel-heading"><div><p>一句话梗概</p><h3>与世界简介同步</h3></div>${linkButton(link)}</div>
    <div class="logline-template card-lite">
      <p class="muted-note">可选 scaffold 模板（填入后可自由修改）：</p>
      <code>${escapeHtml(LOGLINE_TEMPLATE)}</code>
      <button type="button" class="secondary-btn compact" data-action="cockpit-fill-logline-template">填入模板</button>
    </div>
    ${field("logline", cockpit.logline, "一句话梗概", 6)}
    <p class="muted-note">${escapeHtml(loglineStats(cockpit.logline))}</p>
  </section>`;
}

function truthAddForm() {
  return renderQuickForm(
    "新增核心事实",
    `
    <input class="field" data-cockpit-truth="title" placeholder="标题，如：真凶身份">
    <textarea class="field" data-cockpit-truth="claim" rows="3" placeholder="事实内容及成立依据"></textarea>
    <select class="field" data-cockpit-truth="confidence"><option value="canon">已确认</option><option value="inferred">推定</option><option value="misdirection">误导信息</option><option value="unknown">待确认</option></select>`,
    "cockpit-add-truth-claim",
  );
}

function relationAddForm(roles) {
  if (!roles.length) {
    return `<div class="empty-state">请先在「人物」阶段添加角色席位，再建立关系。</div>`;
  }
  return renderQuickForm(
    "新增关系边",
    `
    <div class="row"><select class="field" data-cockpit-rel="from">${roleOptions(roles)}</select>
    <span>→</span><select class="field" data-cockpit-rel="to">${roleOptions(roles)}</select></div>
    <input class="field" data-cockpit-rel="label" placeholder="关系标签，如：师徒 / 债务">
    <input class="field" data-cockpit-rel="strength" type="number" min="-10" max="10" placeholder="强度 -10～10（可选）">`,
    "cockpit-add-relationship",
  );
}

function chapterAddForm() {
  return renderQuickForm(
    "新增公共章节",
    `
    <input class="field" data-cockpit-chapter="title" placeholder="章节标题，如：第一幕 · 暴风雪夜">
    <textarea class="field" data-cockpit-chapter="summary" rows="2" placeholder="本章摘要（可选）"></textarea>`,
    "cockpit-add-chapter",
  );
}

export function renderArchitectureCanvas(ctx, cockpit, findItemLink) {
  const { studio, truthClaims, relationships, bibleSummary } = ctx;
  const counts = bibleSummary?.counts || {};
  const link = findItemLink("architecture", cockpit.activeItem);
  const proLink = `<div class="row" style="margin-top:12px">${linkButton({ view: "truth", label: "打开谜底与关系编辑器" }, "primary-btn")}${linkButton(link)}</div>`;
  if (cockpit.activeCanvas === "relations") {
    return `<section class="cockpit-panel"><div class="panel-heading"><div><p>角色关系</p><h3>${relationships.length || counts.relationships || 0} 条</h3></div></div>
      <p class="muted-note">人物关系的新增、删除和关系图查看请在「谜底与关系」专业视图中进行。</p>${proLink}</section>`;
  }
  if (cockpit.activeCanvas === "timeline") {
    const chapters = studio?.chapters || [];
    return `<section class="cockpit-panel"><div class="panel-heading"><div><p>章节与时间线</p><h3>${chapters.length} 章节 · ${counts.timelineEvents || 0} 条案件事件</h3></div></div>
      <div class="timeline-swimlane">${renderTimelineSwimlane(studio)}</div>
      <p class="muted-note">公共章节泳道（只读）。案件时间线事件请在专业视图编辑。</p>${proLink}</section>`;
  }
  return `<section class="cockpit-panel"><div class="panel-heading"><div><p>核心事实 / 核心谜底</p><h3>${truthClaims.length || counts.truthClaims || 0} 条事实 · 谜底 ${counts.coreTrick ? "已写入" : "未写入"}</h3></div></div>
    <p class="muted-note">驾驶舱仅展示统计。核心事实、谜底、伏笔和案件时间线在「谜底与关系」中编辑。</p>${proLink}</section>`;
}

export function renderCharactersCanvas(ctx, cockpit, findItemLink) {
  const { studio, bibleSummary } = ctx;
  const roles = studio?.roles || [];
  const sections = studio?.sections || [];
  const counts = bibleSummary?.counts || {};
  const link = findItemLink("characters", cockpit.activeItem);
  if (cockpit.activeCanvas === "preview") {
    return `<section class="cockpit-panel"><div class="panel-heading"><div><p>玩家视角</p><h3>预览私人分幕</h3></div></div>
      <div class="row">${linkButton({ action: "creator-preview", label: "玩家视角预览" }, "primary-btn")}${linkButton({ view: "writer", label: "分幕编辑器" })}</div></section>`;
  }
  const cards = roles.length
    ? roles
        .map((role) => {
          const roleSections = sections.filter(
            (s) => s.role_slot_id === role.id,
          );
          const count = roleSections.length;
          const pub = roleSections.filter(
            (s) => s.publication_status !== "draft",
          ).length;
          return `<article class="character-card"><div class="character-avatar">${escapeHtml(role.name.slice(0, 1))}</div><h4>${escapeHtml(role.name)}</h4><p>${count} 分幕 · ${pub} 可测试/已发布</p>
          <button type="button" class="text-btn" data-go="writer">编辑分幕与档案 →</button></article>`;
        })
        .join("")
    : "";
  return `<section class="cockpit-panel"><div class="panel-heading"><div><p>角色与分幕</p><h3>${roles.length} 角色 · ${sections.length} 分幕 · ${counts.roleArchivesFilled || 0} 份档案有内容</h3></div>${linkButton(link)}</div>
    <div class="character-desk">${cards || `<div class="empty-state">尚无角色。</div>`}</div>
    <p class="muted-note">角色档案、弧光与分幕正文请在「角色私人剧本」专业视图中编辑。</p>
    <div class="row">${linkButton({ view: "writer", label: "打开角色私人剧本" }, "primary-btn")}</div></section>`;
}

export function renderFlowCanvas(ctx, cockpit, findItemLink) {
  const { studio, segments, counts, bibleSummary } = ctx;
  const bc = bibleSummary?.counts || {};
  const link = findItemLink("flow", cockpit.activeItem);
  if (cockpit.activeCanvas === "matrix") {
    const clues = (studio?.clues || []).slice(0, 12);
    const roles = (studio?.roles || []).slice(0, 6);
    if (!clues.length || !roles.length) {
      return `<section class="cockpit-panel"><div class="empty-state">需要线索与角色。${linkButton({ view: "clues", label: "添加线索" }, "primary-btn")}</div></section>`;
    }
    const grantMap = new Map();
    segments.forEach((seg) => {
      (seg.operations?.clueGrants || []).forEach((g) => {
        const roleId = g.roleSlotId || g.role_slot_id || "";
        const clueId = g.clueId || g.clue_id || "";
        if (clueId && roleId) grantMap.set(`${clueId}:${roleId}`, true);
      });
    });
    return `<section class="cockpit-panel"><div class="panel-heading"><div><p>线索 × 角色</p><h3>绿格 = Segment 已标注应发线索</h3></div>${linkButton({ view: "structure", label: "编辑 clueGrants" })}</div>
      <table class="clue-matrix-table"><thead><tr><th>线索</th>${roles.map((r) => `<th>${escapeHtml(r.name)}</th>`).join("")}</tr></thead>
      <tbody>${clues
        .map(
          (clue) =>
            `<tr><th>${escapeHtml(clue.name)}</th>${roles
              .map((r) => {
                const on = grantMap.has(`${clue.id}:${r.id}`);
                return `<td class="${on ? "visible-cell" : "hidden-cell"}">${on ? "应发" : "—"}</td>`;
              })
              .join("")}</tr>`,
        )
        .join("")}</tbody></table></section>`;
  }
  if (cockpit.activeCanvas === "sandbox") {
    const secondary = cockpit.activeItem === "mechanics"
      ? { view: "rules", label: "自动化规则" }
      : { action: "world-rooms", label: "管理运行房" };
    return `<section class="cockpit-panel"><div class="panel-heading"><div><p>机制与主持预演</p><h3>${counts.rooms || 0} 个运行房</h3></div></div>
      <div class="row">${linkButton(link, "primary-btn")}${linkButton(secondary)}</div></section>`;
  }
  const segRows = segments.length
    ? segments
        .map(
          (
            s,
          ) => `<button type="button" class="host-current-item cockpit-segment-pick ${s.id === cockpit.selectedSegmentId ? "active" : ""}" data-cockpit-segment-id="${escapeHtml(s.id)}">
        <strong>${escapeHtml(s.segmentKey)} · ${escapeHtml(s.title)}</strong>
        <p>${s.operations?.flow ? "含主持流程" : "缺 flow"} · ${(s.operations?.clueGrants || []).length} 条应发线索</p></button>`,
        )
        .join("")
    : `<div class="empty-state">尚无 Segment。有章节后可从图谱同步。</div>`;
  const current =
    segments.find((s) => s.id === cockpit.selectedSegmentId) ||
    segments[0] ||
    null;
  return `<section class="cockpit-panel cockpit-segment-panel"><div class="panel-heading"><div><p>运行段落</p><h3>${segments.length} 幕 · ${bc.segmentsWithFlow ?? 0} 幕已写主持手册</h3></div>
    <div class="row">${linkButton({ view: "structure", label: "运行段落工作台" }, "primary-btn")}${linkButton({ action: "cockpit-sync-segments", label: "从章节同步" }, "secondary-btn")}</div></div>
    <div class="host-current-list">${segRows}</div>
    <p class="muted-note">主持流程、主持真相与应发线索请在运行段落工作台深度编辑。</p></section>`;
}

export function renderManuscriptCanvas(ctx, cockpit) {
  const { studio, counts } = ctx;
  if (cockpit.activeCanvas === "cards") {
    const clues = studio?.clues || [];
    const cards = clues.length
      ? clues
          .slice(0, 12)
          .map(
            (c) =>
              `<article class="prop-card"><div class="prop-image">线索</div><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(c.public_text?.slice(0, 40) || "待补充说明")}</small></article>`,
          )
          .join("")
      : `<div class="empty-state">尚无线索。${linkButton({ view: "clues", label: "线索管理" }, "primary-btn")}</div>`;
    return `<section class="cockpit-panel"><div class="panel-heading"><div><p>线索物料</p><h3>${clues.length} 条线索</h3></div>${linkButton({ view: "clues", label: "编辑线索" })}</div>
      <div class="prop-grid">${cards}</div>
      ${renderQuickForm("快速添加线索", `<input class="field" data-cockpit-clue="name" placeholder="线索名称"><textarea class="field" data-cockpit-clue="publicText" rows="2" placeholder="玩家可见说明（可选）"></textarea>`, "cockpit-add-clue")}</section>`;
  }
  if (cockpit.activeCanvas === "package") {
    return `<section class="cockpit-panel"><div class="panel-heading"><div><p>导入导出</p><h3>内容包与备份</h3></div></div>
      <div class="row">${linkButton({ action: "creator-import", label: "导入内容包" }, "secondary-btn")}${linkButton({ action: "creator-export", label: "导出备份" }, "primary-btn")}${linkButton({ action: "deepseek-pipeline", label: "AI 悬疑创作" }, "secondary-btn")}</div></section>`;
  }
  return `<section class="cockpit-panel"><div class="panel-heading"><div><p>内容生产</p><h3>${counts.sections || 0} 分幕 · ${counts.chapters || 0} 章节</h3></div></div>
    <div class="workspace-action-grid" style="margin-top:12px">
      <button type="button" class="workspace-action-card primary" data-action="deepseek-pipeline"><strong>AI 悬疑创作</strong><span>八层生成流程</span></button>
      <button type="button" class="workspace-action-card" data-go="writer"><strong>角色私人剧本</strong><span>Markdown 分幕</span></button>
      <button type="button" class="workspace-action-card" data-action="creator-import"><strong>导入内容包</strong><span>Word / Markdown</span></button>
    </div></section>`;
}

function renderFeedbackSummary() {
  const completion = worldStore.get().cloudSegmentCompletion;
  const hitRate = worldStore.get().cloudClueHitRate;
  return `<div class="feedback-embed-grid">
    ${renderSegmentCompletionEmbed(completion)}
    ${renderClueHitRateEmbed(hitRate)}
    <div class="row">${linkButton({ view: "insights", label: "完整复盘页" })}${linkButton({ view: "archive", label: "存档明细" })}</div>
  </div>`;
}

function checkLevelLabel(level) {
  return (
    { error: "必填缺失", warning: "待确认", info: "通过", ok: "通过" }[level] ||
    level
  );
}

export function renderLaunchCanvas(ctx, cockpit, findItemLink) {
  const { checks, dashboard, counts, diagnostics, playtest } = ctx;
  const link = findItemLink("launch", cockpit.activeItem);
  if (cockpit.activeCanvas === "diagnostics") {
    const result = diagnostics
      ? `<div class="diagnostic-headline ${diagnostics.summary?.danger ? "danger" : diagnostics.summary?.warning ? "warning" : "ready"}">
          <strong>${escapeHtml(diagnostics.summary?.headline || "诊断已完成")}</strong>
          <span>结构健康度 ${diagnostics.scores?.overall ?? 0} · 因果 ${diagnostics.scores?.causal ?? 0} · 信息 ${diagnostics.scores?.information ?? 0} · 公平 ${diagnostics.scores?.fairness ?? 0}</span>
        </div>`
      : `<div class="empty-state">尚未运行作品诊断。诊断中心会检查因果链、信息传播和真相证据。</div>`;
    return `<section class="cockpit-panel"><div class="panel-heading"><div><p>作品诊断</p><h3>剧情体检 / 剧本 MRI</h3></div>${linkButton({ view: "diagnostics", label: diagnostics ? "查看完整报告" : "开始诊断" }, "primary-btn")}</div>
      <p class="muted-note">不同类型作品可切换本格公平、情感还原、机制推理、叙事诡计、开放调查和跑团沙盒标准。</p>${result}</section>`;
  }
  if (cockpit.activeCanvas === "ai-playtest") {
    const report = playtest?.report;
    const result = report
      ? `<div class="diagnostic-headline ${report.summaryCounts?.danger ? "danger" : report.summaryCounts?.warning ? "warning" : "ready"}">
          <strong>${escapeHtml(report.headline || "多 AI 试跑已完成")}</strong>
          <span>${report.players?.length || 0} 个隔离席位 · ${report.summaryCounts?.stalledPlayers || 0} 人卡住 · 体验可信度 ${report.score || 0}</span>
        </div>`
      : `<div class="empty-state">尚未运行多 AI 玩家试跑。系统会分别模拟不同玩家类型，再把问题定位回角色、线索与章节。</div>`;
    return `<section class="cockpit-panel"><div class="panel-heading"><div><p>AI 玩家试跑</p><h3>理解、交流、误判与卡关压力测试</h3></div>${linkButton({ view: "playtest", label: report ? "查看完整回放" : "组建测试桌" }, "primary-btn")}</div>
      <p class="muted-note">每个虚拟玩家使用隔离上下文，不读取作者真相；观察员最后按创作宪法综合验收。</p>${result}</section>`;
  }
  if (cockpit.activeCanvas === "feedback") {
    return `<section class="cockpit-panel"><div class="panel-heading"><div><p>跑局数据</p><h3>完成率与线索命中统计</h3></div></div>
      ${renderFeedbackSummary()}</section>`;
  }
  if (cockpit.activeCanvas === "readiness") {
    const rows = checks.length
      ? checks
          .map((c) => {
            const nav = c.target ? resolveCheckTarget(c.target) : null;
            return `<article class="readiness-row ${c.level}">
          <div class="row" style="justify-content:space-between;width:100%"><strong>${escapeHtml(c.title)}</strong>
            <span class="status-chip">${escapeHtml(checkLevelLabel(c.level))}</span></div>
          <p>${escapeHtml(c.detail || "")}</p>
          <div class="row">${targetButton(c.target, "打开相关视图")}${nav?.view ? linkButton({ view: nav.view, label: "编辑器" }, "text-btn compact") : ""}${nav?.action ? linkButton({ action: nav.action, label: "执行" }, "text-btn compact") : ""}</div></article>`;
          })
          .join("")
      : `<div class="empty-state">尚未运行系统检查。</div>`;
    return `<section class="cockpit-panel readiness-board"><div class="panel-heading"><div><p>系统检查</p><h3>${checks.length} 条 · ${dashboard?.readiness?.label || "—"}</h3></div>${linkButton({ action: "creator-check", label: "刷新" }, "secondary-btn")}</div>
      <p class="muted-note">以下为平台运行所需字段检查结果，不代表对剧情质量的评判。</p>${rows}</section>`;
  }
  return `<section class="cockpit-panel launch-panel"><div class="panel-heading"><div><p>测试运行房</p><h3>${counts.rooms || 0} 个平行房</h3></div></div>
    <button class="launch-test-btn" type="button" data-action="world-rooms"><strong>${counts.rooms ? "管理运行房" : "创建测试房"}</strong><span>复制邀请码 · 打开主持端试跑</span></button>
    <div class="row" style="margin-top:10px">${linkButton({ view: "publish", label: "发布 Release" })}${linkButton({ action: "open-host-console", label: "打开主持端" })}${linkButton({ action: "creator-check", label: "运行系统检查" })}</div></section>`;
}

function renderCopilotAnalysis(cockpit) {
  const analysis = cockpit.lastAnalysis;
  const aiNote = cockpit.lastAiNote;
  const parts = [];
  if (analysis?.nodes?.length) {
    const nodeLines = analysis.nodes
      .slice(0, 12)
      .map(
        (n) =>
          `<li><code>${escapeHtml(n.type || "node")}</code> ${escapeHtml(n.label || n.name || n.text || "")}</li>`,
      )
      .join("");
    parts.push(
      `<p class="muted-note">识别 ${analysis.nodes.length} 个结构节点</p><ul class="cockpit-hint-list">${nodeLines}</ul>`,
    );
  }
  if (aiNote)
    parts.push(
      `<article class="card-lite"><strong>AI 输出</strong><p>${escapeHtml(aiNote)}</p></article>`,
    );
  return parts.length
    ? parts.join("")
    : `<p class="muted-note">可选：结构识别（规则解析）或 AI 续写（作者主动发起，需 LLM）。</p>`;
}

export function renderAssistant(stage, ctx, cockpit) {
  const { counts = {} } = ctx;
  const facts = [
    ["角色 / 分幕", `${counts.roles || 0} / ${counts.sections || 0}`],
    ["章节 / 场景", `${counts.chapters || 0} / ${counts.scenes || 0}`],
    ["线索", String(counts.clues || 0)],
    ["运行房", String(counts.rooms || 0)],
  ];
  const cards = facts
    .map(
      ([k, v]) =>
        `<article class="copilot-fact"><strong>${escapeHtml(k)}</strong><p>${escapeHtml(v)}</p></article>`,
    )
    .join("");
  return `<aside class="cockpit-copilot">
    <div class="copilot-header"><span>内容副窗</span><button class="icon-btn" type="button" data-action="cockpit-refresh" title="刷新数据">↻</button></div>
    <div class="copilot-context"><strong>${escapeHtml(stage.title)}</strong><p>${escapeHtml(stage.subtitle)}</p></div>
    <div class="copilot-cards copilot-facts">${cards}</div>
    <div class="copilot-compose">
      <label class="cockpit-field"><span>粘贴文本（可选）</span><textarea data-cockpit-field="copilotQuery" rows="3" placeholder="粘贴梗概或片段，用于结构识别或 AI 续写…">${escapeHtml(cockpit.copilotQuery || "")}</textarea></label>
      <div class="row">
        <button type="button" class="secondary-btn compact" data-action="cockpit-analyze-draft">结构识别</button>
        <button type="button" class="secondary-btn compact" data-action="cockpit-ai-suggest">AI 续写</button>
      </div>
      <div class="copilot-analysis">${renderCopilotAnalysis(cockpit)}</div>
    </div>
    <div class="copilot-note"><span>说明</span><p>${escapeHtml(cockpit.magicNote)}</p></div>
  </aside>`;
}
