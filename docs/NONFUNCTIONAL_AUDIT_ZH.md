# 非功能性审计与上线门禁

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
- 周期报告使用明确 UTF-8 输出；编码门禁覆盖 735 个生产与审计脚本，并识别常见二次转码乱码。四个前端表面的 gzip 预算已加入周期验收。
- 编码/语法门禁采用最多 8 路有界并发，同等 735 文件覆盖从 48.2 秒降到约 15.6 秒，避免定期检查自身成为反馈瓶颈。

当前代码结构债务由 `npm run check:architecture` 做单调收敛门禁：68 个路由模块还剩 143 个路由层直连数据库点，任何回升都会失败。热点优先级是 checkpoint、voice、player-access、player-progress、host-content-action；它们是后续领域迁移计划，不是本轮非功能修复的未通过项。

本轮快速证据包括：依赖生产审计四端 0 个 high/critical 漏洞、App/Site/Host/Play 四个前端表面构建通过、SSE 故障矩阵 27/27、共享 transport 81/81、LISTEN 冷启动故障注入恢复、外部请求/SSRF/限流/错误脱敏/静态路径/优雅关闭的定向测试，以及包体预算全部通过。当前 Supabase 数据库的迁移完整性为 67 个已应用、0 个待应用、校验和一致；该结果是只读核验，不替代隔离数据库上的升级与回滚演练。无隔离 `DATABASE_URL` 时，真实 PostgreSQL 写入、会话触碰与 LISTEN 集成断言必须明确标记跳过，不能计作通过。

仍属于部署/运行证据而不是静态代码能消除的风险：多实例全局限流必须由 Cloudflare WAF/Rate Limiting 作为权威层；P95/P99、SSE 大并发、托管数据库容量和恢复时间必须在预发或生产镜像环境定期采样。快速审计不替代恢复演练与长时间 soak test。
