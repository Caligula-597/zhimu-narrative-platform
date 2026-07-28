/** Player invite URLs for play.getzhimu.com */
import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import {
  hostConsoleUrl as buildHostConsoleUrl,
  playerJoinUrl as buildPlayerJoinUrl
} from "../../shared/portal-links.js";
(function (window) {
  function playSiteOrigin() {
    return (window.zhimuConfig?.playSiteOrigin || "https://play.getzhimu.com").replace(/\/$/, "");
  }

  function playerJoinUrl(inviteCode) {
    return buildPlayerJoinUrl(playSiteOrigin(), inviteCode);
  }

  function hostConsoleUrl(roomId) {
    const base = (window.zhimuConfig?.hostSiteOrigin || "https://host.getzhimu.com").replace(/\/$/, "");
    const id = String(roomId || zhimuApi?.context?.roomId || "").trim();
    return buildHostConsoleUrl(base, id);
  }

  async function copyText(text, label = "内容") {
    const value = String(text || "").trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${label}已复制`);
    } catch {
      showToast(`${label}：${value}`);
    }
  }

  window.zhimuInviteLinks = { playSiteOrigin, playerJoinUrl, hostConsoleUrl, copyText };
})(window);
export {};
