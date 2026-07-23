# 非功能性审计与上线门禁

最后更新：2026-07-20

本轮把非功能性要求从人工检查收敛为 `npm run audit:nonfunctional`，并接入 `npm run audit:periodic`。门禁覆盖外部 I/O 超时、数据库池等待与连接回收、后台任务关闭 drain、限流内存上限、500 错误脱敏、敏感查询串日志脱敏、静态文件路径边界、生产 CSP / Trusted Types 和 App、Site、Host、Play 四个前端表面的入口体积。

`npm run check:bundle-budgets` 会重新构建四个前端表面并检查 gzip 预算；LiveKit 必须保持独立懒加载块，不能回流到 Player 首页入口。

`npm run check:pages-installability` 使用 Cloudflare 当前构建环境的 `npm@10.9.2`，并行验证 Site、Host、Play 的 lockfile 能否执行干净安装；这可以发现本机已有 `node_modules` 时普通构建掩盖的 lockfile 漂移。包体门禁同时覆盖 App、Site、Host、Play 四个前端表面。

已完成的高风险整改：

- 邮件、OAuth、Stripe、告警、上传扫描统一使用有超时的上游 transport；资产直传和创作者文档加载也有取消上限。
- PostgreSQL 连接获取默认 10 秒超时，连接默认 30 分钟轮换；滚动关闭会等待 outbox、延迟事件和告警任务结束后再关闭连接池。
- 未预期的 5xx 不再向客户端返回数据库/供应商原始消息与 details；日志和 Sentry 路径不再记录 OAuth 等查询串。
- 限流按已登录用户隔离，非法配置回退到安全默认值，内存桶有 2 万上限；Railway 环境明确只信任一跳代理。
- 静态文档和错误页在读取前执行 `path.resolve + path.relative` 边界校验，拒绝编码、反斜杠和畸形 URI 穿越。
- Studio 图谱路由已迁移到 repository/service；引用统计从最多 5 次数据库往返变为 1 次聚合查询。
- 用户自带 LLM 地址只允许安全 HTTPS 出站目标；运行前解析 DNS，拒绝回环、内网、特殊地址、凭据 URL、非标准端口和重定向绕过，降低 SSRF 风险。
- 会话校验不再每次请求都写 `last_seen_at`，默认最多每 5 分钟触碰一次；不存在账号也执行等成本的 dummy scrypt 校验，降低登录枚举时序差。API/SSE 的 401 只撤销请求发出时实际使用且仍为当前值的凭证，迟到的旧 401 不再清除新登录；登录、验证码和重置凭证尝试失败也不会误退现有会话。
- 测试套件、性能 fixture、迁移升级和托管恢复脚本默认拒绝生产形态或未知远程数据库；测试写入与破坏性演练使用相互独立的显式开关，避免本地 `.env` 误指向生产时污染真实数据。
- SSE 服务端增加单连接写缓冲和 replay 队列上限，慢客户端会被主动断开；房间事件在 replay/live 两条路径执行服务端受众投影，私享线索、定向提醒、私密语音等不再依赖客户端自行过滤。四条流的游标按账号隔离，长连接最多 5 分钟重新认证，被踢玩家收到终止事件后立即断流。PostgreSQL LISTEN 冷启动失败会保留订阅并指数退避恢复。
- 投票写链路已迁移到 repository/service；投票关闭与玩家提交在同一行锁事务内串行化，消除“校验时开放、落库时已关闭”的竞态。
- Host 游戏控制写链路已迁移到 repository/service；小游戏、时间线、主持审计和 outbox 同事务提交，房间与成员锁顺序固定。并发双启动隔离测试证明只保留一个活动游戏，审计失败会整体回滚且可安全重试。规则预览不再重复执行条件查询，每个条件叶只读取一次。
- 内容运行报告与洞察已迁移到 repository/service；run-report 从 4 次数据库往返降到 2 次，creator analytics 从四条并发 SQL 合并为一条聚合 SQL，避免单请求占用默认 6 连接池中的 4 个连接。
- Player 首页 supplemental 的 social 从 5 次数据库往返合并为 1 次、session 从 4 次合并为 1 次；连同 tasks，单请求并发连接峰值由约 9 降为 3。章节页附件不再按章节逐次查询，而是对当前可读章节的资产 ID 去重后一次查询、一次签名，并保持每章原始页序。
- Creator 单文档图片/PDF 页导入改为两阶段：权限与版本先短事务预检，R2 上传、stat 和安全扫描在不占数据库连接的阶段完成，正式事务只登记资产与章节；失败和重复导入在事务结束后清理暂存对象。响应序列化失败不再误触发“数据库回滚”清理，避免删除已经提交引用的对象。
- ZIP script-bundle 导入也完成两阶段收敛：解压、文本抽取、PDF 检测/渲染及 R2 扫描全部在事务外执行；事务开始后先锁定目标 world，每个有效文件使用 SAVEPOINT，单文件失败会回滚角色、资产、章节和知识块的半成品，已跳过或预处理失败的文件不产生 SAVEPOINT 往返。多章节/逐页导入同时按子 importKey 去重，重复提交不会再次生成内容。
- 路由层最后六个直连点已归零；实体卡激活把房间 world 校验移入 token 行锁事务，消除事务外检查窗口；房间补救列表由“查 worldId + 查列表”收敛为单条联表查询。
- 周期报告使用明确 UTF-8 输出；编码门禁覆盖生产与审计脚本并识别常见二次转码乱码。四个前端表面的 gzip 预算已加入周期验收，Site 的共享 `safe-dom` 首屏块单独计入，避免拆 chunk 后漏算。
- Writer/Director/Site 等产品代码不再直接写 `innerHTML`；`shared/safe-dom.js` 是唯一带精确预算的安全 sink。官网发布产物包含 CSP、`trusted-types zhimu-html` 与 `require-trusted-types-for 'script'`。
- `verify:full:3` 对非法、重复或零次数参数直接失败，每次隔离运行记录退出码、信号和耗时；备份恢复与前向迁移演练也生成 JSON，且明确声明未覆盖应用镜像回滚。

当前代码结构由 `npm run check:architecture` 固定门禁：69 个路由模块的路由层直连数据库点为 0，任何回升都会失败。后续数据库审计对象转为 service/repository 内部的往返次数、连接池占用、索引和事务一致性，而不是继续按文件机械拆层。

当前快速证据包括：`audit:periodic` 14/14、SSE 故障矩阵 39/39、Auth 故障矩阵 22/22、Trusted Types 23/23、发布门禁工具 5/5、性能工具 4/4，以及 App/Site/Host/Play 构建和包体预算通过。2026-07-20 已在当前 Supabase 数据库部署 068–090，迁移完整性为 90 个已应用、0 个待应用、校验和一致，应用 readiness 为 `ready=true`；这不替代隔离数据库上的升级与回滚演练。无隔离 `DATABASE_URL` 时，真实 PostgreSQL 写入、会话触碰与 LISTEN 集成断言必须明确标记跳过，不能计作通过。

仍属于部署/运行证据而不是静态代码能消除的风险：多实例全局限流必须由 Cloudflare WAF/Rate Limiting 作为权威层；真实 Bearer 的 P95/P99、SSE 大并发、托管数据库容量、应用镜像回滚、R2 恢复和恢复时间必须在预发或生产镜像环境定期采样。2026-07-16 的 `Release Acceptance` 运行 29477387204 已失败：第 1/3 轮隔离测试 712 项中 8 项失败，后续 E2E、性能和恢复步骤全部 skipped；cleanup 还暴露隔离库删除后的表访问错误。快速矩阵通过不能覆盖这一发布阻断。
