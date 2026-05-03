---
name: gsd:codewiki-deepwiki-export
description: Run or register DeepWiki exports for selected CodeWiki repos
argument-hint: "[--set <set-id>] [--repo <repo-id>|--repos <repo-id,repo-id>] [--command <template>|--register-existing] [--force] [--dry-run]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

<objective>
Run or register DeepWiki exports for the selected CodeWiki repo namespace or multi-repo set.

DeepWiki output is seed material only. It is not final CodeWiki evidence.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-deepwiki-export.md
</execution_context>

<context>
Arguments: $ARGUMENTS
</context>

<process>
Execute the codewiki-deepwiki-export workflow from `@~/.claude/get-shit-done/workflows/codewiki-deepwiki-export.md`.
</process>
