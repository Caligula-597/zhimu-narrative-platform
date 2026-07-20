import assert from "node:assert/strict";
import test from "node:test";

import { enrichPlayerSectionsWithPages } from "../src/section-pages.js";

test("page assets are fetched and signed once across all readable sections", async () => {
  const firstId = "00000000-0000-4000-8000-000000000001";
  const secondId = "00000000-0000-4000-8000-000000000002";
  let fetchCalls = 0;
  let signCalls = 0;

  const sections = await enrichPlayerSectionsWithPages(
    { query() { throw new Error("the injected fetcher should own the query"); } },
    [
      { id: "text", metadata: { contentMode: "text" } },
      { id: "pages-a", metadata: JSON.stringify({ contentMode: "pages", pageAssetIds: [secondId, firstId] }) },
      { id: "pages-b", metadata: { contentMode: "pages", pageAssetIds: [firstId] } }
    ],
    {
      async fetchAssets(_client, assetIds) {
        fetchCalls += 1;
        assert.deepEqual(assetIds, [secondId, firstId]);
        return assetIds.map((id) => ({ id, object_key: `pages/${id}` }));
      },
      async signAssets(assets) {
        signCalls += 1;
        return assets.map((asset) => ({ assetId: asset.id, url: `signed://${asset.id}` }));
      }
    }
  );

  assert.equal(fetchCalls, 1);
  assert.equal(signCalls, 1);
  assert.deepEqual(sections[0].pages, []);
  assert.deepEqual(sections[1].pages.map((page) => page.assetId), [secondId, firstId]);
  assert.deepEqual(sections[2].pages.map((page) => page.assetId), [firstId]);
});

test("sections without page assets do not acquire storage or database work", async () => {
  const sections = await enrichPlayerSectionsWithPages(
    {},
    [{ id: "text", metadata: null }],
    {
      fetchAssets() { throw new Error("unexpected asset fetch"); },
      signAssets() { throw new Error("unexpected asset signing"); }
    }
  );
  assert.deepEqual(sections[0].pages, []);
});
