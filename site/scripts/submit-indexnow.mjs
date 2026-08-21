#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonicalOrigin = "https://getzhimu.com";
const keyFileName = "4ae3984d5a13c690ca674a0fc1185a8c.txt";
const endpoint = process.env.INDEXNOW_ENDPOINT || "https://api.indexnow.org/indexnow";

function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
}

function requestedUrls(args, sitemap) {
  const supplied = args.filter((arg) => !arg.startsWith("--"));
  return supplied.length ? supplied : sitemapUrls(sitemap);
}

function validateUrls(urls) {
  const unique = [...new Set(urls)];
  if (!unique.length) throw new Error("No URLs found for IndexNow submission");
  for (const value of unique) {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.origin !== canonicalOrigin) {
      throw new Error(`IndexNow URL must use the canonical origin: ${value}`);
    }
  }
  return unique;
}

const args = process.argv.slice(2);
const [sitemap, keyFile] = await Promise.all([
  fs.readFile(path.join(root, "public", "sitemap.xml"), "utf8"),
  fs.readFile(path.join(root, "public", keyFileName), "utf8")
]);
const key = keyFile.trim();
const keyLocation = `${canonicalOrigin}/${keyFileName}`;
if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) throw new Error("Invalid IndexNow key file");
const urls = validateUrls(requestedUrls(args, sitemap));
const payload = {
  host: new URL(canonicalOrigin).host,
  key,
  keyLocation,
  urlList: urls
};

if (args.includes("--dry-run")) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

const ownershipResponse = await fetch(keyLocation, {
  signal: AbortSignal.timeout(15_000)
});
const publishedKey = ownershipResponse.ok ? (await ownershipResponse.text()).trim() : "";
if (publishedKey !== key) {
  throw new Error(`IndexNow key is not deployed at ${keyLocation}; deploy the site before submitting`);
}

const response = await fetch(endpoint, {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(15_000)
});

if (![200, 202].includes(response.status)) {
  const detail = (await response.text()).slice(0, 500);
  throw new Error(`IndexNow submission failed (${response.status}): ${detail}`);
}

console.log(`IndexNow accepted ${urls.length} URL(s) with status ${response.status}.`);
