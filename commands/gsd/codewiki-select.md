---
name: gsd:codewiki-select
description: Select the matching CodeWiki namespace or multi-repo set for the current Git checkout
argument-hint: "[--set <set-id>]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

<objective>
Select the correct CodeWiki namespace or CodeWiki set for the current Git checkout.

This command is read-only. It must not modify source files, CodeWiki files, or `.planning/`.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-select.md
</execution_context>

<context>
Arguments: $ARGUMENTS
</context>

<process>
Execute the codewiki-select workflow from `@~/.claude/get-shit-done/workflows/codewiki-select.md`.
</process>

