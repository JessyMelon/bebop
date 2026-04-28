---
name: gsd:progress
description: 检查项目进度，显示上下文，并路由到下一步动作（执行或规划）。使用 --forensic 可在标准报告后追加 6 项完整性审计。
argument-hint: "[--forensic]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - SlashCommand
---
<objective>
检查项目进度，总结最近完成的工作与接下来的方向，然后智能路由到下一个动作：执行已有计划，或创建下一个计划。

在继续工作前提供态势感知。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/progress.md
</execution_context>

<process>
端到端执行 @~/.claude/get-shit-done/workflows/progress.md 中的 progress workflow。
保留所有路由逻辑（Route A 到 F）和边界情况处理。
</process>
