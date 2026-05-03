---
name: gsd:codewiki-init
description: Initialize a version-aware CodeWiki namespace or multi-repo CodeWiki set
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
Initialize CodeWiki files for the current repo/ref or for an explicit multi-repo set.

This command creates registry, manifest, set manifest, and starter wiki structure. It does not run DeepWiki automatically.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-init.md
</execution_context>

<context>
Arguments: $ARGUMENTS
</context>

<process>
Execute the codewiki-init workflow from `@~/.claude/get-shit-done/workflows/codewiki-init.md`.
</process>

