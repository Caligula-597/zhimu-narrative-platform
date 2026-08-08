import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCookieRequestOrigin,
  isAllowedCookieOrigin
} from "../src/cookie-request-origin.js";

const productionOrigins = [
  "https://app.getzhimu.com",
  "https://host.getzhimu.com",
  "https://play.getzhimu.com"
];

function request({ method = "POST", transport = "cookie", origin, fetchSite } = {}) {
  const headers = {};
  if (origin !== undefined) headers.origin = origin;
  if (fetchSite !== undefined) headers["sec-fetch-site"] = fetchSite;
  return { method, authTransport: transport, headers };
}

test("cookie mutations allow the three trusted portal origins", () => {
  for (const origin of productionOrigins) {
    assert.doesNotThrow(() => assertCookieRequestOrigin(request({ origin }), productionOrigins));
  }
  assert.equal(isAllowedCookieOrigin("https://HOST.getzhimu.com/path", productionOrigins), true);
});

test("cookie mutations reject untrusted Origin and explicit cross-site browser requests", () => {
  assert.throws(
    () => assertCookieRequestOrigin(request({ origin: "https://attacker.example" }), productionOrigins),
    (error) => error.code === "CSRF_ORIGIN_FORBIDDEN" && error.statusCode === 403
  );
  assert.throws(
    () => assertCookieRequestOrigin(request({ origin: "https://app.getzhimu.com", fetchSite: "cross-site" }), productionOrigins),
    (error) => error.code === "CSRF_ORIGIN_FORBIDDEN"
  );
  assert.throws(
    () => assertCookieRequestOrigin({
      method: "POST",
      authTransport: "cookie",
      headers: { referer: "https://attacker.example/forged-form" }
    }, productionOrigins),
    (error) => error.code === "CSRF_ORIGIN_FORBIDDEN"
  );
});

test("bearer requests, safe methods and non-browser cookie clients are unaffected", () => {
  assert.doesNotThrow(() => assertCookieRequestOrigin(
    request({ transport: "bearer", origin: "https://attacker.example", fetchSite: "cross-site" }),
    productionOrigins
  ));
  assert.doesNotThrow(() => assertCookieRequestOrigin(
    request({ method: "GET", origin: "https://attacker.example", fetchSite: "cross-site" }),
    productionOrigins
  ));
  assert.doesNotThrow(() => assertCookieRequestOrigin(request(), productionOrigins));
});

test("origin matcher supports strict regex allowlists without global-regex state leaks", () => {
  const allowed = /^https:\/\/(?:app|host|play)\.getzhimu\.com$/gu;
  assert.equal(isAllowedCookieOrigin("https://app.getzhimu.com", allowed), true);
  assert.equal(isAllowedCookieOrigin("https://app.getzhimu.com", allowed), true);
  assert.equal(isAllowedCookieOrigin("https://evil.getzhimu.com", allowed), false);
  assert.equal(isAllowedCookieOrigin("null", true), false);
});
