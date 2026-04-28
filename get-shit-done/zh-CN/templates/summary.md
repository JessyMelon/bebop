# 总结模板

用于 `.planning/phases/XX-name/{phase}-{plan}-SUMMARY.md` 的模板 - 阶段完成文档。

---

## 文件模板

```markdown
---
phase: XX-name
plan: YY
subsystem: [primary category: auth, payments, ui, api, database, infra, testing, etc.]
tags: [searchable tech: jwt, stripe, react, postgres, prisma]

# Dependency graph
requires:
  - phase: [prior phase this depends on]
    provides: [what that phase built that this uses]
provides:
  - [bullet list of what this phase built/delivered]
affects: [list of phase names or keywords that will need this context]

# Tech tracking
tech-stack:
  added: [libraries/tools added in this phase]
  patterns: [architectural/code patterns established]

key-files:
  created: [important files created]
  modified: [important files modified]

key-decisions:
  - "Decision 1"
  - "Decision 2"

patterns-established:
  - "Pattern 1: description"
  - "Pattern 2: description"

requirements-completed: []  # REQUIRED — Copy ALL requirement IDs from this plan's `requirements` frontmatter field.

# Metrics
duration: Xmin
completed: YYYY-MM-DD
---

# Phase [X]: [Name] 总结

**[用一句有内容的话概括结果 - 不要写 "phase complete" 或 "implementation finished"]**

## Performance

- **Duration:** [time] (例如：23 min, 1h 15m)
- **Started:** [ISO timestamp]
- **Completed:** [ISO timestamp]
- **Tasks:** [count completed]
- **Files modified:** [count]

## Accomplishments
- [最重要的成果]
- [第二项关键成果]
- [如果适用，第三项]

## Task Commits

每个 task 都以原子方式提交：

1. **Task 1: [task name]** - `abc123f` (feat/fix/test/refactor)
2. **Task 2: [task name]** - `def456g` (feat/fix/test/refactor)
3. **Task 3: [task name]** - `hij789k` (feat/fix/test/refactor)

**Plan metadata:** `lmn012o` (docs: complete plan)

_注：TDD task 可能包含多个 commit（test → feat → refactor）_

## Files Created/Modified
- `path/to/file.ts` - 它的作用
- `path/to/another.ts` - 它的作用

## Decisions Made
[关键决策及简短原因，或 "None - followed plan as specified"]

## Deviations from Plan

[如果没有偏离："None - plan executed exactly as written"]

[如果发生偏离：]

### Auto-fixed Issues

**1. [Rule X - Category] 简短描述**
- **Found during:** Task [N] ([task name])
- **Issue:** [哪里有问题]
- **Fix:** [做了什么修复]
- **Files modified:** [file paths]
- **Verification:** [如何验证]
- **Committed in:** [hash] (part of task commit)

[... 每个 auto-fix 都重复一次 ...]

---

**Total deviations:** [N] auto-fixed ([按规则分类统计])
**Impact on plan:** [简短评估 - 例如："All auto-fixes necessary for correctness/security. No scope creep."]

## Issues Encountered
[遇到的问题及其解决方式，或 "None"]

[注："Deviations from Plan" 记录按 deviation 规则自动处理的计划外工作。"Issues Encountered" 记录在计划内工作过程中，需要额外排查或解决的问题。]

## User Setup Required

[如果生成了 USER-SETUP.md：]
**外部服务需要手动配置。** 见 [{phase}-USER-SETUP.md](./{phase}-USER-SETUP.md)，其中包含：
- 需要添加的环境变量
- 控制台配置步骤
- 验证命令

[如果没有 USER-SETUP.md：]
None - no external service configuration required.

## Next Phase Readiness
[下一阶段已具备的条件]
[任何 blocker 或注意事项]

---
*Phase: XX-name*
*Completed: [date]*
```

<frontmatter_guidance>
**Purpose:** 通过依赖图支持自动组装上下文。Frontmatter 让 summary 元数据可被机器读取，因此 plan-phase 可以快速扫描所有 summary，并根据依赖选择相关内容。

**Fast scanning:** Frontmatter 位于前 ~25 行，可低成本扫描所有 summary，而无需读取完整正文。

