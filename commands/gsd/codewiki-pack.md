---
name: gsd:codewiki-pack
description: Generate Repomix seed bundles for selected CodeWiki repos
argument-hint: "[--set <set-id>] [--repo <repo-id>|--repos <repo-id,repo-id>] [--style xml|markdown|json|plain] [--force] [--dry-run]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

<objective>
Generate Repomix seed bundles for the selected CodeWiki repo namespace or multi-repo set.

Repomix output is packed context only. It is not final CodeWiki evidence.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-pack.md
</execution_context>

<context>
Arguments: $ARGUMENTS
</context>

<process>
Execute the codewiki-pack workflow from `@~/.claude/get-shit-done/workflows/codewiki-pack.md`.
</process>
