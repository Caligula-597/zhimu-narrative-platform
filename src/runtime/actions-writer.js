/** Creator workspace + DeepSeek / story assistant actions. */
(function (window) {
  function views() { return window.zhimuViews || {}; }

  function handleWriterAction(action, el) {
    const W = views().writer || {};
    switch (action) {
      case "creator-add-section": W.openCreatorSection?.(el?.dataset?.role); return true;
      case "creator-edit-section": W.openCreatorSection?.(el?.dataset?.role, el?.dataset?.section); return true;
      case "creator-edit-chapter": W.openCreatorChapter?.(el?.dataset?.chapter); return true;
      case "creator-check": W.runCreatorChecks?.(); return true;
      case "creator-preview": W.openCreatorPreview?.(); return true;
      case "creator-collaboration": W.openCollaboration?.(); return true;
      case "creator-logs": W.openWorldLogs?.(); return true;
      case "creator-document-parser": W.openDocumentParser?.(); return true;
      case "deepseek-assistant": W.openDeepseekAssistant?.(); return true;
      case "deepseek-pipeline": W.openDeepseekPipeline?.(); return true;
      case "deepseek-full-mystery": W.openDeepseekFullMystery?.(); return true;
      case "story-manuscript": W.openStoryManuscript?.(); return true;
      case "story-assistant": W.openStoryAssistant?.(); return true;
      case "creator-add-role": W.openCreatorRole?.(); return true;
      case "creator-edit-role": W.openCreatorRole?.(el?.dataset?.role); return true;
      case "creator-export": W.exportCreatorPackage?.(); return true;
      case "creator-import": W.openCreatorImport?.(); return true;
      case "creator-snapshot": W.createCreatorSnapshot?.(); return true;
      case "creator-restore": W.restoreCreatorSnapshot?.(el?.dataset?.version); return true;
      case "creator-delete-version": W.deleteCreatorSnapshot?.(el?.dataset?.version); return true;
      default: return false;
    }
  }

  window.zhimuActionsWriter = { handleWriterAction };
})(window);
export {};
