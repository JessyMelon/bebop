---
name: gsd:stats
description: 显示项目统计信息，包括 phases、plans、requirements、git 指标和时间线
allowed-tools:
  - Read
  - Bash
---
<objective>
显示全面的项目统计信息，包括 phase 进度、plan 执行指标、requirements 完成情况、git 历史统计和项目时间线。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/stats.md
</execution_context>

<process>
端到端执行 `@~/.claude/get-shit-done/workflows/stats.md` 中的 stats 工作流。
</process>
