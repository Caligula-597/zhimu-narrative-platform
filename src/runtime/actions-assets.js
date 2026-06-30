/** Asset library filter / upload / recycle actions. */
import { callView } from "./view-registry.js";

(function (window) {
  function handleAssetsAction(action, el) {
    switch (action) {
      case "asset-filter": callView("assets", "setAssetFilter", el?.dataset?.kind); return true;
      case "asset-recycle-toggle": callView("assets", "toggleAssetRecycle"); return true;
      case "upload-asset": callView("assets", "openAssetUpload"); return true;
      case "upload-world-cover": callView("assets", "openAssetUpload", { setAsCover: true }); return true;
      case "download-asset": callView("assets", "downloadCloudAsset", el?.dataset?.asset); return true;
      case "delete-asset": callView("assets", "deleteCloudAsset", el?.dataset?.asset); return true;
      case "restore-asset": callView("assets", "restoreCloudAsset", el?.dataset?.asset); return true;
      case "set-world-cover": callView("assets", "setWorldCoverAsset", el?.dataset?.asset || el?.value); return true;
      case "clear-world-cover": callView("assets", "clearWorldCover"); return true;
      default: return false;
    }
  }

  window.zhimuActionsAssets = { handleAssetsAction };
})(window);
export {};
