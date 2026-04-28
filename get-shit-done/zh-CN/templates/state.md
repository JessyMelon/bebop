# 状态模板

用于 `.planning/STATE.md` 的模板 —— 项目的活记忆。

---

## 文件模板

```markdown
# Project State

## Project Reference

See: .planning/PROJECT.md (updated [date])

**Core value:** [One-liner from PROJECT.md Core Value section]
**Current focus:** [Current phase name]

## Current Position

Phase: [X] of [Y] ([Phase name])
Plan: [A] of [B] in current phase
Status: [Ready to plan / Planning / Ready to execute / In progress / Phase complete]
Last activity: [YYYY-MM-DD] — [What happened]

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: [N]
- Average duration: [X] min
- Total execution time: [X.X] hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: [durations]
- Trend: [Improving / Stable / Degrading]

*每个 plan 完成后更新*

## Accumulated Context

### Decisions

决策记录在 PROJECT.md 的 Key Decisions 表中。
最近影响当前工作的决策：

- [Phase X]: [Decision summary]
- [Phase Y]: [Decision summary]

### Pending Todos

[来自 .planning/todos/pending/ —— 会话中记录的想法]

None yet.

### Blockers/Concerns

[影响后续工作的事项]

None yet.

## Deferred Items

上一个 milestone 关闭时已确认并延续到现在的事项：

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: [YYYY-MM-DD HH:MM]
Stopped at: [Description of last completed action]
Resume file: [Path to .continue-here*.md if exists, otherwise "None"]
```

<purpose>

STATE.md 是跨越所有阶段和会话的项目短期记忆。

**它解决的问题：** 信息虽然记录在 summary、issue 和 decision 中，但没有被系统地消费。新会话启动时缺乏上下文。

**解决方案：** 一个统一且小巧的文件，它：
- 在每个 workflow 中首先读取
- 每次重要动作后更新
- 包含累积上下文的摘要
- 支持即时恢复会话

</purpose>

<lifecycle>

**创建：** 在 ROADMAP.md 创建后（初始化期间）
- 参考 PROJECT.md（读取当前上下文）
- 初始化为空的 accumulated context 区块
- 将位置设为 "Phase 1 ready to plan"

**读取：** 每个 workflow 的第一步
- progress: 向用户展示当前状态
- plan: 为计划决策提供信息
- execute: 了解当前位置
- transition: 了解哪些内容已完成

**写入：** 每次重要动作后
- execute: 在 SUMMARY.md 创建后
  - 更新位置（phase、plan、status）
  - 记录新决策（详细内容写入 PROJECT.md）
  - 添加 blockers/concerns
- transition: 在阶段标记完成后
  - 更新进度条
  - 清理已解决的 blocker
  - 刷新 Project Reference 日期

</lifecycle>

<sections>

### Project Reference
指向 PROJECT.md 以获取完整上下文。包含：
- Core value（唯一最重要的事）
- Current focus（当前是哪个阶段）
- Last update date（过旧时触发重新读取）

Claude 会直接读取 PROJECT.md 获取 requirements、constraints 和 decisions。

### Current Position
我们当前所处的位置：
- Phase X of Y —— 当前阶段
- Plan A of B —— 阶段内当前 plan
- Status —— 当前状态
- Last activity —— 最近发生了什么
- Progress bar —— 整体完成度的可视化指示

进度计算： (completed plans) / (all phases 的 total plans) × 100%

### Performance Metrics
跟踪执行速度以了解执行模式：
- 已完成 plan 总数
- 每个 plan 的平均耗时
- 按阶段拆分
- 最近趋势（improving/stable/degrading）

每个 plan 完成后更新。

### Accumulated Context

**Decisions：** 指向 PROJECT.md 的 Key Decisions 表，并附带最近决策摘要以便快速查看。完整决策日志保存在 PROJECT.md。

**Pending Todos：** 通过 /gsd-add-todo 记录的想法
- pending todo 数量
- 指向 .planning/todos/pending/
- 数量少时列出简表，数量多时写数量（例如："5 pending todos — see /gsd-check-todos"）

**Blockers/Concerns：** 来自 "Next Phase Readiness" 区块
- 影响后续工作的事项
- 加上来源 phase 前缀
- 解决后清除

### Session Continuity
支持即时继续工作：
- 上次会话是什么时候
- 上次完成了什么
- 是否存在可继续的 .continue-here 文件

</sections>

<size_constraint>

将 STATE.md 控制在 100 行以内。

它是摘要，不是档案。如果累积上下文变得过大：
- 摘要中只保留最近 3-5 条决策（完整日志在 PROJECT.md）
- 只保留仍活跃的 blocker，移除已解决的

目标是“一次读完就知道当前状态”—— 如果太长，就失败了。

</size_constraint>
