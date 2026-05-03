---
name: gsd:codewiki-update
description: Update CodeWiki from source diffs after verified code changes
argument-hint: "[--phase N|--milestone VERSION|--base SHA --head SHA] [--set <set-id>]"
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
Update CodeWiki from a verified code change in one repo or across a multi-repo set.

The update must be source-evidence driven. DeepWiki and Repomix outputs may be seed or context only; they are not final evidence.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-update.md
</execution_context>

<context>
Arguments: $ARGUMENTS
</context>

<process>
Execute the codewiki-update workflow from `@~/.claude/get-shit-done/workflows/codewiki-update.md`.
</process>