**Dependency graph:** `requires`/`provides`/`affects` 建立了阶段之间的显式链接，从而支持通过传递闭包选择上下文。

**Subsystem:** 主分类（auth、payments、ui、api、database、infra、testing），用于发现相关阶段。

**Tags:** 可搜索的技术关键词（libraries、frameworks、tools），用于识别技术栈。

**Key-files:** 重要文件，供 PLAN.md 中的 @context 引用。

**Patterns:** 后续阶段应继续遵循的既有约定。

**Population:** Frontmatter 会在 execute-plan.md 创建 summary 时填充。字段级说明见 `<step name="create_summary">`。
</frontmatter_guidance>

<one_liner_rules>
这句 one-liner 必须有实际内容：

**Good:**
- "JWT auth with refresh rotation using jose library"
- "Prisma schema with User, Session, and Product models"
- "Dashboard with real-time metrics via Server-Sent Events"

**Bad:**
- "Phase complete"
- "Authentication implemented"
- "Foundation finished"
- "All tasks done"

这句 one-liner 应该让人一眼看出到底交付了什么。
</one_liner_rules>

<example>
```markdown
# Phase 1: Foundation Summary

**JWT auth with refresh rotation using jose library, Prisma User model, and protected API middleware**

## Performance

- **Duration:** 28 min
- **Started:** 2025-01-15T14:22:10Z
- **Completed:** 2025-01-15T14:50:33Z
- **Tasks:** 5
- **Files modified:** 8

## Accomplishments
- User model with email/password auth
- Login/logout endpoints with httpOnly JWT cookies
- Protected route middleware checking token validity
- Refresh token rotation on each request

## Files Created/Modified
- `prisma/schema.prisma` - User and Session models
- `src/app/api/auth/login/route.ts` - Login endpoint
- `src/app/api/auth/logout/route.ts` - Logout endpoint
- `src/middleware.ts` - Protected route checks
- `src/lib/auth.ts` - JWT helpers using jose

## Decisions Made
- 使用 jose 而不是 jsonwebtoken（原生支持 ESM，兼容 Edge）
- 使用 15 分钟 access token 和 7 天 refresh token
- 将 refresh token 存入数据库，以支持撤销能力

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] 添加了使用 bcrypt 的密码哈希**
- **Found during:** Task 2 (Login endpoint implementation)
- **Issue:** 计划中未指定密码哈希 —— 明文存储会是严重安全缺陷
- **Fix:** 在注册时加入 bcrypt 哈希，在登录时使用 salt rounds 10 进行比较
- **Files modified:** src/app/api/auth/login/route.ts, src/lib/auth.ts
- **Verification:** 密码哈希测试通过，且从不存储明文
- **Committed in:** abc123f (Task 2 commit)

**2. [Rule 3 - Blocking] 安装缺失的 jose 依赖**
- **Found during:** Task 4 (JWT token generation)
- **Issue:** package.json 中没有 jose 包，import 失败
- **Fix:** 运行 `npm install jose`
- **Files modified:** package.json, package-lock.json
- **Verification:** import 成功，build 通过
- **Committed in:** def456g (Task 4 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** 两个 auto-fix 都是保障安全性和功能正确性的必要修复。没有范围蔓延。

## Issues Encountered
- jsonwebtoken 的 CommonJS import 在 Edge runtime 中失败 —— 改用 jose（计划内的库调整，结果符合预期）

## Next Phase Readiness
- Auth 基础完成，可以开始功能开发
- 正式上线前还需要用户注册 endpoint

---
*Phase: 01-foundation*
*Completed: 2025-01-15*
```
</example>

<guidelines>
**Frontmatter:** 必填 - 所有字段都要完整填写。它支持后续规划时的自动上下文组装。

**One-liner:** 必须有实际内容。应写成 "JWT auth with refresh rotation using jose library"，而不是 "Authentication implemented"。

**Decisions section:**
- 执行过程中做出的关键决策及其原因
- 会被提取到 STATE.md 的 accumulated context
- 如果没有偏离，写 "None - followed plan as specified"

**After creation:** 更新 STATE.md 中的位置、决策和问题。
</guidelines>
