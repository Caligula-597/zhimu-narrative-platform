# 官网第一版设计验收

## 验收基线

- 参考设计：`C:\Users\lenovo\.codex\generated_images\019f4b7a-eac5-7dc3-bd64-e15a36bd2d38\exec-f82be5d1-d1ca-4a4b-9156-07a94788a5f8.png`
- 本地实现：`http://127.0.0.1:4176/`
- 浏览器：Microsoft Edge 原生 CDP（未使用 Playwright）
- 桌面视口：1440 × 1100；完整页面截图 `C:\Users\lenovo\AppData\Local\Temp\zhimu-home-desktop.png`
- 移动视口：390 × 844；完整页面截图 `C:\Users\lenovo\AppData\Local\Temp\zhimu-home-mobile.png`
- 同屏对照：`C:\Users\lenovo\AppData\Local\Temp\zhimu-home-comparison.png`

## 对照记录

### 第 1 轮

- P1：完整页面截图没有触发视口外懒加载图片，玩家端与复盘截图在验收图中为空白。
- P2：滚动触发懒加载后，平滑滚动使 sticky header 停留在完整截图中部，不能用于可靠视觉判断。
- 修正：验收脚本逐屏滚动触发原有懒加载，再禁用平滑滚动并等待两个绘制帧返回顶部。

### 第 2 轮

- 参考图与实现图已放入同一张并排对照图。
- Hero 的左右结构、深绿与米白配色、克制的衬线标题、真实产品图和交替三端展示与第一版方向一致。
- 实现保留了项目现有品牌标识、真实功能入口、导入能力、定价、内测申请与版权/运行保障信息；没有以占位图或装饰卡片替代产品状态。
- 四张产品图均完成加载，无拉伸、错误裁切或破图。
- 桌面和移动端均无横向溢出；移动端按内容顺序折为单列，文字和操作按钮保持可读、可点击。
- 未发现 P0、P1 或 P2 视觉问题。

## 交互与运行检查

- 导航菜单可以打开和关闭，`aria-expanded` 状态同步更新。
- 创作者入口可访问，并使用新标签页及 `noopener noreferrer`。
- 导入预约入口存在，内测表单的浏览器原生必填校验生效。
- 工作流 4 个步骤、价格区和内测表单均存在。
- 两个视口均无破图、无横向溢出。
- 页面自身控制台错误：0。
- Edge 用户环境中的钱包扩展产生 1 条与页面无关的 `chrome-extension://` 错误，已从应用错误中排除。

## 构建与自动检查

- `npm run build --prefix site`：通过。
- `node --test scripts/site-screenshots.test.mjs`：6/6 通过。

final result: passed

---

# Writer 专注写作模式 · Design QA

## Comparison target

- Source visual truth: `C:\Users\lenovo\.codex\generated_images\019f4b7a-eac5-7dc3-bd64-e15a36bd2d38\exec-b0caf31c-0dce-4737-86d1-95e05837c645.png`
- Browser-rendered implementation: `D:\长剧情\artifacts\writer-focus-edge.png`
- Responsive implementation: `D:\长剧情\artifacts\writer-focus-edge-mobile.png`
- Combined comparison: `D:\长剧情\artifacts\design-qa-comparison.png`
- Official-site entry capture: `D:\长剧情\artifacts\site-header-edge.png`
- Source pixels: 1692 × 929
- Desktop implementation pixels / CSS viewport: 1570 × 905 at device scale 1
- Responsive implementation pixels / CSS viewport: 504 × 805 at device scale 1
- Density normalization: both captures use device scale 1; the combined comparison scales each full viewport proportionally inside equal-width columns. Differences caused only by the 7% viewport-width delta were not filed as defects.
- State: authenticated creator, Writer → 钟离 → existing section “边城暮色”, desktop light theme. Local QA hides the unauthenticated demo banner after seeding the creator fixture so the state matches the authenticated source.
- Browser: Microsoft Edge headless/CDP. Playwright was not used.

## Full-view comparison evidence

The implementation preserves the selected design's core composition: narrow persistent creator rail, explicit return/breadcrumb header, visible role and section outline, centered paper-like manuscript canvas, non-modal persistent settings dock, word count/save state, player preview, and a primary save/return action. The editing surface occupies the application viewport and the modal backdrop remains closed.

The implementation intentionally uses current product tokens and real application controls instead of reproducing the concept image's decorative paper texture or inventing a section-level version-history API. These are classified as P3/product constraints rather than structural mismatches.

## Focused-region comparison evidence

