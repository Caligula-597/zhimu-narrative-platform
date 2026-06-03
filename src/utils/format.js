/* format helpers */
(function (window) {
  function formatTime(value) {
    return new Date(value).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function formatRelativeTime(value) {
    if (!value) return "";
    const diff = Date.now() - new Date(value).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    return formatTime(value);
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function roleParts(name = "") {
    const parts = String(name).split(" · ");
    return { name: parts[0] || "未命名角色", role: parts.slice(1).join(" · ") || "玩家角色" };
  }

  function hostOperationLabel(type = "", message = "") {
    const labels = {
      reading_completed: "阅读完成",
      investigation_completed: "调查完成",
      host_grant_clue: "主持发线索",
      host_unlock_section: "解锁分幕",
      scene_unlocked: "开放场景",
      host_event_executed: "主持确认",
      host_event_dismissed: "主持拒绝",
      host_note: "主持备注",
      rule_action: "规则动作",
      clue_read: "线索阅读",
      clue_shared_room: "线索公开"
    };
    return labels[type] || message || "系统记录";
  }

  function hostPlayerColor(index) {
    return ["#b9795c", "#587f79", "#706b91", "#9a814f", "#76614d", "#657c91"][index % 6];
  }

  function logActivityType(eventType = "") {
    return /warn|stuck|delay|卡关/i.test(eventType) ? "warn" : "ok";
  }

  function chapterPublicationLabel(status) {
    return { draft: "草稿", testing: "测试中", published: "已发布" }[status] || status;
  }

  function chapterFlowClass(status) {
    if (status === "published") return "ok";
    if (status === "testing") return "live";
    return "locked";
  }

  window.zhimuFormat = {
    formatRelativeTime,
    formatTime,
    formatBytes,
    escapeHtml,
    roleParts,
    hostOperationLabel,
    hostPlayerColor,
    logActivityType,
    chapterPublicationLabel,
    chapterFlowClass
  };
})(window);
