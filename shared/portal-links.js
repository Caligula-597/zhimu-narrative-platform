function normalizedOrigin(origin, fallback) {
  return String(origin || fallback || "").trim().replace(/\/+$/, "");
}

export function playerJoinUrl(origin, inviteCode) {
  const base = normalizedOrigin(origin, "https://play.getzhimu.com");
  const code = String(inviteCode || "").trim();
  return code ? `${base}/?join=${encodeURIComponent(code)}` : base;
}

export function hostConsoleUrl(origin, roomId) {
  const base = normalizedOrigin(origin, "https://host.getzhimu.com");
  const id = String(roomId || "").trim();
  return id ? `${base}/?room=${encodeURIComponent(id)}` : base;
}

export function hostRoomIdFromSearch(search) {
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(String(search || ""));
  return String(params.get("room") || params.get("roomId") || "").trim();
}
