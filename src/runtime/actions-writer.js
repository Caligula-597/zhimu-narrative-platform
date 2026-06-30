/** Creator workspace + DeepSeek / story assistant actions. */
import { callView } from "./view-registry.js";

(function (window) {
  function handleWriterAction(action, el) {
    switch (action) {
      case "creator-add-section": callView("writer", "openCreatorSection", el?.dataset?.role); return true;
      case "creator-edit-section": callView("writer", "openCreatorSection", el?.dataset?.role, el?.dataset?.section); return true;
      case "creator-edit-chapter": callView("writer", "openCreatorChapter", el?.dataset?.chapter); return true;
      case "creator-delete-chapter": callView("writer", "deleteCreatorChapter", el?.dataset?.chapter); return true;
      case "creator-check": callView("writer", "runCreatorChecks"); return true;
      case "creator-preview": callView("writer", "openCreatorPreview"); return true;
      case "creator-collaboration": callView("writer", "openCollaboration"); return true;
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
      default: return false;
    }
  }

  window.zhimuActionsWriter = { handleWriterAction };
})(window);
export {};
