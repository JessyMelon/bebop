---
name: gsd:codewiki-select
description: 为当前 Git checkout 选择匹配的 CodeWiki 命名空间或多仓库 set
argument-hint: "[--set <set-id>]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

<objective>
为当前 Git checkout 选择正确的 CodeWiki namespace 或 CodeWiki set。

该命令只读，不得修改源码、CodeWiki 文件或 `.planning/`。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-select.md
</execution_context>

<context>
Arguments：$ARGUMENTS
</context>

<process>
执行 `@~/.claude/get-shit-done/workflows/codewiki-select.md` 中的 codewiki-select workflow。
</process>

