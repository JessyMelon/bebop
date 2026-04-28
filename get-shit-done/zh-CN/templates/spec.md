# 阶段规格模板

用于 `.planning/phases/XX-name/{phase_num}-SPEC.md` 的模板 —— 在 discuss-phase 之前锁定需求。

**目的：** 记录一个阶段交付 WHAT 以及 WHY，并精确到需求可证伪。discuss-phase 会读取此文件，并聚焦 HOW 实现（跳过这里已回答的“what/why”问题）。

**核心原则：** 每条需求都必须可证伪 —— 你应该能写出一个测试或检查，证明它满足或未满足。不允许像 “improve performance” 这样的模糊需求。

**下游使用方：**
- `discuss-phase` —— 启动时读取 SPEC.md；将 Requirements、Boundaries 和 Acceptance Criteria 视为已锁定；跳过“what/why”问题
- `gsd-planner` —— 读取已锁定需求来约束计划范围
- `gsd-verifier` —— 将 acceptance criteria 作为明确的通过/失败检查

---

## 文件模板

```markdown
# Phase [X]: [Name] — 规格说明

**Created:** [date]
**Ambiguity score:** [score] (gate: ≤ 0.20)
**Requirements:** [N] locked

## Goal

[一句精确的话 —— 具体且可衡量。不要写 "improve X"，而要写 "X changes from A to B"。]

## Background

[基于代码库的当前状态 —— 现在已有的内容、损坏或缺失的部分，以及这项工作的触发原因。要基于代码现实，而不是抽象描述。]

## Requirements

1. **[Short label]**: [具体、可测试的陈述。]
   - Current: [当前已有或当前不存在的内容]
   - Target: [本阶段完成后应变成什么]
   - Acceptance: [明确的通过/失败检查 —— verifier 如何确认这条已满足]

2. **[Short label]**: [具体、可测试的陈述。]
   - Current: [当前已有或当前不存在的内容]
   - Target: [本阶段完成后应变成什么]
   - Acceptance: [明确的通过/失败检查]

[继续列出所有需求。每条都必须包含 Current/Target/Acceptance。]

## Boundaries

**In scope:**
- [明确列出本阶段产出的内容]
- [每一项都应是具体的交付物或行为]

**Out of scope:**
- [明确列出本阶段不做的内容] — [简短说明排除原因]
- [与本阶段相邻但被排除的问题] — [简短原因]

## Constraints

[性能、兼容性、数据量、依赖或平台约束。
如无："No additional constraints beyond standard project conventions."]

## Acceptance Criteria

- [ ] [通过/失败标准 —— 明确、可验证]
- [ ] [通过/失败标准]
- [ ] [通过/失败标准]

[每条 acceptance criterion 都必须是最终可判定为 PASS 或 FAIL 的复选框。
不要写 “should feel good”、“looks reasonable” 或 “generally works” —— 这些都不是复选框。]

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                              |
|--------------------|-------|------|--------|------------------------------------|
| Goal Clarity       |       | 0.75 |        |                                    |
| Boundary Clarity   |       | 0.70 |        |                                    |
| Constraint Clarity |       | 0.65 |        |                                    |
| Acceptance Criteria|       | 0.70 |        |                                    |
| **Ambiguity**      |       | ≤0.20|        |                                    |

Status: ✓ = 达到最低要求，⚠ = 低于最低要求（planner 会按假设处理）

## Interview Log

[苏格拉底式访谈中的关键决策。格式：round → question → answer → decision locked。]

| Round | Perspective    | Question summary         | Decision locked                    |
|-------|----------------|-------------------------|------------------------------------|
| 1     | Researcher     | [what was asked]        | [what was decided]                 |
| 2     | Simplifier     | [what was asked]        | [what was decided]                 |
| 3     | Boundary Keeper| [what was asked]        | [what was decided]                 |

[如果是 --auto 模式：记录 Claude 自动选择了哪些决定，以及采用该决定的原因。]

---

*Phase: [XX-name]*
*Spec created: [date]*
*Next step: /gsd-discuss-phase [X] — 实现决策（如何构建上面定义的内容）*
```

<good_examples>

**示例 1：功能新增（Post Feed）**

