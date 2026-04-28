---
name: gsd:extract-learnings
description: 从已完成阶段产物中提取决策、经验、模式和意外发现
argument-hint: <phase-number>
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Agent
type: prompt
---
<objective>
从已完成阶段的产物（PLAN.md、SUMMARY.md、VERIFICATION.md、UAT.md、STATE.md）中提取结构化经验，写入一个 LEARNINGS.md 文件，记录决策、经验教训、发现的模式以及遇到的意外情况。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/extract_learnings.md
</execution_context>

端到端执行 @~/.claude/get-shit-done/workflows/extract_learnings.md 中的 extract-learnings workflow。
