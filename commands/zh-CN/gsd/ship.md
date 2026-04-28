---
name: gsd:ship
description: 在验证通过后创建 PR、运行评审并准备合并
argument-hint: "[phase number or milestone, e.g., '4' or 'v1.0']"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Write
  - AskUserQuestion
---
<objective>
衔接本地完成到 PR 合并。`/gsd-verify-work` 通过后，交付这项工作：推送分支、创建带自动生成正文的 PR、可选触发评审，并跟踪合并进度。

闭合 plan → execute → verify → ship 这条流程。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/ship.md
</execution_context>

端到端执行 `@~/.claude/get-shit-done/workflows/ship.md` 中的 ship 工作流。
