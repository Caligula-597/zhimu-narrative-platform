import { uploadPortalAvatar } from "../../../shared/portal-profile-client.js";
import { mergePortalProfileIntoUser } from "../../../shared/portal-profile-ui.js";

const PORTAL = "player";

export function createPlayerProfileController({
  api,
  state,
  render,
  setToast,
  formatApiError,
  openModalState,
  closeModalState,
  documentRef = document
}) {
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
      if (successMessage) setToast(successMessage, render);
      return result;
    } catch (error) {
      state.profileStatus = formatApiError(error, "资料操作失败");
      setToast(state.profileStatus, render);
      return null;
    } finally {
      state.profileBusy = false;
      render();
    }
  }

  async function openProfile() {
    if (!state.user) return;
    openModalState({ kind: "portal-profile", title: "玩家端身份资料" });
    render();
    await runProfileTask(() => api.getPortalProfile(PORTAL));
  }

  async function handleAction(action) {
    if (action === "open-profile") {
      await openProfile();
      return true;
    }
    if (action === "profile-close" && state.modal?.kind === "portal-profile") {
      closeModalState();
      state.profileStatus = "";
      render();
      return true;
    }
    if (state.modal?.kind !== "portal-profile") return false;
    if (action === "profile-check-name") {
      const input = documentRef.querySelector("[data-profile-name]");
      if (!input) return true;
      const result = await runProfileTask(() => api.checkPortalProfileName(PORTAL, input.value));
      if (result) {
        state.profileStatus = result.available ? "这个玩家昵称可以使用" : "这个玩家昵称已被占用";
        render();
      }
      return true;
    }
    if (action === "profile-save-name") {
      const input = documentRef.querySelector("[data-profile-name]");
      if (!input) return true;
      await runProfileTask(
        () => api.updatePortalProfileName(PORTAL, input.value),
        "玩家端昵称已更新"
      );
      return true;
    }
    if (action === "profile-remove-avatar") {
      await runProfileTask(
        () => api.removePortalAvatar(PORTAL),
        "已恢复玩家端默认头像"
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
      "玩家端头像已更新"
    );
    return true;
  }

  return { applyProfile, handleAction, handleChange, openProfile };
}
