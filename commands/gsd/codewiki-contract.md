---
name: gsd:codewiki-contract
description: Create or register a set-level CodeWiki cross-repo contract
argument-hint: "<name> --set <set-id> --producer <repo-id> --consumers <repo-id,repo-id>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

<objective>
Create or register a set-level CodeWiki cross-repo contract document and link it from `wiki-set.yaml`.

This command writes scaffolding only. The resulting contract remains blocked until source paths, line ranges, producer evidence, and consumer evidence are filled from real code.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-contract.md
</execution_context>

<context>
Arguments: $ARGUMENTS
</context>

<process>
Execute the codewiki-contract workflow from `@~/.claude/get-shit-done/workflows/codewiki-contract.md`.
</process>
