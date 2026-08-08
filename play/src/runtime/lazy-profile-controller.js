const PROFILE_ACTIONS = new Set([
  "open-profile",
  "profile-close",
  "profile-check-name",
  "profile-save-name",
  "profile-remove-avatar"
]);

export function createLazyPlayerProfileController(options) {
  let controllerPromise;
  const load = () => {
    controllerPromise ||= import("./profile-controller.js").then(
      ({ createPlayerProfileController }) => createPlayerProfileController(options)
    );
    return controllerPromise;
  };
  const handleLoadFailure = () => {
    controllerPromise = undefined;
    options.setToast?.("身份资料加载失败，请重试", options.render);
    return true;
  };
  return {
    async handleAction(action, button) {
      if (!PROFILE_ACTIONS.has(action)) return false;
      let controller;
      try {
        controller = await load();
      } catch {
        return handleLoadFailure();
      }
      return controller.handleAction(action, button);
    },
    async handleChange(target) {
      if (!target?.matches?.("[data-profile-avatar-file]")) return false;
      let controller;
      try {
        controller = await load();
      } catch {
        return handleLoadFailure();
      }
      return controller.handleChange(target);
    }
  };
}
