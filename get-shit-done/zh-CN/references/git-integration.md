<overview>
GSD framework 的 Git 集成。
</overview>

<core_principle>

**提交结果，而不是过程。**

git log 应该读起来像已交付内容的 changelog，而不是规划活动的日记。
</core_principle>

<commit_points>

| Event                   | Commit? | Why                                              |
| ----------------------- | ------- | ------------------------------------------------ |
| BRIEF + ROADMAP created | YES     | 项目初始化                                       |
| PLAN.md created         | NO      | 中间态 - 随 plan completion 一起提交            |
| RESEARCH.md created     | NO      | 中间态                                           |
| DISCOVERY.md created    | NO      | 中间态                                           |
| **Task completed**      | YES     | 原子工作单元（每个 task 一个 commit）           |
| **Plan completed**      | YES     | 元数据提交（SUMMARY + STATE + ROADMAP）         |
| Handoff created         | YES     | 保留 WIP 状态                                    |

</commit_points>

<git_check>

```bash
[ -d .git ] && echo "GIT_EXISTS" || echo "NO_GIT"
```

如果是 `NO_GIT`：静默运行 `git init`。GSD 项目总是拥有自己的 repo。
</git_check>

<commit_formats>

<format name="initialization">
## Project Initialization (brief + roadmap together)

```
docs: initialize [project-name] ([N] phases)

[One-liner from PROJECT.md]

Phases:
1. [phase-name]: [goal]
2. [phase-name]: [goal]
3. [phase-name]: [goal]
```

What to commit:

```bash
gsd-sdk query commit "docs: initialize [project-name] ([N] phases)" .planning/
```

</format>

<format name="task-completion">
## Task Completion (During Plan Execution)

每个 task 在完成后都应立即单独提交。

> **Parallel agents:** 当作为并行 executor（由 execute-phase 启动）运行时，
> 所有 commits 都使用 `--no-verify`，以避免 pre-commit hook 锁争用。
> orchestrator 会在所有 agents 完成后统一验证 hooks。

```
{type}({phase}-{plan}): {task-name}

- [Key change 1]
- [Key change 2]
- [Key change 3]
```

**Commit types:**
- `feat` - 新功能/新能力
- `fix` - Bug 修复
- `test` - 仅测试（TDD RED phase）
- `refactor` - 代码整理（TDD REFACTOR phase）
- `perf` - 性能改进
- `chore` - 依赖、配置、工具

**Examples:**

```bash
# Standard task
git add src/api/auth.ts src/types/user.ts
git commit -m "feat(08-02): create user registration endpoint

- POST /auth/register validates email and password
- Checks for duplicate users
- Returns JWT token on success
"

# TDD task - RED phase
git add src/__tests__/jwt.test.ts
git commit -m "test(07-02): add failing test for JWT generation

- Tests token contains user ID claim
- Tests token expires in 1 hour
- Tests signature verification
"

# TDD task - GREEN phase
git add src/utils/jwt.ts
git commit -m "feat(07-02): implement JWT generation

- Uses jose library for signing
- Includes user ID and expiry claims
- Signs with HS256 algorithm
"
```

</format>

<format name="plan-completion">
## Plan Completion (After All Tasks Done)

所有 tasks 都提交后，再做一个最终的元数据提交来记录 plan completion。

```
docs({phase}-{plan}): complete [plan-name] plan

Tasks completed: [N]/[N]
- [Task 1 name]
- [Task 2 name]
- [Task 3 name]

SUMMARY: .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md
```

What to commit:

```bash
gsd-sdk query commit "docs({phase}-{plan}): complete [plan-name] plan" .planning/phases/XX-name/{phase}-{plan}-PLAN.md .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md .planning/STATE.md .planning/ROADMAP.md
```

**Note:** 不包含代码文件 —— 它们已经按 task 提交过。

</format>

<format name="handoff">
## Handoff (WIP)

```
wip: [phase-name] paused at task [X]/[Y]

Current: [task name]
[If blocked:] Blocked: [reason]
```

What to commit:

```bash
gsd-sdk query commit "wip: [phase-name] paused at task [X]/[Y]" .planning/
```

</format>
</commit_formats>

<example_log>

**Old approach (per-plan commits):**
```
a7f2d1 feat(checkout): Stripe payments with webhook verification
3e9c4b feat(products): catalog with search, filters, and pagination
8a1b2c feat(auth): JWT with refresh rotation using jose
5c3d7e feat(foundation): Next.js 15 + Prisma + Tailwind scaffold
2f4a8d docs: initialize ecommerce-app (5 phases)
```

