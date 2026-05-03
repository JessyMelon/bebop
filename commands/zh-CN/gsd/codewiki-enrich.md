---
name: gsd:codewiki-enrich
description: 用 codebase map 和源码证据丰富 repo CodeWiki baseline
argument-hint: "<repo-id> [--set <set-id>] [--pages <page,page>] [--profile <name>] [--focus <text>] [--sources <path,path>]"
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
从 `.planning/codebase/` map 和真实 source/config 证据中丰富已有 repo-level CodeWiki namespace。

适用于 `/gsd-map-codebase` 之后，或 starter CodeWiki 缺少 durable repo pages 的情况。该命令只在 canonical `coder-llm-wiki` taxonomy 内做 baseline enrichment，不用于代码变更后的 Git diff 维护。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-enrich.md
</execution_context>

<context>
Arguments：$ARGUMENTS
</context>

<process>
执行 `@~/.claude/get-shit-done/workflows/codewiki-enrich.md` 中的 codewiki-enrich workflow。
</process>
