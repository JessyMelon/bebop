# Planner Anti-Patterns and Specificity Examples

> gsd-planner agent 的参考文件。按需通过 `@` reference 加载。
> 对于小于 200K 的 context windows，这些内容会从 agent prompt 中剥离，并在这里提供按需加载。

## Checkpoint Anti-Patterns

### Bad — Asking human to automate

```xml
<task type="checkpoint:human-action">
  <action>Deploy to Vercel</action>
  <instructions>Visit vercel.com, import repo, click deploy...</instructions>
</task>
```

**Why bad:** Vercel 有 CLI。Claude 应该运行 `vercel --yes`。绝不要让用户去做 Claude 能通过 CLI/API 自动化的事。

### Bad — Too many checkpoints

```xml
<task type="auto">Create schema</task>
<task type="checkpoint:human-verify">Check schema</task>
<task type="auto">Create API</task>
<task type="checkpoint:human-verify">Check API</task>
```

**Why bad:** 验证疲劳。不要让用户检查每个小步骤。应把检查合并到有意义工作结束后的单个 checkpoint。

### Good — Single verification checkpoint

```xml
<task type="auto">Create schema</task>
<task type="auto">Create API</task>
<task type="auto">Create UI</task>
<task type="checkpoint:human-verify">
  <what-built>Complete auth flow (schema + API + UI)</what-built>
  <how-to-verify>Test full flow: register, login, access protected page</how-to-verify>
</task>
```

### Bad — Mixing checkpoints with implementation

一个 plan 不应在实现任务中穿插多种 checkpoint 类型。checkpoints 应位于自然的验证边界，而不是散落在整个过程中。

## Specificity Examples

| TOO VAGUE | JUST RIGHT |
|-----------|------------|
| `Add authentication` | `Add JWT auth with refresh rotation using jose library, store in httpOnly cookie, 15min access / 7day refresh` |
| `Create the API` | `Create POST /api/projects endpoint accepting {name, description}, validates name length 3-50 chars, returns 201 with project object` |
| `Style the dashboard` | `Add Tailwind classes to Dashboard.tsx: grid layout (3 cols on lg, 1 on mobile), card shadows, hover states on action buttons` |
| `Handle errors` | `Wrap API calls in try/catch, return {error: string} on 4xx/5xx, show toast via sonner on client` |
| `Set up the database` | `Add User and Project models to schema.prisma with UUID ids, email unique constraint, createdAt/updatedAt timestamps, run prisma db push` |

**Specificity test:** 换一个 Claude 实例，能否在不提澄清问题的情况下执行该任务？如果不能，就补充更多细节。

## Context Section Anti-Patterns

### Bad — Reflexive SUMMARY chaining

```markdown
<context>
@.planning/phases/01-foundation/01-01-SUMMARY.md
@.planning/phases/01-foundation/01-02-SUMMARY.md  <!-- Does Plan 02 actually need Plan 01's output? -->
@.planning/phases/01-foundation/01-03-SUMMARY.md  <!-- Chain grows, context bloats -->
</context>
```

**Why bad:** Plans 往往彼此独立。机械式串联（02 引 01，03 引 02……）会浪费上下文。只有当当前 plan 真的会用到前一 plan 的 types/exports，或前一 plan 的某项决策会影响当前 plan 时，才引用先前的 SUMMARY 文件。

### Good — Selective context

```markdown
<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/01-foundation/01-01-SUMMARY.md  <!-- Uses User type defined in Plan 01 -->
</context>
```

## Scope Reduction Anti-Patterns

**Prohibited language in task actions:**
- `v1`, `v2`, `simplified version`, `static for now`, `hardcoded for now`
- `future enhancement`, `placeholder`, `basic version`, `minimal implementation`
- `will be wired later`, `dynamic in future phase`, `skip for now`

如果 CONTEXT.md 中的决策说“以 impulses 为单位显示从 billing table 计算出的 cost”，那么 plan 就必须精确交付这一点，而不是交一个 “static label /min” 的 “v1”。如果该 phase 过于复杂，应建议拆分 phase，而不是悄悄缩减范围。
