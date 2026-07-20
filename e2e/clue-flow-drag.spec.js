import { expect, test } from "@playwright/test";

const WORLD_ID = "00000000-0000-4000-8000-000000000101";
const CLUE_ID = "00000000-0000-4000-8000-000000000102";

test("clue flow graph drags from the whole card and preserves click selection", async ({ page }) => {
  const consoleErrors = [];
  const clueWrites = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    if (!new URL(request.url()).pathname.startsWith("/api/")) {
      await route.continue();
      return;
    }
    if (request.method() !== "GET" && request.url().includes(`/clues/${CLUE_ID}`)) {
      clueWrites.push(request.postDataJSON());
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.zhimuViewLoader));
  await page.evaluate(async ({ worldId, clueId }) => {
    const { registerRuntime } = await import("/src/runtime/runtime-facade.js");
    const { studioStore, uiStore } = await import("/src/state/index.js");
    const clues = await import("/src/views/clues.js");
    const clueInteractions = await import("/src/views/clues-interactions.js");
    const api = await import("/src/api/index.js");
    const { setHtml } = await import("/shared/safe-dom.js");
    api.context.worldId = worldId;
    registerRuntime({ render: () => {} });
    studioStore.set({
      cloudStudio: {
        world: { id: worldId, name: "线索拖拽回归", membership_role: "owner", settings: {} },
        chapters: [],
        scenes: [],
        clues: [{
          id: clueId,
          name: "遗失的钥匙",
          public_text: "钟楼下发现的钥匙",
          host_text: "",
          visibility: "role",
          metadata: { clueGraphPosition: { x: 260, y: 220 } }
        }],
        items: [],
        investigationPoints: [],
        edges: [],
        roles: [],
        sections: [],
        rooms: []
      }
    });
    uiStore.set({ cluesSelectedId: "", clueFlowZoom: 1, clueFlowFilter: "all", cluesSearchQuery: "" });
    setHtml(document.querySelector("#content"), clues.clues());
    clueInteractions.bindCluesSearch();
  }, { worldId: WORLD_ID, clueId: CLUE_ID });

  const node = page.locator(`.clue-flow-node[data-clue="${CLUE_ID}"]`);
  await node.scrollIntoViewIfNeeded();
  const initial = await node.boundingBox();
  expect(initial).not.toBeNull();
  expect(await node.evaluate((element) => getComputedStyle(element).touchAction)).toBe("none");

  await page.mouse.move(initial.x + initial.width * 0.7, initial.y + initial.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(initial.x + initial.width * 0.7 + 120, initial.y + initial.height * 0.7 + 70, { steps: 6 });
  const duringDrag = await node.boundingBox();
  expect(duringDrag.x).toBeCloseTo(initial.x + 120, 0);
  expect(Math.abs(duringDrag.y - (initial.y + 70))).toBeLessThanOrEqual(3);
  await page.mouse.up();
  const moved = await node.boundingBox();
  expect(moved.x).toBeCloseTo(initial.x + 120, 0);
  expect(Math.abs(moved.y - (initial.y + 70))).toBeLessThanOrEqual(3);
  expect(clueWrites).toHaveLength(1);

  await page.waitForTimeout(250);
  await node.click();
  await expect.poll(() => page.evaluate(async () => (await import("/src/state/index.js")).uiStore.get().cluesSelectedId)).toBe(CLUE_ID);
  if (process.env.ZHIMU_QA_SCREENSHOT) {
    await page.screenshot({ path: process.env.ZHIMU_QA_SCREENSHOT, fullPage: false });
  }
  expect(consoleErrors).toEqual([]);
});
