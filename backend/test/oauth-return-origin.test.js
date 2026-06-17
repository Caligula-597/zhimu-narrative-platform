import assert from "node:assert/strict";
import test from "node:test";
import {
  allowedOAuthReturnOrigins,
  resolveOAuthReturnOrigin
} from "../src/oauth-providers.js";

test("resolveOAuthReturnOrigin accepts play and app origins", () => {
  const prevApp = process.env.APP_PUBLIC_URL;
  const prevPlay = process.env.PLAY_SITE_ORIGIN;
  process.env.APP_PUBLIC_URL = "https://app.getzhimu.com";
  process.env.PLAY_SITE_ORIGIN = "https://play.getzhimu.com";
  try {
    assert.equal(
      resolveOAuthReturnOrigin("https://play.getzhimu.com"),
      "https://play.getzhimu.com/"
    );
    assert.equal(
      resolveOAuthReturnOrigin("https://app.getzhimu.com"),
      "https://app.getzhimu.com/"
    );
    assert.equal(
      resolveOAuthReturnOrigin("https://evil.example"),
      "https://app.getzhimu.com/"
    );
    assert.ok(allowedOAuthReturnOrigins().has("https://play.getzhimu.com"));
  } finally {
    if (prevApp === undefined) delete process.env.APP_PUBLIC_URL;
    else process.env.APP_PUBLIC_URL = prevApp;
    if (prevPlay === undefined) delete process.env.PLAY_SITE_ORIGIN;
    else process.env.PLAY_SITE_ORIGIN = prevPlay;
  }
});
