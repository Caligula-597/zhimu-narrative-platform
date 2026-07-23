/** Creator workspace + DeepSeek / story assistant actions. */
import { callView } from "./view-registry.js";

(function (window) {
  function handleWriterAction(action, el) {
    switch (action) {
      case "creator-add-section": callView("writer", "openCreatorSection", el?.dataset?.role); return true;
      case "creator-edit-section": callView("writer", "openCreatorSection", el?.dataset?.role, el?.dataset?.section); return true;
      case "writer-editor-close": callView("writer", "closeWriterSectionEditor"); return true;
      case "writer-editor-save": callView("writer", "saveWriterSectionEditor"); return true;
      case "writer-editor-delete": callView("writer", "deleteWriterSectionEditor"); return true;
      case "writer-editor-discard": callView("writer", "discardWriterSectionDraft"); return true;
      case "writer-editor-replace": callView("writer", "replaceWriterSectionText"); return true;
      case "writer-editor-format": callView("writer", "formatWriterSectionText", el?.dataset?.format); return true;
      case "writer-editor-switch": callView("writer", "switchWriterSection", el?.dataset?.role, el?.dataset?.section); return true;
      case "writer-metadata-close": callView("writer", "closeWriterMetadataEditor"); return true;
      case "writer-metadata-save": callView("writer", "saveWriterMetadataEditor"); return true;
      case "writer-metadata-delete-role": callView("writer", "deleteWriterRoleEditor"); return true;
      case "writer-tool-close": callView("writer", "closeWriterToolWorkspace"); return true;
      case "writer-manuscript-save": callView("writer", "saveManuscriptWorkspace"); return true;
      case "writer-manuscript-from-graph": callView("writer", "syncManuscriptFromGraphWorkspace"); return true;
      case "writer-manuscript-to-graph": callView("writer", "syncManuscriptToGraphWorkspace"); return true;
      case "writer-document-parse": callView("writer", "parseDocumentWorkspace"); return true;
      case "writer-document-import": callView("writer", "importDocumentWorkspace"); return true;
      case "writer-export-next": callView("writer", "nextExportWorkspaceStep"); return true;
      case "writer-export-back": callView("writer", "previousExportWorkspaceStep"); return true;
      case "writer-export-run": callView("writer", "runExportWorkspace"); return true;
      case "writer-import-preview": callView("writer", "previewImportWorkspace"); return true;
      case "writer-import-run": callView("writer", "runImportWorkspace"); return true;
      case "writer-snapshot-save": callView("writer", "saveSnapshotWorkspace"); return true;
      case "creator-edit-chapter": callView("writer", "openCreatorChapter", el?.dataset?.chapter); return true;
      case "creator-delete-chapter": callView("writer", "deleteCreatorChapter", el?.dataset?.chapter); return true;
      case "creator-check": callView("writer", "runCreatorChecks"); return true;
      case "creator-preview": callView("writer", "openCreatorPreview", el?.dataset?.role); return true;
      case "writer-select-role": callView("writer", "selectWriterRole", el?.dataset?.role); return true;
      case "publish-impact-preview": callView("writer", "openPublishImpactPreview"); return true;
      case "creator-collaboration": callView("writer", "openCollaboration"); return true;
      case "creator-review": callView("writer", "openCreatorReview"); return true;
      case "creator-logs": callView("writer", "openWorldLogs"); return true;
      case "creator-document-parser": callView("writer", "openDocumentParser"); return true;
      case "deepseek-assistant": callView("writer", "openDeepseekAssistant"); return true;
      case "deepseek-pipeline": callView("writer", "openDeepseekPipeline"); return true;
      case "deepseek-full-mystery": callView("writer", "openDeepseekFullMystery"); return true;
      case "story-manuscript": callView("writer", "openStoryManuscript"); return true;
      case "story-assistant": callView("writer", "openStoryAssistant"); return true;
      case "creator-add-role": callView("writer", "openCreatorRole"); return true;
      case "creator-edit-role": callView("writer", "openCreatorRole", el?.dataset?.role); return true;
      case "creator-export": callView("writer", "exportCreatorPackage"); return true;
      case "creator-import": callView("writer", "openCreatorImport"); return true;
      case "creator-snapshot": callView("writer", "createCreatorSnapshot"); return true;
      case "creator-restore": callView("writer", "restoreCreatorSnapshot", el?.dataset?.version); return true;
      case "creator-delete-version": callView("writer", "deleteCreatorSnapshot", el?.dataset?.version); return true;
      case "save-role-archive":
        return window.zhimuActionsBible?.handleBibleAction?.(action, el) || false;
      case "load-writer-archives":
        void callView("writer", "loadWriterRoleArchives", { force: true });
        return true;
      default: return false;
    }
  }

  window.zhimuActionsWriter = { handleWriterAction };
})(window);
export {};
