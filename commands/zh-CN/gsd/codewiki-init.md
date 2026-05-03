---
name: gsd:codewiki-init
description: 初始化版本绑定的 CodeWiki 命名空间或多仓库 CodeWiki set
argument-hint: "[--set <set-id>] [--repos <paths>] [--repo-id <id>]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
---

<objective>
为当前 repo/ref 初始化 CodeWiki 文件，或创建显式的多仓库 CodeWiki set。

该命令会创建 registry、repo manifest、set manifest 和 starter wiki 结构。它不会自动运行 DeepWiki。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-init.md
</execution_context>

<context>
Arguments：$ARGUMENTS
</context>

<process>
执行 `@~/.claude/get-shit-done/workflows/codewiki-init.md` 中的 codewiki-init workflow。
</process>

