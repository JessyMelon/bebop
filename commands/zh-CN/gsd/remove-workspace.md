---
name: gsd:remove-workspace
description: 删除 GSD 工作区并清理 worktree
argument-hint: "<workspace-name>"
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---
<context>
**Arguments:**
- `<workspace-name>` (required) — 要删除的工作区名称
</context>

<objective>
确认后删除工作区目录。若采用 worktree 策略，会先对每个成员仓库执行 `git worktree remove`。如果任何仓库存在未提交变更，则拒绝执行。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/remove-workspace.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<process>
端到端执行 @~/.claude/get-shit-done/workflows/remove-workspace.md 中的 remove-workspace workflow。
</process>
