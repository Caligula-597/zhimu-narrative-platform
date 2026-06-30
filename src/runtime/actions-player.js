/** Player runtime + voice + cloud reading/clue actions. */
import { callView } from "./view-registry.js";

(function (window) {
  function handlePlayerAction(action, el) {
    switch (action) {
      case "voice-room": callView("player", "openVoiceRooms"); return true;
      case "voice-room-create": callView("player", "openCreateVoiceRoom"); return true;
      case "voice-room-invite": callView("player", "openInviteVoiceRoom", el?.dataset?.roomId, el?.dataset?.room); return true;
      case "join-room": callView("player", "joinVoiceRoom", el?.dataset?.roomId, el?.dataset?.room); return true;
      case "voice-live-connect": callView("player", "connectVoiceLive"); return true;
      case "voice-live-disconnect": callView("player", "disconnectVoiceLive"); return true;
      case "voice-mic-toggle": callView("player", "toggleVoiceMic"); return true;
      case "voice-playback-unlock": callView("player", "unlockVoicePlayback"); return true;
      case "voice-chat-refresh": callView("player", "refreshVoiceMessages"); return true;
      case "voice-chat-send": callView("player", "sendVoiceMessage"); return true;
      case "read-cloud-next": callView("player", "completeCloudReading", el?.dataset?.section); return true;
      case "remove-highlight": callView("player", "removeStoryHighlight", el?.dataset?.highlight); return true;
      case "investigate-cloud": callView("player", "investigateCloud", el?.dataset?.point); return true;
      case "read-cloud-clue": callView("player", "readCloudClue", el?.dataset?.clue, el?.dataset?.shared === "1"); return true;
      case "share-cloud-clue": callView("player", "shareCloudClue", el?.dataset?.clue); return true;
      case "share-clue-roles": callView("player", "openShareClueRolesModal", el?.dataset?.clue); return true;
      case "edit-clue-note": callView("player", "openClueNoteModal", el?.dataset?.clue); return true;
      case "read-shared-clue": callView("player", "readCloudClue", el?.dataset?.clue, true); return true;
      default: return false;
    }
  }

  window.zhimuActionsPlayer = { handlePlayerAction };
})(window);
export {};
