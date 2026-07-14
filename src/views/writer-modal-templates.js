export function worldLogModalHtml() {
  return `<h2>世界运行日志</h2><p class="wizard-intro">查看玩家阅读、调查、规则触发与主持操作。筛选只影响当前查看，不会修改历史记录。</p><div class="log-toolbar"><select class="field compact-field" data-log-event><option value="">全部事件</option><option value="reading_completed">阅读完成</option><option value="investigation_completed">调查完成</option><option value="scene_unlocked">场景解锁</option></select><input class="field" data-log-keyword placeholder="搜索日志内容"><button class="secondary-btn" data-log-refresh>筛选</button></div><div class="log-list" data-log-list></div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`;
}

export function storyAssistantModalHtml() {
  return `<h2>剧情助手</h2><p class="wizard-intro">粘贴剧情梗概或逐段素材。系统会先识别场景、线索和调查点，再生成建议连线。确认后才会写入剧情编排。</p><div class="assistant-guide"><b>推荐格式</b><span>每段用空行分隔。也可以使用“场景：”“线索：”“调查点：”开头提高识别准确度。</span></div><textarea class="field assistant-draft" rows="14" data-story-draft placeholder="场景：旧灯塔。潮水退去后，塔门露出一枚生锈的锁。&#10;&#10;调查点：检查塔门锁孔，发现内部残留蓝色蜡屑。&#10;&#10;线索：蓝色火漆碎片。它与匿名信上的封蜡一致。"></textarea><div data-assistant-preview></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="secondary-btn" data-assistant-analyze>分析分类</button><button class="primary-btn" data-assistant-import disabled>确认写入剧情编排</button></div>`;
}

export function creatorPreviewModalHtml(controlsHtml) {
  return `<h2>玩家视角模拟器</h2><p class="wizard-intro">切换角色和章节，核对玩家能读到的私人文本。草稿、测试中和已发布状态会明确标记。</p><div class="preview-controls">${controlsHtml}</div><div data-preview-body></div><div class="modal-actions"><button class="primary-btn" data-close>结束模拟</button></div>`;
}

export function publishImpactModalHtml(controlsHtml) {
  return `<h2>发布影响预览</h2><p class="wizard-intro">选择角色与房间类型，查看该玩家此刻按发布状态能看到的章节、分幕、场景、线索与任务，以及不可见原因。不含运行中解锁/持有态（解锁与授予另计）。</p><div class="preview-controls">${controlsHtml}</div><div data-impact-body></div><div class="modal-actions"><button class="primary-btn" data-close>关闭</button></div>`;
}

export function deliveryExportModalHtml() {
  return `<h2>交付包导出</h2><p class="wizard-intro">分步选择交付物：内容包备份、玩家本、线索清单、主持手册与版本快照。</p><div data-delivery-body></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="secondary-btn" data-delivery-back style="display:none">上一步</button><button class="secondary-btn" data-delivery-next>下一步</button><button class="primary-btn" data-delivery-run style="display:none">开始导出</button></div>`;
}

export function plainTextImportPreviewHtml() {
  return `<section class="assistant-preview"><p>Markdown / TXT 将直接写入指定角色的新分幕，无需 JSON 预览。</p></section>`;
}

export function storyManuscriptModalHtml({ bodyHtml, statusHtml }) {
  return `<h2>完整剧情母稿</h2><p class="wizard-intro">这是创作者维护的全局剧情文稿，不会替代每位角色的私人剧本。你可以从剧情编排生成一份规范化母稿，也可以把编辑后的母稿拆分成场景、调查点、线索与连接线。</p><div class="assistant-guide"><b>双向同步边界</b><span>“从编排台生成母稿”会覆盖下方文本；“拆分母稿写回编排台”会重建此前由母稿生成的节点，不会删除你手工建立的节点。</span></div><textarea class="field manuscript-draft" rows="20" data-story-manuscript>${bodyHtml}</textarea><div class="manuscript-meta" data-manuscript-meta>${statusHtml}</div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button><button class="secondary-btn" data-manuscript-save>仅保存母稿</button><button class="secondary-btn" data-manuscript-from-graph>从编排台生成母稿</button><button class="primary-btn" data-manuscript-to-graph>拆分母稿写回编排台</button></div>`;
}

