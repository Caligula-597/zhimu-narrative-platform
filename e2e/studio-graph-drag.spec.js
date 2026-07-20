import { expect, test } from "@playwright/test";

const WORLD_ID = "00000000-0000-4000-8000-000000000001";
const CHAPTER_ID = "00000000-0000-4000-8000-000000000011";
const SCENE_ID = "00000000-0000-4000-8000-000000000012";

test("Studio graph drags the whole card without swallowing a normal click", async ({ page }) => {
  const consoleErrors = [];
  const positionWrites = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    if (!new URL(request.url()).pathname.startsWith("/api/")) {
      await route.continue();
      return;
    }
    if (request.method() === "PUT" && request.url().includes("/position")) {
      positionWrites.push(request.postDataJSON());
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ worldId, chapterId, sceneId }) => {
    const { studioStore } = await import("/src/state/index.js");
    const studio = await import("/src/views/studio.js");
    const api = await import("/src/api/index.js");
    const { setHtml } = await import("/shared/safe-dom.js");
    const data = {
      world: { id: worldId, name: "拖拽回归测试", membership_role: "owner" },
      chapters: [{ id: chapterId, title: "第一幕", sequence: 1, summary: "开场", metadata: { graphPosition: { x: 80, y: 120 } } }],
      scenes: [{ id: sceneId, chapter_id: chapterId, name: "钟楼", public_text: "午夜钟声", metadata: { graphPosition: { x: 320, y: 120 } } }],
      clues: [], items: [], investigationPoints: [], edges: [], roles: [], sections: [], rooms: []
    };
    api.context.worldId = worldId;
    studioStore.set({ cloudStudio: data, studioZoom: 1, studioFilter: "all", studioCollapsedScenes: [], studioCanvasHeight: 0 });
    setHtml(document.querySelector("#content"), studio.studioCloud());
    studio.bindStudioDragging();
    window.__studioNodeClicks = 0;
    document.querySelector("#content").addEventListener("click", (event) => {
      if (event.target.closest(".graph-canvas .node[data-node-type]")) window.__studioNodeClicks += 1;
    });
  }, { worldId: WORLD_ID, chapterId: CHAPTER_ID, sceneId: SCENE_ID });

  const node = page.locator(`.graph-canvas .node[data-node-id="${SCENE_ID}"]`);
  const handle = node.locator(".node-drag-handle");
  const initial = await node.boundingBox();
  expect(initial).not.toBeNull();
  expect(await node.evaluate((element) => getComputedStyle(element).touchAction)).toBe("none");

  await page.mouse.move(initial.x + 80, initial.y + 80);
  await page.mouse.down();
  await page.mouse.move(initial.x + 180, initial.y + 130, { steps: 6 });
  await page.mouse.up();
  const afterBody = await node.boundingBox();
  expect(afterBody.x).toBeCloseTo(initial.x + 100, 0);
  expect(afterBody.y).toBeCloseTo(initial.y + 50, 0);
  expect(await page.evaluate(() => window.__studioNodeClicks)).toBe(0);

  const handleBox = await handle.boundingBox();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 100, handleBox.y + 50, { steps: 6 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.__studioNodeClicks)).toBe(0);

  await page.waitForTimeout(300);
  await node.click();
  expect(await page.evaluate(() => window.__studioNodeClicks)).toBe(1);
  expect(positionWrites).toHaveLength(2);
  expect(consoleErrors).toEqual([]);
});
