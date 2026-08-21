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
      case "writer-story-analyze": callView("writer", "analyzeStoryAssistantWorkspace"); return true;
      case "writer-story-import": callView("writer", "importStoryAssistantWorkspace"); return true;
      case "writer-document-parse": callView("writer", "parseDocumentWorkspace"); return true;
      case "writer-document-import": callView("writer", "importDocumentWorkspace"); return true;
      case "writer-export-next": callView("writer", "nextExportWorkspaceStep"); return true;
      case "writer-export-back": callView("writer", "previousExportWorkspaceStep"); return true;
      case "writer-export-run": callView("writer", "runExportWorkspace"); return true;
      case "writer-import-preview": callView("writer", "previewImportWorkspace"); return true;
      case "writer-import-run": callView("writer", "runImportWorkspace"); return true;
      case "writer-snapshot-save": callView("writer", "saveSnapshotWorkspace"); return true;
      case "writer-review-mode": callView("writer", "setReviewWorkspaceMode", el?.dataset?.reviewMode); return true;
      case "writer-review-filter-status": callView("writer", "setReviewFilter", "status", el?.value || ""); return true;
      case "writer-review-filter-target": callView("writer", "setReviewFilter", "target", el?.value || ""); return true;
      case "writer-review-refresh": callView("writer", "refreshReviewList"); return true;
      case "writer-review-create": callView("writer", "createReviewFromWorkspace"); return true;
      case "writer-review-reply": callView("writer", "replyReviewFromWorkspace", el?.dataset?.reviewId); return true;
      case "writer-review-status": callView("writer", "updateReviewStatusFromWorkspace", el?.dataset?.reviewId, el?.dataset?.reviewStatus); return true;
      case "writer-review-compare": callView("writer", "compareReviewVersions"); return true;
      case "writer-collaboration-refresh": callView("writer", "refreshCollaborationWorkspace"); return true;
      case "writer-collaboration-invite": callView("writer", "inviteCollaboratorFromWorkspace"); return true;
      case "writer-collaboration-role-save": callView("writer", "saveCollaboratorRoleFromWorkspace", el?.dataset?.memberId); return true;
      case "writer-collaboration-remove": callView("writer", "removeCollaboratorFromWorkspace", el?.dataset?.memberId); return true;
      case "writer-collaboration-invite-resend": callView("writer", "resendCollaboratorInviteFromWorkspace", el?.dataset?.inviteId); return true;
      case "writer-collaboration-invite-revoke": callView("writer", "revokeCollaboratorInviteFromWorkspace", el?.dataset?.inviteId); return true;
      case "writer-collaboration-invite-copy": callView("writer", "copyCollaborationInviteLink"); return true;
      case "writer-collaboration-invite-dismiss": callView("writer", "dismissCollaborationInviteLink"); return true;
      case "writer-logs-filter-room": callView("writer", "setWorldLogFilter", "room", el?.value || ""); return true;
      case "writer-logs-filter-event": callView("writer", "setWorldLogFilter", "event", el?.value || ""); return true;
      case "writer-logs-apply": callView("writer", "applyWorldLogFilters"); return true;
      case "writer-logs-clear": callView("writer", "clearWorldLogFilters"); return true;
      case "writer-logs-refresh": callView("writer", "refreshWorldLogs"); return true;
      case "writer-logs-more": callView("writer", "loadMoreWorldLogs"); return true;
      case "creator-edit-chapter": callView("writer", "openCreatorChapter", el?.dataset?.chapter); return true;
      case "creator-delete-chapter": callView("writer", "deleteCreatorChapter", el?.dataset?.chapter); return true;
      case "creator-check": callView("writer", "runCreatorChecks"); return true;
      case "writer-select-role": callView("writer", "selectWriterRole", el?.dataset?.role); return true;
      case "publish-impact-preview": callView("writer", "openPublishImpactPreview"); return true;
      case "creator-collaboration": callView("writer", "openCollaboration"); return true;
      case "creator-review": callView("writer", "openCreatorReview"); return true;
      case "creator-logs": callView("writer", "openWorldLogs"); return true;
      case "creator-document-parser": callView("writer", "openDocumentParser"); return true;
      case "story-manuscript": callView("writer", "openStoryManuscript"); return true;
      case "story-assistant": callView("writer", "openStoryAssistant"); return true;
      case "world-engine": callView("writer", "openWorldEngine"); return true;
      case "world-engine-seed": callView("writer", "seedWorldEngineWorkspace"); return true;
      case "world-engine-search": callView("writer", "searchWorldEngineWorkspace"); return true;
      case "world-engine-commit": callView("writer", "commitWorldEngineWorkspace", el?.dataset?.candidateId); return true;
      case "world-engine-lower": callView("writer", "lowerWorldEngineWorkspace", el?.dataset?.actionType); return true;
      case "world-engine-epistemic": callView("writer", "searchWorldEngineEpistemicWorkspace"); return true;
      case "world-engine-render": callView("writer", "renderWorldEngineWorkspace", el?.dataset?.characterId); return true;
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