export function collaborationModalHtml({ memberRowsHtml, pendingRowsHtml }) {
  return `<h2>协作权限</h2><p class="wizard-intro">输入邮箱邀请协作者。未注册账号会收到邀请邮件；已注册账号将直接加入。</p><div class="collab-list">${memberRowsHtml}${pendingRowsHtml}</div><div class="collab-invite"><h3>邀请协作者</h3><div class="row"><input class="field" data-member-email placeholder="成员邮箱"><select class="field compact-field" data-member-new-role><option value="editor">协作者</option><option value="host">主持人</option><option value="viewer">只读观察者</option></select><button class="primary-btn" data-add-member>发送邀请</button></div></div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`;
}

export function documentParserModalHtml(roleOptionsHtml) {
  return `<h2>文档解析与导入</h2><p class="wizard-intro">支持 TXT / Markdown / DOCX / PDF / 图片。文本型文档提取文字；图片型 PDF 与 JPG/PNG 将<strong>按页导入为分幕图片</strong>，玩家在端内直接翻页阅读。可选 OCR 提取可编辑文字（需复核）。</p><div class="form-group"><label>选择文档</label><input class="field" type="file" accept=".txt,.md,.markdown,.docx,.pdf,.jpg,.jpeg,.png,.webp" data-document-file><label>写入目标</label><select class="field" data-document-target><option value="manuscript">完整剧情母稿</option>${roleOptionsHtml}</select><label class="checkbox-line" style="margin-top:10px"><input type="checkbox" data-document-allow-ocr> 图片型 PDF 尝试 OCR 为文字（较慢，需复核）</label><label>PDF 图片导入布局（仅图片模式）</label><select class="field" data-document-page-layout><option value="single_section">整份 PDF 合并为一个分幕</option><option value="one_section_per_page">每页单独一个分幕</option></select></div><div data-document-preview></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="secondary-btn" data-document-parse>解析预览</button><button class="primary-btn" data-document-import disabled>确认导入</button></div>`;
}

export function documentPreviewHtml({ filenameHtml, summaryHtml, extraHtml }) {
  return `<section class="document-preview"><b>${filenameHtml}</b><p>${summaryHtml}</p>${extraHtml}</section>`;
}

export function creatorPreviewBodyHtml({ roleNameHtml, privateProfileHtml, sectionRowsHtml }) {
  return `<article class="preview-role-card"><p class="section-kicker">仅此角色可见</p><h3>${roleNameHtml}</h3><p>${privateProfileHtml}</p></article>${sectionRowsHtml || `<div class="empty-state">该筛选条件下没有私人剧情。</div>`}`;
}

export function creatorImportModalHtml({ emptyRoleHintHtml, newWorldFieldsHtml, roleSelectHtml }) {
  return `<h2>导入创作内容</h2><p class="wizard-intro">JSON 内容包会先预览再写入。可选择追加到当前世界，或创建一个新世界。现有内容不会被覆盖。</p><div class="form-group"><label>导入模式</label><select class="field" data-import-mode><option value="append">追加到当前世界</option><option value="new_world">创建新世界并导入</option></select>${emptyRoleHintHtml}<div data-new-world-fields style="display:none;margin-top:10px">${newWorldFieldsHtml}</div><label>选择文件</label><input class="field" type="file" accept=".json,.md,.txt" data-creator-import-file>${roleSelectHtml}</div><div data-import-preview></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="secondary-btn" data-import-preview-btn>解析预览</button><button class="primary-btn" data-import-submit disabled>确认导入</button></div>`;
}
