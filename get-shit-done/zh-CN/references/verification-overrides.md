# 验证覆盖

用于在已知且可接受的偏差情况下，有意接受 must-have 失败的机制。可避免对本就不可能按原始要求通过的条目反复进入验证循环。

<override_format>

## 覆盖格式

在 `VERIFICATION.md` 的 frontmatter 中，通过 `overrides:` 键声明 override：

```yaml
---
phase: 03-authentication
verified: 2026-04-05T12:00:00Z
status: passed
score: 5/5
overrides_applied: 2
overrides:
  - must_have: "OAuth2 PKCE flow implemented"
    reason: "Using session-based auth instead — PKCE unnecessary for server-rendered app"
    accepted_by: "dave"
    accepted_at: "2026-04-04T15:30:00Z"
  - must_have: "Rate limiting on login endpoint"
    reason: "Deferred to Phase 5 (infrastructure) — tracked in ROADMAP.md"
    accepted_by: "dave"
    accepted_at: "2026-04-04T15:30:00Z"
---
```

### 必填字段

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `must_have` | string | 被 override 的 must-have 事实、工件描述或关键链接。不必完全匹配，支持模糊匹配。 |
| `reason` | string | 说明为什么该偏差可接受。必须具体，不能只写 "not needed"。 |
| `accepted_by` | string | 谁接受了该 override（用户名或角色）。必填。 |
| `accepted_at` | string | 接受该 override 的 ISO 时间戳。必填。 |

</override_format>

## 何时使用

当某个 phase 在执行过程中有意偏离原计划时，可使用 override。例如需求被缩减、选择了替代方案，或依赖发生变化。

如果没有 override，verifier 会将这些情况报告为 FAIL，即使该偏差本来就是有意的。override 允许开发者将特定条目标记为 `PASSED (override)`，并附上记录好的原因。

适合使用 override 的情况：
- 需求在规划后发生变化，但 `ROADMAP.md` 尚未更新
- 替代实现满足了意图，但不符合字面表述
- 某个 must-have 被明确跟踪并延期到后续 phase
- 外部限制使原始 must-have 不可行或没有必要

## 何时不要使用

不适合使用 override 的情况：
- 实现本身就是未完成的，应直接补齐
- must-have 含义不清，应先澄清
- 开发者只是想跳过验证，这会破坏流程
- 同一 phase 有多个 must-have 失败，如果超过 2-3 项都需要 override，应回头调整计划，而不是批量覆盖

<matching_rules>

## 匹配规则

override 匹配使用的是**模糊匹配**，不是精确字符串比较。这样可兼容 `ROADMAP.md`、`PLAN.md` frontmatter 与 override 条目之间在 must-have 表述上的细微差异。

### 匹配算法

1. **规范化两个字符串：** 不区分大小写比较，将两边都转成小写、去掉标点并折叠空白
2. **Token overlap：** 按单词拆分并计算交集
3. **Match threshold：** 任一方向达到 80% token 重叠即可（override tokens 出现在 must-have 中，或 must-have tokens 出现在 override 中）
4. **Key noun priority：** 名词和技术术语（文件路径、组件名、API endpoint）权重高于常见词

### 示例

| Must-Have | Override `must_have` | 是否匹配 | 原因 |
|-----------|---------------------|--------|--------|
| "User can authenticate via OAuth2 PKCE" | "OAuth2 PKCE flow implemented" | Yes | 关键术语 `OAuth2` 和 `PKCE` 重叠，达到 80% 阈值 |
| "Rate limiting on /api/auth/login" | "Rate limiting on login endpoint" | Yes | `rate limiting` + `login` 重叠 |
| "Chat component renders messages" | "OAuth2 PKCE flow implemented" | No | 没有有意义的 token 重叠 |
| "src/components/Chat.tsx provides message list" | "Chat.tsx message list rendering" | Yes | `Chat.tsx` + `message` + `list` 重叠 |

### 歧义处理

如果某个 override 匹配到多个 must-have，应应用到**最具体的匹配项**（token 重叠百分比最高）。如果仍然有歧义，则应用到第一个匹配项并记录警告。

</matching_rules>

<verifier_behavior>

## 带覆盖时的 Verifier 行为

### 检查顺序

override 检查发生在**把 must-have 标记为 FAIL 之前**。流程如下：

