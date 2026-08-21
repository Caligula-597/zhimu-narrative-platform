import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

test("player and host HTML declare noindex for search discovery boundaries", () => {
  for (const file of ["play/index.html", "host/index.html"]) {
    assert.match(read(file), /<meta name="robots" content="noindex, nofollow, noarchive" \/>/);
  }
});

test("player and host Pages headers send X-Robots-Tag noindex", () => {
  for (const file of ["play/public/_headers", "host/public/_headers"]) {
    assert.match(read(file), /X-Robots-Tag: noindex, nofollow, noarchive/);
  }
});

test("search discovery sync script and npm entry exist", () => {
  assert.match(read("scripts/cloudflare-sync-search-discovery.mjs"), /http_request_dynamic_redirect/);
  assert.match(read("scripts/cloudflare-sync-search-discovery.mjs"), /crawler_hints/);
  assert.match(read("package.json"), /"cloudflare:sync-search-discovery"/);
});