**New approach (per-task commits):**
```
# Phase 04 - Checkout
1a2b3c docs(04-01): complete checkout flow plan
4d5e6f feat(04-01): add webhook signature verification
7g8h9i feat(04-01): implement payment session creation
0j1k2l feat(04-01): create checkout page component

# Phase 03 - Products
3m4n5o docs(03-02): complete product listing plan
6p7q8r feat(03-02): add pagination controls
9s0t1u feat(03-02): implement search and filters
2v3w4x feat(03-01): create product catalog schema

# Phase 02 - Auth
5y6z7a docs(02-02): complete token refresh plan
8b9c0d feat(02-02): implement refresh token rotation
1e2f3g test(02-02): add failing test for token refresh
4h5i6j docs(02-01): complete JWT setup plan
7k8l9m feat(02-01): add JWT generation and validation
0n1o2p chore(02-01): install jose library

# Phase 01 - Foundation
3q4r5s docs(01-01): complete scaffold plan
6t7u8v feat(01-01): configure Tailwind and globals
9w0x1y feat(01-01): set up Prisma with database
2z3a4b feat(01-01): create Next.js 15 project

# Initialization
5c6d7e docs: initialize ecommerce-app (5 phases)
```

每个 plan 会产生 2-4 个 commits（tasks + metadata）。清晰、细粒度、可 bisect。

</example_log>

<anti_patterns>

**仍然不要提交（中间工件）：**
- PLAN.md 创建（与 plan completion 一起提交）
- RESEARCH.md（中间态）
- DISCOVERY.md（中间态）
- 轻微规划改动
- `Fixed typo in roadmap`

**应该提交（结果）：**
- 每个 task 完成（feat/fix/test/refactor）
- plan completion metadata（docs）
- project initialization（docs）

**Key principle:** 提交可工作的代码和已交付的结果，而不是规划过程。

</anti_patterns>

<commit_strategy_rationale>

## Why Per-Task Commits?

**Context engineering for AI:**
- Git 历史会成为未来 Claude 会话的主要上下文来源
- `git log --grep="{phase}-{plan}"` 能展示某个 plan 的全部工作
- `git diff <hash>^..<hash>` 能显示每个 task 的精确改动
- 减少对解析 SUMMARY.md 的依赖 = 把更多上下文留给真正的工作

**Failure recovery:**
- Task 1 已提交 ✅，Task 2 失败 ❌
- 下次会话中的 Claude：能看到 task 1 已完成，可以重试 task 2
- 可以 `git reset --hard` 到上一个成功 task

**Debugging:**
- `git bisect` 能定位到确切失败 task，而不只是失败的 plan
- `git blame` 可将某一行追溯到具体 task 上下文
- 每个 commit 都能独立回滚

**Observability:**
- 独立开发者 + Claude 工作流受益于细粒度归因
- 原子提交是 git 最佳实践
- 当消费者是 Claude 而不是人时，“commit noise” 并不重要

</commit_strategy_rationale>

<sub_repos_support>

## Multi-Repo Workspace Support (sub_repos)

对于带有多个独立 git repos 的工作区（例如 `backend/`, `frontend/`, `shared/`），GSD 会把 commits 分别路由到各个 repo。

### Configuration

在 `.planning/config.json` 中，将子仓库目录列到 `planning.sub_repos` 下：

```json
{
  "planning": {
    "commit_docs": false,
    "sub_repos": ["backend", "frontend", "shared"]
  }
}
```

设置 `commit_docs: false`，这样规划文档会保留在本地，而不会提交进任何 sub-repo。

### How It Works

1. **Auto-detection:** 在 `/gsd-new-project` 期间，会检测带有自身 `.git` 文件夹的目录，并提供选择作为 sub-repos。之后运行时，`loadConfig` 会自动将 `sub_repos` 列表与文件系统同步 —— 新增 repo 会加入，删除的 repo 会移除。这意味着磁盘上的 repo 变化可能会自动改写 `config.json`。
2. **File grouping:** 代码文件会按其 sub-repo 前缀分组（例如 `backend/src/api/users.ts` 属于 `backend/` repo）。
3. **Independent commits:** 每个 sub-repo 都会通过 `gsd-tools.cjs commit-to-subrepo` 获得自己的原子提交。文件路径在暂存前会先相对化为 sub-repo 根目录。
4. **Planning stays local:** `.planning/` 目录不会被提交；它只用作跨 repo 协调层。

### Commit Routing

当配置了 `sub_repos` 时，使用 `commit-to-subrepo` 替代标准 `commit` 命令：

```bash
gsd-sdk query commit-to-subrepo "feat(02-01): add user API" \
  --files backend/src/api/users.ts backend/src/types/user.ts frontend/src/components/UserForm.tsx
```

这样会在 `backend/` repo 中暂存 `src/api/users.ts` 和 `src/types/user.ts`，在 `frontend/` repo 中暂存 `src/components/UserForm.tsx`，然后分别用同一条消息提交。

不匹配任何已配置 sub-repo 的文件会被报告为 unmatched。

</sub_repos_support>
