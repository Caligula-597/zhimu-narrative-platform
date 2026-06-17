/** Player invite URLs for play.getzhimu.com */
(function (window) {
  function playSiteOrigin() {
    return (window.zhimuConfig?.playSiteOrigin || "https://play.getzhimu.com").replace(/\/$/, "");
  }

  function playerJoinUrl(inviteCode) {
    const code = String(inviteCode || "").trim();
    if (!code) return playSiteOrigin();
    return `${playSiteOrigin()}/?join=${encodeURIComponent(code)}`;
  }

  async function copyText(text, label = "内容") {
    const value = String(text || "").trim();
    if (!value) return;
    const showToast = window.zhimuToast?.showToast || (() => {});
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${label}已复制`);
    } catch {
      showToast(`${label}：${value}`);
    }
  }

  window.zhimuInviteLinks = { playSiteOrigin, playerJoinUrl, copyText };
})(window);
export {};
