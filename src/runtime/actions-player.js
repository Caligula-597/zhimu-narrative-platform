/** Player runtime + voice + cloud reading/clue actions. */
(function (window) {
  function views() { return window.zhimuViews || {}; }

  function handlePlayerAction(action, el) {
    const P = views().player || {};
    switch (action) {
      case "voice-room": P.openVoiceRooms?.(); return true;
      case "voice-room-create": P.openCreateVoiceRoom?.(); return true;
      case "voice-room-invite": P.openInviteVoiceRoom?.(el?.dataset?.roomId, el?.dataset?.room); return true;
      case "join-room": P.joinVoiceRoom?.(el?.dataset?.roomId, el?.dataset?.room); return true;
      case "voice-live-connect": P.connectVoiceLive?.(); return true;
      case "voice-live-disconnect": P.disconnectVoiceLive?.(); return true;
      case "voice-mic-toggle": P.toggleVoiceMic?.(); return true;
      case "voice-chat-refresh": P.refreshVoiceMessages?.(); return true;
      case "voice-chat-send": P.sendVoiceMessage?.(); return true;
      case "read-cloud-next": P.completeCloudReading?.(el?.dataset?.section); return true;
      case "remove-highlight": P.removeStoryHighlight?.(el?.dataset?.highlight); return true;
      case "investigate-cloud": P.investigateCloud?.(el?.dataset?.point); return true;
      case "read-cloud-clue": P.readCloudClue?.(el?.dataset?.clue, el?.dataset?.shared === "1"); return true;
      case "share-cloud-clue": P.shareCloudClue?.(el?.dataset?.clue); return true;
      case "share-clue-roles": P.openShareClueRolesModal?.(el?.dataset?.clue); return true;
      case "edit-clue-note": P.openClueNoteModal?.(el?.dataset?.clue); return true;
      case "read-shared-clue": P.readCloudClue?.(el?.dataset?.clue, true); return true;
      default: return false;
    }
  }

  window.zhimuActionsPlayer = { handlePlayerAction };
})(window);
export {};
