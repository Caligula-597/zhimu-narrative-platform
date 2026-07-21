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
