/** Asset library filter / upload / recycle actions. */
(function (window) {
  function views() { return window.zhimuViews || {}; }

  function handleAssetsAction(action, el) {
    const A = views().assets || {};
    switch (action) {
      case "asset-filter": A.setAssetFilter?.(el?.dataset?.kind); return true;
      case "asset-recycle-toggle": A.toggleAssetRecycle?.(); return true;
      case "upload-asset": A.openAssetUpload?.(); return true;
      case "upload-world-cover": A.openAssetUpload?.({ setAsCover: true }); return true;
      case "download-asset": A.downloadCloudAsset?.(el?.dataset?.asset); return true;
      case "delete-asset": A.deleteCloudAsset?.(el?.dataset?.asset); return true;
      case "restore-asset": A.restoreCloudAsset?.(el?.dataset?.asset); return true;
      case "set-world-cover": A.setWorldCoverAsset?.(el?.dataset?.asset || el?.value); return true;
      case "clear-world-cover": A.clearWorldCover?.(); return true;
      default: return false;
    }
  }

  window.zhimuActionsAssets = { handleAssetsAction };
})(window);
export {};
