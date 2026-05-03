---
name: gsd:codewiki-index
description: Index selected CodeWiki facts into .planning/intel/codewiki.json
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
Index the selected CodeWiki namespace or multi-repo set into `.planning/intel/codewiki.json` so `/gsd-intel query` can search durable CodeWiki facts.

This command requires `intel.enabled=true`. It writes derived JSON only; CodeWiki manifests, Git commits, and source evidence remain authoritative.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-index.md
</execution_context>

<context>
Arguments: $ARGUMENTS
</context>

<process>
Execute the codewiki-index workflow from `@~/.claude/get-shit-done/workflows/codewiki-index.md`.
</process>
