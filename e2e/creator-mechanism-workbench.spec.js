import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
});

test("草稿可保存，但残缺设计不能被确认为生成契约", async ({ page }) => {
  await page.evaluate(async () => {
    const { openCreatorMechanismWorkbench } = await import(
      "/src/views/creator-mechanism-workbench.js"
    );
    const root = document.querySelector("#content");
    window.__mechanismSaves = [];
    openCreatorMechanismWorkbench({
      root,
      value: {},
      onSave: async (design) => window.__mechanismSaves.push(design),
    });
  });

  await page.locator('[data-mechanism-save="confirmed"]').click();
  await expect(page.getByRole("alert")).toContainText("还不能确认并用于生成");
  await expect(page.getByRole("alert")).toContainText("玩家反复执行的动作");
  await expect(page.locator('[data-mechanism-design-field="title"]')).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.__mechanismSaves.length)).toBe(0);

  await page.locator('[data-mechanism-save="draft"]').click();
  await expect.poll(() =>
    page.evaluate(() => window.__mechanismSaves.at(-1)?.status),
  ).toBe("draft");

  const values = {
    title: "潮窗分洪许可",
    summary: "玩家每轮投入许可，在救援、供电与证据保全之间取舍。",
    recurringAction: "每轮选择一个区域并投入一份闸门许可",
    conflictReason: "救人、供电与保全证据不能同时完成",
    limitedResource: "三份开封许可",
    immediateFeedback: "未保护区域立即失去设施或证据",
    failureAdvance: "未达成共识时执行默认分洪并进入下一轮",
    genreSpecificity: "只适用于潮汐城的闸门代理制度",
    endingCausality: "前几轮保住的区域共同决定最终合闸路线",
  };
  for (const [key, value] of Object.entries(values)) {
    await page.locator(`[data-mechanism-design-field="${key}"]`).fill(value);
  }
  await page.locator('[data-mechanism-save="confirmed"]').click();
  await expect.poll(() =>
    page.evaluate(() => window.__mechanismSaves.at(-1)?.status),
  ).toBe("confirmed");
  await expect(page.locator(".mechanism-workbench-actions")).toContainText(
    "当前版本已确认为作者设定",
  );
});

test("确认设计会生成主持端可结算、玩家端可读的运行界面", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { compilePipelineMechanismPackage } = await import(
      "/backend/src/pipeline-mechanism-package.js"
    );
    const {
      initializeMechanismRuntime,
      projectMechanismRuntime,
      projectPlayerMechanismRuntime,
    } = await import("/shared/mechanism-runtime.js");
    const { state: hostState } = await import("/host/src/state.js");
    const { state: playerState } = await import("/play/src/state.js");
    const { renderHostMechanismWorkspace } = await import(
      "/host/src/views/host-mechanism-workspace.js"
    );
    const { renderMechanismProgress } = await import(
      "/play/src/views/game-home-views.js"
    );
    const { setHtml } = await import("/shared/safe-dom.js");

    const mechanismDesign = {
      version: 1,
      interactionKind: "resource_tradeoff",
      title: "潮窗分洪许可",
      summary: "玩家每轮投入许可，在救援、供电与证据保全之间取舍。",
      recurringAction: "每轮选择一个区域并投入一份闸门许可",
      conflictReason: "救人、供电与保全证据不能同时完成",
      limitedResource: "三份开封许可",
      immediateFeedback: "未保护区域立即失去设施或证据",
      failureAdvance: "未达成共识时执行默认分洪并进入下一轮",
      genreSpecificity: "只适用于潮汐城的闸门代理制度",
      endingCausality: "前几轮保住的区域共同决定最终合闸路线",
      authorNotes: "",
      status: "confirmed",
      updatedAt: "2026-08-08T10:00:00.000Z",
    };
    const { packageValue } = compilePipelineMechanismPackage(
      {
        proposal: {
          chapters: [
            { key: "ch1", title: "第一次潮窗", summary: "决定先保哪一区域。" },
            { key: "ch2", title: "最终合闸", summary: "用剩余许可决定合闸路线。" },
          ],
        },
      },
      mechanismDesign,
    );
    const runtime = initializeMechanismRuntime(packageValue).runtime;
    const hostProjection = projectMechanismRuntime(runtime, packageValue);
    const playerProjection = projectPlayerMechanismRuntime(runtime, packageValue, {
      revision: 1,
    });
    hostState.cloudHostMechanismRuntime = {
      initialized: true,
      state: { ...hostProjection, revision: 1 },
      history: [],
      changes: [],
    };
    hostState.hostMechanismBusy = false;
    hostState.hostMechanismError = "";
    playerState.home = { currentState: { mechanism: playerProjection } };

    setHtml(
      document.querySelector("#content"),
      `<div data-host-proof>${renderHostMechanismWorkspace()}</div><div data-player-proof>${renderMechanismProgress()}</div>`,
    );
    return {
      source: packageValue.source,
      rounds: packageValue.rounds.length,
      decisions: packageValue.decisionNodes.length,
    };
  });

  expect(result).toEqual({
    source: "confirmed_mechanism_design",
    rounds: 2,
    decisions: 2,
  });
  await expect(page.locator("[data-host-proof]")).toContainText("潮窗分洪许可");
  await expect(page.locator("[data-host-proof]")).toContainText("核对剩余资源");
  await expect(page.locator("[data-player-proof]")).toContainText("第一次潮窗");
  await expect(page.locator("[data-player-proof]")).toContainText("每轮选择一个区域");
  await expect(page.locator("[data-player-proof]")).toContainText("未保护区域立即失去设施或证据");
  await expect(page.locator('[data-player-proof] [data-action="submit-mechanism-choice"]')).toHaveCount(2);
});
