---
name: gsd:codewiki-flow
description: Create or register a set-level CodeWiki cross-repo flow
argument-hint: "<name> --set <set-id> --repos <repo-id,repo-id>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

<objective>
Create or register a set-level CodeWiki cross-repo flow document and link it from `wiki-set.yaml`.

This command writes scaffolding only. The resulting flow remains blocked until every participating repo has source-backed evidence.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-flow.md
</execution_context>

<context>
Arguments: $ARGUMENTS
</context>

<process>
Execute the codewiki-flow workflow from `@~/.claude/get-shit-done/workflows/codewiki-flow.md`.
</process>