- Header: return path, role context, word count, save state, preview and save controls stay visible without a modal layer.
- Outline: section hierarchy remains visible while editing; switching items uses the real action dispatcher.
- Manuscript: title and body use the existing Noto Serif SC editorial stack and a constrained 900px reading measure.
- Tool dock: public-chapter binding, publication state, find/replace and version/delete controls remain reachable on desktop and by page scroll on the responsive viewport.
- Formatting: B, I, H2 and list controls perform real Markdown transformations; they are not decorative chrome.
- Official site: “玩家端” and “主持端” are visible beside login/creation actions at the 1600 × 900 desktop viewport, with duplicate mobile-navigation entries in the menu contract.

## Findings

No actionable P0/P1/P2 differences remain.

- [P3] The source uses a subtle paper texture while the implementation uses the product's existing flat warm-paper token.
  - Location: `.writer-focus-paper`
  - Evidence: source has visible texture; implementation is flat `#fbfaf5`.
  - Impact: minor atmospheric difference only; readability and hierarchy are preserved.
  - Follow-up: add a licensed/generated low-contrast texture asset only if the broader creator theme system adopts it consistently.

- [P3] The concept shows section-level version history, while the real product currently stores world-level creator snapshots.
  - Location: “版本与保存” dock panel.
  - Evidence: source contains a multi-row version timeline; implementation shows the real cloud section ID and deletion control.
  - Impact: no false version history is presented, but the concept's richer audit affordance is deferred.
  - Follow-up: add a section-revision backend contract before exposing this UI.

## Required fidelity surfaces

- Fonts and typography: passed. Existing `Noto Serif SC` is used for manuscript/title hierarchy; UI labels retain the existing product sans stack. Weights, reading measure and line height remain legible at desktop and responsive widths.
- Spacing and layout rhythm: passed. Rail/workspace proportions, centered manuscript measure, persistent desktop dock and responsive horizontal outline are stable. No persistent control is clipped.
- Colors and visual tokens: passed. Forest green, warm paper, muted rules and danger semantics match the current creator product rather than introducing an unrelated palette.
- Image quality and asset fidelity: passed. This screen requires no raster content beyond the existing brand; no placeholder image, CSS illustration, or handcrafted SVG was introduced.
- Copy and content: passed. Breadcrumb, role/section context, publication semantics, unsaved state, destructive action and external endpoint labels are product-accurate Chinese copy.

## Interaction and console evidence

The Edge CDP acceptance run verified:

- focus editor visible and modal backdrop not visible;
- 3 fixture sections rendered in the outline;
- dock reachable at desktop and responsive viewports;
- find/replace works;
- Markdown bold formatting works;
- return to role workbench works;
- an unsaved new-section draft is restored when reopening;
- an unsaved new-section draft can be explicitly discarded and reopens empty;
- no runtime exceptions were recorded;
- desktop document height equals viewport height (905px), so persistent controls do not fall below the fold;
- responsive document scroll reaches the settings dock (1494px document height at a 504 × 805 viewport).

## Comparison history

1. First implementation capture
   - P2: collapsed sidebar leaked brand/world text into the 70px rail.
   - P2: editor and dock exceeded the desktop viewport.
   - Fixes: hide rail text containers in focus mode; make the main area a bounded flex viewport; center the manuscript at a 900px measure; keep the dock in the viewport.
   - Post-fix evidence: `D:\长剧情\artifacts\writer-focus-edge.png`.
2. Second comparison
   - P2: concept formatting affordances were absent.
   - Fix: add functional Markdown B/I/H2/list controls with action-contract coverage.
   - Post-fix evidence: `D:\长剧情\artifacts\design-qa-comparison.png`.
3. Responsive capture
   - P1: the legacy mobile sidebar occupied most of the viewport and obscured the writing flow.
   - P2: the fixed-height desktop shell could make the responsive dock unreachable.
   - Fixes: hide the global sidebar only in mobile focus mode; restore document scrolling and verify the dock is reachable.
   - Post-fix evidence: `D:\长剧情\artifacts\writer-focus-edge-mobile.png`.

## Implementation checklist

- [x] Remove section editing from the shared modal/backdrop.
- [x] Preserve role, section, chapter and publication context.
- [x] Preserve create/update/delete API contracts and existing autosave behavior.
- [x] Retain unsaved new-section drafts across return/reopen.
- [x] Add functional Markdown shortcuts and find/replace.
- [x] Restore official-site Player and Host header entries on desktop and mobile.
- [x] Verify desktop and responsive behavior in Edge without Playwright.
- [x] Run build, Trusted Types, module and action-link gates.

## Open questions

- Section-level history remains a future backend/product contract rather than a visual-only control.
- The paper texture is intentionally deferred until creator themes define whether it belongs to one theme or the whole product.

final result: passed
