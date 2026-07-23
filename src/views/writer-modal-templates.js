export function worldLogModalHtml() {
  return `<h2>世界运行日志</h2><p class="wizard-intro">查看玩家阅读、调查、规则触发与主持操作。筛选只影响当前查看，不会修改历史记录。</p><div class="log-toolbar"><select class="field compact-field" data-log-event><option value="">全部事件</option><option value="reading_completed">阅读完成</option><option value="investigation_completed">调查完成</option><option value="scene_unlocked">场景解锁</option></select><input class="field" data-log-keyword placeholder="搜索日志内容"><button class="secondary-btn" data-log-refresh>筛选</button></div><div class="log-list" data-log-list></div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`;
}

export function storyAssistantModalHtml() {
  return `<h2>剧情助手</h2><p class="wizard-intro">粘贴剧情梗概或逐段素材。系统会先识别场景、线索和调查点，再生成建议连线。确认后才会写入剧情编排。</p><div class="assistant-guide"><b>推荐格式</b><span>每段用空行分隔。也可以使用“场景：”“线索：”“调查点：”开头提高识别准确度。</span></div><textarea class="field assistant-draft" rows="14" data-story-draft placeholder="场景：旧灯塔。潮水退去后，塔门露出一枚生锈的锁。&#10;&#10;调查点：检查塔门锁孔，发现内部残留蓝色蜡屑。&#10;&#10;线索：蓝色火漆碎片。它与匿名信上的封蜡一致。"></textarea><div data-assistant-preview></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="secondary-btn" data-assistant-analyze>分析分类</button><button class="primary-btn" data-assistant-import disabled>确认写入剧情编排</button></div>`;
}
