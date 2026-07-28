import { uploadPortalAvatar } from "../../../shared/portal-profile-client.js";
import { mergePortalProfileIntoUser } from "../../../shared/portal-profile-ui.js";
import { api } from "../api.js";
import { formatApiError } from "../errors.js";
import { state } from "../state.js";

const PORTAL = "host";

export function createHostProfileController({ render, showToast, documentRef = document }) {
  function applyProfile(profile) {
    state.portalProfile = profile;
    state.user = mergePortalProfileIntoUser(state.user, profile);
  }

  async function runProfileTask(task, successMessage = "") {
    state.profileBusy = true;
    state.profileStatus = "";
    render();
    try {
      const result = await task();
      if (result?.portal) applyProfile(result);
      if (successMessage) showToast(successMessage);
      return result;
    } catch (error) {
      state.profileStatus = formatApiError(error, "资料操作失败");
      showToast(state.profileStatus);
      return null;
    } finally {
      state.profileBusy = false;
      render();
    }
  }

  async function openProfile() {
    if (!state.user) return;
    state.profileOpen = true;
    render();
    await runProfileTask(() => api.getPortalProfile(PORTAL));
  }

  async function handleAction(action) {
    if (action === "open-profile") {
      await openProfile();
      return true;
    }
    if (action === "close-profile") {
      state.profileOpen = false;
      state.profileStatus = "";
      render();
      return true;
    }
    if (!state.profileOpen) return false;
    if (action === "profile-check-name") {
      const input = documentRef.querySelector("[data-profile-name]");
      if (!input) return true;
      const result = await runProfileTask(() => api.checkPortalProfileName(PORTAL, input.value));
      if (result) {
        state.profileStatus = result.available ? "这个主持人昵称可以使用" : "这个主持人昵称已被占用";
        render();
      }
      return true;
    }
    if (action === "profile-save-name") {
      const input = documentRef.querySelector("[data-profile-name]");
      if (!input) return true;
      await runProfileTask(
        () => api.updatePortalProfileName(PORTAL, input.value),
        "主持人端昵称已更新"
      );
      return true;
    }
    if (action === "profile-remove-avatar") {
      await runProfileTask(
        () => api.removePortalAvatar(PORTAL),
        "已恢复主持人端默认头像"
      );
      return true;
    }
    return false;
  }

  async function handleChange(target) {
    if (!target?.matches?.("[data-profile-avatar-file]")) return false;
    const file = target.files?.[0];
    if (!file) return true;
    await runProfileTask(
      () => uploadPortalAvatar(api, PORTAL, file),
      "主持人端头像已更新"
    );
    return true;
  }

  return { applyProfile, handleAction, handleChange, openProfile };
}
