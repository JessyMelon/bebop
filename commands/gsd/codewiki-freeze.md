---
name: gsd:codewiki-freeze
description: Freeze a CodeWiki namespace or multi-repo set for a shipped version
argument-hint: "<version> [--set <set-id>] [--allow-unverified]"
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
Freeze one CodeWiki namespace or a full CodeWiki set for a shipped version.

Frozen namespaces and sets should reject normal incremental updates. Only review notes or explicit new namespaces should be used after freeze.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-freeze.md
</execution_context>

<context>
Arguments: $ARGUMENTS
</context>

<process>
Execute the codewiki-freeze workflow from `@~/.claude/get-shit-done/workflows/codewiki-freeze.md`.
</process>
