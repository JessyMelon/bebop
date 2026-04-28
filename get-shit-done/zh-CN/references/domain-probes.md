# Domain-Aware Probing Patterns

供 `/gsd-begin`、`/gsd-discuss-phase` 以及领域探索工作流共享使用的参考资料。

当用户提到某个技术领域时，用这些 probes 提出更有洞察的追问。不要机械地像检查表一样逐项过一遍 —— 只根据上下文挑选最相关的 2-3 个。目标是挖出用户可能尚未考虑到的隐藏假设和权衡。

---

## Authentication

| User mentions | Agent probes with domain knowledge |
|---|---|
| `login` 或 `auth` | OAuth（哪些 providers？）、JWT，还是 session-based？需要 social login 还是只要 email/password？ |
| `users` 或 `accounts` | 需要 MFA 吗？Password reset flow？Email verification？ |
| `sessions` | Session duration 和 refresh strategy 是什么？Server-side sessions 还是 stateless tokens？ |
| `roles` 或 `permissions` | RBAC、ABAC，还是简单角色检查？有多少种不同角色？ |
| `API keys` | Key rotation strategy？每个 key 有 scoped permissions 吗？是否需要按 key 限流？ |

---

## Real-Time Updates

| User mentions | Agent probes with domain knowledge |
|---|---|
| `real-time` 或 `live updates` | WebSockets、SSE，还是 polling？哪些内容必须实时，哪些可以 eventual？ |
| `notifications` | Push notifications（browser/mobile）、仅 in-app，还是两者都要？需要持久化和已读回执吗？ |
| `collaboration` 或 `multiplayer` | 冲突解决策略？Operational transforms 还是 CRDTs？预期并发用户数？ |
| `chat` 或 `messaging` | 需要 message history 和 search 吗？Typing indicators？Read receipts？ |
| `streaming` | 断线重连策略？连接断开时怎么处理 —— queue 还是 discard？ |

---

## Dashboard

| User mentions | Agent probes with domain knowledge |
|---|---|
| `dashboard` | 它由哪些数据源驱动？有多少种不同视图？ |
| `charts` 或 `graphs` | 需要交互还是静态？需要 drill-down 能力吗？导出 CSV/PDF？ |
| `metrics` 或 `KPIs` | 刷新策略是什么 —— 实时、定时轮询还是按需？可接受的陈旧度是多少？ |
| `admin panel` | 需要基于角色的可见性吗？除了查看之外还要支持哪些操作（edit、delete、approve）？ |
| `mobile` 或 `responsive` | 移动端是简化视图还是完整等价？图表需要触控交互吗？ |

---

## API Design

| User mentions | Agent probes with domain knowledge |
|---|---|
| `API` | REST、GraphQL，还是 RPC-style？仅内部使用还是对外开放？ |
| `endpoints` 或 `routes` | Versioning strategy 用什么（URL path、header、query param）？破坏性变更策略是什么？ |
| `pagination` | Cursor-based 还是 offset？预期结果集规模？是否保证稳定排序？ |
| `rate limiting` | 按 user、按 IP，还是按 API key？允许 burst 吗？如何向客户端传达限制？ |
| `errors` | 需要结构化错误格式吗？使用 error codes 还是 messages？生产环境错误暴露多少细节？ |

---

## Database

| User mentions | Agent probes with domain knowledge |
|---|---|
| `database` 或 `storage` | SQL 还是 NoSQL？驱动选择的因素是什么 —— 关系完整性、灵活性、规模？ |
| `ORM` 或 `queries` | ORM（哪个？）还是 raw queries？Query builder 作为中间方案如何？ |
| `migrations` | 用哪个 migration tool？rollback strategy？如何处理 data migrations 与 schema migrations？ |
| `seeding` 或 `test data` | 开发环境需要 seed data 吗？是逼真的假数据还是极简 fixtures？ |
| `scale` 或 `performance` | 读写比是多少？需要 read replicas 吗？connection pooling strategy 是什么？ |

---

## Search

| User mentions | Agent probes with domain knowledge |
|---|---|
| `search` | Full-text 还是 exact match？用专门搜索引擎（Elasticsearch、Meilisearch）还是 database-level 实现？ |
| `filtering` 或 `facets` | 需要 faceted filtering 吗？有多少个 filter 维度？支持组合过滤（AND/OR）吗？ |
| `autocomplete` 或 `typeahead` | Debounce strategy？最少字符阈值？结果排名方式？ |
| `indexing` | 索引规模和更新频率？实时索引还是批处理？可接受的索引延迟是多少？ |
| `fuzzy` 或 `typo tolerance` | 需要 fuzzy matching 吗？同义词支持？按语言的 stemming？ |

---

## File Upload/Storage

| User mentions | Agent probes with domain knowledge |
|---|---|
| `upload` 或 `file upload` | 本地 filesystem 还是云存储（S3、GCS、Azure Blob）？直传还是经过 server？ |
| `images` 或 `media` | 处理 pipeline 是什么 —— resize、compress、thumbnail generation？需要格式转换吗？ |
| `size limits` | 单文件最大尺寸？每个用户总存储上限？超限时如何处理？ |
| `CDN` | 是否用 CDN 分发？更新文件时如何 cache invalidation？访问控制要用 signed URLs 吗？ |
| `documents` 或 `attachments` | 需要 virus scanning 吗？需要 preview generation 吗？上传文件要支持 versioning 吗？ |

---

## Caching

| User mentions | Agent probes with domain knowledge |
|---|---|
| `caching` 或 `performance` | 缓存放在哪里 —— browser、CDN、application layer 还是 database query cache？ |
| `invalidation` | Invalidation strategy 是什么 —— TTL、event-driven 还是 manual？Cache-aside 还是 write-through？ |
| `stale data` | 可接受的数据陈旧窗口是多少？是否采用 stale-while-revalidate 模式？ |
| `Redis` 或 `Memcached` | Cache topology 是单节点还是集群？需要 persistence 还是纯缓存？ |
| `CDN` 或 `edge` | 静态资源做 edge caching？动态内容也放到 edge？cache key strategy 是什么？ |

---

## Testing

| User mentions | Agent probes with domain knowledge |
|---|---|
| `testing` 或 `tests` | Unit、integration、E2E 怎么平衡？测试投入主要放在哪一层？ |
| `mocking` 或 `stubs` | mock 外部服务，还是用 test containers？数据库 mocking strategy 是什么？ |
| `CI` 或 `pipeline` | 在 CI 中跑测试吗？支持并行执行吗？是 test-on-PR 还是 test-on-push？ |
| `coverage` | coverage targets 是多少？coverage 是 gate 还是 advisory？看哪些指标（line、branch、function）？ |
| `E2E` 或 `browser testing` | 用 Playwright、Cypress 还是其他？Headed 还是 headless？要做 visual regression testing 吗？ |

---

## Deployment

| User mentions | Agent probes with domain knowledge |
|---|---|
| `deploy` 或 `hosting` | Container、serverless，还是传统 VM/VPS？用托管平台（Vercel、Railway）还是 self-hosted？ |
| `CI/CD` 或 `pipeline` | GitHub Actions、GitLab CI 还是别的？是 merge 到 main 自动部署，还是手动触发？ |
| `environments` | 需要几个环境（dev、staging、prod）？环境一致性策略是什么？ |
| `rollback` | Rollback strategy？Blue-green、canary，还是 instant rollback？数据库回滚怎么考虑？ |
| `secrets` 或 `config` | Secret management 用 env vars、vault 还是平台原生方案？不同环境的 config strategy 是什么？ |
