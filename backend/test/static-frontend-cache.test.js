import assert from "node:assert/strict";
import test from "node:test";
import { staticCacheControl } from "../src/static-cache-policy.js";

test("static frontend revalidates HTML and keeps hashed assets immutable", () => {
  assert.equal(staticCacheControl("/", 200), "public, max-age=0, must-revalidate");
  assert.equal(staticCacheControl("/index.html", 200), "public, max-age=0, must-revalidate");
  assert.equal(
    staticCacheControl("/assets/writer-AbC123.js", 200),
    "public, max-age=31536000, immutable"
  );
});

test("missing static chunks are never cached", () => {
  assert.equal(staticCacheControl("/assets/writer-old.js", 404), "no-store");
  assert.equal(staticCacheControl("/missing.css", 404), "no-store");
});
