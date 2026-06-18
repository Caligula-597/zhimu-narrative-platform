import assert from "node:assert/strict";
import test from "node:test";
import { scanPlaySocialAdContent } from "../src/play-content-moderation.js";

test("scanPlaySocialAdContent detects contact spam", () => {
  assert.equal(scanPlaySocialAdContent("联系 13800138000 详谈").ok, false);
  assert.equal(scanPlaySocialAdContent("今晚八点后在线").ok, true);
});
