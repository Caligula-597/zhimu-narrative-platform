import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { query } from "../src/db.js";
import { getObjectStorage } from "../src/storage/index.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);

function auth(token) {
  return { authorization: `Bearer ${token}` };
}

test("one account keeps independent creator, host and player profiles", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());

  const stamp = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const users = [];
  context.after(async () => {
    if (users.length) await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [users]);
  });

  const first = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      email: `portal-first-${stamp}@zhimu.local`,
      displayName: `门户甲${stamp.slice(-6)}`,
      password: "portal-pass-123"
    }
  });
  assert.equal(first.statusCode, 201, first.body);
  const firstBody = first.json();
  users.push(firstBody.user.id);

  const second = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      email: `portal-second-${stamp}@zhimu.local`,
      displayName: `门户乙${stamp.slice(-6)}`,
      password: "portal-pass-123"
    }
  });
  assert.equal(second.statusCode, 201, second.body);
  const secondBody = second.json();
  users.push(secondBody.user.id);

  const profiles = await app.inject({
    method: "GET",
    url: "/api/account/portal-profiles",
    headers: auth(firstBody.token)
  });
  assert.equal(profiles.statusCode, 200, profiles.body);
  assert.deepEqual(
    profiles.json().profiles.map((profile) => profile.portal),
    ["creator", "host", "player"]
  );

  const creatorName = `主创${stamp.slice(-8)}`;
  const creatorRename = await app.inject({
    method: "PUT",
    url: "/api/account/portal-profiles/creator/name",
    headers: auth(firstBody.token),
    payload: { displayName: creatorName }
  });
  assert.equal(creatorRename.statusCode, 200, creatorRename.body);
  assert.equal(creatorRename.json().displayName, creatorName);
  assert.equal(creatorRename.json().canChangeName, false);

  const playerProfile = await app.inject({
    method: "GET",
    url: "/api/account/portal-profiles/player",
    headers: auth(firstBody.token)
  });
  assert.notEqual(playerProfile.json().displayName, creatorName);
  assert.equal(playerProfile.json().canChangeName, true);

  const cooldown = await app.inject({
    method: "PUT",
    url: "/api/account/portal-profiles/creator/name",
    headers: auth(firstBody.token),
    payload: { displayName: `再改${stamp.slice(-8)}` }
  });
  assert.equal(cooldown.statusCode, 409, cooldown.body);
  assert.equal(cooldown.json().code, "PORTAL_PROFILE_NAME_COOLDOWN");
  assert.ok(cooldown.json().details.nextNameChangeAt);

  const hostName = `主持${stamp.slice(-8)}`;
  const firstHostRename = await app.inject({
    method: "PUT",
    url: "/api/account/portal-profiles/host/name",
    headers: auth(firstBody.token),
    payload: { displayName: hostName }
  });
  assert.equal(firstHostRename.statusCode, 200, firstHostRename.body);

  const availability = await app.inject({
    method: "GET",
    url: `/api/account/portal-profiles/host/name-availability?displayName=${encodeURIComponent(hostName.toUpperCase())}`,
    headers: auth(secondBody.token)
  });
  assert.equal(availability.statusCode, 200, availability.body);
  assert.equal(availability.json().available, false);

  const duplicate = await app.inject({
    method: "PUT",
    url: "/api/account/portal-profiles/host/name",
    headers: auth(secondBody.token),
    payload: { displayName: hostName.toUpperCase() }
  });
  assert.equal(duplicate.statusCode, 409, duplicate.body);
  assert.equal(duplicate.json().code, "PORTAL_PROFILE_NAME_TAKEN");
});

test("player avatar upload is confirmed, served and removable", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());

  const stamp = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const registered = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      email: `portal-avatar-${stamp}@zhimu.local`,
      displayName: `头像号${stamp.slice(-6)}`,
      password: "portal-pass-123"
    }
  });
  assert.equal(registered.statusCode, 201, registered.body);
  const { token, user } = registered.json();
  context.after(() => query(`DELETE FROM users WHERE id = $1`, [user.id]));

  const prepared = await app.inject({
    method: "POST",
    url: "/api/account/portal-profiles/player/avatar-upload-url",
    headers: auth(token),
    payload: {
      filename: "avatar.png",
      contentType: "image/png",
      byteSize: PNG.length
    }
  });
  assert.equal(prepared.statusCode, 201, prepared.body);
  const ticket = prepared.json();
  const objectKey = decodeURIComponent(new URL(ticket.uploadUrl).hostname);
  await getObjectStorage().putObject({
    key: objectKey,
    body: PNG,
    contentType: "image/png"
  });

  const confirmed = await app.inject({
    method: "POST",
    url: "/api/account/portal-profiles/player/avatar/confirm",
    headers: auth(token),
    payload: { uploadId: ticket.uploadId }
  });
  assert.equal(confirmed.statusCode, 200, confirmed.body);
  assert.equal(confirmed.json().hasCustomAvatar, true);
  assert.match(confirmed.json().avatarUrl, /\/api\/account\/portal-avatars\//);
  const storedProfile = await query(
    `SELECT avatar_object_key FROM user_portal_profiles WHERE user_id = $1 AND portal = 'player'`,
    [user.id]
  );
  const publishedObjectKey = storedProfile.rows[0]?.avatar_object_key;
  assert.ok(publishedObjectKey);
  assert.notEqual(publishedObjectKey, objectKey);
  assert.match(publishedObjectKey, /\/profiles\/player\/published\//u);
  await assert.rejects(getObjectStorage().statObject({ key: objectKey }), /Object not found/u);

  const avatarPath = new URL(confirmed.json().avatarUrl).pathname;
  const served = await app.inject({ method: "GET", url: avatarPath });
  assert.equal(served.statusCode, 200, served.body);
  assert.equal(served.headers["content-type"], "image/png");
  assert.deepEqual(served.rawPayload, PNG);

  const removed = await app.inject({
    method: "DELETE",
    url: "/api/account/portal-profiles/player/avatar",
    headers: auth(token)
  });
  assert.equal(removed.statusCode, 200, removed.body);
  assert.equal(removed.json().hasCustomAvatar, false);

  const missing = await app.inject({ method: "GET", url: avatarPath });
  assert.equal(missing.statusCode, 404, missing.body);
});
