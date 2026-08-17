import assert from "node:assert/strict";
import test from "node:test";
import {
  extractCreatorAssetManifest,
  extractRequiredChunkAssets,
  probeCreatorFrontendSync
} from "./production-frontend-sync.mjs";

const html = `<!doctype html><html><head>
  <script type="module" crossorigin src="/assets/index-EXPECTED.js"></script>
  <link rel="stylesheet" crossorigin href="/assets/index-EXPECTED.css">
</head></html>`;

function response(body, contentType, cacheControl = "public, max-age=31536000, immutable") {
  return new Response(body, {
    status: 200,
    headers: { "content-type": contentType, "cache-control": cacheControl }
  });
}

test("extracts the Creator entry asset fingerprint", () => {
  assert.deepEqual(extractCreatorAssetManifest(html), {
    entryScript: "/assets/index-EXPECTED.js",
    entryStyles: ["/assets/index-EXPECTED.css"]
  });
});

test("extracts required lazy-loaded feature assets", () => {
  assert.deepEqual(
    extractRequiredChunkAssets('Promise.all([import("./tabletop-map-MAP.js"),"assets/tabletop-map-MAP.css",import("./board-game-BOARD.js"),"assets/board-game-BOARD.css"])'),
    [
      "/assets/board-game-BOARD.css",
      "/assets/board-game-BOARD.js",
      "/assets/tabletop-map-MAP.css",
      "/assets/tabletop-map-MAP.js"
    ]
  );
  assert.throws(() => extractRequiredChunkAssets("no map chunk here"), /required chunk: tabletop-map/u);
  assert.throws(
    () => extractRequiredChunkAssets('import("./tabletop-map-MAP.js")'),
    /required chunk: board-game/u
  );
});

test("production probe verifies exact entry hashes and fetches required product chunks", async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    const pathname = new URL(url).pathname;
    requested.push(pathname);
    if (pathname === "/") return response(html, "text/html; charset=utf-8", "public, max-age=0, must-revalidate");
    if (pathname === "/assets/index-EXPECTED.js") {
      return response(
        'Promise.all([import("./tabletop-map-MAP.js"),"assets/tabletop-map-MAP.css",import("./board-game-BOARD.js"),"assets/board-game-BOARD.css"])',
        "text/javascript"
      );
    }
    if (pathname.endsWith(".css")) return response("body{}", "text/css");
    if (["/assets/tabletop-map-MAP.js", "/assets/board-game-BOARD.js"].includes(pathname)) {
      return response("export{}", "text/javascript");
    }
    return new Response("missing", { status: 404 });
  };

  const result = await probeCreatorFrontendSync("https://app.example.test", {
    expectedManifest: extractCreatorAssetManifest(html),
    fetchImpl,
    nonce: "test"
  });
  assert.deepEqual(result.verifiedDynamicAssets, [
    "/assets/board-game-BOARD.css",
    "/assets/board-game-BOARD.js",
    "/assets/tabletop-map-MAP.css",
    "/assets/tabletop-map-MAP.js"
  ]);
  assert.deepEqual(requested, [
    "/",
    "/assets/index-EXPECTED.js",
    "/assets/index-EXPECTED.css",
    "/assets/board-game-BOARD.css",
    "/assets/board-game-BOARD.js",
    "/assets/tabletop-map-MAP.css",
    "/assets/tabletop-map-MAP.js"
  ]);
});

test("production probe rejects a stale Creator entry", async () => {
  const staleHtml = html.replaceAll("EXPECTED", "STALE");
  const fetchImpl = async () => response(
    staleHtml,
    "text/html; charset=utf-8",
    "public, max-age=0, must-revalidate"
  );
  await assert.rejects(
    probeCreatorFrontendSync("https://app.example.test", {
      expectedManifest: extractCreatorAssetManifest(html),
      fetchImpl,
      nonce: "test"
    }),
    /Creator frontend is stale/u
  );
});
