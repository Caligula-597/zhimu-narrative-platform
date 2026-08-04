import assert from "node:assert/strict";
import test from "node:test";
import {
  mergePortalProfileIntoUser,
  renderPortalProfileEditor
} from "../shared/portal-profile-ui.js";
import {
  PORTAL_AVATAR_MAX_BYTES,
  validatePortalAvatarFile
} from "../shared/portal-profile-client.js";

test("profile editor explains independent portal identity and cooldown", () => {
  const html = renderPortalProfileEditor({
    displayName: "谜面玩家",
    avatarUrl: null,
    hasCustomAvatar: false,
    canChangeName: false,
    nextNameChangeAt: "2026-08-27T00:00:00.000Z"
  }, { portal: "player", status: "这个玩家昵称已被占用" });

  assert.match(html, /玩家端身份资料/);
  assert.match(html, /登录账号三端通用，昵称与头像仅在本端生效/);
  assert.match(html, /2026/);
  assert.match(html, /这个玩家昵称已被占用/);
  assert.match(html, /data-profile-name disabled/);
});

test("portal profile replaces only the active presentation fields", () => {
  const user = { id: "user-1", email: "same@example.com", displayName: "基础昵称" };
  const merged = mergePortalProfileIntoUser(user, {
    displayName: "主持昵称",
    avatarUrl: "https://app.example/avatar"
  });
  assert.equal(merged.id, user.id);
  assert.equal(merged.email, user.email);
  assert.equal(merged.displayName, "主持昵称");
  assert.equal(merged.avatarUrl, "https://app.example/avatar");
});

test("avatar policy accepts only supported images up to 2 MB", () => {
  assert.doesNotThrow(() => validatePortalAvatarFile({
    name: "avatar.webp",
    type: "image/webp",
    size: PORTAL_AVATAR_MAX_BYTES
  }));
  assert.throws(() => validatePortalAvatarFile({
    name: "avatar.svg",
    type: "image/svg+xml",
    size: 200
  }), /JPEG、PNG 或 WebP/);
  assert.throws(() => validatePortalAvatarFile({
    name: "huge.png",
    type: "image/png",
    size: PORTAL_AVATAR_MAX_BYTES + 1
  }), /2 MB/);
});