```markdown
# Phase 3: Post Feed — 规格说明

**Created:** 2025-01-20
**Ambiguity score:** 0.12
**Requirements:** 4 locked

## Goal

用户可以滚动浏览他们关注账号发布的帖子，并可通过下拉刷新获取新帖子。

## Background

数据库已有 `posts` 表和 `follows` 表。目前还没有 feed 查询或 feed UI。首页显示占位文本 "Your feed will appear here."。本阶段构建 feed 查询、API endpoint 和 feed 列表组件。

## Requirements

1. **Feed query**: 返回关注账号的帖子，按创建时间倒序排列。
   - Current: 当前没有 feed 查询 —— `posts` 表仅会从个人资料页被直接查询
   - Target: `GET /api/feed` 返回来自关注账号的分页帖子，最新优先，每页最多 20 条
   - Acceptance: 对一个关注了 3 个账号且帖子数量已知的用户，查询返回正确帖子；基于 cursor 的分页可正确推进

2. **Feed display**: 以可滚动卡片列表显示帖子。
   - Current: 首页只显示静态占位文本
   - Target: 首页渲染 feed 卡片，包含作者、时间戳、帖子内容和反应计数
   - Acceptance: 在 0 条帖子（显示空状态）、1 条帖子和 20+ 条帖子时都能无错误渲染

3. **Pull-to-refresh**: 用户可以手动刷新 feed。
   - Current: 当前没有刷新机制
   - Target: 下拉手势触发重新获取；新帖子出现在列表顶部
   - Acceptance: 测试中新建帖子后，下拉刷新可显示新帖子，无需重启整个应用

4. **New posts indicator**: 新帖子到达时显示横幅，而不是自动滚动。
   - Current: 当前没有这种机制
   - Target: 当重新获取返回的帖子比当前可见区域最旧帖子更新时，显示 "3 new posts" 横幅；点击横幅会滚动到顶部并显示新帖子
   - Acceptance: 当有 ≥1 条新帖子时显示横幅，没有新帖子时不显示，点击后跳到顶部

## Boundaries

**In scope:**
- Feed 查询（backend）—— 来自关注账号的帖子，支持分页
- Feed 列表 UI（frontend）—— 带作者、时间戳、内容和反应计数的帖子卡片
- 下拉刷新手势
- 新帖子提示横幅
- 当用户未关注任何人或没有帖子时显示空状态

**Out of scope:**
- 创建帖子 —— 那是 Phase 4
- 对帖子做反应 —— 那是 Phase 5
- 关注/取消关注账号 —— 那是 Phase 2（已完成）
- 新帖推送通知 —— 单独的 backlog 项

## Constraints

- Feed 查询必须使用基于 cursor 的分页（不能用 offset）—— 数据库有 500K+ 帖子，offset 分页在第 3 页后会慢到不可接受
- Feed 卡片组件必须复用 Phase 2 中已有的 `<AvatarImage>` 组件

## Acceptance Criteria

- [ ] `GET /api/feed` 只返回来自已关注账号的帖子（不是所有帖子）
- [ ] `GET /api/feed` 支持用于分页的 `cursor` 参数
- [ ] Feed 在 0、1 和 20+ 帖子时都能正确渲染
- [ ] 下拉刷新会触发重新获取
- [ ] 当存在比当前视图更新的帖子时显示新帖子提示
- [ ] 当用户未关注任何人时渲染空状态

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                            |
|--------------------|-------|------|--------|----------------------------------|
| Goal Clarity       | 0.92  | 0.75 | ✓      |                                  |
| Boundary Clarity   | 0.95  | 0.70 | ✓      | 明确列出了 out-of-scope 项       |
| Constraint Clarity | 0.80  | 0.65 | ✓      | 必须使用 cursor 分页             |
| Acceptance Criteria| 0.85  | 0.70 | ✓      | 6 条通过/失败标准                |
| **Ambiguity**      | 0.12  | ≤0.20| ✓      |                                  |

## Interview Log

| Round | Perspective     | Question summary              | Decision locked                         |
|-------|-----------------|------------------------------|-----------------------------------------|
| 1     | Researcher      | 现在帖子相关已有些什么？     | 已有 posts + follows 表，但没有 feed   |
| 2     | Simplifier      | 最小可行 feed 是什么？       | 卡片 + 下拉刷新，不做自动滚动          |
| 3     | Boundary Keeper | 什么不属于这个阶段？         | 创建帖子、反应不在范围内               |
| 3     | Boundary Keeper | 完成标准是什么？             | 可滚动 feed，卡片含 4 个字段           |

---

*Phase: 03-post-feed*
*Spec created: 2025-01-20*
*Next step: /gsd-discuss-phase 3 — 实现决策（卡片布局、loading skeleton 等）*
```

**示例 2：CLI 工具（数据库备份）**

