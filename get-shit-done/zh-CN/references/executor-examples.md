# Executor Extended Examples

> gsd-executor agent 的参考文件。按需通过 `@` reference 加载。
> 对于小于 200K 的 context window，这些内容会从 agent prompt 中剥离，并在这里提供按需加载。

## Deviation Rule Examples

### Rule 1 — Auto-fix bugs

**Examples of Rule 1 triggers:**
- 返回了错误数据的查询
- 条件分支中的逻辑错误
- 类型错误与类型不匹配
- 空指针异常 / undefined 访问
- 校验失效（接受了无效输入）
- 安全漏洞（XSS、SQL injection）
- 异步代码中的竞态条件
- 资源未清理导致的内存泄漏

### Rule 2 — Auto-add missing critical functionality

**Examples of Rule 2 triggers:**
- 缺少错误处理（未处理的 promise rejections、I/O 没有 try/catch）
- 面向用户的 endpoints 缺少输入校验
- 在属性访问前缺少 null checks
- 受保护路由没有 auth
- 缺少 authorization checks（用户可访问其他用户的数据）
- 缺少 CSRF/CORS 配置
- 公共 endpoints 缺少限流
- 高频查询列缺少 DB indexes
- 没有错误日志（失败被静默吞掉）

### Rule 3 — Auto-fix blocking issues

**Examples of Rule 3 triggers:**
- package.json 中缺少依赖
- 类型错误阻止编译
- imports 失效（路径错误、导出名错误）
- 运行时必需 env var 缺失
- DB connection error（URL 错误、凭据缺失）
- build config error（入口点错误、缺少 loader）
- 缺少被引用文件（import 指向不存在的 module）
- 阻止 module load 的循环依赖

### Rule 4 — Ask about architectural changes

**Examples of Rule 4 triggers:**
- 新增 DB table（不仅仅是加一列）
- 大型 schema 变更（重命名 tables、修改 relationships）
- 新 service layer（增加 queue、cache 或 message bus）
- 切换 libraries/frameworks（例如把 Express 替换成 Fastify）
- 改变 auth 方案（从 session 切到 JWT）
- 新基础设施（引入 Redis、S3 等）
- 破坏性 API 变更（删除或重命名 endpoints）

## Edge Case Decision Guide

| Scenario | Rule | Rationale |
|----------|------|-----------|
| 输入缺少校验 | Rule 2 | 安全要求 |
| null 输入导致崩溃 | Rule 1 | Bug —— 行为错误 |
| 需要新数据库表 | Rule 4 | 架构决策 |
| 需要给现有表新增列 | Rule 1 or 2 | 取决于上下文 |
| 既有 lint warnings | Out of scope | 不是当前任务引入的 |
| 无关的测试失败 | Out of scope | 不是当前任务引起的 |

**Decision heuristic:** “这会影响正确性、安全性或完成当前任务的能力吗？”
- YES → Rules 1-3（自动修复）
- MAYBE → Rule 4（询问用户）
- NO → Out of scope（记录到 deferred-items.md）

## Checkpoint Examples

### Good checkpoint placement

```xml
<!-- Automate everything, then verify at the end -->
<task type="auto">Create database schema</task>
<task type="auto">Create API endpoints</task>
<task type="auto">Create UI components</task>
<task type="checkpoint:human-verify">
  <what-built>Complete auth flow (schema + API + UI)</what-built>
  <how-to-verify>
    1. Visit http://localhost:3000/register
    2. Create account with test@example.com
    3. Log in with those credentials
    4. Verify dashboard loads with user name
  </how-to-verify>
</task>
```

### Bad checkpoint placement

```xml
<!-- Too many checkpoints — causes verification fatigue -->
<task type="auto">Create schema</task>
<task type="checkpoint:human-verify">Check schema</task>
<task type="auto">Create API</task>
<task type="checkpoint:human-verify">Check API</task>
<task type="auto">Create UI</task>
<task type="checkpoint:human-verify">Check UI</task>
```

### Auth gate handling

当 `type="auto"` 执行过程中出现 auth error 时：
1. 将其识别为 auth gate（不是 bug）—— 常见信号有：`Not authenticated`、`401`、`403`、`Please run X login`
2. **停止** 当前任务
3. 返回一个带精确认证步骤的 `checkpoint:human-action`
4. 在 SUMMARY.md 中，将 auth gates 记为正常流程，而不是 deviations
