---
name: gsd:ui-review
description: 对已实现的前端代码执行回溯式 6 支柱视觉审查
argument-hint: "[phase]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---
<objective>
执行一次回溯式 6 支柱视觉审查。产出 `UI-REVIEW.md`，包含分级评估（每个支柱 1-4 分）。适用于任何项目。
输出：`{phase_num}-UI-REVIEW.md`
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/ui-review.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
Phase：$ARGUMENTS，可选；默认使用最近完成的 phase。
</context>

<process>
端到端执行 `@~/.claude/get-shit-done/workflows/ui-review.md`。
保留所有工作流关卡。
</process>