```markdown
# Phase 2: Backup Command — 规格说明

**Created:** 2025-01-20
**Ambiguity score:** 0.15
**Requirements:** 3 locked

## Goal

一个 `gsd backup` CLI 命令可以创建可复现的数据库快照，并可由 `gsd restore`（单独阶段）恢复。

## Background

当前没有任何备份工具。项目使用 PostgreSQL。开发者目前手动使用 `pg_dump` —— 没有标准化流程、没有输出命名规范，也没有 CI 集成。上个季度有三次事故与从错误或损坏的 dump 恢复有关。

## Requirements

1. **Backup creation**: CLI 命令执行完整数据库备份。
   - Current: CLI 中不存在 `backup` 子命令
   - Target: `gsd backup` 连接数据库（通过 `DATABASE_URL` env 或 `--db` flag），运行 pg_dump，并将输出写入 `./backups/YYYY-MM-DD_HH-MM-SS.dump`
   - Acceptance: 在测试数据库上运行 `gsd backup` 会创建 `.dump` 文件；对该文件运行 `pg_restore` 可无错误重建数据库

2. **Network retry**: 自动重试瞬时网络故障。
   - Current: pg_dump 遇到网络错误会立即失败
   - Target: 备份最多重试 3 次，每次间隔 5 秒；第 4 次失败时以 code 1 退出并向 stderr 输出消息
   - Acceptance: 模拟连续 2 次网络失败会在 2 次重试后成功；模拟 4 次失败会返回 exit code 1 并输出 stderr 消息

3. **Partial cleanup**: 失败的备份不会留下损坏文件。
   - Current: 手动 pg_dump 失败时会留下部分文件
   - Target: 如果备份开始后失败，退出前删除未完成的 `.dump` 文件
   - Acceptance: 在 dump 中途模拟失败后，`./backups/` 中不存在 `.dump` 文件

## Boundaries

**In scope:**
- `gsd backup` 子命令（仅完整 dump）
- 输出到 `./backups/` 目录（不存在则创建）
- 网络重试（3 次）
- 失败时清理部分文件

**Out of scope:**
- `gsd restore` —— 那是 Phase 3
- 增量备份 —— 单独的 backlog 项（当前只做完整 dump）
- S3 或远程存储 —— 单独的 backlog 项
- 加密 —— 单独的 backlog 项
- 定时/cron 备份 —— 单独的 backlog 项

## Constraints

- 必须使用 `pg_dump`（不是自定义查询）—— 这样可确保与标准 `pg_restore` 兼容
- 必须提供 `--no-retry` flag 供 CI 使用（快速失败，不重试）

## Acceptance Criteria

- [ ] `gsd backup` 会以 `./backups/YYYY-MM-DD_HH-MM-SS.dump` 格式创建 `.dump` 文件
- [ ] `gsd backup` 使用 `DATABASE_URL` env var 或 `--db` flag 建立连接
- [ ] 网络失败时重试 3 次，随后以 code 1 退出并输出 stderr 消息
- [ ] `--no-retry` flag 会跳过重试并在首次错误时立即失败
- [ ] 备份失败后不留下部分 `.dump` 文件

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                          |
|--------------------|-------|------|--------|--------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ✓      |                                |
| Boundary Clarity   | 0.95  | 0.70 | ✓      | 明确列出了 out-of-scope 项     |
| Constraint Clarity | 0.75  | 0.65 | ✓      | 要求使用 pg_dump               |
| Acceptance Criteria| 0.80  | 0.70 | ✓      | 5 条通过/失败标准              |
| **Ambiguity**      | 0.15  | ≤0.20| ✓      |                                |

## Interview Log

| Round | Perspective     | Question summary              | Decision locked                         |
|-------|-----------------|------------------------------|-----------------------------------------|
| 1     | Researcher      | 现有备份工具是什么？         | 没有 —— 只有手动 pg_dump               |
| 2     | Simplifier      | 最小可行备份是什么？         | 只做完整 dump，只支持本地              |
| 3     | Boundary Keeper | 什么不属于这个阶段？         | Restore、S3、加密被排除                |
| 4     | Failure Analyst | 失败时会出什么问题？         | 会留下部分文件，CI 需要快速失败        |

---

*Phase: 02-backup-command*
*Spec created: 2025-01-20*
*Next step: /gsd-discuss-phase 2 — 实现决策（进度展示、flag 设计等）*
```

</good_examples>

<guidelines>
**每条需求都需要这三个字段：**
- Current：基于现实 —— 今天已有的是什么？
- Target：具体变更 —— 不是 “improve X”，而是 “X becomes Y”
- Acceptance：可证伪的检查 —— verifier 如何确认它？

**Ambiguity Report 必须反映真实访谈。** 如果某个维度低于最低值，标记为 ⚠ —— planner 会把它当作假设，而不是已锁定需求。

**Interview Log 是严谨性的证据。** 不要省略。它表明需求来自发现过程，而不是假设。

**Boundaries 用来防止范围蔓延。** 带原因的 out-of-scope 列表和 in-scope 列表同样重要。后续涉及相邻区域的阶段可以参考这个 SPEC.md，了解哪些内容是有意排除的。

**SPEC.md 对需求来说是单向门。** discuss-phase 会把这些内容视为已锁定。如果 SPEC.md 写完后需求发生变化，用户应先更新 SPEC.md，再重新运行 discuss-phase。

**SPEC.md 不能替代 CONTEXT.md。** 两者职责不同：
- SPEC.md：阶段交付什么（requirements、boundaries、acceptance criteria）
- CONTEXT.md：阶段如何实现（decisions、patterns、tradeoffs）

discuss-phase 会在读取 SPEC.md 后生成 CONTEXT.md。
</guidelines>