1. 根据代码库评估 must-have（验证流程的第 3-5 步）
2. 如果评估结果为 FAIL 或 UNCERTAIN：
   a. 检查 `VERIFICATION.md` frontmatter 中的 `overrides:` 数组，做模糊匹配
   b. 如果找到 override：标记为 `PASSED (override)`，而不是 FAIL
   c. 如果未找到 override：按正常方式标记为 FAIL
3. 如果评估结果为 PASS：标记为 VERIFIED（此时 override 无关）

### 输出格式

被 override 的条目在所有验证表中都应显示为独立状态：

```markdown
| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can authenticate | VERIFIED | OAuth session flow working |
| 2 | OAuth2 PKCE flow | PASSED (override) | Override: Using session-based auth — accepted by dave on 2026-04-04 |
| 3 | Chat renders messages | FAILED | Component returns placeholder |
```

`PASSED (override)` 状态必须在视觉上区别于 `VERIFIED` 和 `FAILED`。在 evidence 列中，应包含 override 原因以及接受人。

### 对整体状态的影响

- `PASSED (override)` 条目计入通过分数，不计入失败分数
- 如果某个 phase 的所有条目都是 VERIFIED 或 PASSED (override)，其状态可为 `passed`
- override **不会**抑制 `human_needed` 条目，这些仍然需要人工测试

### Frontmatter 评分

frontmatter 中的分数和 override 数量应反映已应用的 override：

```yaml
score: 5/5  # includes 2 overrides
overrides_applied: 2
```

</verifier_behavior>

<creating_overrides>

## 创建覆盖

### 交互式覆盖建议

当 verifier 将某个 must-have 标记为 FAIL，且这个失败看起来是有意的（例如存在替代实现，或代码明确以不同方式处理该场景）时，verifier 应建议创建 override：

```markdown
### F-002: OAuth2 PKCE flow

**Status:** FAILED
**Evidence:** No PKCE implementation found. Session-based auth used instead.

**This looks intentional.** The codebase uses session-based authentication which achieves the same goal differently. To accept this deviation, add an override to VERIFICATION.md frontmatter:

```yaml
overrides:
  - must_have: "OAuth2 PKCE flow implemented"
    reason: "Using session-based auth instead — PKCE unnecessary for server-rendered app"
    accepted_by: "{your name}"
    accepted_at: "{current ISO timestamp}"
```

Then re-run verification to apply.
```

### 通过 gsd-tools 添加覆盖

也可以通过验证工作流来管理 override：

1. 运行 `/gsd-verify-work`，验证会找出缺口
2. 审查缺口，确定哪些是有意偏差
3. 将 override 条目加入 `VERIFICATION.md` frontmatter
4. 重新运行 `/gsd-verify-work`，应用 override，并展示剩余缺口

</creating_overrides>

<override_lifecycle>

## 覆盖生命周期

### 重新验证期间

当某个 phase 被重新验证时（例如补齐缺口后）：
- 现有 override 会自动沿用
- 如果底层代码现在已经满足该 must-have，该 override 就不再必要，此时应标记为 VERIFIED
- override 永远不会被自动删除；它们会作为文档持续保留

### 在 Milestone 完成时

在 `/gsd-audit-milestone` 期间，audit 报告会展示 override：

```
### Verification Overrides ({count} across {phase_count} phases)

| Phase | Must-Have | Reason | Accepted By |
|-------|----------|--------|-------------|
| 03 | OAuth2 PKCE | Session-based auth used instead | dave |
```

这样团队在关闭 milestone 前，就能看到所有已接受的偏差。

### 清理

对于过期 override（其 must-have 后来已实现，或已从 `ROADMAP.md` 删除），可在 milestone 完成时清理。它们只起信息记录作用，即使保留也不会造成问题。

</override_lifecycle>

## `VERIFICATION.md` 示例

```markdown
---
phase: 03-api-layer
verified: 2026-04-05T12:00:00Z
status: passed
score: 3/3
overrides_applied: 1
overrides:
  - must_have: "paginated API responses"
    reason: "Descoped — dataset under 100 items, pagination adds complexity without value"
    accepted_by: "dave"
    accepted_at: "2026-04-04T15:30:00Z"
---

## Phase 3: API Layer — Verification

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | REST endpoints return JSON | VERIFIED | curl tests confirm |
| 2 | Paginated API responses | PASSED (override) | Descoped — see override: dataset under 100 items |
| 3 | Authentication middleware | VERIFIED | JWT validation working |
```
