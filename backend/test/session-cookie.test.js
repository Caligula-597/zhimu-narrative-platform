import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { readSessionCookie } from "../src/session-cookie.js";

test("guest login sets HttpOnly session cookie and cookie auth works", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false, nodeEnv: "production" });
  context.after(() => app.close());

  const login = await app.inject({
    method: "POST",
    url: "/api/auth/guest",
    payload: { displayName: "Cookie测试" }
  });
  assert.equal(login.statusCode, 201);
  const setCookie = login.headers["set-cookie"];
  assert.ok(setCookie);
  assert.match(String(setCookie), /HttpOnly/i);
  assert.match(String(setCookie), /zhimu_session=/);

  const token = login.json().token;
  const me = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { cookie: `zhimu_session=${encodeURIComponent(token)}` }
  });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().display_name, "Cookie测试");
});

test("readSessionCookie parses token from cookie header", () => {
  const token = "abc123def456ghi789jkl012";
  const request = { headers: { cookie: `zhimu_session=${token}; other=1` } };
  assert.equal(readSessionCookie(request), token);
});

test("logout clears session cookie", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());

  const login = await app.inject({
    method: "POST",
    url: "/api/auth/guest",
    payload: { displayName: "Logout测试" }
  });
  const token = login.json().token;
  const logout = await app.inject({
    method: "POST",
    url: "/api/auth/logout",
    headers: { cookie: `zhimu_session=${token}` }
  });
  assert.equal(logout.statusCode, 200);
  assert.match(String(logout.headers["set-cookie"] || ""), /Max-Age=0/i);
});

test("logout revokes both bearer and cookie sessions when both are presented", async (context) => {
  const app = await createApp({ logger: false, allowDemoUserHeader: false });
  context.after(() => app.close());

  const bearerLogin = await app.inject({
    method: "POST",
    url: "/api/auth/guest",
    payload: { displayName: "Bearer logout" }
  });
  const cookieLogin = await app.inject({
    method: "POST",
    url: "/api/auth/guest",
    payload: { displayName: "Cookie logout" }
  });
  const bearerToken = bearerLogin.json().token;
  const cookieToken = cookieLogin.json().token;

  const logout = await app.inject({
    method: "POST",
    url: "/api/auth/logout",
    headers: {
      authorization: `Bearer ${bearerToken}`,
      cookie: `zhimu_session=${encodeURIComponent(cookieToken)}`
    }
  });
  assert.equal(logout.statusCode, 200);

  for (const token of [bearerToken, cookieToken]) {
    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(me.statusCode, 401);
  }
});
