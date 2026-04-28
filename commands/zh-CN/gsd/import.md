---
name: gsd:import
description: 在写入任何内容前，导入外部计划并针对项目决策进行冲突检测。
argument-hint: "--from <filepath>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Task
---

<objective>
将外部计划文件导入 GSD 规划系统，并针对 PROJECT.md 中的决策进行冲突检测。

- **--from**：导入一个外部计划文件，检测冲突，将其写成 GSD PLAN.md，并通过 gsd-plan-checker 校验。

未来：用于 PRD 提取的 `--prd` 模式计划在后续 PR 中实现。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/import.md
@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/references/gate-prompts.md
@~/.claude/get-shit-done/references/doc-conflict-engine.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
端到端执行 import workflow。
</process>
