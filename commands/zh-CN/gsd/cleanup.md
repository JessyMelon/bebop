---
name: gsd:cleanup
description: 归档已完成 milestone 积累下来的 phase 目录
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---
<objective>
将已完成 milestones 的 phase 目录归档到 `.planning/milestones/v{X.Y}-phases/`。

当 `.planning/phases/` 中积累了过去 milestones 的目录时使用。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/cleanup.md
</execution_context>

<process>
遵循 `@~/.claude/get-shit-done/workflows/cleanup.md` 中的 cleanup 工作流。
识别已完成的 milestones，展示 dry-run 摘要，并在确认后归档。
</process>
