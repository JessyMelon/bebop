---
name: gsd:list-workspaces
description: 列出活跃的 GSD workspaces 及其状态
allowed-tools:
  - Bash
  - Read
---
<objective>
扫描 `~/gsd-workspaces/` 中包含 `WORKSPACE.md` 清单的 workspace 目录。显示一张摘要表，包含名称、路径、仓库数量、策略和 GSD 项目状态。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/list-workspaces.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<process>
端到端执行 @~/.claude/get-shit-done/workflows/list-workspaces.md 中的 list-workspaces workflow。
</process>
