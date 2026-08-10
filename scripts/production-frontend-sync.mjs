import fs from "node:fs";
import path from "node:path";

const DEFAULT_REQUIRED_CHUNKS = Object.freeze(["tabletop-map"]);

function canonicalAssetPath(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value), "https://creator.invalid");
    return url.pathname.startsWith("/assets/") ? url.pathname : "";
  } catch {
    return "";
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function extractCreatorAssetManifest(html) {
  const source = String(html || "");
  const scripts = [...source.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/giu)]
    .map((match) => canonicalAssetPath(match[1]));
  const stylesheets = [...source.matchAll(/<link\b[^>]*\brel=["'][^"']*stylesheet[^"']*["'][^>]*\bhref=["']([^"']+)["'][^>]*>/giu)]
    .map((match) => canonicalAssetPath(match[1]));
  const entryScript = scripts.find((asset) => /\/assets\/index-[A-Za-z0-9_-]+\.js$/u.test(asset))
    || scripts.find((asset) => asset.endsWith(".js"))
    || "";
  const entryStyles = unique(stylesheets)
    .filter((asset) => /\/assets\/index-[A-Za-z0-9_-]+\.css$/u.test(asset))
    .sort();

  if (!entryScript) throw new Error("Creator HTML does not reference a hashed entry script");
  if (!entryStyles.length) throw new Error("Creator HTML does not reference a hashed entry stylesheet");
  return { entryScript, entryStyles };
}

export function extractRequiredChunkAssets(entrySource, requiredChunks = DEFAULT_REQUIRED_CHUNKS) {
  const source = String(entrySource || "");
  const assets = [];
  for (const chunk of requiredChunks) {
    const escaped = String(chunk).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const pattern = new RegExp(
      `(?:\\./|/assets/|assets/)(${escaped}-[A-Za-z0-9_-]+\\.(?:js|css))`,
      "gu"
    );
    const matches = [...source.matchAll(pattern)].map((match) => `/assets/${match[1]}`);
    if (!matches.some((asset) => asset.endsWith(".js"))) {
      throw new Error(`Creator entry does not reference required chunk: ${chunk}`);
    }
    assets.push(...matches);
  }
  return unique(assets).sort();
}

export function loadExpectedCreatorManifest({ root = process.cwd(), required = false } = {}) {
  const indexPath = path.join(root, "dist", "index.html");
  if (!fs.existsSync(indexPath)) {
    if (required) throw new Error(`Expected Creator build is missing: ${indexPath}`);
    return null;
  }
  return extractCreatorAssetManifest(fs.readFileSync(indexPath, "utf8"));
}

function assertManifestsMatch(actual, expected) {
  if (!expected) return;
  const actualStyles = actual.entryStyles.join(",");
  const expectedStyles = expected.entryStyles.join(",");
  if (actual.entryScript !== expected.entryScript || actualStyles !== expectedStyles) {
    throw new Error(
      `Creator frontend is stale: expected ${expected.entryScript} + ${expectedStyles}; `
      + `received ${actual.entryScript} + ${actualStyles}`
    );
  }
}

async function fetchText(fetchImpl, url, { html = false, timeoutMs = 20_000 } = {}) {
  const response = await fetchImpl(url, {
    headers: html ? { "cache-control": "no-cache", pragma: "no-cache" } : undefined,
    signal: AbortSignal.timeout(timeoutMs)
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`GET ${url} returned ${response.status}`);
  if (html && !String(response.headers.get("content-type") || "").includes("text/html")) {
    throw new Error(`GET ${url} did not return HTML`);
  }
  return { response, body };
}

function assertImmutable(response, assetPath) {
  const cacheControl = String(response.headers.get("cache-control") || "");
  if (!/\bimmutable\b/iu.test(cacheControl)) {
    throw new Error(`Hashed asset is not immutable: ${assetPath}`);
  }
}

export async function probeCreatorFrontendSync(baseUrl, {
  expectedManifest = null,
  fetchImpl = fetch,
  requiredChunks = DEFAULT_REQUIRED_CHUNKS,
  timeoutMs = 20_000,
  nonce = Date.now()
} = {}) {
  const base = String(baseUrl || "").replace(/\/$/u, "");
  if (!base) throw new Error("Creator frontend base URL is required");

  const htmlUrl = `${base}/?__zhimu_release_probe=${encodeURIComponent(nonce)}`;
  const htmlResult = await fetchText(fetchImpl, htmlUrl, { html: true, timeoutMs });
  const actualManifest = extractCreatorAssetManifest(htmlResult.body);
  assertManifestsMatch(actualManifest, expectedManifest);

  const entryUrl = new URL(actualManifest.entryScript, `${base}/`).href;
  const entryResult = await fetchText(fetchImpl, entryUrl, { timeoutMs });
  assertImmutable(entryResult.response, actualManifest.entryScript);

  for (const stylesheet of actualManifest.entryStyles) {
    const result = await fetchText(fetchImpl, new URL(stylesheet, `${base}/`).href, { timeoutMs });
    assertImmutable(result.response, stylesheet);
  }

  const requiredAssets = extractRequiredChunkAssets(entryResult.body, requiredChunks);
  for (const asset of requiredAssets) {
    const result = await fetchText(fetchImpl, new URL(asset, `${base}/`).href, { timeoutMs });
    assertImmutable(result.response, asset);
  }

  return {
    base,
    manifest: actualManifest,
    verifiedDynamicAssets: requiredAssets
  };
}
