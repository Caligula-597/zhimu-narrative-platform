# 织幕全平台搜索发现与收录 SOP

> 目标：让公开官网与未来的公开内容页被搜索平台发现；创作草稿、主持控制台、玩家房间、角色私密内容继续保持不可索引。

## 一、代码与域名基线

- 唯一公开主域：`https://getzhimu.com/`。
- 首页必须提供自指向 canonical、明确的 `index, follow`、绝对地址 Open Graph、Twitter Card 与 WebSite 结构化数据。
- `sitemap.xml` 只列可返回 200、允许索引、使用主域的最终 URL；不得列跳转页、`noindex` 页面、登录页或房间页。
- `robots.txt` 保留公开官网抓取权限，并声明 sitemap。
- `app.getzhimu.com` 的 HTML 与静态响应必须返回 `X-Robots-Tag: noindex, nofollow, noarchive`，入口 HTML 同时保留 `noindex` meta；`play` 与 `host` 继续整站禁止抓取。
- `www.getzhimu.com` 在 Cloudflare 使用 301 永久跳转到 `getzhimu.com`，保留路径和查询参数。Cloudflare Pages 的 `_redirects` 不支持域名级跳转，应使用 Bulk Redirects 或 Single Redirects。
- Cloudflare 开启 Crawler Hints，让已更新的公开 URL 通过 IndexNow 被参与平台更快发现。

## 二、平台提交顺序

### Google

1. 在 Google Search Console 添加 `getzhimu.com` Domain property，并用 DNS TXT 验证。
2. 提交 `https://getzhimu.com/sitemap.xml`。
3. 用 URL Inspection 检查首页，再执行 Request indexing。
4. 后续每个新公开内容页进入 sitemap；不要反复提交没有变化的 URL。

### Bing 与 IndexNow 参与平台

1. 在 Bing Webmaster Tools 添加站点，可从 Google Search Console 导入验证信息。
2. 提交 sitemap。
3. 部署后执行 `npm run seo:indexnow --prefix site`；首次先用 `-- --dry-run` 检查负载。
4. 在 Bing Webmaster Tools 的 IndexNow 报告确认接收状态。

### 百度

1. 在百度搜索资源平台完成站点验证；首页当前保留百度验证码。
2. 在“普通收录/链接提交”中提交 sitemap 与首页。
3. 新增高质量公开页面时使用平台提供的 API 推送；历史 URL 继续由 sitemap 管理。
4. 在“站点属性”设置中文站名“织幕”、站点类型与品牌 Logo。

### 360、搜狗、神马及其他平台

- 如平台仍提供站长入口，分别验证同一主域并提交同一份 sitemap。
- 没有稳定站长入口的平台主要依赖可抓取链接、外部引用和搜索生态的数据共享；不要使用付费“包收录”或批量垃圾外链服务。

### AI 搜索

- 公开官网允许 `OAI-SearchBot`、`ChatGPT-User`、`Claude-SearchBot`、`Claude-User`、`PerplexityBot` 与 `Perplexity-User`，用于搜索索引或用户触发的页面读取。
- 继续禁止 `GPTBot`、`ClaudeBot`、`CCBot` 等训练型采集器；公开可搜索不等于授权训练。
- `Google-Extended` 同时涉及 Gemini 应用与 Vertex AI 使用，目前保持禁止；Google 网页搜索仍由允许访问的 Googlebot 完成。如未来决定开放 Gemini 的直接使用，应单独完成版权与内容授权评估。

## 三、内容供给边界

搜索引擎只能持续展示公开、独立、有搜索价值的 URL。官网首页不足以覆盖所有业务关键词，建议逐步增加：

- `/features/creator`：剧本创作、角色私本、线索与章节编排。
- `/features/host`：线上主持、进度控制、场景切换与遭遇触发。
- `/features/player`：玩家阅读、语音协作、已揭示地图与状态。
- `/guides/...`：创建房间、发布剧本、主持流程、玩家加入等教程。
- `/stories/...`：明确获得公开授权的示例剧本或案例；不得暴露付费剧本、角色秘密、房间状态或用户生成的私密内容。

每个公开页面都要有独立标题、摘要、canonical、清晰正文、内部链接，并进入 sitemap。只有真正公开且有价值的页面才提交搜索平台。

## 四、验收与监控

- 直连：首页返回 200；`www` 返回 301 到主域。
- 抓取：Googlebot、Bingbot、Baiduspider 均能获得首页正文。
- 规范化：页面 canonical、sitemap 与最终 URL 完全一致。
- 收录：在各平台站长工具查看 URL Inspection/抓取诊断，不以浏览器地址栏历史作为依据。
- 查询：使用 `site:getzhimu.com` 检查发现情况；品牌词和业务词排名需要内容质量、真实访问与外部引用积累。
- 频率：上线后第 1、3、7、14、30 天复查；提交只能促进发现，不能保证收录或排名。
- 自动验收：部署并完成 `www` 永久跳转后执行 `npm run seo:verify-live --prefix site`；通过后再运行 IndexNow 提交。
