---
name: gsd:codewiki-project
description: 将选中的 CodeWiki context 投影到 .planning/codebase 供规划使用
argument-hint: "[--set <set-id>]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

<objective>
将选中的 CodeWiki namespace 或多仓库 set 投影到 `.planning/codebase/codewiki-summary.md`，供 planner 和 executor 使用。

该 projection 是一次性规划上下文。CodeWiki manifest、Git commit 和源码证据仍然是权威来源。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-project.md
</execution_context>

<context>
Arguments：$ARGUMENTS
</context>

<process>
执行 `@~/.claude/get-shit-done/workflows/codewiki-project.md` 中的 codewiki-project workflow。
</process>

