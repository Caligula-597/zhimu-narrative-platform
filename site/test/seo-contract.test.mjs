import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonicalOrigin = "https://getzhimu.com";

const [home, pricing, sitemap, robots, indexNowKey] = await Promise.all([
  fs.readFile(path.join(root, "index.html"), "utf8"),
  fs.readFile(path.join(root, "pricing-commercial.html"), "utf8"),
  fs.readFile(path.join(root, "public", "sitemap.xml"), "utf8"),
  fs.readFile(path.join(root, "public", "robots.txt"), "utf8"),
  fs.readFile(path.join(root, "public", "4ae3984d5a13c690ca674a0fc1185a8c.txt"), "utf8")
]);

test("homepage exposes one canonical, indexable search identity", () => {
  assert.match(home, /<meta name="robots" content="index, follow,[^"]+" \/>/);
  assert.match(home, /<link rel="canonical" href="https:\/\/getzhimu\.com\/" \/>/);
  assert.match(home, /<meta property="og:url" content="https:\/\/getzhimu\.com\/" \/>/);
  assert.match(home, /<meta property="og:image" content="https:\/\/getzhimu\.com\/assets\/zhimu-product-hero\.png" \/>/);
  assert.match(home, /<meta name="twitter:card" content="summary_large_image" \/>/);
  assert.match(home, /<script type="application\/ld\+json">[\s\S]+"@type": "WebSite"[\s\S]+<\/script>/);
});

test("draft pricing remains private from search while preserving crawlable links", () => {
  assert.match(pricing, /<meta name="robots" content="noindex, follow" \/>/);
  assert.match(pricing, /<link rel="canonical" href="https:\/\/getzhimu\.com\/pricing-commercial" \/>/);
});

test("sitemap lists only canonical, indexable URLs", () => {
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(urls, [`${canonicalOrigin}/`]);
  assert.doesNotMatch(sitemap, /\.html<\/loc>/);
  assert.match(robots, /Sitemap: https:\/\/getzhimu\.com\/sitemap\.xml/);
});

test("IndexNow ownership key is stable and publishable at the site root", () => {
  assert.equal(indexNowKey.trim(), "4ae3984d5a13c690ca674a0fc1185a8c");
});
