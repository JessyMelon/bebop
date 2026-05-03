---
name: gsd:codewiki-status
description: Show CodeWiki freshness, blockers, snapshots, and multi-repo set status
argument-hint: "[--set <set-id>]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

<objective>
Show CodeWiki health for the current workspace.

This command is read-only. It reports selected namespace or set, current commits, manifest commits, freshness state, latest snapshots, and recommended next actions.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-status.md
</execution_context>

<context>
Arguments: $ARGUMENTS
</context>

<process>
Execute the codewiki-status workflow from `@~/.claude/get-shit-done/workflows/codewiki-status.md`.
</process>

