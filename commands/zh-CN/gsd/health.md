---
name: gsd:health
description: 诊断 planning 目录健康状况，并可选择修复问题
argument-hint: [--repair]
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---
<objective>
校验 `.planning/` 目录的完整性并报告可执行的问题。检查缺失文件、无效配置、不一致状态以及孤立 plans。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/health.md
</execution_context>

<process>
端到端执行 @~/.claude/get-shit-done/workflows/health.md 中的 health workflow。
从参数中解析 `--repair` flag 并传给 workflow。
</process>
