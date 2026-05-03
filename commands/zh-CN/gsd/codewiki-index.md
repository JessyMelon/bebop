---
name: gsd:codewiki-index
description: 将选中的 CodeWiki facts 索引到 .planning/intel/codewiki.json
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
将选中的 CodeWiki namespace 或多仓库 set 索引到 `.planning/intel/codewiki.json`，让 `/gsd-intel query` 可以搜索 durable CodeWiki facts。

该命令要求 `intel.enabled=true`。它只写 derived JSON；CodeWiki manifest、Git commit 和源码证据仍然是权威来源。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-index.md
</execution_context>

<context>
Arguments：$ARGUMENTS
</context>

<process>
执行 `@~/.claude/get-shit-done/workflows/codewiki-index.md` 中的 codewiki-index workflow。
</process>

