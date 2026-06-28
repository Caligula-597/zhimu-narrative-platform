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

  function hostConsoleUrl(roomId) {
    const base = (window.zhimuConfig?.hostSiteOrigin || "https://host.getzhimu.com").replace(/\/$/, "");
    const id = String(roomId || window.zhimuApi?.context?.roomId || "").trim();
    return id ? `${base}/?roomId=${encodeURIComponent(id)}` : base;
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

  window.zhimuInviteLinks = { playSiteOrigin, playerJoinUrl, hostConsoleUrl, copyText };
})(window);
export {};
