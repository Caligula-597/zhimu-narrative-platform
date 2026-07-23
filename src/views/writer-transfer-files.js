import { escapeHtml } from "../utils/format.js";

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function fileFingerprint(file) {
  if (!file) return "";
  return [file.name, file.size, file.lastModified, file.type].join(":");
}

export function downloadTextFile(filename, text, mime = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function buildRoleScriptsMarkdown(studio) {
  const roles = studio?.roles || [];
  const sections = studio?.sections || [];
  const chapters = studio?.chapters || [];
  return roles.map((role) => {
    const roleSections = sections
      .filter((section) => section.role_slot_id === role.id)
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    const header = `# ${role.name}\n\n${role.private_profile || ""}\n\n---\n\n`;
    const body = roleSections
      .map((section) => {
        const chapter = chapters.find((item) => item.id === section.chapter_id);
        return `## ${chapter ? `${chapter.title} · ` : ""}${section.title}\n\n${section.body || ""}\n`;
      })
      .join("\n");
    return { filename: `${role.name}-玩家剧本.md`, content: header + body };
  });
}

const CLUE_KIND_EXPORT_LABELS = {
  general: "一般线索",
  deep: "深入线索",
  verify: "验证线索",
  misdirect: "误导线索",
  emotion: "情感线索",
  mechanic: "机制线索"
};

export function buildClueCardsMarkdown(studio) {
  const clues = studio?.clues || [];
  const lines = ["# 线索清单", "", `共 ${clues.length} 条线索`, ""];
  for (const clue of clues) {
    const kind = CLUE_KIND_EXPORT_LABELS[clue.clue_kind || clue.clueKind || "general"] || "一般线索";
    lines.push(`## ${clue.name}`, `- 类型：${kind}`, `- 可见性：${clue.visibility || "role"}`, "", clue.public_text || clue.host_text || "（暂无正文）", "", "---", "");
  }
  return lines.join("\n");
}

export function buildHostRunbookMarkdown(segments = [], worldName = "剧本") {
  const lines = [`# ${worldName} · 主持手册`, ""];
  if (!segments.length) {
    lines.push("暂无 Segment 主持信息。请先在「结构编排」工作台编辑 Segment.operations。");
    return lines.join("\n");
  }
  for (const segment of [...segments].sort((a, b) => (a.sequence || 0) - (b.sequence || 0))) {
    const ops = segment.operations || {};
    lines.push(
      `## ${segment.segmentKey || segment.segment_key} · ${segment.title || ""}`,
      "",
      ops.flow ? `### 流程\n${ops.flow}\n` : "",
      ops.hostTruth ? `### 主持真相\n${ops.hostTruth}\n` : "",
      Array.isArray(ops.fallbacks) && ops.fallbacks.length ? `### 补救话术\n${ops.fallbacks.map((item) => `- ${item}`).join("\n")}\n` : "",
      "---",
      ""
    );
  }
  return lines.join("\n");
}

export function contentPackageSummaryHtml(summary = {}) {
  return `<section class="assistant-preview package-summary"><div class="proposal-stats"><span>${Number(summary.roles || 0)} 角色</span><span>${Number(summary.chapters || 0)} 章节</span><span>${Number(summary.sections || 0)} 分幕</span><span>${Number(summary.scenes || 0)} 场景</span><span>${Number(summary.clues || 0)} 线索</span><span>${Number(summary.truthClaims || 0)} 真相</span><span>${Number(summary.roleArchives || 0)} 档案</span><span>${Number(summary.creatorReviews || 0)} 审稿记录</span><span>${Number(summary.assetCount || 0)} 资产</span></div><div class="assistant-guide"><b>${summary.hasAttachments ? "包含资产清单" : "不含附件文件"}</b><span>结构化归档包含标准创作对象和资产清单，附件二进制需另行下载。导出文件应按未发布原稿保密管理。</span></div></section>`;
}

export function contentPackagePreviewHtml(preview = {}) {
  const warnings = Array.isArray(preview.warnings) ? preview.warnings : [];
  const warningRows = warnings.length
    ? warnings.map((item) => `<div class="check-result ${escapeHtml(item.level || "info")}"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.detail)}</span></div>`).join("")
    : `<div class="empty-state">未发现缺失引用或重名冲突。</div>`;
  const list = (items, map, empty) => (Array.isArray(items) && items.length ? items.map(map).join("") : `<li>${empty}</li>`);
  const roleRows = list(preview.roles, (item) => `<li>${escapeHtml(item.name)}</li>`, "无角色");
  const chapterRows = list(preview.chapters, (item) => `<li>${escapeHtml(String(item.sequence))}. ${escapeHtml(item.title)}</li>`, "无章节");
  const clueRows = list(preview.clues, (item) => `<li>${escapeHtml(item.name)}</li>`, "无线索");
  const summary = preview.summary || {};
  const blocking = preview.canImport === false || preview.hasBlockingErrors;
  return `<section class="assistant-preview package-preview"><div class="section-head"><div><p class="section-kicker">${preview.mode === "new_world" ? "创建新世界" : "追加到当前世界"}</p><h3>${escapeHtml(preview.sourceWorldName || "导入内容包")}</h3><p>${escapeHtml(preview.sourceWorldSummary || "无摘要")}</p></div><span class="cloud-pill">仅预览 · 尚未写入</span></div>${blocking ? `<div class="workspace-inline-error"><strong>存在阻断性引用错误</strong><p>当前内容包不能写入。请修复缺失的角色、分幕、场景或线索引用后重新预览。</p></div>` : ""}<div class="proposal-stats"><span>${Number(summary.roles || 0)} 角色</span><span>${Number(summary.chapters || 0)} 章节</span><span>${Number(summary.sections || 0)} 分幕</span><span>${Number(summary.scenes || 0)} 场景</span><span>${Number(summary.clues || 0)} 线索</span><span>${Number(summary.investigationPoints || 0)} 调查点</span><span>${Number(summary.rules || 0)} 规则</span></div><div class="preview-grid"><article><h4>即将导入的角色</h4><ul>${roleRows}</ul></article><article><h4>即将导入的章节</h4><ul>${chapterRows}</ul></article><article><h4>即将导入的线索</h4><ul>${clueRows}</ul></article></div><div class="section-head writer-transfer-review-head"><div><h4>引用检查与重名提示</h4><p>${preview.targetWorldName ? `目标世界：${escapeHtml(preview.targetWorldName)} · ` : ""}导入不会覆盖已有内容，只会追加新记录。</p></div></div>${warningRows}</section>`;
}
