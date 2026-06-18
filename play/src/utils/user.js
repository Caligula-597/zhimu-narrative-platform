export function isRegisteredUser(user) {
  return Boolean(user && !user.isGuest);
}

export function userSessionLabel(user) {
  if (!user) return "";
  if (user.isGuest) return "访客";
  return user.displayName || user.email || "已登录";
}
