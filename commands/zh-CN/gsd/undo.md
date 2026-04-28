---
name: gsd:undo
description: "安全地执行 git revert。使用 phase manifest 回滚 phase 或 plan 提交，并带依赖检查。"
argument-hint: "--last N | --phase NN | --plan NN-MM"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
安全地执行 git revert：基于 phase manifest 回滚 GSD 的 phase 或 plan 提交，并在执行前进行依赖检查和确认关卡。

三种模式：
- **--last N**：显示最近的 GSD 提交，供交互式选择
- **--phase NN**：回滚某个 phase 的全部提交（manifest + git log 回退）
- **--plan NN-MM**：回滚某个特定 plan 的全部提交
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/undo.md
@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/references/gate-prompts.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
端到端执行 `@~/.claude/get-shit-done/workflows/undo.md` 中的 undo 工作流。
</process>
