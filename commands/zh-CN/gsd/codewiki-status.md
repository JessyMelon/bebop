---
name: gsd:codewiki-status
description: 展示 CodeWiki freshness、blocker、snapshot 和多仓库 set 状态
argument-hint: "[--set <set-id>]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

<objective>
展示当前 workspace 的 CodeWiki 健康状态。

该命令只读。它报告选中的 namespace 或 set、当前 commit、manifest commit、freshness 状态、最新 snapshot 和推荐下一步。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-status.md
</execution_context>

<context>
Arguments：$ARGUMENTS
</context>

<process>
执行 `@~/.claude/get-shit-done/workflows/codewiki-status.md` 中的 codewiki-status workflow。
</process>

