import { state } from "../state.js";

export function renderMobileNav() {
  if (state.view === "game" || state.view === "landing" || state.view === "join" || state.view === "auth") {
    return "";
  }
  const dmUnread = (state.dmConversations?.items || []).reduce(
    (sum, c) => sum + (c.unreadCount || 0),
    0
  );
  const item = (views, action, label, badge = "") => {
    const active = views.includes(state.view);
    return `<button type="button" class="mobile-nav-item ${active ? "is-active" : ""}" data-action="${action}">${label}${badge}</button>`;
  };
  return `
    <nav class="mobile-nav" aria-label="主导航">
      ${item(["landing"], "go-home", "首页")}
      ${item(["plaza", "plaza-thread"], "go-plaza", "广场")}
      ${item(["friends"], "go-friends", "好友")}
      ${item(["messages", "dm"], "go-messages", "消息", dmUnread ? `<span class="nav-badge">${dmUnread > 99 ? "99+" : dmUnread}</span>` : "")}
      ${item(["lobby"], "go-lobby", "找局")}
    </nav>`;
}
